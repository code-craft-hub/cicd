import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';

const config = new pulumi.Config();
const imageTag = config.require('imageTag');
const zone = config.get('zone') ?? 'us-central1-a';
const machineType = config.get('machineType') ?? 'e2-micro';

const shared = new pulumi.StackReference(config.require('sharedStack'));
const repositoryUrl = shared.requireOutput('repositoryUrl') as pulumi.Output<string>;
const vmServiceAccountEmail = shared.requireOutput('vmServiceAccountEmail') as pulumi.Output<string>;
const region = shared.requireOutput('region') as pulumi.Output<string>;

const imageUrl = pulumi.interpolate`${repositoryUrl}/fastify-hello-world:${imageTag}`;

// Container-Optimized OS runs this once at boot; production deploys force a
// reboot (see cd.yml) so an updated imageTag actually takes effect.
const startupScript = pulumi.interpolate`#!/bin/bash
set -e
docker-credential-gcr configure-docker --registries=${region}-docker.pkg.dev
docker rm -f fastify-app || true
docker run -d --restart=always --name fastify-app -p 3000:3000 ${imageUrl}
`;

const instance = new gcp.compute.Instance('fastify-vm', {
  name: `fastify-${pulumi.getStack()}`,
  machineType,
  zone,
  tags: ['fastify-app', 'iap-ssh'],
  bootDisk: {
    initializeParams: {
      image: 'projects/cos-cloud/global/images/family/cos-stable',
    },
  },
  networkInterfaces: [
    {
      network: 'default',
      accessConfigs: [{}],
    },
  ],
  serviceAccount: {
    email: vmServiceAccountEmail,
    scopes: ['cloud-platform'],
  },
  metadataStartupScript: startupScript,
  allowStoppingForUpdate: true,
});

export const instanceName = instance.name;
export const publicIp = instance.networkInterfaces.apply((ni) => ni[0]?.accessConfigs?.[0]?.natIp);
export const appUrl = pulumi.interpolate`http://${publicIp}:3000`;

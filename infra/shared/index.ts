import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';

const project = gcp.config.project!;
const gcpRegion = 'us-central1';

export const artifactRepo = new gcp.artifactregistry.Repository('fastify-repo', {
  repositoryId: 'fastify-repo',
  location: gcpRegion,
  format: 'DOCKER',
});

// App traffic: the demo serves plain HTTP on :3000, open to the world.
export const allowApp = new gcp.compute.Firewall('allow-fastify-app', {
  network: 'default',
  allows: [{ protocol: 'tcp', ports: ['3000'] }],
  sourceRanges: ['0.0.0.0/0'],
  targetTags: ['fastify-app'],
});

// SSH only via Identity-Aware Proxy's fixed source range - no public port 22.
export const allowIapSsh = new gcp.compute.Firewall('allow-iap-ssh', {
  network: 'default',
  allows: [{ protocol: 'tcp', ports: ['22'] }],
  sourceRanges: ['35.235.240.0/20'],
  targetTags: ['iap-ssh'],
});

// Minimal-privilege identity the VMs run as (separate from the CI deploy identity).
export const vmServiceAccount = new gcp.serviceaccount.Account('fastify-vm-sa', {
  accountId: 'fastify-vm-sa',
  displayName: 'Fastify VM runtime service account',
});

new gcp.projects.IAMMember('fastify-vm-sa-artifact-reader', {
  project,
  role: 'roles/artifactregistry.reader',
  member: pulumi.interpolate`serviceAccount:${vmServiceAccount.email}`,
});

export const region = gcpRegion;
export const repositoryUrl = pulumi.interpolate`${gcpRegion}-docker.pkg.dev/${project}/${artifactRepo.repositoryId}`;
export const vmServiceAccountEmail = vmServiceAccount.email;

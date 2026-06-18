# fastify-hello-world

Minimal Fastify + TypeScript "Hello World" API, built to demonstrate a
multi-stage Docker build and a CI/CD pipeline with a manual approval gate
between staging and production.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

## Test / build

```bash
npm run typecheck
npm test
npm run build
docker build -t fastify-hello-world .
```

## Pipeline

- [.github/workflows/ci.yml](.github/workflows/ci.yml) — runs on every PR and push to `main`: typecheck, tests, build, Docker build.
- [.github/workflows/cd.yml](.github/workflows/cd.yml) — runs on push to `main`: builds and pushes one image to Artifact Registry, provisions a fresh `staging` VM with Pulumi, then deploys to the persistent `production` VM, then tears `staging` back down.
- [.github/workflows/infra-shared.yml](.github/workflows/infra-shared.yml) — manually triggered; applies the persistent shared infra (Artifact Registry repo, firewall rules, VM service account).

The `deploy-production` job declares `environment: production`. If that
environment has required reviewers configured (see below), GitHub pauses the
job — it shows as **"Waiting for review"** in the Actions run — until someone
approves it. Nothing in the YAML can express this; it's a repo setting.

## Infrastructure (Pulumi on GCP)

Two Pulumi TypeScript projects under [infra/](infra/):

- [infra/shared](infra/shared) — Artifact Registry repo, firewall rules (app
  port 3000 public, SSH only via IAP), and the VM's runtime service account.
  Persistent; applied via the `infra-shared.yml` workflow, not on every push.
- [infra/compute](infra/compute) — a single Compute Engine VM (Container-Optimized
  OS) running the pushed image, parameterized by Pulumi stack. The `staging`
  stack is created fresh in every `cd.yml` run and destroyed once production
  succeeds; the `production` stack persists and is updated in place.

State is stored in Pulumi Cloud (free tier) rather than self-managed, so no
GCS backend bucket is needed.

## One-time setup

### 1. GCP — Workload Identity Federation

GitHub Actions authenticates to GCP project `cverai` via OIDC, no service
account keys involved. Run [infra/bootstrap/gcp-bootstrap.sh](infra/bootstrap/gcp-bootstrap.sh)
once, locally, while authenticated (`gcloud auth login`) as an owner/editor
on the project. It creates the Workload Identity pool/provider, a
`github-deployer` service account scoped to this repo only, and prints the
two values needed below.

### 2. GitHub repo configuration

**Secrets** (Settings → Secrets and variables → Actions → Secrets):

| Name | Value |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | printed by the bootstrap script |
| `GCP_SERVICE_ACCOUNT` | printed by the bootstrap script (`github-deployer@cverai.iam.gserviceaccount.com`) |
| `PULUMI_ACCESS_TOKEN` | a token from [app.pulumi.com/account/tokens](https://app.pulumi.com/account/tokens) |

The GCP project ID (`cverai`) is hardcoded in [cd.yml](.github/workflows/cd.yml)
and the `Pulumi.*.yaml` config files, so it doesn't need a repo setting.

Neither the provider path nor the service account email is actually
sensitive, but `google-github-actions/auth`'s inputs read most naturally as
secrets here and GitHub secrets work fine for non-secret values too — just
expect them masked as `***` in run logs.

### 3. Apply shared infra once

After the bootstrap script and the variables/secret above are in place, run
the **Infra (shared)** workflow manually (Actions tab → "Infra (shared)" →
Run workflow). This must succeed before the first `cd.yml` run, since the
compute stacks reference its outputs (Artifact Registry URL, VM service
account) via `pulumi.StackReference`.

### 4. Environment protection (the approval gate)

Settings → Environments → New environment → `production` →
check **Required reviewers** and add yourself/your team. Also create a
`staging` environment (no reviewers needed) so its job has somewhere to
target.

### 5. Branch protection / code review policy

Settings → Branches → Add rule for `main`:
- Require a pull request before merging
- Require review from Code Owners (enforces [.github/CODEOWNERS](.github/CODEOWNERS))
- Require status checks to pass (select the `CI / test` job)

Edit [.github/CODEOWNERS](.github/CODEOWNERS) to list real usernames/teams
instead of the placeholder.

Once all of the above is set, a merge to `main` will: run CI → build & push
the image → stand up a fresh staging VM and smoke-test it → **stop and
wait** for an approver to unblock `deploy-production` → deploy to the
persistent production VM → tear the staging VM back down.

### SSH access (debugging)

No public SSH port is open; tunnel through Identity-Aware Proxy instead:

```bash
gcloud compute ssh fastify-production --zone=us-central1-a --tunnel-through-iap
```

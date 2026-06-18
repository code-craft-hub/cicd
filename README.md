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
- [.github/workflows/cd.yml](.github/workflows/cd.yml) — runs on push to `main`: builds and pushes one image, deploys it to `staging`, then deploys to `production`.

The `deploy-production` job declares `environment: production`. If that
environment has required reviewers configured (see below), GitHub pauses the
job — it shows as **"Waiting for review"** in the Actions run — until someone
approves it. Nothing in the YAML can express this; it's a repo setting.

## One-time GitHub setup

These can't be stored as files in the repo — set them once after pushing:

1. **Environment protection (the approval gate)**
   Settings → Environments → New environment → `production` →
   check **Required reviewers** and add yourself/your team. Also create a
   `staging` environment (no reviewers needed) so its job has somewhere to
   target.

2. **Branch protection / code review policy**
   Settings → Branches → Add rule for `main`:
   - Require a pull request before merging
   - Require review from Code Owners (enforces [.github/CODEOWNERS](.github/CODEOWNERS))
   - Require status checks to pass (select the `CI / test` job)

3. Edit [.github/CODEOWNERS](.github/CODEOWNERS) to list real
   usernames/teams instead of the placeholder.

Once both are set, a merge to `main` will: run CI → build & push the image →
auto-deploy to staging → **stop and wait** for an approver to unblock
`deploy-production` before it reaches prod.

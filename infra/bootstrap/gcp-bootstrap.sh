#!/usr/bin/env bash
# One-time setup: creates a Workload Identity Federation pool/provider and a
# deploy service account so GitHub Actions can authenticate to GCP without
# any long-lived key. Run this once, locally, authenticated as an
# owner/editor on the target project (gcloud auth login).
set -euo pipefail

PROJECT_ID="cverai"
PROJECT_NUMBER="865996551693"
REPO="code-craft-hub/cicd"
POOL_ID="github-pool"
PROVIDER_ID="github-provider"
SA_NAME="github-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID"

gcloud services enable \
  iamcredentials.googleapis.com \
  compute.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com

# 1. Workload Identity Pool
gcloud iam workload-identity-pools create "$POOL_ID" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# 2. OIDC provider trusting GitHub Actions, restricted to this one repo
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub Actions Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '${REPO}'"

# 3. Deploy service account used by GitHub Actions
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="GitHub Actions Deployer"

# 4. Project roles the deploy SA needs to provision this demo's infra
for ROLE in \
  roles/compute.admin \
  roles/artifactregistry.admin \
  roles/iam.serviceAccountUser \
  roles/iam.serviceAccountAdmin
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE"
done

# 5. Allow only this GitHub repo to impersonate the deploy service account
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}"

echo
echo "Done. Add these as GitHub Actions repo VARIABLES (Settings > Secrets and variables > Actions > Variables):"
echo "  GCP_PROJECT_ID                 = ${PROJECT_ID}"
echo "  GCP_WORKLOAD_IDENTITY_PROVIDER  = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
echo "  GCP_SERVICE_ACCOUNT             = ${SA_EMAIL}"

# 5-Minute End-to-End Walkthrough Script

This script walks through the complete lifecycle of the Internal Developer Platform (IDP) in under 5 minutes:
1. **Developer Authentication & RBAC token exchange**
2. **Team Quota Discovery**
3. **Golden Path Service Scaffolding (Node.js Express template)**
4. **Environment Secret Management (AES-256-GCM encrypted vault)**
5. **GitOps Rollout Trigger & Deterministic State Machine Execution**
6. **Simulated Failure & Automatic Rollback**
7. **Grounded AI Infrastructure Advisory & Rightsizing Approval**
8. **Multi-file Terraform HCL Export**

---

## Prerequisites
Ensure the backend API and frontend portal are running:
```bash
# Terminal 1: Backend
npm run dev --workspace=@idp/api

# Terminal 2: Web UI
npm run dev --workspace=@idp/web
```
- API Base URL: `http://localhost:3000`
- Web Dashboard: `http://localhost:5173`
- Swagger OpenAPI Specs: `http://localhost:3000/docs`

---

## Step 1: Authentication & RBAC Login
Login as Lead Developer (`lead.platform@idp.internal`):

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lead.platform@idp.internal",
    "password": "Password123!"
  }' > login_response.json

# Extract Access Token
export TOKEN=$(cat login_response.json | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
echo "JWT Token: $TOKEN"
```

Verify authentication and role claims:
```bash
curl -s -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Step 2: Inspect Team Quotas
Check resource ceilings before onboarding workloads:
```bash
curl -s -X GET http://localhost:3000/api/v1/teams \
  -H "Authorization: Bearer $TOKEN" | jq .
```
Expected output shows `maxServices`, `maxCpuMillicores`, and `maxMemoryMb`.

---

## Step 3: Scaffold New Service from Golden Path Template
List available Golden Path templates:
```bash
curl -s -X GET http://localhost:3000/api/v1/templates \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Scaffold `payment-service` with 1-click auto-registration:
```bash
curl -s -X POST http://localhost:3000/api/v1/templates/node-express-tpl/scaffold \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "payment-service",
    "initialEnvironment": "dev",
    "autoRegister": true
  }' > scaffold_result.json

cat scaffold_result.json | jq .instructions
export SERVICE_ID=$(cat scaffold_result.json | grep -o '"serviceId":"[^"]*' | cut -d'"' -f4)
```

---

## Step 4: Add AES-256-GCM Encrypted Environment Secret
Store a sensitive database password:
```bash
# List environments for service
curl -s -X GET http://localhost:3000/api/v1/services/$SERVICE_ID \
  -H "Authorization: Bearer $TOKEN" | jq .environments

export ENV_ID=$(curl -s http://localhost:3000/api/v1/services/$SERVICE_ID -H "Authorization: Bearer $TOKEN" | jq -r '.environments[0].id')

# Create encrypted secret
curl -s -X POST http://localhost:3000/api/v1/environments/$ENV_ID/variables \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "DB_PASSWORD",
    "value": "SuperSecretProdDBKey2026!",
    "isSecret": true
  }' | jq .
```

Notice the response returns masked `••••••••••••`.
Reveal secrets (Lead/Admin privilege with immutable audit log):
```bash
curl -s -X GET http://localhost:3000/api/v1/environments/$ENV_ID/secrets/reveal \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Step 5: Trigger Microservice Deployment
Trigger deployment dispatch:
```bash
curl -s -X POST http://localhost:3000/api/v1/deployments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"serviceId\": \"$SERVICE_ID\",
    \"environmentId\": \"$ENV_ID\",
    \"imageTag\": \"v1.0.0\"
  }" > deploy_response.json

export DEPLOYMENT_ID=$(cat deploy_response.json | jq -r '.id')
echo "Deployment ID: $DEPLOYMENT_ID"
```

Inspect deployment state transitions:
```bash
curl -s -X GET http://localhost:3000/api/v1/deployments/$DEPLOYMENT_ID \
  -H "Authorization: Bearer $TOKEN" | jq '{id, status, events: .events}'
```

---

## Step 6: Test Simulated Failure & Rollback
Simulate a deployment failure (e.g. invalid image or crashloop):
```bash
# Trigger failing deployment
curl -s -X POST http://localhost:3000/api/v1/deployments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"serviceId\": \"$SERVICE_ID\",
    \"environmentId\": \"$ENV_ID\",
    \"imageTag\": \"crash-test-failing\"
  }" > fail_deploy.json

export FAIL_DEPLOY_ID=$(cat fail_deploy.json | jq -r '.id')

# Trigger Rollback
curl -s -X POST http://localhost:3000/api/v1/deployments/$FAIL_DEPLOY_ID/rollback \
  -H "Authorization: Bearer $TOKEN" | jq .
```
Notice:
1. Status transitions to `rolled_back`.
2. ReplicaSet reverts to prior known healthy revision.
3. Notification dispatched to Slack/Discord webhook and email.

---

## Step 7: AI Infrastructure Optimization (Grounded Advisory)
Generate AI resource sizing recommendations based on metrics:
```bash
curl -s -X POST http://localhost:3000/api/v1/services/$SERVICE_ID/recommendations \
  -H "Authorization: Bearer $TOKEN" | jq .

export REC_ID=$(curl -s http://localhost:3000/api/v1/services/$SERVICE_ID/recommendations -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
```

Review and Approve the recommendation:
```bash
curl -s -X POST http://localhost:3000/api/v1/recommendations/$REC_ID/approve \
  -H "Authorization: Bearer $TOKEN" | jq .
```
Environment CPU and RAM requests are automatically patched in the database, with full audit trail!

---

## Step 8: Export Multi-file Terraform HCL
Generate complete infrastructure as code for GCP or AWS:
```bash
# Generate Terraform HCL
curl -s -X POST http://localhost:3000/api/v1/services/$SERVICE_ID/terraform \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cloudProvider": "gcp",
    "environment": "prod",
    "enableDatabase": true,
    "enableStorage": true
  }' | jq '.files | keys'

# Download combined Terraform file
curl -s -X GET http://localhost:3000/api/v1/services/$SERVICE_ID/terraform/download \
  -H "Authorization: Bearer $TOKEN" -o infrastructure.tf

cat infrastructure.tf | head -n 40
```

---

## Step 9: Audit Trail Verification
Inspect immutable tamper-evident audit logs:
```bash
curl -s -X GET http://localhost:3000/api/v1/audit-log \
  -H "Authorization: Bearer $TOKEN" | jq .
```
Every single action taken during the demo (`SERVICE_SCAFFOLDED`, `REVEAL_SECRET`, `DEPLOY_SERVICE`, `ROLLBACK`, `APPROVE_RECOMMENDATION`) is immutably logged with timestamp, user ID, and full metadata payload.

---

## Conclusion
You have exercised all core capabilities of the Internal Developer Platform:
- Self-service Developer Portal with Golden Paths
- Fine-grained RBAC & Quotas
- Deterministic Deployment State Machine with Rollbacks
- Zero-Secret Policy with AES-256-GCM Encryption
- AI-driven Resource Rightsizing
- Full Infrastructure as Code via Terraform


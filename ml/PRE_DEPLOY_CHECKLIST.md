# Pre-Deployment Checklist - Zeno ML Service

Use this checklist before deploying to Render to ensure everything is ready.

## ☐ 1. Local Testing

### Train Models (if not done)
```bash
cd ml
python scripts/train_full_pipeline.py --synthetic
```

**Verify models exist:**
```bash
ls -lh data/artifacts/xgboost/
# Should show:
# - xgb_model.pkl
# - isolation_forest.pkl
# - feature_columns.json
# - scaler.pkl
```

### Test Service Locally
```bash
# Option 1: Direct Python
python start_ml_service.py

# Option 2: Docker (recommended - tests the actual deployment)
docker build -f Dockerfile.ml -t zeno-ml:test .
docker run -p 8001:8001 zeno-ml:test
```

### Verify Endpoints Work
```bash
# Health check
curl http://localhost:8001/health

# Model info
curl http://localhost:8001/ml/model-info

# Prediction test
curl -X POST http://localhost:8001/ml/predict \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": {
      "transaction_id": "test-123",
      "amount": 1000.0,
      "merchant_id": "merch-001",
      "payment_method": "CREDIT_CARD",
      "merchant_category": "RETAIL",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "customer_context": {
      "customer_id": "cust-001",
      "historical_transaction_count": 5
    }
  }'
```

**Expected response includes:**
- `fraud_probability` (0-1 range)
- `anomaly_score` (0-1 range)
- `risk_score` (0-100)
- `risk_level` (LOW/MEDIUM/HIGH/CRITICAL)
- `model_version`

## ☐ 2. Model Strategy Decision

Choose ONE strategy:

### [ ] Option A: Include Models in Docker Image
**Action items:**
- [ ] Models trained and verified locally
- [ ] Uncomment `COPY data/artifacts/ data/artifacts/` in `Dockerfile.ml`
- [ ] Test Docker build with models: `docker build -f Dockerfile.ml -t zeno-ml:test .`
- [ ] Verify image size is acceptable: `docker images zeno-ml:test`
- [ ] Commit models to Git (if repo is private and size is acceptable)

### [ ] Option B: Render Disk (Recommended for Production)
**Action items:**
- [ ] Models trained and saved locally
- [ ] Keep `Dockerfile.ml` as-is (don't include COPY line)
- [ ] Plan to create Render Disk after initial deployment
- [ ] Have upload strategy ready (SCP, Render Shell, or upload script)

### [ ] Option C: External Storage (S3/GCS)
**Action items:**
- [ ] S3/GCS bucket created and configured
- [ ] Upload models to bucket
- [ ] Modify `start_ml_service.py` to download models on startup
- [ ] AWS/GCP credentials configured in Render environment

## ☐ 3. Configuration Files

### Check render.yaml
- [ ] Service name is correct: `zeno-ml-service`
- [ ] Region is appropriate (default: `singapore`)
- [ ] Branch is correct (default: `main`)
- [ ] Instance type is suitable (default: `starter`)
- [ ] Environment variables are set correctly

### Check Dockerfile.ml
- [ ] Python version is 3.12
- [ ] All dependencies in requirements.txt
- [ ] Model copy line is correct for your strategy (commented/uncommented)
- [ ] Non-root user configured
- [ ] Health check port (8001) exposed

### Check .dockerignore
- [ ] Excludes unnecessary files (tests, docs, venv)
- [ ] Includes necessary files (src, requirements.txt)
- [ ] Model artifacts handling matches your strategy

## ☐ 4. GitHub Repository

### Push All Changes
```bash
git status  # Verify what will be committed

# Recommended commits:
git add ml/render.yaml ml/.dockerignore ml/.env.example
git commit -m "Add Render deployment configuration"

git add ml/DEPLOYMENT.md ml/QUICK_DEPLOY.md ml/RENDER_SUMMARY.md
git commit -m "Add deployment documentation"

# If including models in image:
git add ml/Dockerfile.ml ml/data/artifacts/
git commit -m "Include trained models in Docker image"

# Otherwise:
git add ml/Dockerfile.ml
git commit -m "Update Dockerfile with model strategy notes"

git push origin main
```

### Verify on GitHub
- [ ] All ML service files are pushed
- [ ] render.yaml is in ml/ directory
- [ ] Dockerfile.ml is correct
- [ ] Models are included if using Option A

## ☐ 5. Render Account Setup

### Account Preparation
- [ ] Render account created at https://render.com
- [ ] GitHub account connected to Render
- [ ] Payment method added (if using paid plans)
- [ ] Understand pricing: Starter ($7/mo), Standard ($25/mo)

### Access Verification
- [ ] Can access https://dashboard.render.com
- [ ] Can see your GitHub repositories
- [ ] Can create new services

## ☐ 6. Deployment Method Choice

Choose ONE method:

### [ ] Blueprint Deployment (Recommended)
**Steps:**
1. [ ] Dashboard → New + → Blueprint
2. [ ] Select your repository
3. [ ] Render detects ml/render.yaml
4. [ ] Review configuration
5. [ ] Click "Apply"

### [ ] Manual Deployment
**Steps:**
1. [ ] Dashboard → New + → Web Service
2. [ ] Connect GitHub repository
3. [ ] Configure manually:
   - Name: `zeno-ml-service`
   - Region: Singapore
   - Branch: main
   - Root Directory: `ml`
   - Environment: Docker
   - Dockerfile Path: `./Dockerfile.ml`
4. [ ] Add environment variables manually
5. [ ] Create Web Service

## ☐ 7. Post-Deployment Verification

### Wait for Deployment
- [ ] Monitor build logs in Render Dashboard
- [ ] Build completes successfully (5-10 minutes)
- [ ] Service shows "Live" status
- [ ] No error messages in logs

### Test Deployed Service
```bash
# Replace with your actual Render URL
RENDER_URL="https://zeno-ml-service.onrender.com"

# Health check
curl $RENDER_URL/health

# Model info (should return model details or 503 if models not loaded)
curl $RENDER_URL/ml/model-info

# Prediction test
curl -X POST $RENDER_URL/ml/predict \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": {
      "transaction_id": "test-render-001",
      "amount": 1500.0,
      "merchant_id": "merch-render-001",
      "payment_method": "CREDIT_CARD",
      "merchant_category": "RETAIL",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "customer_context": {
      "customer_id": "cust-render-001",
      "historical_transaction_count": 10
    }
  }'
```

### Expected Results
- [ ] `/health` returns 200 with `status: "UP"` or `status: "DEGRADED"` (if models not loaded)
- [ ] `/ml/model-info` returns model details OR 503 if models not ready
- [ ] `/ml/predict` returns predictions OR 503 if models not ready
- [ ] Response times < 2 seconds
- [ ] No errors in Render logs

## ☐ 8. Backend Integration

### Update Backend Configuration
In your backend's Render service, add/update environment variables:
```bash
ML_SERVICE_ENABLED=true
ML_SERVICE_URL=https://zeno-ml-service.onrender.com  # Use your actual URL
ML_SERVICE_TIMEOUT_SECONDS=10
```

### Redeploy Backend
- [ ] Backend automatically redeploys with new env vars
- [ ] Backend logs show ML service connection
- [ ] No ML service errors in backend logs

### Test End-to-End
- [ ] Create a test transaction via backend API
- [ ] Verify backend calls ML service
- [ ] Check risk assessment is returned
- [ ] Verify logs in both backend and ML service

## ☐ 9. Model Upload (If Using Render Disk)

Only if you chose **Option B: Render Disk**

### Create Render Disk
- [ ] Go to your ML service in Render Dashboard
- [ ] Navigate to "Disks" tab
- [ ] Click "Add Disk"
- [ ] Configure:
  - Name: `ml-models`
  - Mount Path: `/app/data/artifacts`
  - Size: 1GB (or larger if needed)
- [ ] Save and wait for disk to be created

### Upload Models
Choose one method:

**Method 1: Render Shell**
- [ ] Dashboard → Your Service → Shell
- [ ] Use SCP or similar to upload models

**Method 2: Temporary Upload Endpoint**
- [ ] Add upload endpoint to FastAPI app (temporarily)
- [ ] Upload via HTTP
- [ ] Remove endpoint after upload

**Method 3: Initialize from S3**
- [ ] Store models in S3
- [ ] Add one-time download script
- [ ] Run on first deployment

### Verify Models Loaded
```bash
# After upload, restart service and check
curl https://zeno-ml-service.onrender.com/ml/model-info
# Should return model details instead of 503
```

## ☐ 10. Monitoring Setup

### Configure Alerts (Optional but Recommended)
- [ ] Set up Render alerts for service downtime
- [ ] Configure alerts for high memory usage
- [ ] Set up alerts for high error rates

### Monitor Performance
- [ ] Check response times in Render metrics
- [ ] Monitor memory usage
- [ ] Review prediction logs
- [ ] Check for errors in logs

### Set Up Log Monitoring
- [ ] Configure log aggregation (optional)
- [ ] Set up log search/filtering
- [ ] Create dashboards for key metrics

## ☐ 11. Documentation

### Update Project Documentation
- [ ] Update README with ML service URL
- [ ] Document model update procedure
- [ ] Add architecture diagrams if needed
- [ ] Note any deployment gotchas

### Share with Team
- [ ] Share Render dashboard access (if applicable)
- [ ] Document environment variables
- [ ] Create runbook for common issues
- [ ] Document scaling procedures

## ☐ 12. Cost Optimization

### Review Current Setup
- [ ] Note current instance type
- [ ] Estimate monthly cost
- [ ] Plan for scaling

### Optimization Checklist
- [ ] Auto-sleep disabled for production (or enabled for dev)
- [ ] Right-sized instance for load
- [ ] Disk size appropriate (if using)
- [ ] Consider reserved instances for production

## ☐ 13. Security Review

### Access Control
- [ ] Consider adding API key authentication
- [ ] Review CORS settings if applicable
- [ ] Use HTTPS only (automatic on Render)
- [ ] Limit network access if possible

### Secrets Management
- [ ] No secrets in code or logs
- [ ] Environment variables properly set
- [ ] Database credentials secure
- [ ] API keys rotated regularly

## ☐ 14. Backup & Recovery

### Backup Strategy
- [ ] Model artifacts backed up (local or S3)
- [ ] Configuration files in version control
- [ ] Recovery procedure documented
- [ ] Test restore procedure

## Summary

Before deploying, ensure:
1. ✅ Local testing complete and passing
2. ✅ Model strategy chosen and implemented
3. ✅ All configuration files correct
4. ✅ Code pushed to GitHub
5. ✅ Render account ready
6. ✅ Deployment method chosen

After deploying, verify:
1. ✅ Service is live and healthy
2. ✅ Endpoints responding correctly
3. ✅ Backend integration working
4. ✅ Models loaded (or plan for upload complete)
5. ✅ Monitoring configured

## Quick Status Check

Run this command to verify everything is ready locally:

```bash
#!/bin/bash
echo "=== Zeno ML Pre-Deployment Check ==="
echo ""

# Check if models exist
if [ -d "data/artifacts/xgboost" ]; then
    echo "✅ Model directory exists"
    if [ -f "data/artifacts/xgboost/xgb_model.pkl" ]; then
        echo "✅ XGBoost model found"
    else
        echo "❌ XGBoost model missing"
    fi
else
    echo "❌ Model directory not found"
fi

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed"
else
    echo "⚠️  Docker not found (needed for local testing)"
fi

# Check if git status is clean
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ Git working directory is clean"
else
    echo "⚠️  Uncommitted changes exist"
fi

# Check if render.yaml exists
if [ -f "render.yaml" ]; then
    echo "✅ render.yaml exists"
else
    echo "❌ render.yaml not found"
fi

echo ""
echo "=== Ready to deploy! ==="
```

Save this as `check_deploy.sh`, make it executable with `chmod +x check_deploy.sh`, and run it!

---

**Good luck with your deployment!** 🚀

For any issues, refer to:
- `DEPLOYMENT.md` - Full detailed guide
- `QUICK_DEPLOY.md` - Quick reference
- `RENDER_SUMMARY.md` - Overview and decisions

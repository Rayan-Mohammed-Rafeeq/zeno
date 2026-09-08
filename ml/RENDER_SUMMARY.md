# Render Deployment - ML Service Summary

## What We've Set Up

I've prepared everything you need to deploy the Zeno ML service to Render. Here's what was created:

### 1. Core Deployment Files

| File | Purpose |
|------|---------|
| `render.yaml` | Infrastructure as Code - defines the ML service configuration for Render |
| `Dockerfile.ml` | Already existed - Docker image configuration for the ML service |
| `.dockerignore` | Excludes unnecessary files from Docker image (faster builds, smaller images) |
| `.env.example` | Template for environment variables |

### 2. Documentation

| File | Purpose |
|------|---------|
| `DEPLOYMENT.md` | Complete, detailed deployment guide with all options and troubleshooting |
| `QUICK_DEPLOY.md` | TL;DR version - get deployed in 5 minutes |
| `RENDER_SUMMARY.md` | This file - overview of what was set up |

## Quick Start

### Option 1: Blueprint Deployment (Recommended - Fastest)

```bash
# 1. Push to GitHub
git add ml/
git commit -m "Add Render deployment configuration for ML service"
git push

# 2. Go to Render Dashboard
# https://dashboard.render.com

# 3. New + → Blueprint → Select your repo
# Render will automatically detect ml/render.yaml

# 4. Click "Apply"
# Done! Service will deploy automatically
```

### Option 2: Manual Deployment

Follow the step-by-step guide in `QUICK_DEPLOY.md`

## Key Decisions You Need to Make

### 1. Model Storage Strategy

You need to decide how to handle trained models:

#### Option A: Include in Docker Image (Simplest)
- ✅ Best for: Small models, getting started quickly
- ✅ No additional setup needed
- ❌ Rebuilds image on every model update
- **Action Required**: 
  1. Train models: `python scripts/train_full_pipeline.py --synthetic`
  2. Uncomment in `Dockerfile.ml`: `COPY data/artifacts/ data/artifacts/`
  3. Commit and push models

#### Option B: Render Disk (Recommended for Production)
- ✅ Best for: Production use, frequent model updates
- ✅ Models persist across deployments
- ❌ Additional cost (~$0.25/GB/month)
- ❌ Requires manual setup
- **Action Required**: 
  1. Create Render Disk after initial deployment
  2. Upload models to disk
  3. See `DEPLOYMENT.md` for detailed steps

#### Option C: External Storage (Advanced)
- ✅ Best for: Multi-region, advanced scenarios
- ✅ Versioned, scalable
- ❌ Most complex setup
- **Action Required**: Modify startup script to download from S3/GCS

### 2. Instance Size

| Plan | RAM | CPU | Cost | Best For |
|------|-----|-----|------|----------|
| **Starter** | 512MB | 0.5 | $7/mo | Development, testing, low traffic |
| **Standard** | 2GB | 1 | $25/mo | Production, moderate traffic |
| **Pro** | 4GB | 2 | $85/mo | High traffic, large models |

**Recommendation**: Start with Starter, upgrade to Standard for production.

## Configuration Summary

### Environment Variables Set in render.yaml

```yaml
ZENO_MODEL_DIR: /app/data/artifacts/xgboost
ML_SERVICE_HOST: 0.0.0.0
ML_SERVICE_PORT: 8001
LOG_LEVEL: INFO
PYTHONPATH: /app/src
```

### Service Configuration

```yaml
Name: zeno-ml-service
Region: Singapore
Docker: Dockerfile.ml
Health Check: /health
Instance: Starter (upgradeable)
Auto-deploy: On push to main branch
```

## Integration with Backend

After ML service is deployed, update your backend's Render environment variables:

```bash
ML_SERVICE_ENABLED=true
ML_SERVICE_URL=https://zeno-ml-service.onrender.com
ML_SERVICE_TIMEOUT_SECONDS=10
```

The backend will automatically start using the ML service for risk assessments.

## Endpoints

Once deployed, your ML service will have these endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check (used by Render) |
| `/ml/model-info` | GET | Model metadata |
| `/ml/predict` | POST | Single transaction prediction |
| `/ml/batch-predict` | POST | Batch predictions (up to 1000) |
| `/ml/monitoring/health` | GET | Monitoring statistics |
| `/docs` | GET | Swagger/OpenAPI documentation |

## Verification Steps

After deployment, test these:

### 1. Health Check
```bash
curl https://zeno-ml-service.onrender.com/health
```

Expected:
```json
{
  "status": "UP",
  "model_status": "READY",
  "model_version": "v1.0.0"
}
```

### 2. Model Info
```bash
curl https://zeno-ml-service.onrender.com/ml/model-info
```

### 3. Prediction
```bash
curl -X POST https://zeno-ml-service.onrender.com/ml/predict \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": {
      "transaction_id": "test-123",
      "amount": 1000.0,
      "merchant_id": "merch-001",
      "payment_method": "CREDIT_CARD"
    },
    "customer_context": {
      "customer_id": "cust-001",
      "historical_transaction_count": 5
    }
  }'
```

## Common Issues & Solutions

### Issue: 503 Service Unavailable on /ml/predict

**Cause**: Models not loaded

**Solution**: 
- Check logs: Render Dashboard → Your Service → Logs
- Look for: "Model artefacts not found"
- Ensure models are available (see Model Storage Strategy above)

### Issue: Build Fails

**Cause**: Missing dependencies or incorrect paths

**Solution**:
```bash
# Test locally first
cd ml
docker build -f Dockerfile.ml -t zeno-ml:test .
```

### Issue: Out of Memory

**Cause**: Model too large for instance

**Solution**:
- Upgrade to Standard instance (2GB RAM)
- Or optimize model size

## Cost Estimate

### Minimal Setup (Development)
- ML Service (Starter): **$7/month**
- Backend (Starter): **$7/month**
- Database (Neon Free): **$0/month**
- **Total: ~$14/month**

### Production Setup
- ML Service (Standard): **$25/month**
- Backend (Standard): **$25/month**
- Database (Neon Scale): **$19/month**
- Render Disk (1GB): **$0.25/month**
- **Total: ~$69/month**

## Next Steps

1. ✅ **Choose model storage strategy** (see above)
2. ✅ **Review render.yaml** - make sure region and plan are correct
3. ✅ **Push to GitHub**
4. ✅ **Deploy via Blueprint** or manual setup
5. ✅ **Verify deployment** with health checks
6. ✅ **Update backend** environment variables
7. ✅ **Test end-to-end** integration
8. ✅ **Monitor** performance and logs

## Support & Resources

- **Detailed Guide**: See `DEPLOYMENT.md`
- **Quick Reference**: See `QUICK_DEPLOY.md`
- **Render Docs**: https://render.com/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com

## File Structure

```
ml/
├── render.yaml              # ← Render configuration (new)
├── Dockerfile.ml            # ← Docker image definition (existing)
├── .dockerignore            # ← Build optimization (new)
├── .env.example             # ← Environment template (new)
├── DEPLOYMENT.md            # ← Full deployment guide (new)
├── QUICK_DEPLOY.md          # ← Quick start guide (new)
├── RENDER_SUMMARY.md        # ← This file (new)
├── requirements.txt         # ← Python dependencies
├── start_ml_service.py      # ← Service entry point
├── src/                     # ← ML service code
│   └── zeno_ml/
│       └── inference/
│           └── app.py       # ← FastAPI application
└── data/
    └── artifacts/           # ← Trained models (you need to add)
        └── xgboost/
            ├── xgb_model.pkl
            ├── isolation_forest.pkl
            ├── feature_columns.json
            └── scaler.pkl
```

## Ready to Deploy?

You have everything you need! Choose your deployment method and follow the guide.

**Recommended path for first-time deployment:**
1. Use **Option A** (include models in Docker) for simplicity
2. Use **Blueprint deployment** for ease
3. Start with **Starter instance** to minimize cost
4. Upgrade to **Standard + Render Disk** once you're comfortable

Good luck! 🚀

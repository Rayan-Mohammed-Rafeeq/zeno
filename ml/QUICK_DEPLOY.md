# Quick Deploy Guide - Zeno ML Service on Render

## TL;DR

```bash
# 1. Train models locally (if not done)
python scripts/train_full_pipeline.py --synthetic

# 2. Test Docker build locally
docker build -f Dockerfile.ml -t zeno-ml:test .
docker run -p 8001:8001 zeno-ml:test

# 3. Test the service
curl http://localhost:8001/health

# 4. Push to GitHub
git add .
git commit -m "Prepare ML service for Render deployment"
git push

# 5. Deploy on Render
# - Go to https://dashboard.render.com
# - New + → Blueprint
# - Connect repo → Apply ml/render.yaml
```

## Method 1: Blueprint (Fastest)

1. **Push code**:
   ```bash
   git push
   ```

2. **In Render Dashboard**:
   - Click **"New +"** → **"Blueprint"**
   - Select your repository
   - Render detects `ml/render.yaml`
   - Click **"Apply"**

3. **Done!** Service deploys automatically.

## Method 2: Manual Setup

1. **Create Web Service**:
   - Dashboard → **"New +"** → **"Web Service"**
   - Connect GitHub repo

2. **Configure**:
   ```
   Name: zeno-ml-service
   Region: Singapore
   Branch: main
   Root Directory: ml
   Environment: Docker
   Dockerfile: ./Dockerfile.ml
   Instance: Starter
   ```

3. **Environment Variables**:
   ```bash
   ZENO_MODEL_DIR=/app/data/artifacts/xgboost
   ML_SERVICE_HOST=0.0.0.0
   ML_SERVICE_PORT=8001
   LOG_LEVEL=INFO
   ```

4. **Create & Deploy**

## Handling Models

### Option A: Include in Docker (Simplest)

1. **Uncomment in Dockerfile.ml**:
   ```dockerfile
   COPY data/artifacts/ data/artifacts/
   ```

2. **Train & commit**:
   ```bash
   python scripts/train_full_pipeline.py --synthetic
   git add data/artifacts/
   git commit -m "Add trained models"
   git push
   ```

### Option B: Render Disk (Recommended)

1. **Create Disk** in Render Dashboard:
   - Service → Disks → Add Disk
   - Name: `ml-models`
   - Mount: `/app/data/artifacts`
   - Size: 1GB

2. **Upload models** via Render Shell or SCP

## Connect Backend

In backend's Render service, set:

```bash
ML_SERVICE_ENABLED=true
ML_SERVICE_URL=https://zeno-ml-service.onrender.com
ML_SERVICE_TIMEOUT_SECONDS=10
```

## Test Deployment

```bash
# Health check
curl https://zeno-ml-service.onrender.com/health

# Prediction test
curl -X POST https://zeno-ml-service.onrender.com/ml/predict \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "test-123",
    "amount": 1000.0,
    "merchant_id": "merch-001",
    "customer_id": "cust-001",
    "transaction_type": "PURCHASE"
  }'
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 503 on /ml/predict | Models not loaded - check logs for model path |
| Out of memory | Upgrade to Standard instance (2GB RAM) |
| Build fails | Test locally: `docker build -f Dockerfile.ml .` |
| Slow response | Upgrade instance or optimize model |

## Cost

- **Starter**: $7/month (512MB RAM) - Good for dev/testing
- **Standard**: $25/month (2GB RAM) - Recommended for production
- **Disk**: +$0.25/GB/month (if using Render Disks)

## Next Steps

1. ✅ Deploy ML service
2. ✅ Update backend environment variables
3. ✅ Test integration end-to-end
4. ✅ Monitor logs and performance
5. ✅ Scale as needed

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

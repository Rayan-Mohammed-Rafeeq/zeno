# Zeno ML Service Deployment Guide - Render

## Overview

This guide walks you through deploying the Zeno ML Service to Render. The ML service is a FastAPI-based microservice that provides fraud risk prediction using XGBoost models.

## Prerequisites

1. **Render Account**
   - Sign up at https://render.com

2. **Trained Models**
   - Models need to be available in the service
   - Options: 
     - Train models locally and include in Docker image
     - Mount models from external storage
     - Use Render Disks for persistent storage

3. **GitHub Repository**
   - Code pushed to GitHub with ML service

## Architecture

```
┌─────────────────┐
│  Zeno Backend   │
│   (Java/Spring) │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  ML Service     │
│  (FastAPI)      │
│  Port: 8001     │
└─────────────────┘
```

## Deployment Options

### Option 1: Using render.yaml (Recommended)

The included `render.yaml` file provides Infrastructure as Code.

1. **Push to GitHub**
   ```bash
   git add ml/render.yaml
   git commit -m "Add ML service Render configuration"
   git push
   ```

2. **Create Blueprint in Render**
   - Go to https://dashboard.render.com
   - Click **"New +"** → **"Blueprint"**
   - Connect your GitHub repository
   - Select the repository
   - Render will detect `ml/render.yaml`
   - Click **"Apply"**

### Option 2: Manual Setup

1. **Create Web Service**
   - Go to https://dashboard.render.com
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository

2. **Configure Service**
   - **Name**: `zeno-ml-service`
   - **Region**: Singapore (or closest to your backend)
   - **Branch**: `main`
   - **Root Directory**: `ml`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `./Dockerfile.ml`
   - **Docker Context**: `.`
   - **Instance Type**: `Starter` (512MB RAM, 0.5 CPU)

3. **Set Environment Variables**
   ```bash
   ZENO_MODEL_DIR=/app/data/artifacts/xgboost
   ML_SERVICE_HOST=0.0.0.0
   ML_SERVICE_PORT=8001
   LOG_LEVEL=INFO
   PYTHONPATH=/app/src
   ```

4. **Deploy**
   - Click **"Create Web Service"**
   - Wait for build and deployment (5-10 minutes)

## Model Management

### Challenge: Persistent Model Storage

Docker containers on Render are ephemeral, so trained models need persistent storage.

### Solution 1: Include Models in Docker Image (Simple)

**Best for**: Small models (<100MB), infrequent updates

1. **Train models locally**
   ```bash
   cd ml
   python scripts/train_full_pipeline.py --synthetic
   ```

2. **Modify Dockerfile.ml to copy models**
   ```dockerfile
   # Add after copying source code
   COPY data/artifacts/ data/artifacts/
   ```

3. **Commit and push**
   ```bash
   git add ml/data/artifacts/
   git commit -m "Add trained models"
   git push
   ```

**Pros**: Simple, no external dependencies
**Cons**: Rebuilds entire image on model updates, increases image size

### Solution 2: Render Disks (Recommended for Production)

**Best for**: Large models, frequent updates, production use

1. **Create a Render Disk**
   - In Render Dashboard, go to your ML service
   - Click **"Disks"** tab
   - Click **"Add Disk"**
   - **Name**: `ml-models`
   - **Mount Path**: `/app/data/artifacts`
   - **Size**: 1GB (adjust based on model size)

2. **Upload Models to Disk**
   
   After deployment, use Render Shell or a one-time upload script:
   
   ```bash
   # Option A: Use Render Shell
   # Go to Render Dashboard → Your Service → Shell
   # Upload models via SCP or similar
   
   # Option B: Create upload endpoint (temporary)
   # Add to your FastAPI app for one-time use
   ```

3. **Update Dockerfile.ml**
   ```dockerfile
   # Remove the mkdir for artifacts (will be mounted)
   # Keep the rest as-is
   ```

**Pros**: Persistent storage, separate from container, easy updates
**Cons**: Additional cost (~$0.25/GB/month), setup complexity

### Solution 3: External Storage (S3, GCS, etc.)

**Best for**: Multi-region deployments, advanced setups

1. **Store models in S3/GCS**
2. **Download on startup**
   
   Modify `start_ml_service.py`:
   ```python
   # Add before uvicorn.run()
   if not artefacts_exist:
       logger.info("Downloading models from S3...")
       # Add S3 download logic
       import boto3
       # ... download code
   ```

3. **Set AWS credentials in Render**

**Pros**: Scalable, versioned, multi-region
**Cons**: Complex, external dependency, network latency on startup

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `ZENO_MODEL_DIR` | `/app/data/artifacts/xgboost` | Directory containing trained models |
| `ML_SERVICE_HOST` | `0.0.0.0` | Host to bind the service |
| `ML_SERVICE_PORT` | `8001` | Port to bind the service |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `PYTHONPATH` | `/app/src` | Python module search path |

## Health Checks

The ML service exposes health endpoints:

- **Health**: `GET /health`
- **Readiness**: `GET /ml/ready` (checks if models are loaded)

Render uses `/health` for automatic health checking.

## Connecting Backend to ML Service

Once deployed, update your backend configuration:

1. **Get ML Service URL**
   - In Render Dashboard, copy the service URL
   - Example: `https://zeno-ml-service.onrender.com`

2. **Update Backend Environment Variables**
   
   In your backend's Render service:
   ```bash
   ML_SERVICE_ENABLED=true
   ML_SERVICE_URL=https://zeno-ml-service.onrender.com
   ML_SERVICE_TIMEOUT_SECONDS=10
   ```

3. **Redeploy Backend**
   - Backend will automatically redeploy with new env vars

## Testing Deployment

### 1. Health Check

```bash
curl https://zeno-ml-service.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "version": "0.1.0"
}
```

### 2. Prediction Test

```bash
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

### 3. From Backend

Check backend logs to see ML service integration:
```
[ML] Calling ML service for risk assessment...
[ML] Risk score: 0.234 (low risk)
```

## Monitoring & Logs

### View Logs

1. Go to Render Dashboard → Your ML Service
2. Click **"Logs"** tab
3. Monitor for errors or performance issues

### Key Metrics to Monitor

- **Response Time**: Should be <2 seconds for predictions
- **Memory Usage**: Monitor for memory leaks
- **CPU Usage**: Check if CPU-bound during predictions
- **Model Load Time**: Should load in <10 seconds on startup

### Troubleshooting

#### Service Returns 503 on /ml/predict

**Cause**: Models not loaded

**Solution**:
```bash
# Check logs for:
"Model artefacts not found in /app/data/artifacts/xgboost"

# Verify model files exist:
# - xgb_model.pkl
# - isolation_forest.pkl
# - feature_columns.json
# - scaler.pkl
```

#### Out of Memory Errors

**Cause**: Model too large for instance

**Solution**:
- Upgrade to Standard instance (2GB RAM)
- Or optimize model size
- Or use model quantization

#### Slow Predictions

**Cause**: CPU bottleneck

**Solution**:
- Upgrade instance type
- Batch predictions if possible
- Consider async processing

#### Build Fails

**Cause**: Missing dependencies or incorrect paths

**Solution**:
```bash
# Test Docker build locally
cd ml
docker build -f Dockerfile.ml -t zeno-ml:test .
docker run -p 8001:8001 zeno-ml:test
```

## Security Considerations

### 1. API Authentication

The ML service currently has no authentication. For production:

**Option A**: Use API Keys
```python
# Add to FastAPI app
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != os.getenv("ML_SERVICE_API_KEY"):
        raise HTTPException(status_code=403, detail="Invalid API key")
```

**Option B**: Network-level restrictions
- Use Render's private networking (requires paid plan)
- Or implement IP allowlisting

### 2. Rate Limiting

Add rate limiting to prevent abuse:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
```

### 3. HTTPS Only

Render provides HTTPS by default. Ensure your backend uses HTTPS URLs.

## Cost Optimization

### Starter Instance ($7/month)
- **RAM**: 512 MB
- **CPU**: 0.5 CPU
- **Good for**: Development, testing, low traffic
- **Predictions**: ~50-100 per minute

### Standard Instance ($25/month)
- **RAM**: 2 GB
- **CPU**: 1 CPU
- **Good for**: Production, moderate traffic
- **Predictions**: ~200-500 per minute

### Pro Instance ($85/month)
- **RAM**: 4 GB
- **CPU**: 2 CPU
- **Good for**: High traffic, large models
- **Predictions**: ~1000+ per minute

### Cost-Saving Tips

1. **Use Starter for Dev**: Keep development on Starter
2. **Sleep Services**: Enable auto-sleep for unused services
3. **Optimize Models**: Use smaller models when possible
4. **Batch Processing**: Group predictions to reduce overhead
5. **Caching**: Cache predictions for identical inputs

## Scaling Strategies

### Horizontal Scaling

Render auto-scales based on traffic (on paid plans):
1. Go to Service Settings → **"Scaling"**
2. Set **"Min instances"** and **"Max instances"**
3. Render adds instances during high load

### Vertical Scaling

Upgrade instance size:
1. Go to Service Settings → **"Instance Type"**
2. Select larger instance
3. Service redeploys automatically

### Async Processing

For high-volume scenarios:
1. Use message queue (RabbitMQ, Redis)
2. Backend pushes prediction requests to queue
3. ML service processes queue asynchronously
4. Results stored in DB or returned via webhook

## CI/CD

### Auto-Deploy on Push

Render automatically redeploys when you push to the connected branch:

```bash
git add ml/
git commit -m "Update ML models"
git push
```

### Preview Environments

Create preview environments for PRs:
1. Enable in Render Dashboard → Service Settings
2. Each PR gets a unique URL
3. Test before merging to main

## Production Checklist

- [ ] Models trained and uploaded
- [ ] Health checks passing
- [ ] Backend successfully connecting to ML service
- [ ] Prediction endpoints tested
- [ ] Logs reviewed for errors
- [ ] Response times acceptable (<2s)
- [ ] Memory usage stable
- [ ] API authentication configured (if needed)
- [ ] Rate limiting enabled (if needed)
- [ ] Monitoring alerts set up
- [ ] Cost estimates reviewed
- [ ] Backup strategy for models defined
- [ ] Documentation updated

## Alternative: Docker Compose (Local Development)

For local testing before deploying:

```yaml
# docker-compose.yml
version: '3.8'
services:
  ml-service:
    build:
      context: ./ml
      dockerfile: Dockerfile.ml
    ports:
      - "8001:8001"
    volumes:
      - ./ml/data/artifacts:/app/data/artifacts:ro
    environment:
      - ZENO_MODEL_DIR=/app/data/artifacts/xgboost
      - ML_SERVICE_HOST=0.0.0.0
      - ML_SERVICE_PORT=8001
      - LOG_LEVEL=DEBUG
```

Run with:
```bash
docker-compose up ml-service
```

## Support & Resources

- **Render Docs**: https://render.com/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **XGBoost Docs**: https://xgboost.readthedocs.io
- **MLflow Docs**: https://mlflow.org/docs

## Summary

You've learned how to:
1. ✅ Deploy ML service to Render using Docker
2. ✅ Manage model persistence with different strategies
3. ✅ Connect backend to ML service
4. ✅ Monitor and troubleshoot the service
5. ✅ Secure and optimize for production
6. ✅ Scale based on traffic needs

**Next Steps**:
1. Choose a model storage strategy
2. Deploy the service
3. Update backend configuration
4. Test end-to-end integration
5. Monitor and optimize performance

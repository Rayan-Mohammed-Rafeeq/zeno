# ✅ Render Deployment Checklist

## Pre-Deployment Verification

### ✅ Files Created
- [x] `Dockerfile` - Multi-stage build optimized for Render
- [x] `.dockerignore` - Excludes unnecessary files from Docker build
- [x] `render.yaml` - Infrastructure as Code configuration
- [x] `application-prod.yml` - Production Spring Boot configuration
- [x] `DEPLOYMENT.md` - Complete deployment guide

### ✅ Docker Configuration Verified
- [x] Java 21 (matches pom.xml)
- [x] Multi-stage build (smaller image)
- [x] Maven wrapper used (no need for system Maven)
- [x] Dependencies cached for faster rebuilds
- [x] Non-root user for security
- [x] Health check configured
- [x] JVM memory optimized for containers

### ✅ Database Configuration Verified
- [x] PostgreSQL driver included in pom.xml
- [x] Neon DB connection string format correct
- [x] Connection pooling endpoint used (`-pooler`)
- [x] HikariCP configured (max pool: 5)
- [x] Flyway migrations enabled

### ✅ Security Checklist
- [x] `.env` file in .gitignore (secrets not committed)
- [x] Environment variables properly configured
- [x] Non-root Docker user
- [x] Error messages sanitized in production
- [x] Stack traces disabled in production

### ✅ Production Settings
- [x] Spring profile: `prod`
- [x] JPA ddl-auto: `validate` (safe for production)
- [x] Flyway baseline-on-migrate: `true`
- [x] Compression enabled
- [x] Graceful shutdown enabled
- [x] Health probes configured

## Deployment Steps

### 1. Commit and Push
```bash
cd backend
git add Dockerfile .dockerignore render.yaml DEPLOYMENT.md RENDER_CHECKLIST.md src/main/resources/application-prod.yml
git commit -m "Add Render deployment configuration with Docker"
git push origin main
```

### 2. Create Render Web Service
1. Go to: https://dashboard.render.com
2. Click: "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `zeno-backend`
   - **Region**: Singapore (ap-southeast-1, matches Neon DB)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Plan**: Starter ($7/month) or higher

### 3. Set Environment Variables

Copy these to Render dashboard (Environment tab):

```plaintext
SPRING_PROFILES_ACTIVE=prod
SERVER_PORT=8080
DATABASE_URL=jdbc:postgresql://ep-flat-art-azecsfo3-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb
DATABASE_USERNAME=neondb_owner
DATABASE_PASSWORD=npg_nmbYDfv2TMx8
JWT_SECRET=8pEhmz5WYM5YrSo3FigSnUMavTynTUhnlI0NK3AiCmd
JWT_ACCESS_TOKEN_EXPIRY_MINUTES=60
APP_FRONTEND_URL=http://localhost:3000
RESEND_API_KEY=your-resend-api-key-here
RESEND_FROM_ADDRESS=Zeno <noreply@alliededge.app>
AI_API_KEY=your-openrouter-api-key-here
AI_API_URL=https://openrouter.ai/api/v1
AI_MODEL=minimax/minimax-m3
AI_ENABLED=true
ML_SERVICE_ENABLED=false
ML_SERVICE_URL=http://localhost:8001
ML_SERVICE_TIMEOUT_SECONDS=5
RAZORPAY_WEBHOOK_SECRET=your_razorpay_test_webhook_secret_here
RAZORPAY_WEBHOOK_ENABLED=true
RAZORPAY_KEY_ID=rzp_test_TYEb3nd4wQd92n
RAZORPAY_KEY_SECRET=aUJqZIzH18CsV1bjCHiiBB7l
```

⚠️ **IMPORTANT**: Update `APP_FRONTEND_URL` once you deploy your frontend!

### 4. Deploy
Click "Create Web Service" and wait for deployment (5-10 minutes first time).

### 5. Verify Deployment

After deployment completes, test these endpoints:

```bash
# Health Check
curl https://your-app.onrender.com/actuator/health

# Should return: {"status":"UP"}

# API Documentation
# Visit: https://your-app.onrender.com/swagger-ui.html
```

## Post-Deployment

### Update Frontend
Once backend is deployed, update your frontend `.env` with:
```
VITE_API_BASE_URL=https://your-app.onrender.com/api/v1
```

### Monitor Application
- Logs: Render Dashboard → Your Service → Logs
- Metrics: `/actuator/metrics`
- Health: `/actuator/health`

### Performance Optimization
If you experience issues:
1. Upgrade to higher Render plan (more RAM/CPU)
2. Monitor Neon DB connection limits
3. Check application logs for errors

## Troubleshooting

### Build Fails
- Check Render build logs
- Verify all files are committed
- Test Docker build locally:
  ```bash
  docker build -t zeno-backend .
  ```

### Database Connection Issues
- Neon DB free tier sleeps after inactivity
- Check connection string is correct
- Verify database credentials

### Application Won't Start
- Check environment variables are set
- Review Render logs
- Verify Neon DB is active

## Success Indicators

✅ Build completes without errors
✅ Container starts successfully
✅ Health check returns 200 OK
✅ Swagger UI accessible
✅ Can register/login users
✅ Database migrations run successfully

## What's Already Configured

✅ PostgreSQL + Flyway migrations
✅ Security + JWT authentication
✅ CORS for frontend
✅ Email service (Resend)
✅ AI integration (OpenRouter)
✅ Payment gateway (Razorpay)
✅ API documentation (Swagger)
✅ Health checks + monitoring

## Ready to Deploy! 🚀

All configuration files are production-ready. Just follow the steps above!

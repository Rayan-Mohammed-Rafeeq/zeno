# Zeno Backend Deployment Guide - Render + Neon DB

## Prerequisites

1. **Neon DB** (PostgreSQL Database)
   - Already set up with your connection string
   - Connection pooling enabled (using `-pooler` endpoint)

2. **Render Account**
   - Sign up at https://render.com

## Deployment Steps

### Step 1: Push Code to GitHub

Make sure your code is pushed to a GitHub repository.

### Step 2: Create Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `zeno-backend`
   - **Region**: Singapore (or closest to your Neon DB region)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Environment**: `Docker`
   - **Instance Type**: `Starter` (or higher)

### Step 3: Configure Environment Variables

Add these environment variables in Render dashboard:

#### Required Variables

```bash
# Database (from Neon DB)
DATABASE_URL=jdbc:postgresql://ep-flat-art-azecsfo3-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb
DATABASE_USERNAME=neondb_owner
DATABASE_PASSWORD=npg_nmbYDfv2TMx8

# JWT (generate a strong secret)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ACCESS_TOKEN_EXPIRY_MINUTES=60

# Frontend URL (update with your actual frontend URL)
APP_FRONTEND_URL=https://your-frontend-url.com

# Email (Resend)
RESEND_API_KEY=your-resend-api-key-here
RESEND_FROM_ADDRESS=Zeno <noreply@alliededge.app>

# AI Configuration
AI_API_KEY=your-openrouter-api-key-here
AI_API_URL=https://openrouter.ai/api/v1
AI_MODEL=minimax/minimax-m3
AI_ENABLED=true

# Razorpay
RAZORPAY_KEY_ID=rzp_test_TYEb3nd4wQd92n
RAZORPAY_KEY_SECRET=aUJqZIzH18CsV1bjCHiiBB7l
RAZORPAY_WEBHOOK_SECRET=your_razorpay_test_webhook_secret_here
RAZORPAY_WEBHOOK_ENABLED=true

# Spring Profile
SPRING_PROFILES_ACTIVE=prod

# Server Port (Render uses internal port 10000, but we keep 8080)
SERVER_PORT=8080
```

#### Optional Variables (ML Service - disabled by default)

```bash
ML_SERVICE_ENABLED=false
ML_SERVICE_URL=http://localhost:8001
ML_SERVICE_TIMEOUT_SECONDS=5
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Build the Docker image
   - Run database migrations (Flyway)
   - Start the application
3. Wait for the deployment to complete (5-10 minutes for first build)

### Step 5: Verify Deployment

Once deployed, check:

1. **Health Check**: `https://your-app.onrender.com/actuator/health`
2. **API Docs**: `https://your-app.onrender.com/swagger-ui.html`

## Important Notes

### Database Connection

- ✅ Using **connection pooling** endpoint (`-pooler`)
- ✅ Configured with HikariCP settings optimized for Render
- ✅ Pool size: 5 connections (good for Starter plan)

### Docker Build

- Multi-stage build for smaller image size
- Maven dependencies cached for faster rebuilds
- Runs as non-root user for security
- JVM optimized for container environment

### Security

- ⚠️ **Change JWT_SECRET** in production
- ⚠️ **Never commit .env file** (already in .gitignore)
- ⚠️ Use Razorpay **test mode** credentials only
- ⚠️ Update CORS settings in production

### Monitoring

- Health check endpoint: `/actuator/health`
- Metrics endpoint: `/actuator/metrics`
- Info endpoint: `/actuator/info`

### Troubleshooting

#### Build Fails
```bash
# Check Maven build locally
cd backend
./mvnw clean package -DskipTests
```

#### Database Connection Issues
- Verify Neon DB is active (free tier sleeps after inactivity)
- Check connection string format
- Ensure connection pooling endpoint is used

#### Application Crashes
- Check Render logs
- Verify all environment variables are set
- Check Neon DB connection limits

#### Out of Memory
- Increase instance type on Render
- Adjust JVM memory settings in Dockerfile

## Auto-Deploy on Push

Render automatically redeploys when you push to the connected branch.

## Alternative: Using render.yaml

You can use the included `render.yaml` file for Infrastructure as Code:

1. Push `render.yaml` to your repo
2. In Render Dashboard, go to **"Blueprint"** → **"New Blueprint Instance"**
3. Connect your repo and Render will auto-configure everything

## Cost Estimates

- **Render Starter**: $7/month (512 MB RAM, 0.5 CPU)
- **Neon DB Free**: Free tier available
- **Total**: ~$7/month minimum

## Production Checklist

- [ ] Change JWT_SECRET to a strong random value
- [ ] Update APP_FRONTEND_URL to production URL
- [ ] Switch to Razorpay production credentials
- [ ] Configure proper CORS origins
- [ ] Set up custom domain (optional)
- [ ] Enable SSL/TLS (automatic on Render)
- [ ] Set up monitoring and alerts
- [ ] Configure backups on Neon DB
- [ ] Review and test all API endpoints

## Support

- Render Docs: https://render.com/docs
- Neon DB Docs: https://neon.tech/docs
- Spring Boot Docs: https://spring.io/projects/spring-boot

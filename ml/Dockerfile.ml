# Niro ML Service — Docker image
# Python 3.12 slim, installs dependencies from requirements.txt,
# loads model artefacts from a mounted volume at runtime.
#
# Build:  docker build -f Dockerfile.ml -t niro-ml:latest .
# Run:    docker run -p 8001:8001 -v ./data/artifacts:/app/data/artifacts:ro niro-ml:latest

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies needed by some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer cache friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ src/
COPY start_ml_service.py .

# Artefact directory — expected to be mounted at runtime
# The service starts even if this is empty (returns 503 on predict endpoints)
RUN mkdir -p data/artifacts/xgboost

# Non-root user for security
RUN useradd -m -u 1001 niro
USER niro

EXPOSE 8001

ENV PYTHONPATH=/app/src
ENV NIRO_MODEL_DIR=/app/data/artifacts/xgboost
ENV ML_SERVICE_HOST=0.0.0.0
ENV ML_SERVICE_PORT=8001
ENV LOG_LEVEL=INFO

CMD ["python", "start_ml_service.py", "--prod"]

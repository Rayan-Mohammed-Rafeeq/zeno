FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    API_HOST=0.0.0.0 \
    API_PORT=8001

WORKDIR /app
COPY pyproject.toml ./
COPY main.py ./
COPY api ./api
COPY core ./core
COPY workflows ./workflows
RUN pip install --no-cache-dir '.[openai]' && adduser --disabled-password --gecos "" appuser

USER appuser
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]

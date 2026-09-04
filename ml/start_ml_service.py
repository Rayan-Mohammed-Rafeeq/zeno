"""
Zeno ML Service startup script.

Usage
─────
    # Development (auto-reload on file changes):
    python start_ml_service.py

    # Production (no reload):
    python start_ml_service.py --prod

    # Custom port:
    python start_ml_service.py --port 8001

    # Or run directly with uvicorn:
    uvicorn zeno_ml.inference.app:app --host 0.0.0.0 --port 8001

Environment variables (see .env.ml.example):
    ZENO_MODEL_DIR  — path to model artefacts directory
    ML_SERVICE_HOST — bind host (default 0.0.0.0)
    ML_SERVICE_PORT — bind port (default 8001)
    LOG_LEVEL       — logging level (default INFO)
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

# Make the src package importable
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

# Load .env.ml if it exists
env_file = ROOT / ".env.ml"
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())


def main() -> None:
    p = argparse.ArgumentParser(description="Start the Zeno ML inference service")
    p.add_argument("--host",  default=os.getenv("ML_SERVICE_HOST", "0.0.0.0"))
    p.add_argument("--port",  type=int, default=int(os.getenv("ML_SERVICE_PORT", "8001")))
    p.add_argument("--prod",  action="store_true", help="Production mode (no auto-reload)")
    p.add_argument("--workers", type=int, default=1)
    args = p.parse_args()

    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )
    logger = logging.getLogger("startup")

    model_dir = os.getenv("ZENO_MODEL_DIR", str(ROOT / "data" / "artifacts" / "xgboost"))
    logger.info("Zeno ML Service")
    logger.info("  Model directory : %s", model_dir)
    logger.info("  Host            : %s", args.host)
    logger.info("  Port            : %d", args.port)
    logger.info("  Mode            : %s", "production" if args.prod else "development")

    artefacts_exist = (
        (Path(model_dir) / "xgb_model.pkl").exists()
        and (Path(model_dir) / "isolation_forest.pkl").exists()
    )
    if not artefacts_exist:
        logger.warning(
            "Model artefacts not found in %s. "
            "The service will start but /ml/predict will return HTTP 503 "
            "until models are trained. Run: python scripts/train_full_pipeline.py --synthetic",
            model_dir,
        )

    import uvicorn
    uvicorn.run(
        "zeno_ml.inference.app:app",
        host=args.host,
        port=args.port,
        reload=not args.prod,
        workers=args.workers if args.prod else 1,
        log_level=log_level.lower(),
    )


if __name__ == "__main__":
    main()

"""
Model registry — loads and holds the active model artefacts at startup.

Design principles:
  - Model is loaded ONCE at application startup, never per-request.
  - If the model files are absent, the service starts but returns 503
    on prediction endpoints (never a silent default score).
  - The registry exposes a typed ModelBundle that includes the model,
    calibrator, scaler, Isolation Forest, feature version, model version,
    and the optimal decision threshold.
  - MLflow artifact paths are supported but optional — the registry
    also accepts plain filesystem paths for local development.

State machine:
  UNLOADED  → load() called → LOADING → READY
                                       → FAILED (artefact missing / corrupt)
"""

from __future__ import annotations

import logging
import os
import pickle
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Default artefact directory — override via ZENO_MODEL_DIR env var
DEFAULT_MODEL_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "artifacts" / "xgboost"


class RegistryStatus(str, Enum):
    UNLOADED = "UNLOADED"
    LOADING  = "LOADING"
    READY    = "READY"
    FAILED   = "FAILED"


@dataclass
class ModelBundle:
    """
    All artefacts required for a single prediction.

    xgb_model       : trained XGBoost Booster or sklearn-compatible estimator
    isolation_forest: trained IsolationForest (sklearn)
    scaler          : fitted StandardScaler (may be None if scaling not used)
    calibrator      : fitted CalibratedClassifierCV or None
    feature_version : e.g. "1.0"
    model_version   : e.g. "xgboost-v1.4"
    threshold       : optimal decision threshold selected on validation data
    feature_names   : ordered list matching the training feature matrix columns
    metadata        : arbitrary metadata dict (hyperparameters, dataset version, etc.)
    """
    xgb_model:        Any
    isolation_forest: Any
    scaler:           Any = None
    calibrator:       Any = None
    feature_version:  str = "1.0"
    model_version:    str = "unknown"
    threshold:        float = 0.5
    feature_names:    list[str] = field(default_factory=list)
    metadata:         dict[str, Any] = field(default_factory=dict)


class ModelRegistry:
    """
    Singleton-style registry holding the currently active ModelBundle.

    Usage
    -----
    registry = ModelRegistry()
    registry.load()               # call once at startup
    bundle = registry.get_bundle() # raises RuntimeError if not READY
    """

    def __init__(self, model_dir: Path | str | None = None) -> None:
        self._model_dir = Path(model_dir or os.getenv("ZENO_MODEL_DIR", str(DEFAULT_MODEL_DIR)))
        self._status: RegistryStatus = RegistryStatus.UNLOADED
        self._bundle: ModelBundle | None = None
        self._load_error: str | None = None

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    @property
    def status(self) -> RegistryStatus:
        return self._status

    @property
    def is_ready(self) -> bool:
        return self._status == RegistryStatus.READY

    @property
    def load_error(self) -> str | None:
        return self._load_error

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------

    def load(self) -> None:
        """
        Attempt to load model artefacts from disk.

        Expected files in model_dir:
          xgb_model.pkl          — XGBoost model
          isolation_forest.pkl   — Isolation Forest
          scaler.pkl             — StandardScaler (optional)
          calibrator.pkl         — CalibratedClassifierCV (optional)
          metadata.pkl           — dict with version info, threshold, feature names

        Logs a clear error and sets status=FAILED if any required file
        is missing.  The service will still start and serve /health.
        """
        self._status = RegistryStatus.LOADING
        logger.info("Loading model artefacts from: %s", self._model_dir)

        try:
            xgb_model        = self._load_pickle("xgb_model.pkl", required=True)
            isolation_forest = self._load_pickle("isolation_forest.pkl", required=True)
            scaler           = self._load_pickle("scaler.pkl", required=False)
            calibrator       = self._load_pickle("calibrator.pkl", required=False)
            metadata         = self._load_pickle("metadata.pkl", required=False) or {}

            self._bundle = ModelBundle(
                xgb_model=xgb_model,
                isolation_forest=isolation_forest,
                scaler=scaler,
                calibrator=calibrator,
                feature_version=metadata.get("feature_version", "1.0"),
                model_version=metadata.get("model_version", "unknown"),
                threshold=metadata.get("threshold", 0.5),
                feature_names=metadata.get("feature_names", []),
                metadata=metadata,
            )
            self._status = RegistryStatus.READY
            logger.info(
                "Model loaded successfully: version=%s feature_version=%s threshold=%.4f",
                self._bundle.model_version,
                self._bundle.feature_version,
                self._bundle.threshold,
            )

        except FileNotFoundError as exc:
            self._status = RegistryStatus.FAILED
            self._load_error = str(exc)
            logger.warning(
                "Model artefacts not found — service will return 503 on prediction "
                "endpoints until models are trained and placed in %s. Error: %s",
                self._model_dir,
                exc,
            )
        except Exception as exc:  # noqa: BLE001
            self._status = RegistryStatus.FAILED
            self._load_error = str(exc)
            logger.error("Failed to load model artefacts: %s", exc, exc_info=True)

    def get_bundle(self) -> ModelBundle:
        """
        Return the active ModelBundle.

        Raises
        ------
        RuntimeError if status is not READY.
        """
        if self._status != RegistryStatus.READY:
            raise RuntimeError(
                f"Model not ready (status={self._status.value}). "
                f"Train and place artefacts in {self._model_dir}. "
                f"Error: {self._load_error}"
            )
        return self._bundle  # type: ignore[return-value]

    def health_dict(self) -> dict[str, Any]:
        """Return a dict suitable for the /health endpoint."""
        d: dict[str, Any] = {
            "model_status": self._status.value,
        }
        if self._bundle and self._status == RegistryStatus.READY:
            d["model_version"]   = self._bundle.model_version
            d["feature_version"] = self._bundle.feature_version
            d["threshold"]       = self._bundle.threshold
            d["feature_count"]   = len(self._bundle.feature_names)
        if self._load_error:
            d["load_error"] = self._load_error
        return d

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _load_pickle(self, filename: str, required: bool) -> Any:
        path = self._model_dir / filename
        if not path.exists():
            if required:
                raise FileNotFoundError(
                    f"Required model artefact not found: {path}. "
                    "Run the training pipeline first (scripts/train_xgboost.py)."
                )
            logger.debug("Optional artefact not found (skipped): %s", path)
            return None
        with open(path, "rb") as fh:
            obj = pickle.load(fh)
        logger.debug("Loaded artefact: %s (%d bytes)", filename, path.stat().st_size)
        return obj


# Module-level singleton used by the FastAPI app
_registry: ModelRegistry | None = None


def get_registry() -> ModelRegistry:
    """Return the module-level registry instance (created lazily)."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry

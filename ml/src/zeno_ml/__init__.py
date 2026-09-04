"""
Zeno ML Service
Enterprise fraud risk detection engine.

Architecture:
  data/       — ingestion, canonical schema, validation, normalization
  features/   — leakage-safe feature engineering pipeline (versioned)
  models/     — training, hyperparameter search, calibration
  inference/  — FastAPI serving layer, SHAP explanations
  graph/      — NetworkX graph construction and graph features
  evaluation/ — metrics, threshold optimization, ablation, benchmark reports
  monitoring/ — prediction drift, feature drift, data quality tracking
"""

__version__ = "0.1.0"

# ml/data — Dataset and Artefact Storage

This directory is excluded from git (see `.gitignore`).
It is created locally after running the training pipeline.

## Directory Structure

```
ml/data/
  raw/
    ieee-cis/
      train_transaction.csv   ← download from Kaggle (see below)
      train_identity.csv      ← download from Kaggle (optional, for device features)
  artifacts/
    xgboost/
      xgb_model.pkl           ← trained XGBoost model
      isolation_forest.pkl    ← trained Isolation Forest
      calibrator.pkl          ← probability calibrator (if calibration improved ECE)
      scaler.pkl              ← StandardScaler fitted on training data
      metadata.pkl            ← model version, threshold, feature names
      threshold_curve.json    ← threshold vs expected loss curve (for frontend charts)
  processed/                  ← intermediate feature matrices (ignored by git)
```

## IEEE-CIS Dataset

The IEEE-CIS Fraud Detection dataset is used for ML training and evaluation.

**Download:**
1. Create a Kaggle account at https://www.kaggle.com
2. Go to https://www.kaggle.com/c/ieee-fraud-detection/data
3. Accept the competition rules
4. Download `train_transaction.csv` and `train_identity.csv`
5. Place both files in `ml/data/raw/ieee-cis/`

**Dataset size:**
- `train_transaction.csv`: ~490 MB, 590,540 rows, 394 columns
- `train_identity.csv`: ~21 MB, 144,233 rows, 41 columns

**Fraud rate:** ~3.5%

**Temporal split used:**
- Train: oldest 70% by `TransactionDT`
- Validation: next 15%
- Test: most recent 15% (frozen — never used for tuning)

## Running on Synthetic Data (No Download Needed)

For development and CI, use the synthetic data generator:

```bash
cd ml
python scripts/train_full_pipeline.py --synthetic --n-samples 8000
```

Synthetic results are clearly labelled in all reports with:
```
⚠ SYNTHETIC DATA — results do not represent production performance.
```

## Training the Full Pipeline

```bash
# With IEEE-CIS (requires download above)
python scripts/train_full_pipeline.py

# With synthetic data (no download)
python scripts/train_full_pipeline.py --synthetic --n-samples 8000

# Skip ablation for faster iteration
python scripts/train_full_pipeline.py --synthetic --skip-ablation
```

After training, artefacts are placed in `data/artifacts/xgboost/`.
The FastAPI service will load them at startup.

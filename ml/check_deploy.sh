#!/bin/bash
# Pre-deployment check script for Zeno ML Service
# Run this before deploying to Render

set -e

echo "╔════════════════════════════════════════════════════╗"
echo "║   Zeno ML Service - Pre-Deployment Check          ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

# Function to print status
print_status() {
    local status=$1
    local message=$2
    case $status in
        "ok")
            echo "✅ $message"
            ;;
        "warn")
            echo "⚠️  $message"
            ((WARNINGS++))
            ;;
        "error")
            echo "❌ $message"
            ((ERRORS++))
            ;;
    esac
}

echo "📁 Checking project structure..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if we're in the ml directory
if [ ! -f "start_ml_service.py" ]; then
    print_status "error" "Not in ML directory. Please cd into ml/ directory first."
    exit 1
else
    print_status "ok" "In correct directory"
fi

# Check configuration files
[ -f "render.yaml" ] && print_status "ok" "render.yaml found" || print_status "error" "render.yaml missing"
[ -f "Dockerfile.ml" ] && print_status "ok" "Dockerfile.ml found" || print_status "error" "Dockerfile.ml missing"
[ -f ".dockerignore" ] && print_status "ok" ".dockerignore found" || print_status "warn" ".dockerignore missing"
[ -f "requirements.txt" ] && print_status "ok" "requirements.txt found" || print_status "error" "requirements.txt missing"

echo ""
echo "🤖 Checking model artifacts..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "data/artifacts/xgboost" ]; then
    print_status "ok" "Model directory exists"
    
    if [ -f "data/artifacts/xgboost/xgb_model.pkl" ]; then
        MODEL_SIZE=$(du -h "data/artifacts/xgboost/xgb_model.pkl" | cut -f1)
        print_status "ok" "XGBoost model found ($MODEL_SIZE)"
    else
        print_status "error" "xgb_model.pkl missing"
    fi
    
    if [ -f "data/artifacts/xgboost/isolation_forest.pkl" ]; then
        print_status "ok" "Isolation Forest model found"
    else
        print_status "error" "isolation_forest.pkl missing"
    fi
    
    if [ -f "data/artifacts/xgboost/feature_columns.json" ]; then
        print_status "ok" "Feature columns found"
    else
        print_status "error" "feature_columns.json missing"
    fi
    
    if [ -f "data/artifacts/xgboost/scaler.pkl" ]; then
        print_status "ok" "Scaler found"
    else
        print_status "error" "scaler.pkl missing"
    fi
    
    # Check total model size
    TOTAL_SIZE=$(du -sh "data/artifacts/xgboost" | cut -f1)
    echo "   📊 Total model size: $TOTAL_SIZE"
    
else
    print_status "error" "Model directory not found (data/artifacts/xgboost)"
    echo "   💡 Run: python scripts/train_full_pipeline.py --synthetic"
fi

echo ""
echo "🐳 Checking Docker setup..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v docker &> /dev/null; then
    print_status "ok" "Docker is installed"
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    echo "   🐳 Version: $DOCKER_VERSION"
else
    print_status "warn" "Docker not found (optional, but recommended for local testing)"
fi

echo ""
echo "📝 Checking Git status..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v git &> /dev/null; then
    if git rev-parse --git-dir > /dev/null 2>&1; then
        print_status "ok" "Git repository detected"
        
        # Check for uncommitted changes
        if [ -z "$(git status --porcelain)" ]; then
            print_status "ok" "No uncommitted changes"
        else
            print_status "warn" "Uncommitted changes exist"
            echo "   💡 Consider committing before deployment"
        fi
        
        # Check current branch
        BRANCH=$(git branch --show-current)
        echo "   🌿 Current branch: $BRANCH"
        
        # Check if branch exists on remote
        if git ls-remote --exit-code --heads origin "$BRANCH" &> /dev/null; then
            print_status "ok" "Branch exists on remote"
        else
            print_status "warn" "Branch not pushed to remote"
        fi
    else
        print_status "warn" "Not in a git repository"
    fi
else
    print_status "warn" "Git not found"
fi

echo ""
echo "🐍 Checking Python environment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    print_status "ok" "Python 3 found (version $PYTHON_VERSION)"
    
    # Check if version is 3.12+
    MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
    if [ "$MAJOR" -eq 3 ] && [ "$MINOR" -ge 12 ]; then
        print_status "ok" "Python version is 3.12+"
    else
        print_status "warn" "Python 3.12+ recommended (current: $PYTHON_VERSION)"
    fi
else
    print_status "error" "Python 3 not found"
fi

echo ""
echo "📦 Checking dependencies..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if key packages are installed
if python3 -c "import fastapi" 2>/dev/null; then
    print_status "ok" "FastAPI installed"
else
    print_status "warn" "FastAPI not found (run: pip install -r requirements.txt)"
fi

if python3 -c "import xgboost" 2>/dev/null; then
    print_status "ok" "XGBoost installed"
else
    print_status "warn" "XGBoost not found (run: pip install -r requirements.txt)"
fi

echo ""
echo "🔧 Checking Dockerfile configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if models are being copied in Dockerfile
if grep -q "^COPY data/artifacts/" "Dockerfile.ml" 2>/dev/null; then
    print_status "ok" "Dockerfile configured to include models in image"
    echo "   📦 Strategy: Models in Docker image"
elif grep -q "^# COPY data/artifacts/" "Dockerfile.ml" 2>/dev/null; then
    print_status "warn" "Dockerfile NOT copying models (using external storage?)"
    echo "   📦 Strategy: External model storage"
else
    print_status "warn" "Model copy strategy unclear in Dockerfile"
fi

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║                   SUMMARY                          ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 All checks passed! You're ready to deploy!"
    echo ""
    echo "Next steps:"
    echo "  1. Review render.yaml configuration"
    echo "  2. Push to GitHub: git push origin main"
    echo "  3. Deploy via Render Blueprint or manual setup"
    echo "  4. See QUICK_DEPLOY.md for deployment instructions"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  $WARNINGS warning(s) found, but you can proceed with deployment."
    echo ""
    echo "Review the warnings above and proceed if acceptable."
    echo "See DEPLOYMENT.md for detailed guidance."
    exit 0
else
    echo "❌ $ERRORS error(s) and $WARNINGS warning(s) found."
    echo ""
    echo "Please fix the errors before deploying."
    echo "Common fixes:"
    echo "  - Missing models: python scripts/train_full_pipeline.py --synthetic"
    echo "  - Missing files: Check PRE_DEPLOY_CHECKLIST.md"
    exit 1
fi

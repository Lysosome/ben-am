#!/bin/bash
set -e

echo "🔍 Checking for yt-dlp updates..."
echo ""

# Get latest yt-dlp version from GitHub
LATEST_VERSION=$(curl -s https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION" ]; then
  echo "⚠️  Warning: Could not fetch latest version from GitHub. Proceeding with download..."
  LATEST_VERSION="unknown"
else
  echo "📦 Latest yt-dlp version: $LATEST_VERSION"
fi

# Try to get current version from existing layer (if it exists)
if command -v aws &> /dev/null; then
  # Get the latest layer version number dynamically
  LATEST_LAYER_VERSION=$(aws lambda list-layer-versions \
    --layer-name yt-dlp-binary \
    --query 'LayerVersions[0].Version' \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$LATEST_LAYER_VERSION" ] && [ "$LATEST_LAYER_VERSION" != "None" ]; then
    CURRENT_LAYER_DESC=$(aws lambda get-layer-version \
      --layer-name yt-dlp-binary \
      --version-number "$LATEST_LAYER_VERSION" \
      --query 'Description' \
      --output text 2>/dev/null || echo "")
    
    if [ -n "$CURRENT_LAYER_DESC" ]; then
      echo "📦 Current layer: version $LATEST_LAYER_VERSION - $CURRENT_LAYER_DESC"
    fi
  else
    echo "ℹ️  No existing yt-dlp-binary layer found (will be first deployment)"
  fi
else
  echo "ℹ️  AWS CLI not found - skipping current version check"
fi

echo ""
echo "Building yt-dlp Lambda Layer with standalone binary..."
echo ""

# Create layer directory structure
mkdir -p yt-dlp-layer/bin
cd yt-dlp-layer/bin

# Download yt-dlp standalone Linux binary
echo "Downloading yt-dlp $LATEST_VERSION standalone Linux binary..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o yt-dlp
chmod +x yt-dlp

# Test the binary (this will work on x86_64 Linux)
echo "Binary downloaded (testing requires compatible architecture)"
file yt-dlp

cd ..

# Create zip file
echo "Creating layer zip..."
zip -r ../yt-dlp-layer.zip .

cd ..
rm -rf yt-dlp-layer

echo "✅ yt-dlp layer built successfully: yt-dlp-layer.zip"
echo ""
echo "Upload with:"
echo "aws lambda publish-layer-version \\"
echo "  --layer-name yt-dlp-binary \\"
echo "  --description \"yt-dlp $LATEST_VERSION - $(date +%Y-%m-%d)\" \\"
echo "  --zip-file fileb://yt-dlp-layer.zip \\"
echo "  --compatible-runtimes nodejs20.x \\"
echo "  --region us-east-1"
echo ""
echo "Or use: npm run deploy:yt-dlp-layer"

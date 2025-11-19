#!/bin/bash
# Build Lambda layer with YouTube cookies for authentication
# This layer provides the cookies.txt file to the yt-dlp Lambda function

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAYER_DIR="$SCRIPT_DIR/cookies-layer"
COOKIES_SOURCE="$SCRIPT_DIR/cookies.txt"

echo "Building cookies Lambda layer..."

# Check if cookies.txt exists
if [ ! -f "$COOKIES_SOURCE" ]; then
    echo "ERROR: cookies.txt not found at $COOKIES_SOURCE"
    echo "Please create cookies.txt in the lambda-layers directory first."
    exit 1
fi

# Create layer directory structure
rm -rf "$LAYER_DIR"
mkdir -p "$LAYER_DIR/cookies"

# Copy cookies file
cp "$COOKIES_SOURCE" "$LAYER_DIR/cookies/cookies.txt"
echo "Copied cookies.txt to layer structure"

# Create zip file
cd "$LAYER_DIR"
zip -r ../cookies-layer.zip .
cd "$SCRIPT_DIR"

echo "Layer created: cookies-layer.zip"
echo ""
echo "To upload this layer to AWS Lambda:"
echo "  aws lambda publish-layer-version \\"
echo "    --layer-name youtube-cookies \\"
echo "    --zip-file fileb://cookies-layer.zip \\"
echo "    --compatible-runtimes nodejs20.x"
echo ""
echo "⚠️  SECURITY WARNING:"
echo "  - This layer contains sensitive authentication data"
echo "  - Keep the cookies.txt file and this layer PRIVATE"
echo "  - Update cookies periodically as they expire"
echo "  - Never commit cookies.txt to version control"

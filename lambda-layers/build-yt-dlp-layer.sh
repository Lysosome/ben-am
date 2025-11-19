#!/bin/bash
set -e

echo "Building yt-dlp Lambda Layer with standalone binary..."

# Create layer directory structure
mkdir -p yt-dlp-layer/bin
cd yt-dlp-layer/bin

# Download yt-dlp standalone Linux binary
echo "Downloading yt-dlp standalone Linux binary..."
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
echo "  --description \"yt-dlp standalone binary for Lambda\" \\"
echo "  --zip-file fileb://yt-dlp-layer.zip \\"
echo "  --compatible-runtimes nodejs20.x \\"
echo "  --region us-east-1"

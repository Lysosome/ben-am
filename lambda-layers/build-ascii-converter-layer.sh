#!/bin/bash
set -e

echo "Building ascii-image-converter Lambda Layer..."

# Create layer directory structure
rm -rf ascii-converter-layer
mkdir -p ascii-converter-layer/bin
cd ascii-converter-layer/bin

# Download the latest release for Linux x86_64
# Check https://github.com/TheZoraiz/ascii-image-converter/releases for latest version
VERSION="1.13.1"
echo "Downloading ascii-image-converter v${VERSION} for Linux x86_64..."
curl -L "https://github.com/TheZoraiz/ascii-image-converter/releases/download/v${VERSION}/ascii-image-converter_Linux_amd64_64bit.tar.gz" \
  -o ascii-converter.tar.gz

tar -xzf ascii-converter.tar.gz
rm ascii-converter.tar.gz

# Move binary from extracted subdirectory
mv ascii-image-converter_Linux_amd64_64bit/ascii-image-converter .
rm -rf ascii-image-converter_Linux_amd64_64bit
chmod +x ascii-image-converter

# Show binary info
echo "Binary downloaded:"
ls -la
file ascii-image-converter

cd ..

# Create zip file
echo "Creating layer zip..."
zip -r ../ascii-converter-layer.zip .

cd ..
rm -rf ascii-converter-layer

echo ""
echo "✅ ascii-image-converter layer built successfully: ascii-converter-layer.zip"
echo ""
echo "Upload with:"
echo "aws lambda publish-layer-version \\"
echo "  --layer-name ascii-image-converter \\"
echo "  --description \"ascii-image-converter binary for Lambda\" \\"
echo "  --zip-file fileb://ascii-converter-layer.zip \\"
echo "  --compatible-runtimes nodejs20.x \\"
echo "  --region us-east-1"

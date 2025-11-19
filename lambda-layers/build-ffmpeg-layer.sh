#!/bin/bash
set -e

echo "Building ffmpeg Lambda Layer..."

# Create layer directory structure
mkdir -p ffmpeg-layer/bin
cd ffmpeg-layer/bin

# Download pre-compiled ffmpeg for Lambda (AWS Lambda uses Amazon Linux 2)
echo "Downloading ffmpeg static build..."
curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg.tar.xz

echo "Extracting..."
tar -xf ffmpeg.tar.xz --strip-components=1
rm ffmpeg.tar.xz

# Keep only ffmpeg and ffprobe
mkdir -p temp
mv ffmpeg temp/
mv ffprobe temp/
rm -rf *
mv temp/ffmpeg .
mv temp/ffprobe .
rmdir temp

chmod +x ffmpeg ffprobe

# Test the binaries
echo "Testing ffmpeg..."
./ffmpeg -version | head -n 1
./ffprobe -version | head -n 1

cd ..

# Create zip file
echo "Creating layer zip..."
zip -r ../ffmpeg-layer.zip .

cd ..
rm -rf ffmpeg-layer

echo "✅ ffmpeg layer built successfully: ffmpeg-layer.zip"
echo ""
echo "Upload with:"
echo "aws lambda publish-layer-version \\"
echo "  --layer-name ffmpeg-binary \\"
echo "  --description \"ffmpeg binary for Lambda\" \\"
echo "  --zip-file fileb://ffmpeg-layer.zip \\"
echo "  --compatible-runtimes nodejs20.x \\"
echo "  --region us-east-1"

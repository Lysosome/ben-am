import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ASSETS_DIR = path.join(__dirname, 'assets');
const OUTPUT_DIR = path.join(__dirname, '..', 'frontend', 'src', 'ascii-animations', 'loading');

const MAX_FRAMES = 50;
const CHAR_WIDTH = 40;

// Brightness ramp: dark → bright (for dark backgrounds)
const ASCII_RAMP = ' .:-=+*#%@';

/**
 * Evenly sample `count` indices from an array of `total` items.
 * Returns indices that are evenly distributed across the range.
 */
function sampleIndices(total, count) {
  const indices = [];
  for (let i = 0; i < count; i++) {
    indices.push(Math.round(i * (total - 1) / (count - 1)));
  }
  return indices;
}

/**
 * Convert a single pixel brightness (0-255) to an ASCII character.
 */
function brightnessToChar(value) {
  const idx = Math.floor((value / 256) * ASCII_RAMP.length);
  return ASCII_RAMP[Math.min(idx, ASCII_RAMP.length - 1)];
}

/**
 * Convert a GIF file to an array of ASCII art frame strings.
 * Uses sharp (libvips) to decode frames — this correctly handles all GIF
 * disposal methods (cumulative, clear-to-background, restore-to-previous)
 * so each extracted frame looks exactly as it would when displayed.
 */
async function convertGifToAscii(gifPath) {
  const basename = path.basename(gifPath, '.gif');
  console.log(`  Processing: ${path.basename(gifPath)}`);

  // 1. Load the animated GIF metadata to discover frame count and dimensions
  const gifBuffer = fs.readFileSync(gifPath);
  const metadata = await sharp(gifBuffer, { animated: true, pages: -1 }).metadata();

  const totalFrames = metadata.pages || 1;
  const pageHeight = metadata.pageHeight || metadata.height;
  const gifWidth = metadata.width;

  console.log(`    Extracted ${totalFrames} frames (${gifWidth}x${pageHeight}px each)`);

  // 2. Determine which frame indices to keep
  let frameIndices = Array.from({ length: totalFrames }, (_, i) => i);
  if (totalFrames > MAX_FRAMES) {
    frameIndices = sampleIndices(totalFrames, MAX_FRAMES);
    console.log(`    Sampled down to ${frameIndices.length} frames`);
  }

  // 3. Compute character height from aspect ratio
  const aspectRatio = pageHeight / gifWidth;
  // 0.5 factor compensates for monospace chars being ~2x taller than wide
  const charHeight = Math.max(1, Math.round(CHAR_WIDTH * aspectRatio * 0.5));
  console.log(`    Output size: ${CHAR_WIDTH}x${charHeight} chars`);

  // 4. Convert selected frames to ASCII
  //    Using the `page` option renders each frame as it would appear on screen
  //    (libvips correctly handles all GIF disposal methods per-page)
  const asciiFrames = [];

  for (const idx of frameIndices) {
    const { data } = await sharp(gifBuffer, { page: idx })
      .flatten({ background: { r: 0, g: 0, b: 0 } })
      .resize(CHAR_WIDTH, charHeight, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let frame = '';
    for (let y = 0; y < charHeight; y++) {
      let line = '';
      for (let x = 0; x < CHAR_WIDTH; x++) {
        const pixel = data[y * CHAR_WIDTH + x];
        line += brightnessToChar(pixel);
      }
      frame += line;
      if (y < charHeight - 1) {
        frame += '\n';
      }
    }

    asciiFrames.push(frame);
  }

  return { name: basename, frames: asciiFrames };
}

async function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Find all GIF files
  const gifs = fs.readdirSync(ASSETS_DIR).filter((f) => f.toLowerCase().endsWith('.gif'));

  if (gifs.length === 0) {
    console.log('No .gif files found in assets/. Add some GIFs and try again.');
    return;
  }

  console.log(`Found ${gifs.length} GIF(s). Converting to ASCII animations...\n`);

  for (const gif of gifs) {
    try {
      const { name, frames } = await convertGifToAscii(path.join(ASSETS_DIR, gif));
      const outputPath = path.join(OUTPUT_DIR, `${name}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(frames), 'utf-8');
      console.log(`    → ${name}.json (${frames.length} frames)\n`);
    } catch (err) {
      console.error(`    ✗ Failed to convert ${gif}: ${err.message}\n`);
    }
  }

  console.log('Done!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

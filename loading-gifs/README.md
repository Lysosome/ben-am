# Loading GIFs → ASCII Art Converter

Converts GIF files into ASCII art animation JSON files for use as loading spinners in the frontend.

## Setup

```bash
cd loading-gifs
npm install
```

## Usage

1. Place your `.gif` files in the `assets/` directory
2. Run the conversion:

```bash
npm run convert
```

This will process every `.gif` in `assets/` and output JSON files to `frontend/src/ascii-animations/loading/`.

## Output Format

Each JSON file is an array of strings, where each string is one ASCII art frame (with `\n` line breaks):

```json
[
  "  ***  \n *   * \n  ***  ",
  "  +++  \n +   + \n  +++  "
]
```

## Configuration

The conversion uses these defaults (configurable in `convert.mjs`):

| Setting | Default | Description |
|---------|---------|-------------|
| `CHAR_WIDTH` | 30 | Width of ASCII output in characters |
| `MAX_FRAMES` | 50 | Maximum frames per animation (evenly sampled if exceeded) |
| `ASCII_RAMP` | ` .:-=+*#%@` | Brightness-to-character mapping (dark → bright) |

## Notes

- GIF files in `assets/` are **gitignored** — they won't be committed to version control.
- The output JSON files in `frontend/src/ascii-animations/loading/` **are** committed, since they're part of the frontend bundle.
- Transparent GIF pixels are flattened onto a black background (designed for dark UI themes).
- Character aspect ratio correction (2:1) is applied automatically so images don't appear stretched.

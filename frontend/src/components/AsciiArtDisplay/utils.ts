import { ANSI_COLORS } from './types';

/**
 * Parse a single line of text with ANSI color codes and extract characters with their colors
 */
export function parseAnsiLine(
  text: string
): Array<{ char: string; color: string; col: number }> {
  const ansiRegex = /(?:\x1b)?\[(?:38;2;(\d+);(\d+);(\d+)|(\d+))m/g;
  const characters: Array<{ char: string; color: string; col: number }> = [];
  let currentColor = '#e5e5e5'; // Default color
  let lastIndex = 0;
  let colIndex = 0;

  let match;
  while ((match = ansiRegex.exec(text)) !== null) {
    // Add characters before this color code
    if (match.index > lastIndex) {
      const textContent = text.substring(lastIndex, match.index);
      for (const char of textContent) {
        characters.push({ char, color: currentColor, col: colIndex++ });
      }
    }

    // Update color - check if it's RGB (38;2;R;G;B) or simple code
    if (match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      // 24-bit RGB color: [38;2;R;G;Bm
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      currentColor = `rgb(${r},${g},${b})`;
    } else if (match[4] !== undefined) {
      // Simple color code
      const colorCode = match[4];
      if (colorCode === '0' || colorCode === '39') {
        // Reset to default
        currentColor = '#e5e5e5';
      } else if (ANSI_COLORS[colorCode]) {
        currentColor = ANSI_COLORS[colorCode];
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining characters
  if (lastIndex < text.length) {
    const textContent = text.substring(lastIndex);
    for (const char of textContent) {
      characters.push({ char, color: currentColor, col: colIndex++ });
    }
  }

  return characters;
}

/**
 * Generate a random character from printable ASCII range
 */
export function getRandomChar(): string {
  return String.fromCharCode(33 + Math.floor(Math.random() * 94));
}

/**
 * Get a random character from a specific set
 */
export function getRandomFromSet(chars: string): string {
  return chars[Math.floor(Math.random() * chars.length)];
}

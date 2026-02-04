import { AsciiCharacter } from './types';
import { parseAnsiLine } from './utils';

/**
 * Build a 2D grid of AsciiCharacter objects from raw ASCII art string
 */
export function buildCharacterGrid(asciiArt: string): AsciiCharacter[][] {
  const lines = asciiArt.split('\n');
  const grid: AsciiCharacter[][] = [];

  lines.forEach((line, rowIndex) => {
    const parsedChars = parseAnsiLine(line);
    const row: AsciiCharacter[] = parsedChars.map(({ char, color, col }) => ({
      char,
      color,
      row: rowIndex,
      col,
      originalChar: char,
      originalColor: color,
    }));
    grid.push(row);
  });

  return grid;
}

/**
 * Get the maximum column count across all rows
 */
export function getMaxColumns(grid: AsciiCharacter[][]): number {
  return Math.max(...grid.map(row => row.length), 0);
}

/**
 * Get character at specific position (returns null if out of bounds)
 */
export function getCharAt(
  grid: AsciiCharacter[][],
  row: number,
  col: number
): AsciiCharacter | null {
  if (row < 0 || row >= grid.length) return null;
  if (col < 0 || col >= grid[row].length) return null;
  return grid[row][col];
}

/**
 * Get all characters in a specific column
 */
export function getColumn(
  grid: AsciiCharacter[][],
  col: number
): AsciiCharacter[] {
  return grid
    .map(row => getCharAt(grid, row[0]?.row ?? 0, col))
    .filter((char): char is AsciiCharacter => char !== null);
}

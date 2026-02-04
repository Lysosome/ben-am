import { SxProps, Theme } from '@mui/material';

/**
 * Represents a single character in the ASCII art grid
 */
export interface AsciiCharacter {
  char: string;           // The current character to display
  color: string;          // Current color (RGB or hex)
  row: number;            // Row position in grid
  col: number;            // Column position in grid
  originalChar: string;   // Original character (for restoration)
  originalColor: string;  // Original color (for restoration)
}

/**
 * Context passed to character transformers
 */
export interface TransformContext {
  randomSeed?: number;
  allowedChars?: string[];
  timestamp?: number;
}

/**
 * Function that transforms a character
 */
export type CharTransformer = (
  original: AsciiCharacter,
  context?: TransformContext
) => string;

/**
 * Represents an active animation effect
 */
export interface AnimationEffect {
  id: string;
  type: 'ripple' | 'hover' | 'global';
  duration: number;
  transformer: CharTransformer;
  targets: Array<{ row: number; col: number }>;
  startTime: number;
}

/**
 * Props for the main AsciiArtDisplay component
 */
export interface AsciiArtDisplayProps {
  /**
   * The ASCII art string to display, with newlines preserved
   */
  asciiArt: string;
  /**
   * Alt text for accessibility
   */
  alt?: string;
  /**
   * Height of the container (like an image height)
   */
  height?: number | string;
  /**
   * The maximum number of characters per line in the ASCII art
   */
  charactersPerLine: number;
  /**
   * The pixel width available for the ASCII art
   */
  pixelWidth: number;
  /**
   * Additional styles to apply to the container
   */
  sx?: SxProps<Theme>;
  /**
   * Enable hover effect that transforms characters on mouse over
   */
  enableHoverEffect?: boolean;
  /**
   * Enable matrix-style ripple effect
   */
  enableMatrixRipple?: boolean;
  /**
   * Custom transformer for hover effect
   */
  hoverTransformer?: CharTransformer;
  /**
   * Interval between matrix ripple effects (ms)
   */
  rippleInterval?: number;
  /**
   * Duration of effect animations (ms)
   */
  effectDuration?: number;
  /**
   * Text color for the ASCII art (overrides default)
   */
  textColor?: string;
  /**
   * Disable the background overlay
   */
  disableBackground?: boolean;
}

/**
 * ANSI color code mappings to CSS colors
 */
export const ANSI_COLORS: Record<string, string> = {
  '30': '#000000', // Black
  '31': '#cd3131', // Red
  '32': '#0dbc79', // Green
  '33': '#e5e510', // Yellow
  '34': '#2472c8', // Blue
  '35': '#bc3fbc', // Magenta
  '36': '#11a8cd', // Cyan
  '37': '#e5e5e5', // White
  '90': '#666666', // Bright Black (Gray)
  '91': '#f14c4c', // Bright Red
  '92': '#23d18b', // Bright Green
  '93': '#f5f543', // Bright Yellow
  '94': '#3b8eea', // Bright Blue
  '95': '#d670d6', // Bright Magenta
  '96': '#29b8db', // Bright Cyan
  '97': '#ffffff', // Bright White
};

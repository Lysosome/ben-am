import { Box } from '@mui/material';
import { useMemo } from 'react';
import { AsciiArtDisplayProps } from './types';
import { buildCharacterGrid } from './AsciiCharacterGrid';
import { AsciiCharacter } from './AsciiCharacter';
import { useAsciiAnimations } from './useAsciiAnimations';
import { dotTransformer } from './transformers';

/**
 * A component that displays ASCII art in a way that behaves like an image.
 * It preserves line breaks, uses a monospace font, and centers the content
 * within a fixed-height container. Supports ANSI color codes and animations.
 */
export const AsciiArtDisplay = ({
  asciiArt,
  alt,
  charactersPerLine,
  pixelWidth,
  sx,
  enableHoverEffect = false,
  enableMatrixRipple = false,
  hoverTransformer = dotTransformer,
  rippleInterval = 10000,
  effectDuration = 500,
  textColor,
  disableBackground = false,
}: AsciiArtDisplayProps) => {
  // Build character grid from ASCII art (memoized)
  const characterGrid = useMemo(() => buildCharacterGrid(asciiArt), [asciiArt]);

  // Calculate font size to fit charactersPerLine within pixelWidth
  const fontSize = useMemo(() => {
    return (pixelWidth / charactersPerLine) * 1.5;
  }, [pixelWidth, charactersPerLine]);

  // Setup animations
  const { charOverrides, handleHover } = useAsciiAnimations(characterGrid, {
    enableHoverEffect,
    enableMatrixRipple,
    hoverTransformer,
    rippleInterval,
    effectDuration,
  });

  return (
    <Box
      role="img"
      aria-label={alt}
      sx={{
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        ...sx,
      }}
    >
      <Box
        component="pre"
        sx={{
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          letterSpacing: 0,
          margin: 0,
          padding: 1,
          whiteSpace: 'pre',
          textAlign: 'left',
          transform: 'scale(1)',
          transformOrigin: 'center center',
          position: 'relative',
          color: textColor,
          ...(!disableBackground && {
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 8,
              left: 8,
              right: 8,
              bottom: 8,
              backgroundColor: '#E0A0A0',
              opacity: 0.05,
              pointerEvents: 'none',
              zIndex: 2,
            },
          }),
        }}
      >
        {characterGrid.map((row, rowIndex) => (
          <div key={rowIndex}>
            {row.map((char) => {
              const key = `${char.row},${char.col}`;
              const displayChar = charOverrides.get(key) || char;
              
              return (
                <AsciiCharacter
                  key={key}
                  character={displayChar}
                  fontSize={fontSize}
                  onHover={enableHoverEffect ? handleHover : undefined}
                  overrideColor={textColor}
                />
              );
            })}
          </div>
        ))}
      </Box>
    </Box>
  );
};

export default AsciiArtDisplay;

// Re-export types and utilities for external use
export * from './types';
export * from './transformers';
export { buildCharacterGrid } from './AsciiCharacterGrid';
export { useAsciiAnimations } from './useAsciiAnimations';

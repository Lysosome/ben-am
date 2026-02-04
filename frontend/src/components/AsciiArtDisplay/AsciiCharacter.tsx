import { memo } from 'react';
import { AsciiCharacter as AsciiCharType } from './types';

interface AsciiCharacterProps {
  character: AsciiCharType;
  fontSize: number;
  onHover?: (row: number, col: number) => void;
  overrideColor?: string;
}

/**
 * Renders a single ASCII character with hover support
 * Memoized to prevent unnecessary re-renders
 */
export const AsciiCharacter = memo(({ character, fontSize, onHover, overrideColor }: AsciiCharacterProps) => {
  const handleMouseEnter = () => {
    if (onHover) {
      onHover(character.row, character.col);
    }
  };

  return (
    <span
      style={{
        color: overrideColor || character.color,
        display: 'inline-block',
        width: `${fontSize * 0.6}px`, // Monospace character width approximation
      }}
      onMouseEnter={handleMouseEnter}
    >
      {character.char}
    </span>
  );
});

AsciiCharacter.displayName = 'AsciiCharacter';

export default AsciiCharacter;

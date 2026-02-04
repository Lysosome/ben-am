import { useState, useRef, useEffect, useCallback } from 'react';
import { AsciiCharacter, CharTransformer } from './types';
import { getMaxColumns } from './AsciiCharacterGrid';

/**
 * Custom hook to manage ASCII art animations
 */
export function useAsciiAnimations(
  grid: AsciiCharacter[][],
  options: {
    enableHoverEffect?: boolean;
    enableMatrixRipple?: boolean;
    hoverTransformer?: CharTransformer;
    rippleInterval?: number;
    effectDuration?: number;
  }
) {
  const {
    enableHoverEffect = false,
    enableMatrixRipple = false,
    hoverTransformer,
    rippleInterval = 10000,
    effectDuration = 500,
  } = options;

  // Map of "row,col" -> temporary character override
  const [charOverrides, setCharOverrides] = useState<Map<string, AsciiCharacter>>(new Map());
  
  // Timers for cleanup
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /**
   * Apply a character transformation with auto-expiry
   */
  const applyEffect = useCallback(
    (row: number, col: number, transformer: CharTransformer, duration: number = effectDuration) => {
      const key = `${row},${col}`;
      const originalChar = grid[row]?.[col];
      
      if (!originalChar) return;

      // Apply transformation
      const newChar = transformer(originalChar);
      const overrideChar: AsciiCharacter = {
        ...originalChar,
        char: newChar,
      };

      setCharOverrides(prev => {
        const next = new Map(prev);
        next.set(key, overrideChar);
        return next;
      });

      // Clear any existing timer for this position
      const existingTimer = timers.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set timer to restore original character
      const timer = setTimeout(() => {
        setCharOverrides(prev => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        timers.current.delete(key);
      }, duration);

      timers.current.set(key, timer);
    },
    [grid, effectDuration]
  );

  /**
   * Trigger a column ripple effect (Matrix style)
   */
  const triggerColumnRipple = useCallback(
    (col: number, transformer: CharTransformer) => {
      const columnChars = grid
        .map((row, rowIndex) => ({ char: row[col], rowIndex }))
        .filter(item => item.char !== undefined);

      // Stagger the effect down the column
      columnChars.forEach(({ rowIndex }, index) => {
        setTimeout(() => {
          applyEffect(rowIndex, col, transformer, effectDuration);
        }, index * 50); // 50ms delay between each row
      });
    },
    [grid, applyEffect, effectDuration]
  );

  /**
   * Handle hover effect - affects a 3x3 grid centered at cursor
   */
  const handleHover = useCallback(
    (row: number, col: number) => {
      if (!enableHoverEffect || !hoverTransformer) return;
      
      // Apply effect to a 3x3 grid centered at the cursor
      for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
          // Check if the position is valid in the grid
          if (r >= 0 && r < grid.length && c >= 0 && grid[r] && c < grid[r].length) {
            applyEffect(r, c, hoverTransformer, effectDuration);
          }
        }
      }
    },
    [enableHoverEffect, hoverTransformer, applyEffect, effectDuration, grid]
  );

  /**
   * Matrix ripple interval effect
   */
  useEffect(() => {
    if (!enableMatrixRipple || grid.length === 0) return;

    const maxCols = getMaxColumns(grid);
    if (maxCols === 0) return;

    const intervalId = setInterval(() => {
      const randomCol = Math.floor(Math.random() * maxCols);
      // Use a simple random character transformer for matrix effect
      triggerColumnRipple(randomCol, () => {
        const matrixChars = '0123456789:';
        return matrixChars[Math.floor(Math.random() * matrixChars.length)];
      });
    }, rippleInterval);

    return () => clearInterval(intervalId);
  }, [enableMatrixRipple, grid, rippleInterval, triggerColumnRipple]);

  /**
   * Cleanup all timers on unmount
   */
  useEffect(() => {
    return () => {
      timers.current.forEach(timer => clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

  return {
    charOverrides,
    handleHover,
    applyEffect,
    triggerColumnRipple,
  };
}

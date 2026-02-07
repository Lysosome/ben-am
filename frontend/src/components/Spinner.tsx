import { Box } from '@mui/material';
import { useState, useEffect, useMemo } from 'react';
import animations from '../ascii-animations/loading';

interface SpinnerProps {
  color?: string;
}

const FRAME_DELAY_MS = 100;

// Simple inline fallback: a cycling braille spinner
const FALLBACK_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const Spinner = ({ color = '#E0A0A0' }: SpinnerProps) => {
  const frames = useMemo(() => {
    if (animations.length > 0) {
      return animations[Math.floor(Math.random() * animations.length)];
    }
    return FALLBACK_FRAMES;
  }, []);

  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % frames.length);
    }, FRAME_DELAY_MS);

    return () => clearInterval(interval);
  }, [frames.length]);

  return (
    <Box
      component="pre"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        fontSize: '0.5rem',
        lineHeight: 1.2,
        color,
        letterSpacing: '0.05em',
        whiteSpace: 'pre',
        margin: 0,
      }}
    >
      {frames[currentFrame]}
    </Box>
  );
};

export default Spinner;

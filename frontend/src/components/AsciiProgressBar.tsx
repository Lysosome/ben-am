import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

interface AsciiProgressBarProps {
  progress: number; // 0-100
  barWidth?: number; // Total width in characters (default: 50)
  showPercentage?: boolean; // Show percentage text below (default: true)
  fontColor?: string; // Color of the progress bar text (default: 'text.secondary')
  fontSize?: string; // Font size (default: '1rem')
  backgroundColor?: string; // Background color (default: 'transparent')
}

const AsciiProgressBar = ({ 
  progress, 
  barWidth = 50, 
  showPercentage = true,
  fontColor = 'text.secondary',
  fontSize = '1rem',
  backgroundColor = 'transparent',
}: AsciiProgressBarProps) => {
  const [leadingChar, setLeadingChar] = useState('>');

  // Animated leading character for ASCII progress bar
  useEffect(() => {
    if (progress >= 100) return;

    const chars = '0123456789'.split('');
    
    const intervalId = setInterval(() => {
      setLeadingChar(chars[Math.floor(Math.random() * chars.length)]);
    }, 100); // Rotate every 100ms

    return () => clearInterval(intervalId);
  }, [progress]);

  const renderProgressBar = () => {
    const filledWidth = Math.floor((progress / 100) * barWidth);
    const emptyWidth = Math.max(0, barWidth - filledWidth);
    
    // Create the bar - always exactly barWidth characters
    let filled = '';
    if (filledWidth > 0) {
      filled += '#'.repeat(Math.max(0, filledWidth - 1)); // Filled portion (minus leading char)
      if (progress < 100) {
        filled += leadingChar; // Animated leading character
      } else {
        filled += '#'; // When complete, fill with # instead
      }
    }
    const empty = ' '.repeat(emptyWidth);
    
    // Bracket at end marks the finish line
    return `[${filled}${empty}]`;
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          fontFamily: 'monospace',
          fontSize,
          backgroundColor,
          color: fontColor,
          padding: '12px',
          letterSpacing: '0.05em',
          overflow: 'hidden',
          textAlign: 'left',
          whiteSpace: 'pre',
        }}
      >
        {renderProgressBar()}
      </Box>
      {showPercentage && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          {progress}% complete
        </Typography>
      )}
    </Box>
  );
};

export default AsciiProgressBar;

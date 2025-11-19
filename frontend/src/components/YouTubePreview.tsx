import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Slider, Button } from '@mui/material';

interface YouTubePreviewProps {
  videoId: string;
  onTimeRangeChange: (start: number, end: number) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const YouTubePreview = ({ videoId, onTimeRangeChange }: YouTubePreviewProps) => {
  const [player, setPlayer] = useState<any>(null);
  const [duration, setDuration] = useState<number>(0);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 0]);
  const playerRef = useRef<HTMLDivElement>(null);
  const [apiReady, setApiReady] = useState(false);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setApiReady(true);
    };
  }, []);

  // Initialize player when API is ready
  useEffect(() => {
    if (!apiReady || !playerRef.current) return;

    const newPlayer = new window.YT.Player(playerRef.current, {
      height: '360',
      width: '640',
      videoId: videoId,
      events: {
        onReady: (event: any) => {
          const videoDuration = event.target.getDuration();
          setDuration(videoDuration);
          setTimeRange([0, Math.min(videoDuration, 600)]); // Default to full video or 10 min
          onTimeRangeChange(0, Math.min(videoDuration, 600));
        },
      },
    });

    setPlayer(newPlayer);

    return () => {
      newPlayer.destroy();
    };
  }, [apiReady, videoId]);

  const handleTimeRangeChange = (_event: Event, newValue: number | number[]) => {
    const [start, end] = newValue as [number, number];
    setTimeRange([start, end]);
    onTimeRangeChange(start, end);
  };

  const handlePreview = () => {
    if (player) {
      player.seekTo(timeRange[0], true);
      player.playVideo();
      
      // Stop at end time
      const checkInterval = setInterval(() => {
        const currentTime = player.getCurrentTime();
        if (currentTime >= timeRange[1]) {
          player.pauseVideo();
          clearInterval(checkInterval);
        }
      }, 100);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedDuration = timeRange[1] - timeRange[0];
  const isValid = selectedDuration <= 600;

  return (
    <Box>
      <Box
        ref={playerRef}
        sx={{
          width: '100%',
          aspectRatio: '16/9',
          bgcolor: 'black',
          mb: 2,
        }}
      />

      {duration > 0 && (
        <>
          <Typography variant="body2" gutterBottom>
            Select time range (max 10 minutes)
          </Typography>

          <Slider
            value={timeRange}
            onChange={handleTimeRangeChange}
            valueLabelDisplay="auto"
            valueLabelFormat={formatTime}
            min={0}
            max={duration}
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body2">
              Start: {formatTime(timeRange[0])}
            </Typography>
            <Typography
              variant="body2"
              color={isValid ? 'text.primary' : 'error'}
            >
              Duration: {formatTime(selectedDuration)}
              {!isValid && ' (exceeds 10 min limit)'}
            </Typography>
            <Typography variant="body2">End: {formatTime(timeRange[1])}</Typography>
          </Box>

          <Button variant="outlined" onClick={handlePreview} fullWidth>
            Preview Selection
          </Button>
        </>
      )}
    </Box>
  );
};

export default YouTubePreview;

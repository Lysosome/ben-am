import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  Fade,
} from '@mui/material';
import Spinner from '../components/Spinner';
import { getUserId, saveDJPreferences, getDJPreferences } from '../utils/user';
import { calendarApi } from '../api/client';
import DJMessageSetup from '../components/DJMessageSetup';
import YouTubePreview from '../components/YouTubePreview';
import type { SubmitSongRequest } from '../api/client';
import { formatBenAMDate, parseLocalDate } from '../utils/dateFormat';

interface SongData {
  youtubeURL: string;
  songTitle: string;
  startTime: number;
  endTime: number;
}

interface DJMessageData {
  djType: 'recorded' | 'tts';
  djName: string;
  djMessage?: string;
  djRecordingData?: string;
  friendEmail?: string;
}

const SongSetupPage = () => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const userId = getUserId();

  const [lockError, setLockError] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(true);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [songData, setSongData] = useState<SongData>({
    youtubeURL: '',
    songTitle: '',
    startTime: 0,
    endTime: 0,
  });
  const [djMessageData, setDJMessageData] = useState<DJMessageData | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isLoadingTitle, setIsLoadingTitle] = useState(false);

  // Lock the date when component mounts
  useEffect(() => {
    const lockDate = async () => {
      if (!date) return;

      try {
        const response = await calendarApi.lockDate(date, userId);
        if (!response.locked) {
          setLockError(response.message || 'Failed to lock date');
        }
      } catch (error) {
        setLockError('Failed to lock date. Please try again.');
      } finally {
        setIsLocking(false);
        // Trigger fade-in animation after lock completes
        setTimeout(() => setShouldAnimate(true), 50);
      }
    };

    lockDate();

    // Cleanup: unlock date when component unmounts (e.g., browser back button)
    return () => {
      if (date && !lockError) {
        // Don't await - fire and forget on unmount
        calendarApi.unlockDate(date, userId).catch((err) => {
          console.error('Failed to unlock date on unmount:', err);
        });
      }
    };
  }, [date, userId, lockError]);

  // Handle browser navigation events (back/forward buttons, tab close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Synchronous unlock attempt for page unload
      if (date && !lockError) {
        // Use sendBeacon for reliable fire-and-forget on page unload
        const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
        const url = `${apiBaseUrl}/unlock-date`;
        const blob = new Blob([JSON.stringify({ date, userId })], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [date, userId, lockError]);

  const submitMutation = useMutation({
    mutationFn: async (data: SubmitSongRequest) => {
      return calendarApi.submitSong(data);
    },
    onSuccess: (response) => {
      // Save DJ preferences for next time
      if (djMessageData) {
        saveDJPreferences({
          djName: djMessageData.djName,
          friendEmail: djMessageData.friendEmail,
        });
      }
      navigate(`/confirmation?jobId=${response.jobId}&date=${date}`);
    },
    onError: (error: any) => {
      // Error will be displayed in the UI below
      console.error('Submission error:', error);
    },
  });

  const handleCancel = async () => {
    if (date) {
      try {
        await calendarApi.unlockDate(date, userId);
      } catch (error) {
        console.error('Failed to unlock date:', error);
      }
    }
    navigate('/');
  };

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleYouTubeURLChange = (url: string) => {
    setSongData(prev => ({ ...prev, youtubeURL: url }));
    const id = extractVideoId(url);
    setVideoId(id);
    
    // Fetch video title when valid URL is entered
    if (id) {
      fetchVideoTitle(id);
    }
    // Don't clear songTitle when URL is invalid - let user keep their custom title
  };

  const fetchVideoTitle = async (videoId: string) => {
    setIsLoadingTitle(true);
    try {
      // Use YouTube oEmbed API to get video title
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (response.ok) {
        const data = await response.json();
        setSongData(prev => ({ ...prev, songTitle: data.title || '' }));
      }
    } catch (error) {
      console.error('Error fetching video title:', error);
    } finally {
      setIsLoadingTitle(false);
    }
  };

  const handleTimeRangeChange = (start: number, end: number) => {
    const duration = end - start;
    if (duration > 600) {
      // 10 minutes max
      alert('Song duration cannot exceed 10 minutes');
      return;
    }
    setSongData(prev => ({ ...prev, startTime: start, endTime: end }));
  };

  const handleSubmit = () => {
    if (!date) return;

    if (!songData.youtubeURL || !songData.songTitle.trim() || !djMessageData) {
      alert('Please complete all required fields');
      return;
    }

    const duration = songData.endTime - songData.startTime;
    if (duration > 600) {
      alert('Song duration cannot exceed 10 minutes');
      return;
    }

    const payload: SubmitSongRequest = {
      date,
      youtubeURL: songData.youtubeURL,
      songTitle: songData.songTitle,
      startTime: songData.startTime,
      endTime: songData.endTime,
      djType: djMessageData.djType,
      djName: djMessageData.djName,
      djMessage: djMessageData.djMessage,
      djRecordingData: djMessageData.djRecordingData,
      friendEmail: djMessageData.friendEmail,
      userId,
    };

    submitMutation.mutate(payload);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {date && (
        <>
          <Typography variant="h4" gutterBottom>
            {formatBenAMDate(parseLocalDate(date))}
          </Typography>
          <Typography variant="body1" sx={{ mb: 4 }}>
            {`<QUERY> What song should wake Ben up`}
          </Typography>
        </>
      )}

      <Fade in={isLocking} timeout={{ enter: 600, exit: 400 }} easing="ease-in-out" unmountOnExit>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <Spinner />
        </Box>
      </Fade>

      {lockError && (
        <>
          <Alert severity="error" sx={{ mb: 2 }}>
            {lockError}
          </Alert>
          <Button variant="contained" onClick={() => navigate('/')}>
            Back to Calendar
          </Button>
        </>
      )}

      {!isLocking && !lockError && (
        <Box
          sx={{
            opacity: shouldAnimate ? 1 : 0,
            transition: 'opacity 1.0s ease-in-out',
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 'bold'}} color='text.secondary'>
            {`01/SONG`}
          </Typography>
          <Paper sx={{ p: 3, mb: 3 }}>
        <TextField
          fullWidth
          label="YouTube URL"
          value={songData.youtubeURL}
          onChange={(e) => handleYouTubeURLChange(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Song Title"
          value={songData.songTitle}
          onChange={(e) => setSongData({ ...songData, songTitle: e.target.value })}
          required
          disabled={isLoadingTitle}
          placeholder={isLoadingTitle ? 'Loading title...' : 'Enter song title'}
          sx={{ mb: 2 }}
          helperText={isLoadingTitle ? 'Fetching title from YouTube...' : ''}
        />

        {videoId && (
          <YouTubePreview
            videoId={videoId}
            onTimeRangeChange={handleTimeRangeChange}
          />
        )}
      </Paper>

      <Typography variant="body1" sx={{ fontWeight: 'bold'}} color='text.secondary'>
        {`02/MESSAGE`}
      </Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {`<CONTEXT> You are the DJ`}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {`<QUERY> What message do you want to leave for Ben`}
        </Typography>
        <DJMessageSetup 
          onChange={setDJMessageData} 
          initialPrefs={getDJPreferences()}
        />
      </Paper>

      {submitMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {submitMutation.error?.response?.data?.error || 'Failed to submit song. Please try again.'}
          {submitMutation.error?.response?.data?.duplicate && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                This song was already submitted for{' '}
                <strong>{submitMutation.error.response.data.duplicate.date}</strong> by{' '}
                <strong>{submitMutation.error.response.data.duplicate.djName}</strong>.
              </Typography>
            </Box>
          )}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="outlined" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!songData.youtubeURL || !songData.songTitle.trim() || !djMessageData || submitMutation.isPending || isLoadingTitle}
        >
          {submitMutation.isPending ? 'Submitting...' : 'Submit song'}
        </Button>
      </Box>
        </Box>
      )}
    </Container>
  );
};

export default SongSetupPage;

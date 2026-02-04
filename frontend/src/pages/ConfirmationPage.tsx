import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Container,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  LinearProgress,
  Paper,
} from '@mui/material';
import { CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { calendarApi } from '../api/client';
import { getUserId } from '../utils/user';
import { formatBenAMDate } from '../utils/dateFormat';

const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
const FAKE_PROGRESS_DURATION = 60 * 1000; // 60 seconds to reach 99% (typical time is ~60 sec for a short video)

const ConfirmationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');
  const date = searchParams.get('date');
  const userId = getUserId();

  const [finalStatus, setFinalStatus] = useState<'pending' | 'completed' | 'failed' | 'timeout'>('pending');
  const [startTime] = useState(Date.now());
  const [fakeProgress, setFakeProgress] = useState(0);

  const cancelMutation = useMutation({
    mutationFn: () => calendarApi.cancelSubmission({ date: date!, userId }),
    onSuccess: () => {
      console.log('Submission cancelled');
      navigate('/');
    },
    onError: (error) => {
      console.error('Failed to cancel submission:', error);
      // Still navigate back even if cancel fails
      navigate('/');
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => calendarApi.cancelSubmission({ date: date!, userId }),
    onSuccess: () => {
      console.log('Failed submission cleared, navigating to edit');
      navigate(`/song-setup/${date}`);
    },
    onError: (error) => {
      console.error('Failed to clear submission:', error);
      // Navigate anyway - maybe the lock will work
      navigate(`/song-setup/${date}`);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['status', jobId],
    queryFn: () => calendarApi.getStatus(jobId!),
    enabled: !!jobId && finalStatus === 'pending',
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      
      // Check for timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= TIMEOUT_MS && finalStatus === 'pending') {
        setFinalStatus('timeout');
        // Cancel the submission to free up the date
        if (date) {
          cancelMutation.mutate();
        }
        return false;
      }
      
      // Stop polling once completed or failed
      if (status === 'completed' || status === 'failed') {
        return false;
      }
      return 3000; // Poll every 3 seconds
    },
  });

  useEffect(() => {
    if (data?.status === 'completed' || data?.status === 'failed') {
      setFinalStatus(data.status);
      setFakeProgress(100); // Jump to 100% when done
    }
  }, [data]);

  // Fake progress bar that progresses from 0 to 99% over 1 minute with jitter
  useEffect(() => {
    if (finalStatus !== 'pending') return;

    const intervalId = setInterval(() => {
      setFakeProgress(prev => {
        const elapsed = Date.now() - startTime;
        const baseProgress = Math.min(99, (elapsed / FAKE_PROGRESS_DURATION) * 99);
        
        // Add random jitter (±2%) but don't go backwards or over 99%
        const jitter = (Math.random() - 0.5) * 4;
        const newProgress = Math.min(99, Math.max(prev, baseProgress + jitter));
        
        return Math.round(newProgress);
      });
    }, 500); // Update every 500ms for smooth animation

    return () => clearInterval(intervalId);
  }, [finalStatus, startTime]);

  // Set up timeout check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (finalStatus === 'pending') {
        setFinalStatus('timeout');
        if (date) {
          cancelMutation.mutate();
        }
      }
    }, TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [finalStatus, date, cancelMutation]);

  if (!jobId || !date) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">Invalid submission. Missing job information.</Alert>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/')}>
          Back to Calendar
        </Button>
      </Container>
    );
  }

  const getStatusDisplay = () => {
    if (isLoading && !data) {
      return {
        icon: <CircularProgress />,
        title: 'Initializing...',
        message: 'Starting song processing',
        color: 'info' as const,
      };
    }

    if (finalStatus === 'completed') {
      return {
        icon: <CheckCircle sx={{ fontSize: 60, color: 'success.main' }} />,
        title: `${formatBenAMDate(new Date(date))} SUCCESS`,
        message: `Song added. Ben will wake up to your selection at 7 AM`,
        color: 'success' as const,
      };
    }

    if (finalStatus === 'timeout') {
      return {
        icon: <ErrorIcon sx={{ fontSize: 60, color: 'error.main' }} />,
        title: 'Processing timeout',
        message: 'Song processing took too long and has been cancelled. The date has been released for another submission. Please try again with a different song or check your internet connection.',
        color: 'error' as const,
      };
    }

    if (finalStatus === 'failed') {
      return {
        icon: <ErrorIcon sx={{ fontSize: 60, color: 'error.main' }} />,
        title: 'Processing failed',
        message: data?.error || 'Failed to process your song. Please try again.',
        color: 'error' as const,
      };
    }

    // Processing
    const statusText = data?.status === 'processing' 
      ? 'Downloading and converting your song...'
      : 'Waiting to start processing...';

    return {
      icon: <CircularProgress size={60} />,
      title: 'Processing song',
      message: statusText,
      color: 'info' as const,
      progress: fakeProgress,
    };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Box sx={{ mb: 3 }}>{statusDisplay.icon}</Box>

        <Typography variant="h4" gutterBottom>
          {statusDisplay.title}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {statusDisplay.message}
        </Typography>

        {statusDisplay.progress !== undefined && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress
              variant="determinate"
              value={statusDisplay.progress}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {statusDisplay.progress}% complete
            </Typography>
          </Box>
        )}

        {finalStatus === 'timeout' && (
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/')}
            fullWidth
          >
            Back to calendar
          </Button>
        )}

        {finalStatus === 'failed' && (
          <>
            <Button
              variant="contained"
              size="large"
              onClick={() => retryMutation.mutate()}
              fullWidth
              sx={{ mb: 2 }}
              disabled={retryMutation.isPending}
            >
              {retryMutation.isPending ? 'Clearing...' : 'Try a different video'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => cancelMutation.mutate()}
              fullWidth
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Releasing...' : 'Release date & back to calendar'}
            </Button>
          </>
        )}

        {finalStatus === 'completed' && (
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/')}
            fullWidth
          >
            Back to calendar
          </Button>
        )}
      </Paper>

      {finalStatus === 'completed' && (
        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>What happens next?</strong>
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            • Your song will play at 7 AM on {date}
            <br />
            • Your DJ message will introduce the song
            <br />
            • Check your email for confirmation (if provided)
          </Typography>
        </Alert>
      )}
    </Container>
  );
};

export default ConfirmationPage;

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  LinearProgress,
  Alert,
} from '@mui/material';
import { Mic, Stop, TextFields } from '@mui/icons-material';

interface DJMessageData {
  djType: 'recorded' | 'tts';
  djName: string;
  djMessage?: string;
  djRecordingData?: string;
  friendEmail?: string;
}

interface DJMessageSetupProps {
  onChange: (data: DJMessageData | null) => void;
  initialPrefs?: { djName: string; friendEmail?: string } | null;
}

const DJMessageSetup = ({ onChange, initialPrefs }: DJMessageSetupProps) => {
  const [djType, setDjType] = useState<'recorded' | 'tts'>('tts');
  const [djName, setDjName] = useState(initialPrefs?.djName || '');
  const [djMessage, setDjMessage] = useState('');
  const [friendEmail, setFriendEmail] = useState(initialPrefs?.friendEmail || '');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Notify parent of changes
    if (!djName) {
      onChange(null);
      return;
    }

    if (djType === 'tts') {
      onChange({
        djType: 'tts',
        djName,
        djMessage: djMessage || `Good morning! Time to wake up to ${djName}!`,
        friendEmail: friendEmail || undefined,
      });
    } else if (djType === 'recorded' && audioBlob) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({
          djType: 'recorded',
          djName,
          djRecordingData: reader.result as string,
          friendEmail: friendEmail || undefined,
        });
      };
      reader.readAsDataURL(audioBlob);
    } else {
      onChange(null);
    }
  }, [djType, djName, djMessage, friendEmail, audioBlob, onChange]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        // Use the actual MIME type from the MediaRecorder (usually webm/opus)
        // Don't force audio/mpeg - the backend will convert it
        const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
        console.log('Recording MIME type:', actualMimeType);
        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      setError(null);

      // Start timer and auto-stop at 60 seconds
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.');
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleTypeChange = (_event: React.MouseEvent<HTMLElement>, newType: 'recorded' | 'tts' | null) => {
    if (newType) {
      setDjType(newType);
      setAudioBlob(null);
      setError(null);
    }
  };

  return (
    <Box>
      <ToggleButtonGroup
        value={djType}
        exclusive
        onChange={handleTypeChange}
        fullWidth
        sx={{ mb: 3 }}
      >
        <ToggleButton value="tts">
          <TextFields sx={{ mr: 1 }} />
          Text-to-speech
        </ToggleButton>
        <ToggleButton value="recorded">
          <Mic sx={{ mr: 1 }} />
          Record audio
        </ToggleButton>
      </ToggleButtonGroup>

      <TextField
        fullWidth
        required
        label="DJ name"
        value={djName}
        onChange={(e) => setDjName(e.target.value)}
        placeholder="Your name"
        sx={{ mb: 2 }}
      />

      {djType === 'tts' ? (
        <TextField
          fullWidth
          multiline
          rows={3}
          label="DJ message (optional)"
          value={djMessage}
          onChange={(e) => setDjMessage(e.target.value)}
          placeholder="Good morning! Time to wake up to..."
          sx={{ mb: 2 }}
        />
      ) : (
        <Box sx={{ mb: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 4 }}>
            {!isRecording && !audioBlob && (
              <Button
                variant="outlined"
                startIcon={<Mic />}
                onClick={startRecording}
              >
                Start recording
              </Button>
            )}

            {isRecording && (
              <>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Stop />}
                  onClick={stopRecording}
                >
                  Stop recording
                </Button>
                <Typography variant="body2">
                  {recordingDuration}s / 60s
                </Typography>
              </>
            )}

            {audioBlob && !isRecording && (
              <>
                <audio controls src={URL.createObjectURL(audioBlob)} />
                <Button variant="outlined" onClick={() => setAudioBlob(null)}>
                  Re-record
                </Button>
              </>
            )}
          </Box>

          {isRecording && (
            <LinearProgress
              variant="determinate"
              value={(recordingDuration / 60) * 100}
            />
          )}
        </Box>
      )}

      <TextField
        fullWidth
        type="email"
        label="Your email (optional)"
        value={friendEmail}
        onChange={(e) => setFriendEmail(e.target.value)}
        placeholder="friend@example.com"
        helperText="<CONTEXT> Enter your email to receive a song review from Ben"
      />
    </Box>
  );
};

export default DJMessageSetup;

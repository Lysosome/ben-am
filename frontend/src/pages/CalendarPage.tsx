import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import logo from '../img/logo_bg_anim.gif';
import { Lock } from '@mui/icons-material';
import { calendarApi } from '../api/client';
import type { CalendarEntry } from '../api/client';
import { formatBenAMDate } from '../utils/dateFormat';
import { AsciiArtDisplay } from '../components/AsciiArtDisplay';
import { MUSIC_NOTE_ASCII, LOCK_ASCII } from '../constants/asciiArt';

const CalendarPage = () => {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['calendar'],
    queryFn: calendarApi.getCalendar,
    refetchInterval: 5000, // Refresh every 5 seconds
    refetchIntervalInBackground: false, // Stop refetching when tab is not visible
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  const handleDateClick = (date: string, isAvailable: boolean, isLocked: boolean) => {
    if (isAvailable && !isLocked) {
      navigate(`/song-setup/${date}`);
    }
  };

  if (isLoading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">
          Failed to load calendar. Please try again later.
        </Alert>
      </Container>
    );
  }

  // Generate next 30 days (starting from today, but today is not selectable)
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const dates: Date[] = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }

  // Create lookup map: date string -> calendar entry
  const calendarMap = new Map<string, CalendarEntry>();
  data?.calendar.forEach(entry => {
    calendarMap.set(entry.date, entry);
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Box
          component="img"
          src={logo}
          alt="Logo"
          sx={{ mt: 2, width: 300 }}
        />
      </Box>

      <Grid container spacing={3}>
        {dates.map((date) => {
          const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
          const entry = calendarMap.get(dateString);
          const isToday = dateString === todayString;
          const isAvailable = !entry && !isToday; // Not available if today or has entry
          const isLocked = entry?.isLocked || false;
          const isClickable = isAvailable && !isLocked;

          return (
            <Grid item xs={12} sm={6} md={4} key={dateString}>
              <Card
                sx={{
                  height: '17.5em',
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': isClickable
                    ? {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      }
                    : {},
                }}
                onClick={() => handleDateClick(dateString, isAvailable, isLocked)}
              >
                <AsciiArtDisplay
                  asciiArt={entry?.asciiThumbnail || (isAvailable ? MUSIC_NOTE_ASCII : LOCK_ASCII)}
                  alt={entry?.songTitle || (isAvailable ? 'Available slot' : 'Locked slot')}
                  charactersPerLine={60}
                  pixelWidth={330}
                  enableMatrixRipple={entry?.asciiThumbnail ? true : false}
                  enableHoverEffect={true}
                  textColor={!entry?.asciiThumbnail ? '#E0A0A0' : undefined}
                  disableBackground={!entry?.asciiThumbnail}
                />

                <CardContent>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    {formatBenAMDate(date)}
                  </Typography>

                  {!isAvailable && entry && (
                    <>
                      <Typography variant="body1" color="text.secondary" sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {entry.songTitle}
                      </Typography>
                      { entry.djName && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mt: 0.5 }}
                        >
                          DJ: {entry.djName}
                        </Typography>
                      )}
                    </>
                  )}

                  {isLocked && (
                    <Chip
                      label="Locked"
                      size="small"
                      icon={<Lock />}
                      color="warning"
                      sx={{ mt: 1 }}
                    />
                  )}

                  {isToday && !entry && (
                    <Chip
                      label="Today"
                      size="small"
                      color="default"
                      sx={{ mt: 1 }}
                    />
                  )}

                  {isAvailable && !isLocked && (
                    <Chip
                      label="Available"
                      size="small"
                      color="success"
                      sx={{ mt: 1 }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
};

export default CalendarPage;

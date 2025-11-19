import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { Lock, MusicNote } from '@mui/icons-material';
import { calendarApi } from '../api/client';
import type { CalendarEntry } from '../api/client';

const CalendarPage = () => {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['calendar'],
    queryFn: calendarApi.getCalendar,
    refetchInterval: 30000, // Refresh every 30 seconds to see new locks
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
        <Typography variant="h3" component="h1" gutterBottom>
          Ben AM Wake-Up Calendar
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Pick a date to add your morning song
        </Typography>
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
                  cursor: isClickable ? 'pointer' : 'default',
                  opacity: isAvailable ? 1 : 0.6,
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
                {entry?.thumbnailURL ? (
                  <CardMedia
                    component="img"
                    height="180"
                    image={entry.thumbnailURL}
                    alt={entry.songTitle}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 180,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'grey.800',
                    }}
                  >
                    {isAvailable ? (
                      <MusicNote sx={{ fontSize: 60, color: 'grey.600' }} />
                    ) : (
                      <Lock sx={{ fontSize: 60, color: 'grey.600' }} />
                    )}
                  </Box>
                )}

                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Typography>

                  {!isAvailable && entry && (
                    <>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {entry.songTitle}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 0.5 }}
                      >
                        DJ: {entry.djName}
                      </Typography>
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

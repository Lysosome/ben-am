import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Fade,
  Grid,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
  Pagination,
} from '@mui/material';
import logo from '../img/logo_bg_anim.gif';
import { Lock } from '@mui/icons-material';
import { calendarApi } from '../api/client';
import Spinner from '../components/Spinner';
import type { CalendarEntry } from '../api/client';
import { formatBenAMDate } from '../utils/dateFormat';
import { AsciiArtDisplay } from '../components/AsciiArtDisplay';
import { MUSIC_NOTE_ASCII, LOCK_ASCII } from '../constants/asciiArt';

const CalendarPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [shouldAnimate, setShouldAnimate] = useState(false);
  
  // Initialize page from URL query param, default to 1
  const pageFromUrl = parseInt(searchParams.get('page') || '1', 10);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [calendarData, setCalendarData] = useState<CalendarEntry[]>([]);
  const [clickedDate, setClickedDate] = useState<string | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const ITEMS_PER_PAGE = 9;
  const NUM_PAGES = 4;

  // Initial full load (with thumbnails)
  const { data: initialData, isLoading: isInitialLoading, error } = useQuery({
    queryKey: ['calendar-full'],
    queryFn: () => calendarApi.getCalendar(false),
    refetchOnWindowFocus: false,
    staleTime: Infinity, // Don't refetch this automatically
  });

  // Lightweight polling (without thumbnails) - only runs after initial load
  const { data: lightweightData } = useQuery({
    queryKey: ['calendar-lightweight'],
    queryFn: () => calendarApi.getCalendar(true),
    enabled: !isInitialLoading && !!initialData,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Check if we need to refetch full calendar (e.g., after submission)
  useEffect(() => {
    const state = location.state as { refetchFull?: boolean };
    if (state?.refetchFull) {
      queryClient.invalidateQueries({ queryKey: ['calendar-full'] });
      // Clear the state so it doesn't refetch on every render
      window.history.replaceState({}, document.title);
    }
  }, [location.state, queryClient]);

  // Initialize with full data on first load
  useEffect(() => {
    if (initialData?.calendar && calendarData.length === 0) {
      setCalendarData(initialData.calendar);
      setShouldAnimate(true);
    }
  }, [initialData, calendarData.length]);

  // Update from lightweight polls: merge updates and add new entries as locked
  useEffect(() => {
    if (!lightweightData?.calendar) return;

    setCalendarData(prev => {
      const dateMap = new Map(prev.map(e => [e.date, e]));
      lightweightData.calendar.forEach(entry => {
        if (dateMap.has(entry.date)) {
          // Merge lightweight updates (locks, etc) but keep heavy fields
          const existing = dateMap.get(entry.date)!;
          dateMap.set(entry.date, {
            ...entry,
            thumbnailURL: existing.thumbnailURL,
            asciiThumbnail: existing.asciiThumbnail,
          });
        } else {
          // New entry detected - add as locked until full refresh
          dateMap.set(entry.date, {
            ...entry,
            isLocked: true,
          });
        }
      });
      return Array.from(dateMap.values());
    });
  }, [lightweightData]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    setSearchParams({ page: page.toString() });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDateClick = (date: string, isAvailable: boolean, isLocked: boolean, hasEntry: boolean) => {
    if (isAvailable && !isLocked) {
      // Navigate to song setup for available dates
      navigate(`/song-setup/${date}`);
    } else if (hasEntry && !isLocked) {
      // Show alternate content for occupied dates
      // Clear any existing timer
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      
      // Set the clicked date to trigger the fade transition
      setClickedDate(date);
      
      // Reset after 8 seconds
      clickTimerRef.current = setTimeout(() => {
        setClickedDate(null);
      }, 8000);
    }
  };

  if (error) {
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
        <Alert severity="error">
          Failed to load calendar. Please try again later.
        </Alert>
      </Container>
    );
  }

  // Generate next NUM_PAGES pages (starting from today, but today is not selectable)
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const dates: Date[] = [];
  for (let i = 0; i < ITEMS_PER_PAGE*NUM_PAGES; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }

  // Create lookup map: date string -> calendar entry
  const calendarMap = new Map<string, CalendarEntry>();
  calendarData.forEach(entry => {
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

      <Fade in={isInitialLoading} timeout={{ enter: 600, exit: 400 }} easing="ease-in-out" unmountOnExit>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <Spinner />
        </Box>
      </Fade>

      {!isInitialLoading && (
      <>
      <Grid container spacing={3}>
        {dates.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((date, index) => {
          const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
          const entry = calendarMap.get(dateString);
          const isToday = dateString === todayString;
          const isAvailable = !entry && !isToday; // Not available if today or has entry
          const isLocked = entry?.isLocked || false;
          const hasEntry = !!entry && !isLocked;
          const isClickable = isAvailable && !isLocked;
          const isShowingAlternate = clickedDate === dateString;

          return (
            <Grid 
              item 
              xs={12} 
              sm={6} 
              md={4} 
              key={dateString}
              sx={{
                opacity: shouldAnimate ? 1 : 0,
                transition: 'opacity 0.4s ease-in-out',
                transitionDelay: `${index * 75}ms`,
              }}
            >
              <Card
                sx={{
                  height: '17.5em',
                  cursor: isClickable || hasEntry ? 'pointer' : 'default',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': isClickable || hasEntry
                    ? {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      }
                    : {},
                }}
                onClick={() => handleDateClick(dateString, isAvailable, isLocked, hasEntry)}
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

                <Box sx={{ position: 'relative' }}>
                  {/* Default CardContent */}
                  <Fade in={!isShowingAlternate} timeout={500} unmountOnExit>
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
                  </Fade>

                  {/* Alternate CardContent */}
                  {hasEntry && (
                    <Fade in={isShowingAlternate} timeout={500} unmountOnExit>
                      <CardContent sx={{ position: 'absolute', top: -10, left: 0, right: 0 }}>
                        <Typography variant="body2" color="text.secondary" sx={{
                          textAlign: 'center',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          On <strong>{formatBenAMDate(date)}</strong>, Ben will wake up to <strong>{entry?.songTitle}</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                          What else should he wake up to? Click an available date to choose
                        </Typography>
                      </CardContent>
                    </Fade>
                  )}
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Pagination 
          count={Math.ceil(dates.length / ITEMS_PER_PAGE)} 
          page={currentPage}
          onChange={handlePageChange}
          color="primary"
          size="large"
        />
      </Box>
      </>
      )}
    </Container>
  );
};

export default CalendarPage;

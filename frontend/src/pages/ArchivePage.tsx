import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Fade,
  Grid,
  Card,
  CardContent,
  Typography,
  Alert,
  Pagination,
} from '@mui/material';
import logo from '../img/logo_bg_anim.gif';
import { calendarApi } from '../api/client';
import Spinner from '../components/Spinner';
import type { CalendarEntry } from '../api/client';
import { formatBenAMDate } from '../utils/dateFormat';
import { AsciiArtDisplay } from '../components/AsciiArtDisplay';

const ITEMS_PER_PAGE = 9;

const ArchivePage = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['calendar-full'],
    queryFn: () => calendarApi.getCalendar(false),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Past songs sorted newest-first
  const archiveEntries: CalendarEntry[] = (() => {
    if (!data?.calendar) return [];
    const todayString = new Date().toISOString().split('T')[0];
    return data.calendar
      .filter(e => e.date < todayString && e.songTitle && !e.isLocked)
      .sort((a, b) => b.date.localeCompare(a.date));
  })();

  useEffect(() => {
    if (archiveEntries.length > 0) {
      setShouldAnimate(true);
    }
  }, [archiveEntries.length]);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pageEntries = archiveEntries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );
  const totalPages = Math.ceil(archiveEntries.length / ITEMS_PER_PAGE);

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box component="img" src={logo} alt="Logo" sx={{ mt: 2, width: 300 }} />
        </Box>
        <Alert severity="error">Failed to load archive. Please try again later.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Box component="img" src={logo} alt="Logo" sx={{ mt: 2, width: 300 }} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 , justifyContent: 'center' }}>
        <Button
          variant="outlined"
          size="small"
          color="secondary"
          onClick={() => navigate('/')}
          sx={{ fontSize: '1rem', py: 0.25, px: 1 }}
        >
          Back to calendar
        </Button>
      </Box>

      <Fade in={isLoading} timeout={{ enter: 600, exit: 400 }} easing="ease-in-out" unmountOnExit>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <Spinner />
        </Box>
      </Fade>

      {!isLoading && archiveEntries.length === 0 && (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Typography variant="body1" color="text.secondary">
            No past songs yet — check back after the first wake-up!
          </Typography>
        </Box>
      )}

      {!isLoading && archiveEntries.length > 0 && (
        <>
          <Grid container spacing={3}>
            {pageEntries.map((entry, index) => {
              const date = new Date(`${entry.date}T12:00:00`);
              return (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  key={entry.date}
                  sx={{
                    opacity: shouldAnimate ? 1 : 0,
                    transition: 'opacity 0.4s ease-in-out',
                    transitionDelay: `${index * 75}ms`,
                  }}
                >
                  <Card sx={{ height: '20em' }}>
                    <AsciiArtDisplay
                      asciiArt={entry.asciiThumbnail || ''}
                      alt={entry.songTitle}
                      charactersPerLine={60}
                      pixelWidth={330}
                      enableMatrixRipple={!!entry.asciiThumbnail}
                      enableHoverEffect={false}
                    />
                    <CardContent>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        {formatBenAMDate(date)}
                      </Typography>
                      <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {entry.songTitle}
                      </Typography>
                      {entry.djName && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mt: 0.5 }}
                        >
                          DJ: {entry.djName}
                        </Typography>
                      )}
                      {entry.review && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{
                            mt: 0.75,
                            fontStyle: 'italic',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          "{entry.review}"
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default ArchivePage;

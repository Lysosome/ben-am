import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Block, CheckCircle, SwapHoriz, Delete, MusicNote } from '@mui/icons-material';
import { calendarApi, adminApi } from '../api/client';
import type { CalendarEntry } from '../api/client';

type AdminAction = 'block' | 'unblock' | 'move' | 'delete';

interface DialogState {
  open: boolean;
  action: AdminAction | null;
  date: string | null;
  entry: CalendarEntry | null;
}

const AdminPage = () => {
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<DialogState>({
    open: false,
    action: null,
    date: null,
    entry: null,
  });

  // Helper to parse YYYY-MM-DD as local date (not UTC)
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const [blockReason, setBlockReason] = useState('');
  const [moveToDate, setMoveToDate] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['calendar'],
    queryFn: calendarApi.getCalendar,
    refetchInterval: 30000,
  });

  const blockMutation = useMutation({
    mutationFn: ({ date, reason }: { date: string; reason?: string }) => adminApi.blockDate(date, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setSnackbar({ open: true, message: 'Date blocked successfully', severity: 'success' });
      handleCloseDialog();
    },
    onError: (error: any) => {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'Failed to block date', 
        severity: 'error' 
      });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (date: string) => adminApi.unblockDate(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setSnackbar({ open: true, message: 'Date unblocked successfully', severity: 'success' });
      handleCloseDialog();
    },
    onError: (error: any) => {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'Failed to unblock date', 
        severity: 'error' 
      });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ fromDate, toDate }: { fromDate: string; toDate: string }) => 
      adminApi.moveSong(fromDate, toDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setSnackbar({ open: true, message: 'Song moved successfully', severity: 'success' });
      handleCloseDialog();
    },
    onError: (error: any) => {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'Failed to move song', 
        severity: 'error' 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (date: string) => adminApi.deleteSong(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setSnackbar({ open: true, message: 'Song deleted successfully', severity: 'success' });
      handleCloseDialog();
    },
    onError: (error: any) => {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'Failed to delete song', 
        severity: 'error' 
      });
    },
  });

  const handleOpenDialog = (action: AdminAction, date: string, entry: CalendarEntry | null) => {
    setDialogState({ open: true, action, date, entry });
    setBlockReason('');
    setMoveToDate('');
  };

  const handleCloseDialog = () => {
    setDialogState({ open: false, action: null, date: null, entry: null });
    setBlockReason('');
    setMoveToDate('');
  };

  const handleConfirmAction = () => {
    if (!dialogState.date) return;

    switch (dialogState.action) {
      case 'block':
        blockMutation.mutate({ date: dialogState.date, reason: blockReason });
        break;
      case 'unblock':
        unblockMutation.mutate(dialogState.date);
        break;
      case 'move':
        if (moveToDate) {
          moveMutation.mutate({ fromDate: dialogState.date, toDate: moveToDate });
        }
        break;
      case 'delete':
        deleteMutation.mutate(dialogState.date);
        break;
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
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
        <Alert severity="error">Failed to load calendar data</Alert>
      </Container>
    );
  }

  // Generate next 30 days for available dates display
  const today = new Date();
  const dates: Date[] = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }

  // Create lookup map
  const calendarMap = new Map<string, CalendarEntry>();
  data?.calendar.forEach(entry => {
    calendarMap.set(entry.date, entry);
  });

  // Get available dates for move dropdown
  const availableDates = dates
    .map(d => d.toISOString().split('T')[0])
    .filter(dateString => !calendarMap.has(dateString));

  // Filter to show only dates with songs or blocked dates
  const occupiedDates = dates
    .map(date => {
      const dateString = date.toISOString().split('T')[0];
      return { date: dateString, entry: calendarMap.get(dateString) };
    })
    .filter(({ entry }) => entry && !entry.isAvailable);

  const isBlocked = (entry: CalendarEntry | undefined) => 
    entry?.songTitle === '[BLOCKED]';

  const isFutureDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Admin Controls
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage calendar dates and songs
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Block Available Date
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Mark a future date as unavailable for submissions
        </Typography>
        <Grid container spacing={2}>
          {availableDates.slice(1).map(dateString => { // Skip today
            const date = parseLocalDate(dateString);
            return (
              <Grid item xs={12} sm={6} md={4} key={dateString}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Typography>
                    <Chip label="Available" size="small" color="success" sx={{ mb: 1 }} />
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<Block />}
                      fullWidth
                      onClick={() => handleOpenDialog('block', dateString, null)}
                    >
                      Block Date
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Occupied Dates
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Manage existing songs and blocked dates
        </Typography>
        <Grid container spacing={2}>
          {occupiedDates.map(({ date: dateString, entry }) => {
            if (!entry) return null;
            const date = parseLocalDate(dateString);
            const blocked = isBlocked(entry);
            const isFuture = isFutureDate(dateString);

            return (
              <Grid item xs={12} sm={6} md={4} key={dateString}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6">
                        {date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Typography>
                      {blocked ? (
                        <Block color="warning" />
                      ) : (
                        <MusicNote color="primary" />
                      )}
                    </Box>

                    {blocked ? (
                      <>
                        <Chip label="BLOCKED" size="small" color="warning" sx={{ mb: 2 }} />
                        <Button
                          variant="outlined"
                          color="success"
                          startIcon={<CheckCircle />}
                          fullWidth
                          onClick={() => handleOpenDialog('unblock', dateString, entry)}
                          sx={{ mb: 1 }}
                        >
                          Unblock
                        </Button>
                      </>
                    ) : (
                      <>
                        <Typography variant="body2" noWrap sx={{ mb: 0.5 }}>
                          {entry.songTitle}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                          DJ: {entry.djName}
                        </Typography>

                        {isFuture && (
                          <>
                            <Button
                              variant="outlined"
                              color="primary"
                              startIcon={<SwapHoriz />}
                              fullWidth
                              onClick={() => handleOpenDialog('move', dateString, entry)}
                              sx={{ mb: 1 }}
                            >
                              Move Song
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={<Delete />}
                              fullWidth
                              onClick={() => handleOpenDialog('delete', dateString, entry)}
                            >
                              Delete Song
                            </Button>
                          </>
                        )}

                        {!isFuture && (
                          <Chip label="Past Date" size="small" color="default" />
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog open={dialogState.open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogState.action === 'block' && 'Block Date'}
          {dialogState.action === 'unblock' && 'Unblock Date'}
          {dialogState.action === 'move' && 'Move Song'}
          {dialogState.action === 'delete' && 'Delete Song'}
        </DialogTitle>
        <DialogContent>
          {dialogState.action === 'block' && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Mark {dialogState.date} as unavailable for submissions?
              </Typography>
              <TextField
                fullWidth
                label="Reason (optional)"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g., Holiday, Special event"
              />
            </>
          )}

          {dialogState.action === 'unblock' && (
            <Typography variant="body2">
              Remove the block from {dialogState.date}? This will make the date available for submissions.
            </Typography>
          )}

          {dialogState.action === 'move' && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Move "{dialogState.entry?.songTitle}" from {dialogState.date} to:
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Target Date</InputLabel>
                <Select
                  value={moveToDate}
                  onChange={(e) => setMoveToDate(e.target.value)}
                  label="Target Date"
                >
                  {availableDates.map(dateString => (
                    <MenuItem key={dateString} value={dateString}>
                      {parseLocalDate(dateString).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}

          {dialogState.action === 'delete' && (
            <Alert severity="warning">
              <Typography variant="body2" sx={{ mb: 1 }}>
                Permanently delete "{dialogState.entry?.songTitle}" from {dialogState.date}?
              </Typography>
              <Typography variant="body2">
                This will remove all associated files from S3 and cannot be undone.
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmAction}
            color={dialogState.action === 'delete' ? 'error' : 'primary'}
            variant="contained"
            disabled={
              (dialogState.action === 'move' && !moveToDate) ||
              blockMutation.isPending ||
              unblockMutation.isPending ||
              moveMutation.isPending ||
              deleteMutation.isPending
            }
          >
            {(blockMutation.isPending || unblockMutation.isPending || moveMutation.isPending || deleteMutation.isPending)
              ? 'Processing...'
              : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AdminPage;

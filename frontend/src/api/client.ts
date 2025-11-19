import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Preserve error response data for better error messages
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Attach response data to error for easy access
      error.response = error.response;
    }
    return Promise.reject(error);
  }
);

// Types matching backend API
export interface CalendarEntry {
  date: string;
  songTitle: string;
  thumbnailURL?: string;
  djName: string;
  isAvailable: boolean;
  isLocked?: boolean;
  lockedBy?: string;
}

export interface LockDateResponse {
  success: boolean;
  locked: boolean;
  expiresAt?: number;
  message?: string;
}

export interface SubmitSongRequest {
  date: string;
  youtubeURL: string;
  songTitle: string; // Required field
  startTime?: number;
  endTime?: number;
  djType: 'recorded' | 'tts';
  djName: string;
  djMessage?: string;
  djRecordingData?: string;
  friendEmail?: string;
  userId: string;
}

export interface SubmitSongResponse {
  success: boolean;
  jobId: string;
  date: string;
  message?: string;
}

export interface StatusResponse {
  success: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  date?: string;
}

// API Functions
export const calendarApi = {
  getCalendar: async (): Promise<{ calendar: CalendarEntry[] }> => {
    const response = await apiClient.get('/calendar');
    return response.data;
  },

  lockDate: async (date: string, userId: string): Promise<LockDateResponse> => {
    const response = await apiClient.post('/lock-date', { date, userId });
    return response.data;
  },

  unlockDate: async (date: string, userId: string): Promise<{ success: boolean; message?: string }> => {
    const response = await apiClient.post('/unlock-date', { date, userId });
    return response.data;
  },

  submitSong: async (data: SubmitSongRequest): Promise<SubmitSongResponse> => {
    const response = await apiClient.post('/submit-song', data);
    return response.data;
  },

  getStatus: async (jobId: string): Promise<StatusResponse> => {
    const response = await apiClient.get(`/status/${jobId}`);
    return response.data;
  },

  submitReview: async (data: {
    date: string;
    userId: string;
    audioData: string;
    friendEmail: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const response = await apiClient.post('/reviews', data);
    return response.data;
  },

  cancelSubmission: async (data: {
    date: string;
    userId: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const response = await apiClient.post('/cancel-submission', data);
    return response.data;
  },
};

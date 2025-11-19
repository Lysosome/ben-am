/**
 * Shared TypeScript types for Ben AM backend
 */

// DynamoDB item types
export interface SongEntry {
  date: string; // YYYY-MM-DD
  songTitle: string;
  youtubeURL: string;
  videoId: string; // YouTube video ID for duplicate detection
  s3SongKey: string;
  thumbnailS3Key?: string;
  djName: string;
  djType: 'recorded' | 'tts';
  djMessage: string;
  s3DJKey?: string;
  friendEmail?: string;
  submittedBy: string; // Cookie-based user ID
  createdAt: string; // ISO timestamp
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  jobId?: string;
  errorMessage?: string;
}

export interface LockEntry {
  PK: string; // LOCK#YYYY-MM-DD
  lockHolder: string; // Cookie ID
  expiresAt: number; // Unix timestamp (TTL field)
  createdAt: number;
}

export interface ProcessingStatus {
  id: string;
  date: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  result?: {
    s3SongKey: string;
    thumbnailS3Key: string;
    duration: number;
  };
}

// API request/response types
export interface LockDateRequest {
  date: string; // YYYY-MM-DD
  userId: string; // Cookie ID
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
  songTitle?: string;
  startTime?: number; // Optional trim start (seconds)
  endTime?: number; // Optional trim end (seconds)
  djType: 'recorded' | 'tts';
  djName: string;
  djMessage?: string; // For TTS
  djRecordingData?: string; // Base64 encoded audio for recorded
  friendEmail?: string;
  userId: string; // Cookie ID
}

export interface SubmitSongResponse {
  success: boolean;
  jobId: string;
  date: string;
  message?: string;
}

export interface CalendarEntry {
  date: string;
  songTitle: string;
  thumbnailURL?: string;
  djName: string;
  isAvailable: boolean;
  isLocked?: boolean;
  lockedBy?: string;
}

export interface ReviewRequest {
  date: string;
  userId: string;
  audioData: string; // Base64 encoded
  friendEmail: string;
}

// YouTube-DL processor types
export interface YouTubeDownloadJob {
  jobId: string;
  date: string;
  youtubeURL: string;
  startTime?: number;
  endTime?: number;
  maxDuration: number;
}

export interface YouTubeDownloadResult {
  success: boolean;
  s3SongKey?: string;
  thumbnailS3Key?: string;
  duration?: number;
  error?: string;
}

// Environment variable types
export interface AlexaSkillEnv {
  TABLE_NAME: string;
  S3_BUCKET: string;
  SES_EMAIL_SENDER: string;
}

export interface APIEnv {
  TABLE_NAME: string;
  S3_BUCKET: string;
  SES_EMAIL_SENDER: string;
  YOUTUBE_DL_LAMBDA_ARN: string;
  DATE_LOCK_TTL_MINUTES: string;
  MAX_SONG_DURATION_SECONDS: string;
  MAX_DJ_RECORDING_SECONDS: string;
}

export interface YouTubeDLEnv {
  S3_BUCKET: string;
  TABLE_NAME: string;
  MAX_SONG_DURATION_SECONDS: string;
}

import Cookies from 'js-cookie';
import { v4 as uuidv4 } from 'uuid';

const USER_ID_COOKIE_KEY = 'ben-am-user-id';
const DJ_PREFS_COOKIE_KEY = 'ben-am-dj-prefs';
const COOKIE_EXPIRY_DAYS = 365;

export const getUserId = (): string => {
  let userId = Cookies.get(USER_ID_COOKIE_KEY);
  
  if (!userId) {
    userId = uuidv4();
    Cookies.set(USER_ID_COOKIE_KEY, userId, { expires: COOKIE_EXPIRY_DAYS });
  }
  
  return userId;
};

export interface DJPreferences {
  djName: string;
  friendEmail?: string;
}

export const saveDJPreferences = (prefs: DJPreferences): void => {
  Cookies.set(DJ_PREFS_COOKIE_KEY, JSON.stringify(prefs), { expires: COOKIE_EXPIRY_DAYS });
};

export const getDJPreferences = (): DJPreferences | null => {
  const prefsJson = Cookies.get(DJ_PREFS_COOKIE_KEY);
  
  if (!prefsJson) {
    return null;
  }
  
  try {
    return JSON.parse(prefsJson);
  } catch {
    return null;
  }
};

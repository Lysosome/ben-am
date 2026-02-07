/**
 * Formats a date in the custom Ben AM style: "TUE//20-JAN"
 * @param date - The date to format
 * @returns Formatted date string like "TUE//20-JAN"
 */
export function formatBenAMDate(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  
  return `${weekday}//${day}-${month}`;
}

/**
 * Formats a date in a longer format for admin purposes: "FRIDAY//01-MARCH-2026"
 * @param date - The date to format
 * @returns Formatted date string like "FRIDAY//01-MARCH-2026"
 */
export function formatBenAMDateLong(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  const year = date.getFullYear();
  
  return `${weekday}//${day}-${month}-${year}`;
}


// Helper to parse YYYY-MM-DD as local date (not UTC)
export const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

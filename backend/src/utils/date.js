/**
 * Timezone and Date Utility for BBDU Hosteller
 * Configured for Indian Standard Time (IST / Asia/Kolkata)
 */

export const HOSTEL_TIMEZONE = 'Asia/Kolkata';

export const DAYS_OF_WEEK_LIST = Object.freeze([
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]);

/**
 * Returns current date in 'YYYY-MM-DD' formatted for the configured timezone
 */
export const getTodayDateString = (tz = HOSTEL_TIMEZONE) => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
};

/**
 * Resolves day of week in uppercase ('MONDAY'..'SUNDAY') in the configured timezone
 * @param {string|Date} dateInput - YYYY-MM-DD string or Date instance
 * @param {string} tz - IANA timezone identifier
 */
export const getDayOfWeek = (dateInput = new Date(), tz = HOSTEL_TIMEZONE) => {
  let date;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().split('-').map(Number);
    // Use UTC noon to prevent border-crossing shifts in any timezone calculation
    date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  } else {
    date = new Date(dateInput);
  }

  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(date);
  return dayName.toUpperCase();
};

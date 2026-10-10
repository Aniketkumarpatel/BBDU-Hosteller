/**
 * Small wording helpers for the student screens (DEC-031). Pure, no React.
 */
import { splitDuration } from './jobPresentation.js';

const LOCALE = { en: 'en-IN', hi: 'hi-IN' };

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * "5:00 PM" when the time is today, "12 Oct, 5:00 PM" on any other day. Empty for a bad date.
 * @param {string | Date} value
 * @param {'en' | 'hi'} language
 */
export const formatWhen = (value, language = 'en', now = new Date()) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const locale = LOCALE[language] || LOCALE.en;
  const time = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  if (sameDay(date, now)) return time;
  // Hindi short months end in an abbreviation sign that renders like a degree mark, so spell it out
  const month = language === 'hi' ? 'long' : 'short';
  return `${date.toLocaleDateString(locale, { day: 'numeric', month })}, ${time}`;
};

/** "2 hr", "45 min" or "3 days" for the "time left" line. */
export const formatLeft = (t, minutes) => {
  const { unit, n } = splitDuration(minutes);
  return t(`time.${unit}`, { n });
};

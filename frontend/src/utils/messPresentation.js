/**
 * Rules for the simplified Mess screens (DEC-037). Pure, no React, no network.
 * Dates are calendar dates in the hostel's time zone, written "YYYY-MM-DD", the same form
 * the server uses for a day's menu.
 */
import { MEAL_ORDER, mealForHour } from './studentPresentation.js';

export const HOSTEL_TIMEZONE = 'Asia/Kolkata';
export const MEALS = MEAL_ORDER;

const MAX_DISHES = 20;
const MAX_DISH_LENGTH = 60;

/** Today's calendar date at the hostel, whatever time zone the phone is set to. */
export const todayKey = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: HOSTEL_TIMEZONE }).format(now);

/** The hour of the day (0 to 23) at the hostel. */
export const hourAtHostel = (now = new Date()) => {
  const part = new Intl.DateTimeFormat('en-GB', { timeZone: HOSTEL_TIMEZONE, hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(now)
    .find((p) => p.type === 'hour');
  return Number(part?.value ?? 0);
};

const toUtcDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** The calendar date `days` before (negative) or after (positive) a date. */
export const shiftDay = (key, days) => {
  const date = toUtcDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** 'MONDAY' to 'SUNDAY' for a calendar date. */
export const weekdayOf = (key) => WEEKDAYS[toUtcDate(key).getUTCDay()];

/**
 * The row of day buttons: a few days back, today, a few days ahead.
 * @returns {Array<{ key: string, offset: number }>}
 */
export const buildDayStrip = (today, before = 1, after = 1) => {
  const days = [];
  for (let offset = -before; offset <= after; offset += 1) days.push({ key: shiftDay(today, offset), offset });
  return days;
};

/**
 * Where a meal is in the day, from the student's point of view. The server stores no serving
 * times, so "now" and "next" follow the rough time of day (the same rule the Home screen uses).
 * @returns {'served' | 'now' | 'next' | 'later'}
 */
export const mealPhase = ({ meal, dateKey, today, hour }) => {
  if (dateKey < today) return 'served';
  if (dateKey > today) return 'later';
  const index = MEALS.indexOf(meal);
  const current = MEALS.indexOf(mealForHour(hour));
  if (index < current) return 'served';
  if (index === current) return 'now';
  return index === current + 1 ? 'next' : 'later';
};

/** A meal can be rated once it has been or is being served, and only if a menu was published. */
export const canRate = ({ phase, hasMenu }) => hasMenu && (phase === 'served' || phase === 'now');

const QUALITY_BY_STARS = { 5: 'EXCELLENT', 4: 'GOOD', 3: 'AVERAGE', 2: 'POOR', 1: 'VERY_POOR' };
const QUICK_VALUE = { good: 5, ok: 3, bad: 1 };

/**
 * One tap of stars becomes everything the server asks for. The optional quick answers
 * (taste, clean, enough) override their own score; anything left out follows the stars.
 * @param {number} stars 1 to 5
 * @param {{ taste?: 'good' | 'ok' | 'bad', clean?: 'good' | 'ok' | 'bad', enough?: 'good' | 'ok' | 'bad' }} [quick]
 */
export const starsToFeedback = (stars, quick = {}) => {
  const rating = Math.min(5, Math.max(1, Math.round(Number(stars) || 0)));
  const pick = (answer) => QUICK_VALUE[answer] ?? rating;
  return {
    rating,
    foodQuality: QUALITY_BY_STARS[rating],
    taste: pick(quick.taste),
    hygiene: pick(quick.clean),
    quantity: pick(quick.enough),
  };
};

/**
 * Dishes typed one per line (or separated by commas) into the list the server stores.
 * @returns {{ items: Array<{ name: string, category: string }>, problem: null | 'empty' | 'tooMany' | 'tooLong' }}
 */
export const parseDishes = (text) => {
  const seen = new Set();
  const names = String(text || '')
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (names.length === 0) return { items: [], problem: 'empty' };
  if (names.length > MAX_DISHES) return { items: [], problem: 'tooMany' };
  if (names.some((name) => name.length > MAX_DISH_LENGTH)) return { items: [], problem: 'tooLong' };
  return { items: names.map((name) => ({ name, category: 'Main Course' })), problem: null };
};

/** The dish names of a menu, one per line, for the edit form. */
export const dishesText = (menu) => (menu?.menuItems || []).map((item) => item?.name).filter(Boolean).join('\n');

/** @returns {'missing' | 'draft' | 'published'} */
export const menuStatus = (menu) => {
  if (!menu || !(menu.menuItems || []).some((item) => item?.name)) return 'missing';
  return menu.isPublished ? 'published' : 'draft';
};

/** The student's own ratings as "date|MEAL" -> stars, so a rated meal can say so. */
export const ratedMap = (feedbacks) => {
  const map = new Map();
  for (const f of feedbacks || []) {
    if (f?.mealDate && f?.mealType) map.set(`${String(f.mealDate).slice(0, 10)}|${f.mealType}`, f.rating);
  }
  return map;
};

const PRIORITY_RANK = { URGENT: 0, IMPORTANT: 1, NORMAL: 2 };

/** Notices with the urgent ones first, then the newest. */
export const sortNotices = (notices) =>
  [...(notices || [])].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

/**
 * Date arithmetic utilities for Smart Preventive Maintenance Scheduling
 */

/**
 * Calculates the next due date from a base date, frequency, and unit,
 * with boundary clamping for months (e.g. Jan 31 + 1 month = Feb 28/29).
 *
 * @param {Date|string|number} baseDate - The starting date
 * @param {number} frequency - Positive integer
 * @param {'DAYS'|'WEEKS'|'MONTHS'} frequencyUnit - Frequency unit
 * @returns {Date} The calculated next due date
 */
export const calculateNextDueDate = (baseDate, frequency, frequencyUnit = 'MONTHS') => {
  const d = new Date(baseDate);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid baseDate provided to calculateNextDueDate');
  }

  const freq = parseInt(frequency, 10);
  if (!freq || freq < 1) {
    throw new Error('Frequency must be a positive integer');
  }

  const unit = String(frequencyUnit).toUpperCase();

  if (unit === 'DAYS') {
    const result = new Date(d);
    result.setDate(result.getDate() + freq);
    return result;
  }

  if (unit === 'WEEKS') {
    const result = new Date(d);
    result.setDate(result.getDate() + freq * 7);
    return result;
  }

  if (unit === 'MONTHS') {
    const originalDay = d.getDate();
    const originalHours = d.getHours();
    const originalMinutes = d.getMinutes();
    const originalSeconds = d.getSeconds();
    const originalMs = d.getMilliseconds();

    // Compute target year and month
    let targetYear = d.getFullYear();
    let targetMonth = d.getMonth() + freq;

    // Adjust years if targetMonth >= 12
    if (targetMonth >= 12) {
      targetYear += Math.floor(targetMonth / 12);
      targetMonth = targetMonth % 12;
    }

    // Determine the maximum number of days in the target month
    // Month is 0-indexed: passing targetMonth + 1 with day 0 gives last day of targetMonth
    const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const clampedDay = Math.min(originalDay, maxDaysInTargetMonth);

    const result = new Date(targetYear, targetMonth, clampedDay, originalHours, originalMinutes, originalSeconds, originalMs);
    return result;
  }

  throw new Error(`Unsupported frequency unit: ${frequencyUnit}`);
};

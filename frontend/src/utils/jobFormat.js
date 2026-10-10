import { splitDuration } from './jobPresentation.js';

/**
 * Turns minutes into a friendly phrase such as "45 min", "3 hr" or "2 days".
 * @param {(key: string, params?: object) => string} t translate function
 * @param {number} minutes
 */
export const formatDuration = (t, minutes) => {
  const { unit, n } = splitDuration(minutes);
  return t(`time.${unit}`, { n });
};

/**
 * Sentence for a job's deadline, or an empty string when there is nothing to say.
 * @param {(key: string, params?: object) => string} t translate function
 * @param {{ state: string, minutes: number }} dueInfo from getDueInfo()
 */
export const describeDue = (t, dueInfo) => {
  if (!dueInfo || dueInfo.state === 'none') return '';
  return t(`due.${dueInfo.state}`, { time: formatDuration(t, dueInfo.minutes) });
};

/**
 * Short block names such as "1" or "A" read like stray characters, so they get the word
 * "Block" in front. Longer names are real names and are shown as they are.
 * @param {(key: string, params?: object) => string} t translate function
 * @param {string} name
 */
export const describeBlock = (t, name) => {
  const clean = String(name ?? '').trim();
  if (!clean) return '';
  return clean.length <= 3 ? `${t('job.block')} ${clean}` : clean;
};

import complaintService from './complaintService.js';

// What a technician can do to a job, mapped to the existing complaint API calls.
const ACTIONS = {
  acknowledge: (id) => complaintService.acknowledgeComplaint(id),
  start: (id) => complaintService.startWorkOnComplaint(id),
  resume: (id) => complaintService.resumeWorkOnComplaint(id),
  finish: (id, note) => complaintService.resolveComplaint(id, { resolutionNote: note }),
};

/** Dictionary key of the confirmation shown after each action succeeds. */
export const TOAST_KEY = {
  acknowledge: 'toast.acknowledged',
  start: 'toast.started',
  resume: 'toast.resumed',
  finish: 'toast.finished',
};

/**
 * Runs one technician action.
 * @param {'acknowledge' | 'start' | 'resume' | 'finish'} action
 * @param {string} id complaint id
 * @param {string} [note] work note, required for 'finish' (the server needs 5 to 2000 characters)
 */
export const performJobAction = async (action, id, note) => {
  const run = ACTIONS[action];
  if (!run) throw new Error(`Unknown job action: ${action}`);
  const res = await run(id, note);
  if (!res?.success) {
    throw new Error(res?.message || 'Action failed');
  }
  return res;
};

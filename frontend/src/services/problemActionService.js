import complaintService from './complaintService.js';
import { needsTriage } from '../utils/problemPresentation.js';

const assertOk = (res, fallback) => {
  if (!res?.success) throw new Error(res?.message || fallback);
  return res;
};

/**
 * Gives a new problem to a technician in one step. The backend needs two: SUBMITTED ->
 * TRIAGED (sets the urgency) then TRIAGED -> ASSIGNED. If the second call fails after
 * the first succeeded, the problem is left TRIAGED, so the error is marked `partial`
 * and the screen can say so. Retrying then skips the triage (the status is TRIAGED).
 *
 * @param {object} problem complaint as returned by the API
 * @param {{ technician: { id: string, departmentId: string }, priority: string }} choice
 */
export const giveToTechnician = async (problem, { technician, priority }) => {
  let triaged = false;
  try {
    if (needsTriage(problem)) {
      assertOk(
        await complaintService.triageComplaint(problem._id, {
          priority,
          ...(technician.departmentId ? { departmentId: technician.departmentId } : {}),
          triageNote: '',
        }),
        'Triage failed'
      );
      triaged = true;
    }
    return assertOk(
      await complaintService.assignComplaint(problem._id, {
        assignedTo: technician.id,
        ...(technician.departmentId ? { departmentId: technician.departmentId } : {}),
        reason: 'Given by the warden',
      }),
      'Assignment failed'
    );
  } catch (error) {
    error.partial = triaged;
    throw error;
  }
};

/**
 * Moves an already-given problem to another technician. The server needs a reason of at
 * least 5 characters and only allows this while the problem is given, seen or being fixed.
 */
export const changeTechnician = async (problem, { technician, reason }) =>
  assertOk(
    await complaintService.reassignComplaint(problem._id, {
      assignedTo: technician.id,
      reason,
      ...(technician.departmentId ? { departmentId: technician.departmentId } : {}),
    }),
    'Change failed'
  );

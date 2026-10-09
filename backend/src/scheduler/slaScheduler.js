import { processSlaAndEscalations } from '../services/sla.service.js';
import env from '../config/env.js';

let intervalId = null;
let isProcessing = false;

/**
 * Execute a single cycle of the SLA & Escalation monitor safely
 */
export const runSlaSchedulerOnce = async () => {
  if (isProcessing) {
    return { skipped: true, reason: 'Previous scheduler pass is still in progress' };
  }

  isProcessing = true;
  try {
    const results = await processSlaAndEscalations({ pilotMode: env.PILOT_MODE });
    return results;
  } catch (err) {
    console.error('[slaScheduler] Cycle execution error:', err.message);
    return { error: err.message };
  } finally {
    isProcessing = false;
  }
};

/**
 * Start recurring background scheduler
 */
export const startSlaScheduler = (intervalMs = 60000) => {
  if (intervalId) {
    clearInterval(intervalId);
  }

  console.log(`[slaScheduler] SLA monitoring & auto-escalation engine started (interval: ${intervalMs}ms)`);
  console.log(
    env.PILOT_MODE
      ? '[slaScheduler] PILOT_MODE=true: auto-escalation OFF, deferred-module jobs skipped, breaches notify hostel wardens only'
      : '[slaScheduler] PILOT_MODE=false: full automatic escalation chain and all module jobs are ACTIVE'
  );

  intervalId = setInterval(async () => {
    try {
      await runSlaSchedulerOnce();
    } catch (err) {
      console.error('[slaScheduler] Interval run failed:', err.message);
    }
  }, intervalMs);

  return intervalId;
};

/**
 * Stop recurring background scheduler
 */
export const stopSlaScheduler = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[slaScheduler] SLA monitor stopped');
  }
};

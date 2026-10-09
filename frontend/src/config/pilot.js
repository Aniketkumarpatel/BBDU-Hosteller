/**
 * Pilot Mode Configuration (DEC-015)
 * When true, confines primary navigation and dashboard focus to Complaint-to-Resolution MVP.
 * Set VITE_PILOT_MODE=false in .env to expose all platform modules.
 */
export const IS_PILOT_MODE = import.meta.env.VITE_PILOT_MODE !== 'false';

import PilotShell from './PilotShell.jsx';

/** Technician shell (DEC-026): one destination, "My jobs", so no menu bar. */
export default function StaffJobsLayout() {
  return <PilotShell homePath="/staff/jobs" />;
}

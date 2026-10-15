import { useLocation } from 'react-router-dom';
import PilotShell from './PilotShell.jsx';

const TABS = [
  { to: '/warden/problems', labelKey: 'nav.problems' },
  { to: '/warden/people', labelKey: 'nav.people' },
  { to: '/virtual-visit', labelKey: 'nav.rooms' },
  { to: '/mess', labelKey: 'tab.mess' },
];

// Rooms is a wide, gallery-style page: it gets more room than the problem list
const WIDE_PATHS = ['/virtual-visit'];

/** Warden shell (DEC-029): Problems and People, plus Rooms (virtual visit media) and Mess, as simple tabs. */
export default function WardenPilotLayout() {
  const { pathname } = useLocation();
  const wide = WIDE_PATHS.some((path) => pathname.startsWith(path));
  return <PilotShell homePath="/warden/problems" tabs={TABS} width={wide ? 'max-w-6xl' : 'max-w-3xl'} />;
}

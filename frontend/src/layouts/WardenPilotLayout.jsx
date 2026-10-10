import PilotShell from './PilotShell.jsx';

const TABS = [
  { to: '/warden/problems', labelKey: 'nav.problems' },
  { to: '/warden/people', labelKey: 'nav.people' },
];

/** Warden shell (DEC-029): two destinations, Problems and People, as simple tabs. */
export default function WardenPilotLayout() {
  return <PilotShell homePath="/warden/problems" tabs={TABS} width="max-w-3xl" />;
}

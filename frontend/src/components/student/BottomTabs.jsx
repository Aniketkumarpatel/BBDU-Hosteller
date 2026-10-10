import { NavLink } from 'react-router-dom';
import Icon from '../jobs/icons.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const TABS = [
  { to: '/student/home', icon: 'home', labelKey: 'tab.home' },
  { to: '/student/problems', icon: 'list', labelKey: 'nav.problems' },
  { to: '/student/alerts', icon: 'bell', labelKey: 'tab.alerts', badge: true },
  { to: '/student/me', icon: 'user', labelKey: 'tab.me' },
];

/**
 * Fixed bottom navigation, within thumb reach on a phone. The active tab is the brand
 * colour; the alerts tab shows how many are unread.
 */
export default function BottomTabs({ unread = 0 }) {
  const { t } = useLanguage();

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-xl">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `relative flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition ${
                isActive ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <span className="relative">
              <Icon name={tab.icon} className="h-6 w-6" />
              {tab.badge && unread > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </span>
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

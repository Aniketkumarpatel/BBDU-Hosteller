import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { getMe } from '../services/auth.service.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import LanguageToggle from '../components/common/LanguageToggle.jsx';
import BottomTabs from '../components/student/BottomTabs.jsx';
import Icon from '../components/jobs/icons.jsx';
import useUnreadCount from '../hooks/useUnreadCount.js';
import { describeBlock } from '../utils/jobFormat.js';

/**
 * Student shell (DEC-031): the room where a delivery address would be, the language
 * switch, and bottom tabs. The profile (with the populated hostel, block and room) is
 * loaded once here and handed to every student screen through the outlet context.
 * The report flow hides the bottom tabs so the form has the whole screen.
 */
export default function StudentPilotLayout() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const [profile, setProfile] = useState(null);
  const { count: unread, refresh: refreshUnread, setCount: setUnread } = useUnreadCount();

  useEffect(() => {
    let active = true;
    getMe()
      .then((res) => {
        if (active && res?.success) setProfile(res.data.user);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const room = profile?.roomNumber || profile?.roomId?.roomNumber || '';
  const block = profile?.blockId?.name || '';
  const hostel = profile?.hostelId?.name || '';
  const fullScreen = pathname.startsWith('/student/report');

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto min-h-screen max-w-xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
        {!fullScreen && (
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-4 py-2.5 backdrop-blur-xs">
            <Link to="/student/home" aria-label={t('student.yourRoom')} className="flex min-w-0 items-center gap-2">
              <Icon name="pin" className="h-6 w-6 shrink-0 text-brand-600" strokeWidth={2.2} />
              <span className="min-w-0">
                <span className="block truncate text-base font-bold leading-snug text-slate-900">
                  {[room ? t('job.room', { room }) : t('student.noRoom'), block ? describeBlock(t, block) : ''].filter(Boolean).join(', ')}
                </span>
                {hostel && <span className="block truncate text-xs leading-snug text-slate-500">{hostel}</span>}
              </span>
            </Link>
            <LanguageToggle />
          </header>
        )}

        <main className={fullScreen ? 'pb-6' : 'pb-24'}>
          <Outlet context={{ profile, unread, refreshUnread, setUnread }} />
        </main>
      </div>

      {!fullScreen && <BottomTabs unread={unread} />}
    </div>
  );
}

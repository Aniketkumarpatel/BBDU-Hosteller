import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import messService from '../../services/messService.js';
import useAutoRefresh from '../../hooks/useAutoRefresh.js';
import DayStrip from '../../components/mess/DayStrip.jsx';
import MealCard from '../../components/mess/MealCard.jsx';
import MenuSheet from '../../components/mess/MenuSheet.jsx';
import NoticeSheet from '../../components/mess/NoticeSheet.jsx';
import NoticeList from '../../components/mess/NoticeList.jsx';
import FoodHealth from '../../components/mess/FoodHealth.jsx';
import { STATUS_STYLE } from '../../components/mess/mealStyle.js';
import WeeklyMenuUploadModal from './WeeklyMenuUploadModal.jsx';
import Icon from '../../components/jobs/icons.jsx';
import { MEALS, buildDayStrip, menuStatus, todayKey, weekdayOf } from '../../utils/messPresentation.js';

const OWN_HOSTEL_ROLES = ['WARDEN', 'HOSTEL_STAFF'];

/**
 * The Mess screen for people who run it (Warden, technician, Authority, Admin): the four meals of
 * a day with what students can see, one big button to upload the weekly menu photo, the notices,
 * and a short "how is the food" block. A Warden sees the mess of their own hostel; the Authority
 * and Admin pick any mess (DEC-037).
 */
export default function ManagerMess() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const today = todayKey();
  const days = useMemo(() => buildDayStrip(today, 1, 6), [today]);
  const [day, setDay] = useState(today);

  const [messes, setMesses] = useState([]);
  const [messId, setMessId] = useState('');
  const [state, setState] = useState('loading'); // loading | ready | none | error
  const [meals, setMeals] = useState(null);
  const [notices, setNotices] = useState([]);
  const [offNotices, setOffNotices] = useState([]);
  const [stats, setStats] = useState(null);
  const [comments, setComments] = useState([]);
  const [problems, setProblems] = useState([]);
  const [editMeal, setEditMeal] = useState('');
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busyNotice, setBusyNotice] = useState('');
  const [toast, setToast] = useState('');

  const ownHostelId = user?.hostelId?._id || user?.hostelId;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await messService.getMesses({ isActive: true });
        if (!active) return;
        let list = res?.data || [];
        // A Warden or technician runs the mess of their own hostel; the server enforces it as well
        if (OWN_HOSTEL_ROLES.includes(user?.role)) {
          list = list.filter((m) => String(m.hostelId?._id || m.hostelId) === String(ownHostelId));
        }
        setMesses(list);
        setMessId(list[0]?._id || '');
        setState(list.length ? 'ready' : 'none');
      } catch {
        if (active) setState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.role, ownHostelId]);

  const load = useCallback(async () => {
    if (!messId) return;
    // Each block shows as soon as its own data arrives, and one failing or slow request never holds
    // back or blanks the others; a failed block keeps what it had until the next refresh
    const part = (request, apply) =>
      request.then((res) => res?.success && apply(res.data)).catch(() => {});
    await Promise.all([
      part(messService.getTodayMenu(messId, { date: day }), (data) => setMeals(data.meals)),
      // The server returns only active notices unless asked, so a manager asks for both kinds to be able to switch one back on
      part(messService.getNotices({ messId, isActive: true }), setNotices),
      part(messService.getNotices({ messId, isActive: false }), (data) => setOffNotices(data.slice(0, 5))),
      part(messService.getMessDashboard({ messId }), (data) => setStats(data.stats)),
      part(messService.getMessFeedbacks({ messId, limit: 5 }), setComments),
      part(messService.getFoodQualityAnalytics({ messId }), (data) => setProblems((data.repeatedIssues || []).slice(0, 3))),
    ]);
  }, [messId, day]);

  useEffect(() => {
    setMeals(null);
    load();
  }, [load]);

  useAutoRefresh(load);

  const flash = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 4000);
  };

  const saveMenu = async ({ items, isPublished, repeat }) => {
    try {
      await messService.createOrUpdateMenu(messId, {
        date: repeat ? null : day,
        dayOfWeek: weekdayOf(day),
        mealType: editMeal,
        menuItems: items,
        isPublished,
      });
    } catch (err) {
      throw new Error(err?.response?.status === 403 ? err.response.data.message : t('mess.err.save'));
    }
    setEditMeal('');
    flash(isPublished ? t('mess.status.published') : t('mess.status.draft'));
    await load();
  };

  const postNotice = async (input) => {
    try {
      await messService.createNotice({ messId, ...input });
    } catch (err) {
      throw new Error(err?.response?.status === 403 ? err.response.data.message : t('mess.notice.err'));
    }
    setNoticeOpen(false);
    await load();
  };

  const toggleNotice = async (notice) => {
    setBusyNotice(notice._id);
    try {
      await messService.toggleNoticeActive(notice._id, notice.isActive === false);
      await load();
    } catch {
      // the list stays as it was; the person can tap again
    } finally {
      setBusyNotice('');
    }
  };

  if (state === 'loading') {
    return <div className="mx-auto max-w-2xl space-y-3 px-4 py-4" aria-busy="true" aria-label={t('common.loading')}><div className="h-28 animate-pulse rounded-3xl bg-slate-100" /><div className="h-28 animate-pulse rounded-3xl bg-slate-100" /></div>;
  }

  if (state !== 'ready') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-4">
        <p role={state === 'error' ? 'alert' : undefined} className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-lg font-semibold text-slate-600">
          {state === 'error' ? t('error.load') : t('mess.mgr.none')}
        </p>
      </div>
    );
  }

  const mess = messes.find((m) => m._id === messId) || messes[0];
  const editMenu = editMeal ? meals?.[editMeal] || null : null;
  const allNotices = [...notices, ...offNotices];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-4">
      <div>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">{mess.name}</h1>
        {messes.length > 1 && (
          <select
            aria-label={t('mess.pick')}
            value={messId}
            onChange={(e) => setMessId(e.target.value)}
            className="mt-2 h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 text-base font-semibold text-slate-800 focus:border-brand-500 focus:outline-hidden focus:ring-4 focus:ring-brand-100"
          >
            {messes.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {toast && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-green-600 p-4 text-lg font-semibold text-white shadow-md">
          <Icon name="check" className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={3} />
          <span>{toast}</span>
        </div>
      )}

      <section className="rounded-3xl bg-linear-to-br from-brand-500 to-brand-700 p-5 text-white shadow-[0_12px_28px_-8px_rgba(200,42,65,0.55)]">
        <p className="max-w-xs text-base text-white/90">{t('mess.mgr.upload.hint')}</p>
        <button type="button" onClick={() => setUploadOpen(true)} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2 text-base font-bold text-brand-700 transition active:scale-95">
          <Icon name="plus" className="h-5 w-5" strokeWidth={3} />
          {t('mess.mgr.upload')}
        </button>
      </section>

      <DayStrip days={days} selected={day} onSelect={setDay} />

      <div className="space-y-3">
        {MEALS.map((meal) => {
          const menu = meals?.[meal] || null;
          const status = menuStatus(menu);
          const dishes = (menu?.menuItems || []).map((item) => item?.name).filter(Boolean);
          return (
            <MealCard
              key={meal}
              meal={meal}
              dishes={dishes}
              empty={meals ? t('mess.notAdded') : t('common.loading')}
              chip={meals ? <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${STATUS_STYLE[status]}`}>{t(`mess.status.${status}`)}</span> : null}
              action={
                meals ? (
                  <button type="button" onClick={() => setEditMeal(meal)} className="h-11 shrink-0 rounded-full bg-white px-5 text-base font-bold text-brand-700 ring-2 ring-brand-200 transition active:scale-95">
                    {status === 'missing' ? t('mess.add') : t('mess.edit')}
                  </button>
                ) : null
              }
              footer={menu && menu.isScheduledOverride === false ? <p className="mt-3 text-sm text-slate-500">{t('mess.source.weekly')}</p> : null}
            />
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">{t('mess.notices')}</h2>
          <button type="button" onClick={() => setNoticeOpen(true)} className="h-11 rounded-full bg-brand-50 px-5 text-base font-bold text-brand-700 ring-1 ring-brand-200">
            {t('mess.notice.post')}
          </button>
        </div>
        {allNotices.length > 0 ? <NoticeList notices={allNotices} onToggle={toggleNotice} busyId={busyNotice} /> : <p className="text-base text-slate-500">{t('mess.notice.empty')}</p>}
      </section>

      <FoodHealth stats={stats} comments={comments} problems={problems} />

      {editMeal && <MenuSheet key={`${editMeal}-${day}`} meal={editMeal} dateKey={day} menu={editMenu} onSave={saveMenu} onClose={() => setEditMeal('')} />}
      {noticeOpen && <NoticeSheet onSubmit={postNotice} onClose={() => setNoticeOpen(false)} />}
      <WeeklyMenuUploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} messId={messId} onSchedulePublished={load} />
    </div>
  );
}

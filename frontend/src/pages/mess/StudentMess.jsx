import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import messService from '../../services/messService.js';
import useAutoRefresh from '../../hooks/useAutoRefresh.js';
import DayStrip from '../../components/mess/DayStrip.jsx';
import MealCard from '../../components/mess/MealCard.jsx';
import NoticeList from '../../components/mess/NoticeList.jsx';
import RatingSheet from '../../components/mess/RatingSheet.jsx';
import { StarRow } from '../../components/mess/Stars.jsx';
import { PHASE_STYLE } from '../../components/mess/mealStyle.js';
import Icon from '../../components/jobs/icons.jsx';
import { MEALS, buildDayStrip, canRate, hourAtHostel, mealPhase, ratedMap, starsToFeedback, todayKey } from '../../utils/messPresentation.js';

/**
 * The student's Mess screen (DEC-037): what is for each meal on a day, a rating in one sheet,
 * the notices, and a way to tell the warden about a food problem. Nothing else.
 */
export default function StudentMess() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const today = todayKey();
  const days = useMemo(() => buildDayStrip(today, 1, 1), [today]);
  const [day, setDay] = useState(today);

  const [mess, setMess] = useState(null);
  const [messState, setMessState] = useState('loading'); // loading | ready | none | error
  const [meals, setMeals] = useState(null);
  const [notices, setNotices] = useState([]);
  const [rated, setRated] = useState(new Map());
  const [rating, setRating] = useState(null); // { meal, dateKey }
  const [toast, setToast] = useState('');

  const hostelId = user?.hostelId?._id || user?.hostelId;

  // Which mess is mine: the one of my own hostel
  useEffect(() => {
    let active = true;
    (async () => {
      if (!hostelId) {
        setMessState('none');
        return;
      }
      try {
        const res = await messService.getMesses({ hostelId, isActive: true });
        if (!active) return;
        const first = res?.data?.[0];
        if (first) {
          setMess(first);
          setMessState('ready');
        } else {
          setMessState('none');
        }
      } catch {
        if (active) setMessState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [hostelId]);

  const load = useCallback(async () => {
    if (!mess) return;
    // Each block shows as soon as its own data arrives; a failed block keeps what it had
    const part = (request, apply) =>
      request.then((res) => res?.success && apply(res.data)).catch(() => {});
    await Promise.all([
      part(messService.getTodayMenu(mess._id, { date: day }), (data) => setMeals(data.meals)),
      part(messService.getNotices({ messId: mess._id, isActive: true }), setNotices),
      part(messService.getMyFeedbacks({ limit: 50 }), (data) => setRated(ratedMap(data))),
    ]);
  }, [mess, day]);

  useEffect(() => {
    setMeals(null);
    load();
  }, [load]);

  useAutoRefresh(load);

  const submitRating = async ({ stars, quick, comments }) => {
    try {
      await messService.submitFeedback({
        messId: mess._id,
        mealType: rating.meal,
        mealDate: rating.dateKey,
        ...starsToFeedback(stars, quick),
        comments,
      });
    } catch (err) {
      if (err?.response?.status === 409) {
        await load();
        throw new Error(t('mess.rate.already'));
      }
      throw new Error(t('mess.rate.err'));
    }
    setRating(null);
    setToast(t('mess.rate.thanks'));
    setTimeout(() => setToast(''), 4000);
    await load();
  };

  if (messState === 'loading') {
    return <div className="mx-auto max-w-xl space-y-3 px-4 pt-4" aria-busy="true" aria-label={t('common.loading')}><div className="h-32 animate-pulse rounded-3xl bg-slate-100" /><div className="h-32 animate-pulse rounded-3xl bg-slate-100" /></div>;
  }

  if (messState !== 'ready') {
    return (
      <div className="mx-auto max-w-xl px-4 pt-4">
        <p role={messState === 'error' ? 'alert' : undefined} className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-lg font-semibold text-slate-600">
          {messState === 'error' ? t('error.load') : t('mess.noMess')}
        </p>
      </div>
    );
  }

  const hour = hourAtHostel();

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 pb-4 pt-4">
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">{mess.name}</h1>

      {toast && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-green-600 p-4 text-lg font-semibold text-white shadow-md">
          <Icon name="check" className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={3} />
          <span>{toast}</span>
        </div>
      )}

      <NoticeList notices={notices} />

      <DayStrip days={days} selected={day} onSelect={setDay} />

      <div className="space-y-3">
        {MEALS.map((meal) => {
          const menu = meals?.[meal] || null;
          const dishes = (menu?.menuItems || []).map((item) => item?.name).filter(Boolean);
          const phase = mealPhase({ meal, dateKey: day, today, hour });
          const myStars = rated.get(`${day}|${meal}`);
          const allowRate = canRate({ phase, hasMenu: dishes.length > 0 });
          return (
            <MealCard
              key={meal}
              meal={meal}
              dishes={dishes}
              highlight={phase === 'now' && day === today}
              empty={meals ? t('mess.notAdded') : t('common.loading')}
              chip={
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${PHASE_STYLE[phase]}`}>{t(`mess.phase.${phase}`)}</span>
              }
              action={
                allowRate && !myStars ? (
                  <button type="button" onClick={() => setRating({ meal, dateKey: day })} className="h-11 shrink-0 rounded-full bg-brand-600 px-5 text-base font-bold text-white transition active:scale-95">
                    {t('mess.rate')}
                  </button>
                ) : null
              }
              footer={
                myStars ? (
                  <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <StarRow value={myStars} />
                    {t('mess.rated', { n: myStars })}
                  </p>
                ) : null
              }
            />
          );
        })}
      </div>

      <section className="rounded-3xl bg-linear-to-br from-brand-500 to-brand-700 p-5 text-white shadow-[0_12px_28px_-8px_rgba(200,42,65,0.55)]">
        <p className="text-xl font-bold">{t('mess.problem')}</p>
        <Link to="/student/report?category=MESS" className="mt-3 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-base font-bold text-brand-700 transition active:scale-95">
          {t('mess.problem.cta')}
          <Icon name="chevronRight" className="h-5 w-5" strokeWidth={3} />
        </Link>
      </section>

      {rating && <RatingSheet mealLabel={t(`meal.${rating.meal}`)} onSubmit={submitRating} onClose={() => setRating(null)} />}
    </div>
  );
}

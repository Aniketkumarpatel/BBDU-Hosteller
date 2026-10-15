import { StarRow } from './Stars.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const number = (value) => (value ? String(value) : '-');

/**
 * "How is the food?" for a manager: four numbers, a clear warning when cleanliness is low, the
 * latest comments and the food problems students reported. Everything arrives from the server
 * already summed; this only lays it out.
 *
 * @param {{ stats: object, comments: object[], problems: object[] }} props
 */
export default function FoodHealth({ stats, comments, problems }) {
  const { t } = useLanguage();
  const hasRatings = (stats?.totalFeedbacks || 0) > 0;
  const lowCleanliness = stats?.hygieneStatus === 'HYGIENE_ATTENTION_REQUIRED';

  const tiles = [
    { key: 'rating', label: t('mess.food.rating'), value: stats?.averageRating },
    { key: 'clean', label: t('mess.food.clean'), value: stats?.avgHygiene },
    { key: 'taste', label: t('mess.food.taste'), value: stats?.avgTaste },
    { key: 'portion', label: t('mess.food.portion'), value: stats?.avgQuantity },
  ];

  const problemLabel = (type) => {
    const key = `issue.${type}`;
    const label = t(key);
    return label === key ? String(type).replace(/_/g, ' ').toLowerCase() : label;
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">{t('mess.food')}</h2>

      {lowCleanliness && (
        <p role="alert" className="rounded-2xl bg-orange-50 p-3.5 text-base font-semibold text-orange-900 ring-1 ring-orange-200">
          {t('mess.food.warn')}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <div key={tile.key} className="rounded-2xl bg-white p-4 text-center shadow-[0_4px_14px_-6px_rgba(15,23,42,0.18)] ring-1 ring-black/5">
            <p className="text-3xl font-extrabold text-slate-900">
              {number(tile.value)}
              {tile.value ? <span className="text-base font-semibold text-slate-400"> / 5</span> : null}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{tile.label}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-slate-500">{hasRatings ? t('mess.food.reviews', { n: stats.totalFeedbacks }) : t('mess.food.none')}</p>

      {comments.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-slate-900">{t('mess.food.comments')}</h3>
          <ul className="mt-2 space-y-2.5">
            {comments.map((c) => (
              <li key={c._id} className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <StarRow value={c.rating} />
                  <span className="text-sm font-semibold text-slate-500">{t(`meal.${c.mealType}`)}</span>
                </div>
                {c.comments && <p className="mt-1.5 break-words text-base text-slate-800">{c.comments}</p>}
                {c.studentId?.name && <p className="mt-1 text-sm text-slate-500">{c.studentId.name}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {problems.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-slate-900">{t('mess.food.problems')}</h3>
          <ul className="mt-2 divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
            {problems.map((p) => (
              <li key={p.issueType} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-base font-semibold text-slate-800">{problemLabel(p.issueType)}</span>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${p.openCount > 0 ? 'bg-orange-50 text-orange-800' : 'bg-slate-100 text-slate-600'}`}>
                  {t('mess.food.problemRow', { n: p.count, open: p.openCount })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

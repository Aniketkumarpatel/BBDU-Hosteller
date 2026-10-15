import Icon from '../jobs/icons.jsx';
import { MEAL_GRADIENT } from './mealStyle.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

/**
 * One meal as a card: a coloured tile, the meal's name, a chip saying where it stands, the dishes
 * and whatever the screen puts at the right (a button) or below (a note). Used by both the student
 * and the manager screens, so a meal looks the same to everyone.
 *
 * @param {{ meal: string, dishes: string[], chip?: import('react').ReactNode, action?: import('react').ReactNode,
 *           footer?: import('react').ReactNode, empty?: string, highlight?: boolean }} props
 */
export default function MealCard({ meal, dishes, chip, action, footer, empty, highlight = false }) {
  const { t } = useLanguage();

  return (
    <article className={`rounded-3xl bg-white p-4 shadow-[0_4px_14px_-4px_rgba(15,23,42,0.18)] ring-1 ${highlight ? 'ring-2 ring-brand-500' : 'ring-black/5'}`}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.45)] ${MEAL_GRADIENT[meal]}`}
        >
          <Icon name="utensils" className="h-6 w-6" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-tight text-slate-900">{t(`meal.${meal}`)}</h3>
          {chip && <div className="mt-1">{chip}</div>}
        </div>
        {action}
      </div>

      {dishes.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {dishes.map((dish) => (
            <li key={dish} className="rounded-full bg-slate-50 px-3 py-1.5 text-base font-medium text-slate-800 ring-1 ring-slate-200">
              {dish}
            </li>
          ))}
        </ul>
      ) : (
        empty && <p className="mt-3 text-base text-slate-500">{empty}</p>
      )}

      {footer}
    </article>
  );
}

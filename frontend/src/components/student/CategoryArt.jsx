import Icon from '../jobs/icons.jsx';
import { CATEGORY_VISUAL, DEFAULT_CATEGORY_VISUAL } from './categoryStyle.js';

/**
 * The picture for a problem category: a rich gradient tile with a white icon and a soft
 * highlight, standing in for the food photo on a Zomato card (DEC-032). The word is always
 * shown next to it, so the picture is decoration, never the only signal.
 */
export default function CategoryArt({ category, shape = 'circle', size = 'h-16 w-16', iconSize = 'h-7 w-7', className = '' }) {
  const visual = CATEGORY_VISUAL[category] || DEFAULT_CATEGORY_VISUAL;
  const rounding = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-linear-to-br text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.45)] ring-2 ring-white ${visual.art} ${rounding} ${size} ${className}`}
    >
      <span className="absolute -left-2 -top-3 h-1/2 w-3/4 rounded-full bg-white/25 blur-[2px]" />
      <Icon name={visual.icon} className={`relative drop-shadow-sm ${iconSize}`} strokeWidth={1.9} />
    </span>
  );
}

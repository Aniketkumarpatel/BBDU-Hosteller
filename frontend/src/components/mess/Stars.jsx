/** A filled or empty star. Decorative: the number is always written next to it. */
export default function Star({ filled, className = 'h-8 w-8' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} ${filled ? 'fill-amber-400 text-amber-400' : 'fill-none text-slate-300'}`} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 16.9l-5.25 2.8 1-5.85L3.5 9.7l5.9-.9L12 3.5z" />
    </svg>
  );
}

/** Five stars showing a rating, for lists. */
export const StarRow = ({ value, className = 'h-4 w-4' }) => (
  <span className="inline-flex" aria-label={`${value} / 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} filled={n <= value} className={className} />
    ))}
  </span>
);

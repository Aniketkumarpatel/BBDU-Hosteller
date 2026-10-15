// One colour per meal so the four cards are told apart at a glance. The word is always shown too.
export const MEAL_GRADIENT = {
  BREAKFAST: 'from-amber-300 to-orange-500',
  LUNCH: 'from-orange-400 to-red-500',
  SNACKS: 'from-rose-400 to-pink-600',
  DINNER: 'from-violet-400 to-purple-600',
};

// How a meal's place in the day looks on its chip
export const PHASE_STYLE = {
  now: 'bg-brand-600 text-white',
  next: 'bg-amber-100 text-amber-800',
  served: 'bg-slate-100 text-slate-600',
  later: 'bg-slate-100 text-slate-500',
};

// How a manager sees the state of a menu
export const STATUS_STYLE = {
  published: 'bg-green-50 text-green-800 ring-1 ring-inset ring-green-200',
  draft: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
  missing: 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-200',
};

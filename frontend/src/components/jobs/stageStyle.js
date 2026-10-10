// One place for how each stage looks, so the list, card and job screen always agree.
// Colour is never the only signal: every stage also has an icon and a word.
export const STAGE_STYLE = {
  redo: { icon: 'redo', chip: 'bg-rose-50 text-rose-700 ring-rose-200', accent: 'border-l-rose-500', text: 'text-rose-700' },
  new: { icon: 'inbox', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200', accent: 'border-l-indigo-500', text: 'text-indigo-700' },
  ready: { icon: 'check', chip: 'bg-sky-50 text-sky-700 ring-sky-200', accent: 'border-l-sky-500', text: 'text-sky-700' },
  working: { icon: 'tool', chip: 'bg-amber-50 text-amber-800 ring-amber-200', accent: 'border-l-amber-500', text: 'text-amber-700' },
  waiting: { icon: 'hourglass', chip: 'bg-violet-50 text-violet-700 ring-violet-200', accent: 'border-l-violet-400', text: 'text-violet-700' },
  done: { icon: 'check', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', accent: 'border-l-emerald-500', text: 'text-emerald-700' },
};

export const PRIORITY_STYLE = {
  CRITICAL: 'bg-rose-100 text-rose-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-slate-100 text-slate-700',
  LOW: 'bg-slate-100 text-slate-500',
};

export const ACTION_STYLE = {
  acknowledge: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800',
  start: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800',
  resume: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800',
  finish: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800',
};

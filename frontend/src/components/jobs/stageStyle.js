// One place for how each stage looks, so the list, card and job screen always agree.
// Colour is never the only signal: every stage also has an icon and a word.
export const STAGE_STYLE = {
  assign: { icon: 'inbox', chip: 'bg-orange-50 text-orange-800 ring-orange-200', accent: 'border-l-orange-500', text: 'text-orange-700' },
  redo: { icon: 'redo', chip: 'bg-orange-50 text-orange-800 ring-orange-200', accent: 'border-l-orange-500', text: 'text-orange-700' },
  new: { icon: 'inbox', chip: 'bg-brand-50 text-brand-800 ring-brand-200', accent: 'border-l-brand-600', text: 'text-brand-700' },
  ready: { icon: 'check', chip: 'bg-blue-50 text-blue-800 ring-blue-200', accent: 'border-l-blue-500', text: 'text-blue-700' },
  working: { icon: 'tool', chip: 'bg-blue-50 text-blue-800 ring-blue-200', accent: 'border-l-blue-600', text: 'text-blue-700' },
  waiting: { icon: 'hourglass', chip: 'bg-violet-50 text-violet-700 ring-violet-200', accent: 'border-l-violet-400', text: 'text-violet-700' },
  done: { icon: 'check', chip: 'bg-green-50 text-green-800 ring-green-200', accent: 'border-l-green-600', text: 'text-green-700' },
};

export const PRIORITY_STYLE = {
  CRITICAL: 'bg-orange-100 text-orange-900',
  HIGH: 'bg-amber-100 text-amber-900',
  MEDIUM: 'bg-slate-100 text-slate-700',
  LOW: 'bg-slate-100 text-slate-500',
};

export const ACTION_STYLE = {
  acknowledge: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800',
  start: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800',
  resume: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800',
  finish: 'bg-green-600 hover:bg-green-700 active:bg-green-800',
};

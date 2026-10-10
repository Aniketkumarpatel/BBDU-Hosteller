// Picture and colour for each complaint category, used on the student home and report flow.
// `tile` is the flat pastel square, `art` the gradient of the rich tile (CategoryArt, DEC-032).
// The icon is never the only signal: the word is always shown next to it.
export const CATEGORY_VISUAL = {
  PLUMBING: { icon: 'tool', tile: 'bg-blue-50 text-blue-600', art: 'from-sky-400 to-blue-600' },
  WATER: { icon: 'droplet', tile: 'bg-sky-50 text-sky-600', art: 'from-cyan-400 to-sky-600' },
  ELECTRICAL: { icon: 'bolt', tile: 'bg-amber-50 text-amber-600', art: 'from-amber-300 to-orange-500' },
  INTERNET: { icon: 'wifi', tile: 'bg-violet-50 text-violet-600', art: 'from-violet-400 to-purple-600' },
  CLEANING: { icon: 'sparkles', tile: 'bg-green-50 text-green-600', art: 'from-emerald-400 to-green-600' },
  FURNITURE: { icon: 'chair', tile: 'bg-rose-50 text-rose-600', art: 'from-rose-400 to-pink-600' },
  ROOM: { icon: 'door', tile: 'bg-slate-100 text-slate-600', art: 'from-slate-400 to-slate-600' },
  MESS: { icon: 'utensils', tile: 'bg-orange-50 text-orange-600', art: 'from-orange-400 to-red-500' },
  SECURITY: { icon: 'shield', tile: 'bg-slate-100 text-slate-700', art: 'from-indigo-400 to-indigo-700' },
  OTHER: { icon: 'dots', tile: 'bg-slate-100 text-slate-600', art: 'from-slate-400 to-slate-600' },
};

export const DEFAULT_CATEGORY_VISUAL = CATEGORY_VISUAL.OTHER;

// Student stage -> the shared status style (components/jobs/stageStyle.js)
export const STUDENT_STAGE_STYLE_KEY = {
  sent: 'waiting',
  given: 'ready',
  working: 'working',
  confirm: 'new',
  redo: 'redo',
  done: 'done',
};

// Colour of the filled part of the progress bar for each student stage
export const PROGRESS_COLOR = {
  sent: 'bg-violet-500',
  given: 'bg-blue-500',
  working: 'bg-blue-600',
  confirm: 'bg-brand-600',
  redo: 'bg-orange-500',
  done: 'bg-green-600',
};

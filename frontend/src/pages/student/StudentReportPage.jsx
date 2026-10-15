import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { translate } from '../../i18n/dictionary.js';
import complaintService from '../../services/complaintService.js';
import Icon from '../../components/jobs/icons.jsx';
import CategoryArt from '../../components/student/CategoryArt.jsx';
import { REPORT_CATEGORIES, REPORT_ISSUES, URGENCY_CHOICES, buildReportPayload } from '../../utils/studentPresentation.js';

const issueKey = (type) => (type === 'OTHER' || type.startsWith('OTHER_') ? 'issue.other' : `issue.${type}`);

const URGENCY_TONE = {
  MEDIUM: 'border-brand-600 bg-brand-50',
  HIGH: 'border-brand-600 bg-brand-50',
  CRITICAL: 'border-brand-600 bg-brand-50',
};

/**
 * Report a problem in three taps (DEC-031): pick a picture, pick what exactly, pick how
 * urgent, send. Typing is optional. The report is built from the choices, so it is always
 * valid and always carries the same short English title the Warden and technician read.
 */
export default function StudentReportPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const startCategory = REPORT_CATEGORIES.includes(params.get('category')) ? params.get('category') : '';
  const [step, setStep] = useState(startCategory ? 2 : 1);
  const [category, setCategory] = useState(startCategory);
  const [issueType, setIssueType] = useState('');
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [hint, setHint] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [sentId, setSentId] = useState('');

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError(t('report.photoInvalid'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError(t('report.photoTooBig'));
      return;
    }

    setPhotoError('');
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoError('');
  };

  const chooseCategory = (key) => {
    setCategory(key);
    setIssueType(REPORT_ISSUES[key].length === 1 ? REPORT_ISSUES[key][0] : '');
    setHint('');
    setStep(2);
  };

  const next = () => {
    if (step === 2 && !issueType) {
      setHint(t('report.pickFirst'));
      return;
    }
    setHint('');
    setStep((s) => s + 1);
  };

  const send = async () => {
    setSending(true);
    setError('');
    try {
      const payload = buildReportPayload(
        { category, issueType, text, priority },
        { issueLabel: translate('en', issueKey(issueType)), categoryLabel: translate('en', `category.${category}`) }
      );
      let dataToSend;
      if (photo) {
        const formData = new FormData();
        formData.append('title', payload.title);
        formData.append('description', payload.description);
        formData.append('category', payload.category);
        formData.append('issueType', payload.issueType);
        formData.append('priority', payload.priority);
        formData.append('attachment', photo);
        dataToSend = formData;
      } else {
        dataToSend = payload;
      }
      const res = await complaintService.submitComplaint(dataToSend);
      if (!res?.success) throw new Error(res?.message || 'send failed');
      setSentId(res.data?._id || '');
      setSent(true);
    } catch (err) {
      setError(err?.response?.data?.message || t('error.report'));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-green-600">
          <Icon name="check" className="h-12 w-12" strokeWidth={3} />
        </span>
        <h1 className="mt-6 text-3xl font-bold leading-tight text-slate-900">{t('report.sentTitle')}</h1>
        <p className="mt-2 max-w-xs text-base text-slate-600">{t('report.sentBody')}</p>
        <div className="mt-8 w-full max-w-xs space-y-3">
          <Link
            to={sentId ? `/student/problems/${sentId}` : '/student/problems'}
            className="flex h-14 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-sm"
          >
            {t('report.track')}
          </Link>
          <Link to="/student/home" className="flex h-14 items-center justify-center rounded-2xl border-2 border-slate-200 text-lg font-bold text-slate-700">
            {t('report.home')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button type="button" onClick={() => navigate('/student/home')} aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100">
          <Icon name="close" className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">{t('report.title')}</h1>
      </div>

      <div className="mt-3 flex gap-1.5 px-4" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= step ? 'bg-brand-600' : 'bg-slate-200'}`} />
        ))}
      </div>

      <div className="flex-1 px-4 pb-28 pt-5">
        <p className="text-sm font-semibold text-slate-500">{t('report.step', { n: step })}</p>

        {step === 1 && (
          <>
            <h2 className="mt-1 text-3xl font-bold leading-tight text-slate-900">{t('student.categories')}</h2>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {REPORT_CATEGORIES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => chooseCategory(key)}
                  className="flex aspect-square flex-col items-center justify-start gap-2.5 rounded-3xl bg-white px-2 pt-4 text-center shadow-[0_4px_14px_-4px_rgba(15,23,42,0.2)] ring-1 ring-black/5 transition active:scale-95"
                >
                  <CategoryArt category={key} size="h-14 w-14" iconSize="h-7 w-7" />
                  <span className="text-sm font-bold leading-tight text-slate-800">{t(`category.${key}`)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && category && (
          <>
            <h2 className="mt-1 text-3xl font-bold leading-tight text-slate-900">{t('report.q2')}</h2>
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3 text-sm font-bold text-slate-700">
              <CategoryArt category={category} size="h-7 w-7" iconSize="h-4 w-4" className="ring-0" />
              {t(`category.${category}`)}
            </p>
            <ul className="mt-4 space-y-2.5" role="radiogroup" aria-label={t('report.q2')}>
              {REPORT_ISSUES[category].map((type) => {
                const on = issueType === type;
                return (
                  <li key={type}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setIssueType(type);
                        setHint('');
                      }}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 text-left text-lg font-semibold transition ${
                        on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${on ? 'bg-brand-600 text-white' : 'border-2 border-slate-300'}`}>
                        {on && <Icon name="check" className="h-4 w-4" strokeWidth={3} />}
                      </span>
                      {t(issueKey(type))}
                    </button>
                  </li>
                );
              })}
            </ul>
            <label htmlFor="more" className="mt-5 block text-base font-bold text-slate-800">
              {t('report.moreWords')}
            </label>
            <textarea
              id="more"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={t('report.morePlaceholder')}
              className="mt-2 w-full rounded-2xl border-2 border-slate-200 p-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden"
            />
          </>
        )}

        {step === 3 && category && (
          <>
            <h2 className="mt-1 text-3xl font-bold leading-tight text-slate-900">{t('report.q3')}</h2>
            <ul className="mt-5 space-y-3" role="radiogroup" aria-label={t('report.q3')}>
              {URGENCY_CHOICES.map((key) => {
                const on = priority === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPriority(key)}
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${on ? URGENCY_TONE[key] : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${on ? 'bg-brand-600 text-white' : 'border-2 border-slate-300'}`}>
                        {on && <Icon name="check" className="h-4 w-4" strokeWidth={3} />}
                      </span>
                      <span>
                        <span className="block text-lg font-bold text-slate-900">{t(`priority.${key}`)}</span>
                        <span className="block text-sm text-slate-500">{t(`report.hint.${key}`)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Step 3: Photo Upload (Optional) */}
            <div className="mt-5">
              <label className="block text-base font-bold text-slate-800">
                {t('report.photoTitle')}
              </label>

              {!photoPreview ? (
                <label
                  htmlFor="problem-photo-input"
                  className="mt-2.5 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-brand-400 hover:bg-brand-50/40 active:scale-[0.99]"
                >
                  <input
                    id="problem-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs text-brand-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <div className="text-left">
                    <span className="block text-sm font-bold text-slate-800">{t('report.photoAdd')}</span>
                    <span className="block text-xs text-slate-500">{t('report.photoHint')}</span>
                  </div>
                </label>
              ) : (
                <div className="mt-2.5 relative flex items-center gap-3 rounded-2xl border-2 border-brand-200 bg-brand-50/50 p-2.5">
                  <img
                    src={photoPreview}
                    alt="Problem Preview"
                    className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-black/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{photo?.name || 'Photo'}</p>
                    <p className="text-xs text-slate-500">{photo?.size ? `${(photo.size / (1024 * 1024)).toFixed(1)} MB` : ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={removePhoto}
                    aria-label={t('report.photoRemove')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-xs hover:bg-rose-50 active:scale-95 cursor-pointer"
                  >
                    <Icon name="close" className="h-5 w-5" />
                  </button>
                </div>
              )}

              {photoError && (
                <p role="alert" className="mt-2 text-xs font-semibold text-brand-700">
                  {photoError}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-3xl bg-slate-50 p-4">
              <CategoryArt category={category} shape="square" size="h-12 w-12" iconSize="h-6 w-6" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-slate-900">{t(issueKey(issueType))}</p>
                <p className="text-sm text-slate-500">{t(`category.${category}`)}</p>
                {text.trim() && <p className="mt-1 break-words text-base text-slate-700">{text.trim()}</p>}
                {photoPreview && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{t('problem.photo')} attached</span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-2xl bg-brand-50 p-3 text-base font-semibold text-brand-800">
                {error}
              </p>
            )}
          </>
        )}

        {hint && (
          <p role="alert" className="mt-4 text-base font-semibold text-brand-700">
            {hint}
          </p>
        )}
      </div>

      {step > 1 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto grid max-w-xl grid-cols-3 gap-3">
            <button
              type="button"
              disabled={sending}
              onClick={() => {
                setHint('');
                setStep((s) => s - 1);
              }}
              className="h-14 rounded-2xl border-2 border-slate-200 text-base font-bold text-slate-700 disabled:opacity-50"
            >
              {t('report.back')}
            </button>
            {step === 2 ? (
              <button type="button" onClick={next} className="col-span-2 h-14 rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-sm">
                {t('report.next')}
              </button>
            ) : (
              <button type="button" disabled={sending} onClick={send} className="col-span-2 h-14 rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-sm disabled:opacity-60">
                {sending ? t('action.wait') : t('report.send')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, getDashboardPathForRole } from '../context/AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
  getPublicHostels,
  getPublicBlocks,
  getPublicFloors,
  sendRegistrationOtp,
} from '../services/auth.service.js';

const INPUT_BASE =
  'mt-1.5 h-12 w-full rounded-xl border-2 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100';
const inputClass = (hasError) =>
  `${INPUT_BASE} ${hasError ? 'border-orange-400 focus:border-orange-500 focus:ring-orange-100' : 'border-slate-200 focus:border-brand-500 focus:ring-brand-100'}`;

const LABEL = 'block text-sm font-semibold text-slate-700';
const HINT = 'mt-1 text-sm text-slate-500';
const FIELD_ERROR = 'mt-1 text-sm font-medium text-orange-700';

const listFrom = (res, key) => {
  const list = res?.data?.[key] || res?.[key] || (Array.isArray(res?.data) ? res.data : null) || (Array.isArray(res) ? res : []);
  return Array.isArray(list) ? list : [];
};

/**
 * Student self-registration (DEC-033, DEC-034). Public registration is student-only: wardens,
 * technicians and administrators are created by an administrator. The flow is: fill the form,
 * a 6-digit code is emailed to the university address, type the code to finish.
 */
export default function RegisterPage() {
  const { t } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    studentId: '',
    phone: '',
    password: '',
    confirmPassword: '',
    hostelId: '',
    blockId: '',
    floorId: '',
    roomNumber: '',
  });

  const [hostels, setHostels] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loadingHostels, setLoadingHostels] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);

  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [screenOtp, setScreenOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Hostels once, blocks when the hostel changes, floors when the block changes
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoadingHostels(true);
      try {
        const res = await getPublicHostels();
        if (isMounted) setHostels(listFrom(res, 'hostels'));
      } catch (err) {
        console.error('Failed to load hostels list:', err);
        if (isMounted) setHostels([]);
      } finally {
        if (isMounted) setLoadingHostels(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!formData.hostelId) {
      setBlocks([]);
      setFloors([]);
      return undefined;
    }
    (async () => {
      setLoadingBlocks(true);
      try {
        const res = await getPublicBlocks(formData.hostelId);
        if (isMounted) setBlocks(listFrom(res, 'blocks'));
      } catch (err) {
        console.error('Failed to load blocks list:', err);
        if (isMounted) setBlocks([]);
      } finally {
        if (isMounted) setLoadingBlocks(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [formData.hostelId]);

  useEffect(() => {
    let isMounted = true;
    if (!formData.blockId) {
      setFloors([]);
      return undefined;
    }
    (async () => {
      setLoadingFloors(true);
      try {
        const res = await getPublicFloors(formData.blockId);
        if (isMounted) setFloors(listFrom(res, 'floors'));
      } catch (err) {
        console.error('Failed to load floors list:', err);
        if (isMounted) setFloors([]);
      } finally {
        if (isMounted) setLoadingFloors(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [formData.blockId]);

  // Resend countdown
  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
    setSubmitError('');

    if (name === 'hostelId') {
      setFormData((prev) => ({ ...prev, hostelId: value, blockId: '', floorId: '', roomNumber: '' }));
      setBlocks([]);
      setFloors([]);
    } else if (name === 'blockId') {
      setFormData((prev) => ({ ...prev, blockId: value, floorId: '', roomNumber: '' }));
      setFloors([]);
    } else if (name === 'floorId') {
      setFormData((prev) => ({ ...prev, floorId: value, roomNumber: '' }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) errors.name = t('reg.err.name');

    const email = formData.email.trim().toLowerCase();
    const domain = email.split('@')[1];
    const isBbduEmail = domain === 'bbdu.ac.in' || (domain ? domain.endsWith('.bbdu.ac.in') : false);
    if (!email) errors.email = t('reg.err.email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = t('reg.err.emailBad');
    else if (!isBbduEmail) errors.email = t('reg.err.emailDomain');

    if (!formData.studentId.trim()) errors.studentId = t('reg.err.studentId');

    if (!formData.password) errors.password = t('reg.err.pwEmpty');
    else if (formData.password.length < 8) errors.password = t('reg.err.pwShort');
    else if (!/[A-Z]/.test(formData.password) || !/[a-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      errors.password = t('reg.err.pwWeak');
    }
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = t('reg.err.pwMatch');

    if (!formData.hostelId) errors.hostelId = t('reg.err.hostel');
    if (!formData.blockId) errors.blockId = t('reg.err.block');
    if (!formData.floorId) errors.floorId = t('reg.err.floor');
    if (!formData.roomNumber.trim()) errors.roomNumber = t('reg.err.room');

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const requestCode = async () => {
    const res = await sendRegistrationOtp({
      email: formData.email.trim().toLowerCase(),
      role: 'STUDENT',
      name: formData.name.trim(),
    });
    // The code is only returned by the server outside production, when no mail account is set
    setScreenOtp(res?.data?.previewOtp || res?.previewOtp || '');
    setResendCooldown(60);
    return res;
  };

  // Step 1: check the form, email the code
  const handleInitiateRegistration = async (e) => {
    e.preventDefault();
    if (sendingOtp) return;
    setSubmitError('');

    if (!validateForm()) {
      setSubmitError(t('reg.err.fix'));
      return;
    }

    setSendingOtp(true);
    try {
      const res = await requestCode();
      setIsExistingAccount(Boolean(res?.data?.isExisting || res?.isExisting));
      setShowOtpModal(true);
      setOtpError('');
      setOtpCode('');
    } catch (err) {
      setSubmitError(err.response?.data?.message || err.userMessage || t('reg.err.send'));
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 2: send the code again
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || sendingOtp) return;
    setSendingOtp(true);
    setOtpError('');
    try {
      await requestCode();
    } catch (err) {
      setOtpError(err.response?.data?.message || t('otp.err.resend'));
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 3: check the code and create the account
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    if (verifyingOtp) return;

    const code = otpCode.trim();
    if (code.length < 4) {
      setOtpError(t('otp.err.short'));
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');
    try {
      const registeredUser = await register({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || undefined,
        password: formData.password,
        role: 'STUDENT',
        hostelId: formData.hostelId,
        otp: code,
        studentId: formData.studentId.trim(),
        blockId: formData.blockId,
        floorId: formData.floorId,
        roomNumber: formData.roomNumber.trim(),
        roomId: formData.roomNumber.trim(),
      });
      setShowOtpModal(false);
      navigate(getDashboardPathForRole(registeredUser.role || 'STUDENT'), { replace: true });
    } catch (err) {
      setOtpError(err.response?.data?.message || err.userMessage || t('otp.err.failed'));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const field = (name, label, props = {}) => (
    <div>
      <label htmlFor={name} className={LABEL}>
        {label}
      </label>
      <input id={name} name={name} value={formData[name]} onChange={handleChange} className={inputClass(formErrors[name])} {...props} />
      {formErrors[name] && <p className={FIELD_ERROR}>{formErrors[name]}</p>}
    </div>
  );

  const select = (name, label, placeholder, loadingText, options, disabled, loading) => (
    <div>
      <label htmlFor={name} className={LABEL}>
        {label}
      </label>
      <select id={name} name={name} value={formData[name]} onChange={handleChange} disabled={disabled || loading} className={inputClass(formErrors[name])}>
        <option value="">{loading ? loadingText : placeholder}</option>
        {options.map((o) => (
          <option key={o._id} value={o._id}>
            {o.name || o.floorNumber}
          </option>
        ))}
      </select>
      {formErrors[name] && <p className={FIELD_ERROR}>{formErrors[name]}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="rounded-3xl bg-white p-6 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.18)] ring-1 ring-black/5 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{t('reg.title')}</h1>
        <p className="mt-1 text-base text-slate-500">{t('reg.subtitle')}</p>

        {submitError && (
          <div role="alert" className="mt-5 rounded-2xl bg-brand-50 p-3.5 text-base font-medium text-brand-800 ring-1 ring-brand-200">
            {submitError}
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleInitiateRegistration} noValidate>
          {field('name', t('reg.name'), { type: 'text', autoComplete: 'name', placeholder: t('reg.name.ph') })}

          <div>
            {field('email', t('login.email'), { type: 'email', autoComplete: 'email', placeholder: 'e.g. student@bbdu.ac.in' })}
            {!formErrors.email && <p className={HINT}>{t('reg.email.hint')}</p>}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {field('studentId', t('reg.studentId'), { type: 'text', placeholder: 'BBDU2026-...' })}
            {field('phone', t('reg.phone'), { type: 'tel', autoComplete: 'tel', placeholder: '+919876543210' })}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className={LABEL}>
                {t('login.password')}
              </label>
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="h-8 rounded-lg px-2 text-sm font-bold text-brand-600 hover:text-brand-800">
                {showPassword ? t('pw.hide') : t('pw.show')}
              </button>
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              className={inputClass(formErrors.password)}
            />
            {formErrors.password ? <p className={FIELD_ERROR}>{formErrors.password}</p> : <p className={HINT}>{t('reg.password.hint')}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className={LABEL}>
              {t('reg.confirm')}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={inputClass(formErrors.confirmPassword)}
            />
            {formErrors.confirmPassword && <p className={FIELD_ERROR}>{formErrors.confirmPassword}</p>}
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h2 className="text-lg font-bold text-slate-900">{t('reg.section')}</h2>
            <p className={HINT}>{t('reg.section.hint')}</p>
          </div>

          {select('hostelId', t('reg.hostel'), t('reg.hostel.pick'), t('reg.loading'), hostels, false, loadingHostels)}
          {select('blockId', t('reg.block'), t('reg.block.pick'), t('reg.loading'), blocks, !formData.hostelId, loadingBlocks)}
          {select('floorId', t('reg.floor'), t('reg.floor.pick'), t('reg.loading'), floors, !formData.blockId, loadingFloors)}
          {field('roomNumber', t('reg.room'), { type: 'text', placeholder: t('reg.room.ph'), disabled: !formData.floorId })}

          <button
            type="submit"
            disabled={sendingOtp}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-[0_8px_18px_-8px_rgba(200,42,65,0.7)] transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-300 disabled:shadow-none"
          >
            {sendingOtp ? (
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t('reg.sending')}
              </span>
            ) : (
              t('reg.send')
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-base text-slate-500">
          {t('reg.have')}{' '}
          <Link to="/login" className="font-bold text-brand-600 hover:underline">
            {t('nav.signIn')}
          </Link>
        </p>
      </div>

      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="otp-title">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-7">
            <h2 id="otp-title" className="text-2xl font-extrabold text-slate-900">
              {t('otp.title')}
            </h2>
            <p className="mt-1 text-base text-slate-600">
              {t('otp.sentTo')} <span className="font-semibold text-slate-900">{formData.email}</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">{t('otp.valid')}</p>
            {!screenOtp && <p className="mt-1 text-sm text-slate-500">{t('otp.spam')}</p>}

            {screenOtp && (
              <div className="mt-4 rounded-2xl bg-amber-50 p-3.5 text-center ring-1 ring-amber-200">
                <p className="text-sm font-semibold text-amber-800">{t('otp.dev')}</p>
                <p className="mt-1 font-mono text-2xl font-extrabold tracking-[6px] text-amber-950">{screenOtp}</p>
              </div>
            )}

            {isExistingAccount && (
              <p className="mt-4 rounded-2xl bg-slate-50 p-3.5 text-sm text-slate-700 ring-1 ring-slate-200">
                {t('otp.existing')}{' '}
                <Link to="/login" className="font-bold text-brand-600 underline">
                  {t('nav.signIn')}
                </Link>
              </p>
            )}

            {otpError && (
              <div role="alert" className="mt-4 rounded-2xl bg-brand-50 p-3.5 text-base font-medium text-brand-800 ring-1 ring-brand-200">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerifyAndRegister} className="mt-5 space-y-4">
              <div>
                <label htmlFor="otp" className="block text-center text-sm font-semibold text-slate-700">
                  {t('otp.enter')}
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="mt-2 h-16 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 text-center font-mono text-3xl font-extrabold tracking-[10px] text-slate-900 placeholder:tracking-widest placeholder:text-slate-300 focus:border-brand-500 focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-brand-100"
                />
              </div>

              <button
                type="submit"
                disabled={verifyingOtp || otpCode.length < 4}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-[0_8px_18px_-8px_rgba(200,42,65,0.7)] transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-300 disabled:shadow-none"
              >
                {verifyingOtp ? (
                  <span className="flex items-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t('otp.verifying')}
                  </span>
                ) : (
                  t('otp.verify')
                )}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => setShowOtpModal(false)} className="h-11 rounded-xl px-2 text-base font-medium text-slate-600 hover:text-slate-900">
                  {t('otp.back')}
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || sendingOtp}
                  className="h-11 rounded-xl px-2 text-base font-bold text-brand-600 hover:text-brand-800 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {resendCooldown > 0 ? t('otp.resendIn', { n: resendCooldown }) : t('otp.resend')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, getDashboardPathForRole } from '../context/AuthContext.jsx';
import {
  getPublicHostels,
  getPublicBlocks,
  getPublicFloors,
  sendRegistrationOtp,
} from '../services/auth.service.js';

export default function RegisterPage() {
  const [role, setRole] = useState('STUDENT'); // 'STUDENT' | 'WARDEN'

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    studentId: '',
    employeeId: '',
    phone: '',
    password: '',
    confirmPassword: '',
    hostelId: '',
    blockId: '',
    floorId: '',
    roomNumber: '',
  });

  // Dropdown options state
  const [hostels, setHostels] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);

  // Loading states for dropdowns
  const [loadingHostels, setLoadingHostels] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);

  // Form states
  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP Modal states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [screenOtp, setScreenOtp] = useState('');
  const [otpDelivered, setOtpDelivered] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  // Load initial Hostels list on component mount
  useEffect(() => {
    let isMounted = true;
    const fetchHostels = async () => {
      setLoadingHostels(true);
      try {
        const res = await getPublicHostels();
        const list =
          res?.data?.hostels ||
          res?.hostels ||
          (Array.isArray(res?.data) ? res.data : null) ||
          (Array.isArray(res) ? res : []);
        if (isMounted) {
          setHostels(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error('Failed to load hostels list:', err);
        if (isMounted) setHostels([]);
      } finally {
        if (isMounted) setLoadingHostels(false);
      }
    };
    fetchHostels();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch blocks when hostelId changes (Only for Student)
  useEffect(() => {
    let isMounted = true;
    if (!formData.hostelId || role === 'WARDEN') {
      setBlocks([]);
      setFloors([]);
      return;
    }

    const fetchBlocks = async () => {
      setLoadingBlocks(true);
      try {
        const res = await getPublicBlocks(formData.hostelId);
        const list =
          res?.data?.blocks ||
          res?.blocks ||
          (Array.isArray(res?.data) ? res.data : null) ||
          (Array.isArray(res) ? res : []);
        if (isMounted) {
          setBlocks(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error('Failed to load blocks list:', err);
        if (isMounted) setBlocks([]);
      } finally {
        if (isMounted) setLoadingBlocks(false);
      }
    };

    fetchBlocks();
    return () => {
      isMounted = false;
    };
  }, [formData.hostelId, role]);

  // Fetch floors when blockId changes (Only for Student)
  useEffect(() => {
    let isMounted = true;
    if (!formData.blockId || role === 'WARDEN') {
      setFloors([]);
      return;
    }

    const fetchFloors = async () => {
      setLoadingFloors(true);
      try {
        const res = await getPublicFloors(formData.blockId);
        const list =
          res?.data?.floors ||
          res?.floors ||
          (Array.isArray(res?.data) ? res.data : null) ||
          (Array.isArray(res) ? res : []);
        if (isMounted) {
          setFloors(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error('Failed to load floors list:', err);
        if (isMounted) setFloors([]);
      } finally {
        if (isMounted) setLoadingFloors(false);
      }
    };

    fetchFloors();
    return () => {
      isMounted = false;
    };
  }, [formData.blockId, role]);

  // Resend OTP Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
    setSubmitError('');

    if (name === 'hostelId') {
      setFormData((prev) => ({
        ...prev,
        hostelId: value,
        blockId: '',
        floorId: '',
        roomNumber: '',
      }));
      setBlocks([]);
      setFloors([]);
    } else if (name === 'blockId') {
      setFormData((prev) => ({
        ...prev,
        blockId: value,
        floorId: '',
        roomNumber: '',
      }));
      setFloors([]);
    } else if (name === 'floorId') {
      setFormData((prev) => ({
        ...prev,
        floorId: value,
        roomNumber: '',
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setFormErrors({});
    setSubmitError('');
    // Clear student-specific fields if switching to warden
    if (newRole === 'WARDEN') {
      setFormData((prev) => ({
        ...prev,
        studentId: '',
        blockId: '',
        floorId: '',
        roomNumber: '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        employeeId: '',
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Full Name is required.';
    }

    const trimmedEmail = formData.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const domain = trimmedEmail.split('@')[1];
    const isBbduEmail = domain === 'bbdu.ac.in' || (domain ? domain.endsWith('.bbdu.ac.in') : false);

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    } else if (!isBbduEmail) {
      errors.email = 'Sirf @bbdu.ac.in wali official email address hi allowed hai.';
    }

    if (role === 'STUDENT') {
      if (!formData.studentId.trim()) {
        errors.studentId = 'Student ID is required.';
      }
    } else if (role === 'WARDEN') {
      if (!formData.employeeId.trim()) {
        errors.employeeId = 'Employee ID is required.';
      }
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (
      !/[A-Z]/.test(formData.password) ||
      !/[a-z]/.test(formData.password) ||
      !/[0-9]/.test(formData.password)
    ) {
      errors.password =
        'Password must contain at least one uppercase letter, one lowercase letter, and one number.';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    // Required hostel allocation fields
    if (!formData.hostelId) {
      errors.hostelId = 'Hostel Name is required.';
    }

    if (role === 'STUDENT') {
      if (!formData.blockId) {
        errors.blockId = 'Block/Wing is required.';
      }
      if (!formData.floorId) {
        errors.floorId = 'Floor is required.';
      }
      if (!formData.roomNumber.trim()) {
        errors.roomNumber = 'Room Number is required.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 1: Initiate registration by sending OTP to user's university email
  const handleInitiateRegistration = async (e) => {
    e.preventDefault();
    if (loading || sendingOtp) return;

    setSubmitError('');

    if (!validateForm()) {
      setSubmitError('Please fix the errors below before continuing.');
      return;
    }

    setSendingOtp(true);
    try {
      const email = formData.email.trim().toLowerCase();
      const res = await sendRegistrationOtp({
        email,
        role,
        name: formData.name.trim(),
      });

      setIsExistingAccount(Boolean(res?.data?.isExisting || res?.isExisting));
      const preview = res?.data?.previewOtp || res?.previewOtp || '';
      const delivered = Boolean(res?.data?.delivered || res?.delivered);
      setOtpDelivered(delivered);
      setScreenOtp(preview);
      setShowOtpModal(true);
      setOtpError('');
      setOtpCode('');
      setResendCooldown(60);
    } catch (err) {
      setSubmitError(
        err.response?.data?.message ||
          err.userMessage ||
          err.message ||
          'Failed to send verification OTP to your email. Please check your email address.'
      );
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || sendingOtp) return;
    setSendingOtp(true);
    setOtpError('');
    try {
      const email = formData.email.trim().toLowerCase();
      const res = await sendRegistrationOtp({
        email,
        role,
        name: formData.name.trim(),
      });
      const preview = res?.data?.previewOtp || res?.previewOtp || '';
      const delivered = Boolean(res?.data?.delivered || res?.delivered);
      setOtpDelivered(delivered);
      setScreenOtp(preview);
      setResendCooldown(60);
    } catch (err) {
      setOtpError(
        err.response?.data?.message || err.message || 'Failed to resend verification OTP.'
      );
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 3: Verify OTP and finalize registration
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    if (verifyingOtp) return;

    const trimmedOtp = otpCode.trim();
    if (!trimmedOtp || trimmedOtp.length < 4) {
      setOtpError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || undefined,
        password: formData.password,
        role,
        hostelId: formData.hostelId,
        otp: trimmedOtp,
      };

      if (role === 'STUDENT') {
        payload.studentId = formData.studentId.trim();
        payload.blockId = formData.blockId;
        payload.floorId = formData.floorId;
        payload.roomNumber = formData.roomNumber.trim();
        payload.roomId = formData.roomNumber.trim();
      } else if (role === 'WARDEN') {
        payload.employeeId = formData.employeeId.trim();
      }

      const registeredUser = await register(payload);
      setShowOtpModal(false);

      // Navigate to respective dashboard
      const target = getDashboardPathForRole(registeredUser.role || role);
      navigate(target, { replace: true });
    } catch (err) {
      setOtpError(
        err.response?.data?.message ||
          err.userMessage ||
          err.message ||
          'Verification failed. Invalid or expired OTP code.'
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col px-4 py-8">
      <div className="rounded-3xl bg-white p-6 shadow-[0_6px_25px_-6px_rgba(15,23,42,0.14)] ring-1 ring-black/5 sm:p-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 shadow-xs">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            {role === 'STUDENT' ? 'Student Registration' : 'Warden Registration'}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {role === 'STUDENT'
              ? 'Create your account and reserve your hostel accommodation'
              : 'Register as an official hostel warden with email verification'}
          </p>
        </div>

        {/* Public registration is student-only; wardens are provisioned by an administrator */}

        {submitError && (
          <div className="mt-4 rounded-xl bg-red-50 p-3.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
            {submitError}
          </div>
        )}

        <form className="mt-5 space-y-4" onSubmit={handleInitiateRegistration}>
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Full Name *
            </label>
            <input
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder={role === 'STUDENT' ? 'e.g. Priya Verma' : 'e.g. Dr. Rajesh Sharma'}
              className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 ${
                formErrors.name
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
              }`}
            />
            {formErrors.name && (
              <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
            )}
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Official University Email (@bbdu.ac.in) *
            </label>
            <input
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder={role === 'STUDENT' ? 'e.g. student@bbdu.ac.in' : 'e.g. warden@bbdu.ac.in'}
              className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 ${
                formErrors.email
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
              }`}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Sirf official <span className="font-semibold text-slate-700">@bbdu.ac.in</span> email address hi allowed hai. Is par 6-digit OTP verification code aayega.
            </p>
            {formErrors.email && (
              <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>
            )}
          </div>

          {/* Student ID or Employee ID & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                {role === 'STUDENT' ? 'Student ID *' : 'Employee ID *'}
              </label>
              <input
                name={role === 'STUDENT' ? 'studentId' : 'employeeId'}
                type="text"
                required
                value={role === 'STUDENT' ? formData.studentId : formData.employeeId}
                onChange={handleChange}
                placeholder={role === 'STUDENT' ? 'BBDU2026-...' : 'EMP-W-104'}
                className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 ${
                  formErrors.studentId || formErrors.employeeId
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
                }`}
              />
              {(formErrors.studentId || formErrors.employeeId) && (
                <p className="mt-1 text-xs text-red-600">
                  {formErrors.studentId || formErrors.employeeId}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Phone Number
              </label>
              <input
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+919876543210"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Password *
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs font-medium text-brand-600 hover:text-brand-800 cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 ${
                formErrors.password
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
              }`}
            />
            {formErrors.password && (
              <p className="mt-1 text-xs text-red-600">{formErrors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Confirm Password *
            </label>
            <input
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter password"
              className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 ${
                formErrors.confirmPassword
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
              }`}
            />
            {formErrors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{formErrors.confirmPassword}</p>
            )}
          </div>

          {/* Section Divider: Hostel Allocation or Assignment */}
          <div className="border-t border-slate-200 pt-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700">
              {role === 'STUDENT' ? 'Hostel Accommodation Allocation' : 'Assigned Hostel Oversight'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {role === 'STUDENT'
                ? 'Select your hostel, block, floor, and allocated room'
                : 'Select the hostel you are officially assigned to manage'}
            </p>
          </div>

          {/* 1. HOSTEL NAME Dropdown */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              {role === 'STUDENT' ? 'Hostel Name *' : 'Assigned Hostel *'}
            </label>
            <select
              name="hostelId"
              value={formData.hostelId}
              onChange={handleChange}
              disabled={loadingHostels}
              className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 focus:outline-hidden focus:ring-2 ${
                formErrors.hostelId
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
              }`}
            >
              <option value="">
                {loadingHostels ? 'Loading hostels...' : 'Select Hostel'}
              </option>
              {hostels.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name}
                </option>
              ))}
            </select>
            {formErrors.hostelId && (
              <p className="mt-1 text-xs text-red-600">{formErrors.hostelId}</p>
            )}
          </div>

          {/* Student-Only Allocation Fields: Block, Floor, Room Number */}
          {role === 'STUDENT' && (
            <>
              {/* 2. BLOCK / WING Dropdown */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Block / Wing *
                </label>
                <select
                  name="blockId"
                  value={formData.blockId}
                  onChange={handleChange}
                  disabled={!formData.hostelId || loadingBlocks}
                  className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 ${
                    formErrors.blockId
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
                  }`}
                >
                  <option value="">
                    {loadingBlocks ? 'Loading blocks...' : 'Select Block/Wing'}
                  </option>
                  {blocks.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {formErrors.blockId && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.blockId}</p>
                )}
              </div>

              {/* 3. FLOOR Dropdown */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Floor *
                </label>
                <select
                  name="floorId"
                  value={formData.floorId}
                  onChange={handleChange}
                  disabled={!formData.blockId || loadingFloors}
                  className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 ${
                    formErrors.floorId
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
                  }`}
                >
                  <option value="">
                    {loadingFloors ? 'Loading floors...' : 'Select Floor'}
                  </option>
                  {floors.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name || f.floorNumber}
                    </option>
                  ))}
                </select>
                {formErrors.floorId && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.floorId}</p>
                )}
              </div>

              {/* 4. ROOM NUMBER Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Room Number *
                </label>
                <input
                  name="roomNumber"
                  type="text"
                  required
                  value={formData.roomNumber}
                  onChange={handleChange}
                  placeholder="Enter your room number (e.g. 330, 106, 234, 420)"
                  disabled={!formData.floorId}
                  className={`mt-1 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 ${
                    formErrors.roomNumber
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
                  }`}
                />
                {formErrors.roomNumber && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.roomNumber}</p>
                )}
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={sendingOtp || loading}
            className="mt-3 flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300 cursor-pointer"
          >
            {sendingOtp ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending Verification OTP...
              </span>
            ) : (
              `Verify Email & Register as ${role === 'STUDENT' ? 'Student' : 'Warden'}`
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      {/* MODAL: OTP EMAIL VERIFICATION */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/10 sm:p-7">
            <div className="text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <h2 className="mt-3 text-xl font-extrabold text-slate-900">
                Confirm Your Email
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Verification code sent to{' '}
                <span className="font-semibold text-slate-800">{formData.email}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Code is valid for 5 minutes
              </p>
            </div>

            {/* Email delivery status banner */}
            {(otpDelivered || !screenOtp) && (
              <div className="mt-3.5 rounded-2xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  OTP Sent to Your Gmail
                </div>
                <p className="mt-1 text-xs text-emerald-800">
                  Please open your Gmail inbox at <strong className="font-bold">{formData.email}</strong> and enter the 6-digit verification code below.
                </p>
                <p className="mt-1 text-[11px] text-emerald-600">
                  Tip: If you don't see it in Primary, please check your <strong>Spam</strong> or <strong>Promotions</strong> folder.
                </p>
              </div>
            )}

            {/* Developer fallback banner when SMTP is not yet configured in .env */}
            {screenOtp && (
              <div className="mt-3.5 rounded-2xl bg-amber-50 p-3.5 text-center ring-1 ring-amber-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Development Mode (SMTP Not Set in backend/.env)
                </span>
                <div className="mt-1 font-mono text-2xl font-extrabold tracking-[6px] text-amber-950">
                  {screenOtp}
                </div>
                <p className="mt-1 text-[11px] text-amber-700">
                  To send real OTP emails directly to Gmail inboxes, add EMAIL_USER and EMAIL_PASS to backend/.env.
                </p>
              </div>
            )}

            {isExistingAccount && (
              <div className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800 ring-1 ring-amber-200 text-center">
                <span>Existing account detected! Verifying OTP will update your password & details. Or </span>
                <Link to="/login" className="font-bold underline text-amber-900 hover:text-amber-950">
                  Click here to Sign In
                </Link>
              </div>
            )}



            {otpError && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 ring-1 ring-red-200">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerifyAndRegister} className="mt-5 space-y-4">
              <div>
                <label className="block text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="mt-2 h-14 w-full rounded-2xl border-2 border-slate-300 bg-slate-50 text-center font-mono text-2xl font-extrabold tracking-[10px] text-slate-900 placeholder:tracking-widest placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-brand-100"
                />
              </div>

              <button
                type="submit"
                disabled={verifyingOtp || otpCode.length < 4}
                className="flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300 cursor-pointer"
              >
                {verifyingOtp ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Verifying &amp; Registering...
                  </span>
                ) : (
                  'Verify & Complete Registration'
                )}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  &larr; Edit Details
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || sendingOtp}
                  className="font-bold text-brand-600 hover:text-brand-800 disabled:cursor-not-allowed disabled:text-slate-400 cursor-pointer"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

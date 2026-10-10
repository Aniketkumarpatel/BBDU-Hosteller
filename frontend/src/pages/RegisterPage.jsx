import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getPublicHostels,
  getPublicBlocks,
  getPublicFloors,
  getPublicRooms,
} from '../services/auth.service.js';

export default function RegisterPage() {
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

  // Dropdown options state
  const [hostels, setHostels] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);

  // Loading states for dropdowns
  const [loadingHostels, setLoadingHostels] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);

  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  // Fetch blocks when hostelId changes
  useEffect(() => {
    let isMounted = true;
    if (!formData.hostelId) {
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
  }, [formData.hostelId]);

  // Fetch floors when blockId changes
  useEffect(() => {
    let isMounted = true;
    if (!formData.blockId) {
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
  }, [formData.blockId]);

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

  const validate = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Full Name is required.';
    }

    const trimmedEmail = formData.email.trim().toLowerCase();
    if (!trimmedEmail) {
      errors.email = 'University email is required.';
    } else if (!trimmedEmail.endsWith('@bbdu.ac.in')) {
      errors.email = 'Please use your official BBDU email address ending with @bbdu.ac.in.';
    }

    if (!formData.studentId.trim()) {
      errors.studentId = 'Student ID is required.';
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
    if (!formData.blockId) {
      errors.blockId = 'Block/Wing is required.';
    }
    if (!formData.floorId) {
      errors.floorId = 'Floor is required.';
    }
    if (!formData.roomNumber.trim()) {
      errors.roomNumber = 'Room Number is required.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setSubmitError('');

    if (!validate()) {
      setSubmitError('Please fix the errors below before submitting.');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        studentId: formData.studentId.trim(),
        phone: formData.phone.trim() || undefined,
        password: formData.password,
        role: 'STUDENT',
        hostelId: formData.hostelId,
        blockId: formData.blockId,
        floorId: formData.floorId,
        roomNumber: formData.roomNumber.trim(),
        roomId: formData.roomNumber.trim(),
      });

      navigate('/student/dashboard', { replace: true });
    } catch (err) {
      setSubmitError(
        err.userMessage ||
          err.response?.data?.message ||
          err.message ||
          'Registration failed. Please check your details.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col px-4 py-10">
      <div className="rounded-3xl bg-white p-6 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.18)] ring-1 ring-black/5 sm:p-8">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Student Registration
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create your account and reserve your hostel accommodation
          </p>
        </div>

        {submitError && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">
            {submitError}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {/* Personal & Account Info */}
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
              placeholder="e.g. Priya Verma"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 ${
                formErrors.name
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
              }`}
            />
            {formErrors.name && (
              <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              University Email *
            </label>
            <input
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="e.g. priya@bbdu.ac.in"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 ${
                formErrors.email
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
              }`}
            />
            {formErrors.email && (
              <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Student ID *
              </label>
              <input
                name="studentId"
                type="text"
                required
                value={formData.studentId}
                onChange={handleChange}
                placeholder="BBDU2026-..."
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 ${
                  formErrors.studentId
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
                }`}
              />
              {formErrors.studentId && (
                <p className="mt-1 text-xs text-red-600">{formErrors.studentId}</p>
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Password *
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-brand-600 hover:text-brand-800"
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
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 ${
                formErrors.password
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
              }`}
            />
            {formErrors.password && (
              <p className="mt-1 text-xs text-red-600">{formErrors.password}</p>
            )}
          </div>

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
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 ${
                formErrors.confirmPassword
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
              }`}
            />
            {formErrors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{formErrors.confirmPassword}</p>
            )}
          </div>

          {/* Section Divider: Hostel Allocation Dropdowns */}
          <div className="border-t border-slate-200 pt-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700">
              Hostel Accommodation Allocation
            </h3>
            <p className="text-[11px] text-slate-500">
              Select your hostel, block, floor, and available room
            </p>
          </div>

          {/* 1. HOSTEL NAME Dropdown */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Hostel Name *
            </label>
            <select
              name="hostelId"
              value={formData.hostelId}
              onChange={handleChange}
              disabled={loadingHostels}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 ${
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
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 ${
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
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 ${
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
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 ${
                formErrors.roomNumber
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200'
              }`}
            />
            {formErrors.roomNumber && (
              <p className="mt-1 text-xs text-red-600">{formErrors.roomNumber}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Registering &amp; Allocating Room...
              </span>
            ) : (
              'Create Student Account'
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

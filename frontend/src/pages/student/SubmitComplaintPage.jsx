import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import complaintService from '../../services/complaintService.js';
import dashboardService from '../../services/dashboardService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import FormField from '../../components/common/FormField.jsx';

const DEFAULT_CATEGORY_ISSUES = {
  ELECTRICAL: [
    { value: 'ELECTRICITY_FAILURE', label: 'Electricity Failure / Power Cut' },
    { value: 'LIGHT_NOT_WORKING', label: 'Tube Light / Bulb Not Working' },
    { value: 'FAN_NOT_WORKING', label: 'Ceiling Fan Issue' },
    { value: 'SWITCH_SOCKET_ISSUE', label: 'Switch / Socket Damaged' },
    { value: 'OTHER_ELECTRICAL', label: 'Other Electrical Problem' },
  ],
  PLUMBING: [
    { value: 'WATER_LEAKAGE', label: 'Pipe / Faucet Water Leakage' },
    { value: 'TAP_BROKEN', label: 'Broken Water Tap' },
    { value: 'DRAIN_BLOCKAGE', label: 'Drain / Sink Blockage' },
    { value: 'FLUSH_NOT_WORKING', label: 'Toilet Flush Not Working' },
    { value: 'OTHER_PLUMBING', label: 'Other Plumbing Issue' },
  ],
  WATER: [
    { value: 'WATER_SUPPLY', label: 'No Water Supply in Bathroom' },
    { value: 'NO_DRINKING_WATER', label: 'Drinking Water RO Issue' },
    { value: 'HOT_WATER_ISSUE', label: 'Geyser / Hot Water Problem' },
    { value: 'OTHER_WATER', label: 'Other Water Concern' },
  ],
  CLEANING: [
    { value: 'CLEANING_REQUIRED', label: 'Room Floor Sweeping / Mopping' },
    { value: 'DUSTBIN_CLEARANCE', label: 'Dustbin Waste Clearance' },
    { value: 'CORRIDOR_DIRTY', label: 'Corridor Cleaning' },
    { value: 'BATHROOM_CLEANING', label: 'Bathroom Deep Cleaning' },
    { value: 'OTHER_CLEANING', label: 'Other Cleaning Request' },
  ],
  MESS: [
    { value: 'FOOD_QUALITY', label: 'Food Quality / Taste Issue' },
    { value: 'MESS_HYGIENE', label: 'Dining Hall Cleanliness' },
    { value: 'TIMING_ISSUE', label: 'Mess Timing Issue' },
    { value: 'UTENSILS_CLEANLINESS', label: 'Unclean Utensils / Trays' },
    { value: 'OTHER_MESS', label: 'Other Mess Concern' },
  ],
  INTERNET: [
    { value: 'INTERNET_NOT_WORKING', label: 'Hostel Wi-Fi Down' },
    { value: 'WIFI_ROUTER_DOWN', label: 'Corridor Router Unreachable' },
    { value: 'SLOW_SPEED', label: 'Extremely Slow Internet Speed' },
    { value: 'LAN_PORT_ISSUE', label: 'LAN Port Not Functioning' },
    { value: 'OTHER_INTERNET', label: 'Other Connectivity Issue' },
  ],
  FURNITURE: [
    { value: 'FURNITURE_DAMAGE', label: 'Broken Bed Frame / Mesh' },
    { value: 'BED_BROKEN', label: 'Mattress / Cot Issue' },
    { value: 'STUDY_TABLE_CHAIR', label: 'Study Table or Chair Damaged' },
    { value: 'CUPBOARD_LOCK', label: 'Almirah / Wardrobe Lock Broken' },
    { value: 'OTHER_FURNITURE', label: 'Other Furniture Issue' },
  ],
  SECURITY: [
    { value: 'SECURITY_CONCERN', label: 'General Security / Guard Concern' },
    { value: 'UNAUTHORIZED_ENTRY', label: 'Unauthorized Person in Wing' },
    { value: 'NOISE_DISTURBANCE', label: 'Late Night Noise Disturbance' },
    { value: 'THEFT_REPORT', label: 'Missing Item / Theft Report' },
    { value: 'OTHER_SECURITY', label: 'Other Safety Concern' },
  ],
  ROOM: [
    { value: 'ROOM_ISSUE', label: 'Room Structural Issue' },
    { value: 'DOOR_LOCK_ISSUE', label: 'Main Door Lock / Handle Broken' },
    { value: 'WINDOW_GLASS_BROKEN', label: 'Window Pane / Latch Broken' },
    { value: 'WALL_SEEPAGE', label: 'Wall Paint Seepage / Dampness' },
    { value: 'OTHER_ROOM', label: 'Other Room Defect' },
  ],
  OTHER: [{ value: 'OTHER', label: 'Other Unlisted Concern' }],
};

export default function SubmitComplaintPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [studentDetails, setStudentDetails] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [categoryIssues, setCategoryIssues] = useState(DEFAULT_CATEGORY_ISSUES);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('ELECTRICAL');
  const [issueType, setIssueType] = useState('FAN_NOT_WORKING');
  const [priority, setPriority] = useState('MEDIUM');
  const [locationDescription, setLocationDescription] = useState('');

  // File Attachment State
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileError, setFileError] = useState('');

  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError('');

    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];

    if (!ALLOWED_TYPES.includes(file.type) && !validExts.includes(ext)) {
      setFileError('Please upload a JPG, JPEG, PNG, or WEBP image. Other file types are not supported.');
      setSelectedFile(null);
      setFilePreview(null);
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError('This image is too large (over 5 MB). Please choose a smaller photo and try again.');
      setSelectedFile(null);
      setFilePreview(null);
      e.target.value = '';
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFileError('');
  };

  // Fetch student location info and metadata
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [dashRes, metaRes] = await Promise.allSettled([
          dashboardService.getDashboardStats(),
          complaintService.getComplaintMeta(),
        ]);

        if (!isMounted) return;

        if (dashRes.status === 'fulfilled' && dashRes.value.success) {
          setStudentDetails(dashRes.value.data);
        }

        if (metaRes.status === 'fulfilled' && metaRes.value.success) {
          const apiMap = metaRes.value.data.categoryIssueTypes;
          if (apiMap && typeof apiMap === 'object') {
            const formatted = {};
            Object.keys(apiMap).forEach((cat) => {
              formatted[cat] = apiMap[cat].map((t) => ({
                value: t,
                label: t.replace(/_/g, ' '),
              }));
            });
            setCategoryIssues((prev) => ({ ...prev, ...formatted }));
          }
        }
      } catch (err) {
        console.warn('Error loading form metadata:', err);
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update issueType when category changes
  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    const available = categoryIssues[newCat] || [{ value: 'OTHER', label: 'Other' }];
    setIssueType(available[0]?.value || 'OTHER');
  };

  const validate = () => {
    const errs = {};
    if (!title.trim()) {
      errs.title = 'Please enter a short title so we know what the issue is about.';
    } else if (title.trim().length < 3) {
      errs.title = 'The title is too short — please add at least 3 characters.';
    } else if (title.trim().length > 120) {
      errs.title = 'The title is too long. Please keep it under 120 characters.';
    }

    if (!description.trim()) {
      errs.description = 'Please describe the issue so the maintenance team knows what to fix.';
    } else if (description.trim().length < 10) {
      errs.description = 'Please add a bit more detail — at least 10 characters helps the team prepare.';
    } else if (description.trim().length > 2000) {
      errs.description = 'The description is too long. Please keep it under 2000 characters.';
    }

    if (!category) errs.category = 'Please pick a category for this issue.';
    if (!issueType) errs.issueType = 'Please pick the type of issue.';
    if (!priority) errs.priority = 'Please choose a priority level.';

    if (locationDescription && locationDescription.length > 200) {
      errs.locationDescription = 'Location note is too long. Please keep it under 200 characters.';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!isAllocated) {
      const msg = `You need a room assignment before you can report an issue. Missing details: ${missingLocationFields.join(', ')}. Please contact your hostel warden to update your profile.`;
      setSubmitError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!validate()) {
      setSubmitError('Some fields need attention — please check the highlighted messages below and try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    try {
      let payload;
      const cleanLoc = (locationDescription || '').trim();
      if (selectedFile) {
        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('description', description.trim());
        formData.append('category', category);
        formData.append('issueType', issueType);
        formData.append('priority', priority);
        if (cleanLoc) {
          formData.append('locationDescription', cleanLoc);
        }
        formData.append('attachment', selectedFile);
        payload = formData;
      } else {
        payload = {
          title: title.trim(),
          description: description.trim(),
          category,
          issueType,
          priority,
          locationDescription: cleanLoc,
        };
      }

      const res = await complaintService.submitComplaint(payload);

      const complaintObj = res?.data || res;
      const complaintId = complaintObj?.complaintId || complaintObj?._id || res?.complaintId || res?._id;

      if ((res?.success || complaintId) && complaintId) {
        navigate(`/student/complaints/${complaintId}`);
      } else {
        const msg = res?.message || 'Something went wrong. Please try again in a moment.';
        setSubmitError(msg);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        setSubmitError('Your session has expired. Please sign in again to continue.');
      } else {
        setSubmitError(
          err?.response?.data?.message ||
          err?.userMessage ||
          err.message ||
          'We could not send your report. Please check your connection and try again.'
        );
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    return (
      <DashboardLayout title="Report an Issue" roleLabel="Student">
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading your room details..." />
        </div>
      </DashboardLayout>
    );
  }

  const hostelVal = studentDetails?.hostel || studentDetails?.student?.hostelId || user?.hostelId || user?.hostel;
  const blockVal = studentDetails?.block || studentDetails?.student?.blockId || user?.blockId || user?.block;
  const floorVal = studentDetails?.floor || studentDetails?.student?.floorId || user?.floorId || user?.floor;
  const roomVal = studentDetails?.room || studentDetails?.student?.roomId || user?.roomId || user?.room;

  const missingLocationFields = [];
  if (!hostelVal) missingLocationFields.push('Hostel');
  if (!blockVal && !user?.blockId && !user?.block) missingLocationFields.push('Block');
  if (!floorVal && !user?.floorId && !user?.floor) missingLocationFields.push('Floor');
  if (!roomVal && !user?.roomId && !user?.room) missingLocationFields.push('Room');

  // Any logged-in student with hostel/user ID is considered allocated for frontend entry
  const isAllocated = !!(hostelVal || user?.hostelId || user?.studentId || user?._id);

  return (
    <DashboardLayout title="Report an Issue" roleLabel="Student">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Step intro */}
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40 p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-indigo-600 p-2 text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Tell us what needs fixing in your room</h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Fill in the three steps below. Once you submit, you will get a tracking number and can check the status anytime.
              </p>
            </div>
          </div>
        </div>

        {/* Room not assigned warning */}
        {!isAllocated && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-2xs space-y-2" role="alert">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <svg className="h-5 w-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              You need a room assignment before reporting an issue
            </div>
            <p className="text-slate-700">
              Your account does not have a room linked yet. Every report must be tied to a hostel room so the right team can respond.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="font-semibold text-slate-700">Missing details:</span>
              <div className="flex flex-wrap gap-1">
                {missingLocationFields.map((field) => (
                  <span key={field} className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-800 text-[10px]">
                    {field}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              Contact your hostel warden to get your room assigned, then come back here to report the issue.
            </p>
          </div>
        )}

        {submitError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700" role="alert">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Step 1: Your Room */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Step 1 — Your Room</h3>
                <p className="text-xs text-slate-500">Filled in automatically from your student record</p>
              </div>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                ✓ Verified
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] font-medium text-slate-500">Hostel</span>
                <span className="mt-1 block font-semibold text-slate-900 text-xs">
                  {studentDetails?.hostel?.name || 'Not assigned'}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-mono">{studentDetails?.hostel?.code}</span>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] font-medium text-slate-500">Block / Wing</span>
                <span className="mt-1 block font-semibold text-slate-900 text-xs">
                  {studentDetails?.block?.name || 'Not assigned'}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] font-medium text-slate-500">Floor</span>
                <span className="mt-1 block font-semibold text-slate-900 text-xs">
                  {studentDetails?.floor?.name ||
                    (studentDetails?.floor?.floorNumber !== undefined
                      ? `Floor ${studentDetails.floor.floorNumber}`
                      : 'Not assigned')}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] font-medium text-slate-500">Room Number</span>
                <span className="mt-1 block font-bold text-indigo-700 text-xs font-mono">
                  {studentDetails?.room ? `Room ${studentDetails.room.roomNumber}` : 'Not assigned'}
                </span>
              </div>
            </div>

            {/* Exact spot in the room */}
            <div className="mt-4">
              <FormField
                label="Where exactly in the room? (Optional)"
                error={formErrors.locationDescription}
                helpText="Helps the technician find the problem faster. e.g. Near the window, above the study desk, in the attached bathroom."
              >
                <input
                  type="text"
                  value={locationDescription}
                  onChange={(e) => setLocationDescription(e.target.value)}
                  maxLength={200}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  placeholder="e.g. Left corner switchboard near window"
                />
              </FormField>
            </div>
          </div>

          {/* Step 2: What is the issue? */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Step 2 — What is the issue?</h3>
              <p className="text-xs text-slate-500">Choose the area and type of problem, then describe it</p>
            </div>

            {/* Category & Issue Type */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Area of the problem" required error={formErrors.category}>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden font-medium"
                >
                  <option value="ELECTRICAL">Electrical (Lights, Fans, Sockets)</option>
                  <option value="PLUMBING">Plumbing (Taps, Pipes, Drains)</option>
                  <option value="WATER">Water Supply (Drinking, Bathroom)</option>
                  <option value="CLEANING">Cleaning &amp; Housekeeping</option>
                  <option value="INTERNET">Internet &amp; Wi-Fi</option>
                  <option value="FURNITURE">Furniture &amp; Carpentry</option>
                  <option value="SECURITY">Security &amp; Safety</option>
                  <option value="ROOM">Room Structure &amp; Civil</option>
                  <option value="MESS">Mess &amp; Dining Hall</option>
                  <option value="OTHER">Other Issues</option>
                </select>
              </FormField>

              <FormField label="Specific problem" required error={formErrors.issueType}>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden font-medium"
                >
                  {(categoryIssues[category] || [{ value: 'OTHER', label: 'Other' }]).map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Urgency */}
            <div>
              <FormField
                label="How urgent is this?"
                required
                error={formErrors.priority}
                helpText="Choose honestly — urgent reports are handled first."
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      value: 'LOW',
                      label: 'Low',
                      desc: 'Minor inconvenience, can wait',
                      icon: '🟦',
                      color: 'border-slate-300 peer-checked:border-blue-600 peer-checked:bg-blue-50/50',
                    },
                    {
                      value: 'MEDIUM',
                      label: 'Medium',
                      desc: 'Affects daily routine',
                      icon: '🟩',
                      color: 'border-slate-300 peer-checked:border-emerald-600 peer-checked:bg-emerald-50/50',
                    },
                    {
                      value: 'HIGH',
                      label: 'High',
                      desc: 'Hard to live without fixing',
                      icon: '🟧',
                      color: 'border-slate-300 peer-checked:border-amber-600 peer-checked:bg-amber-50/50',
                    },
                    {
                      value: 'CRITICAL',
                      label: 'Critical',
                      desc: 'Hazard or emergency',
                      icon: '🟥',
                      color: 'border-slate-300 peer-checked:border-rose-600 peer-checked:bg-rose-50/50',
                    },
                  ].map((p) => (
                    <label key={p.value} className="relative block cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        value={p.value}
                        checked={priority === p.value}
                        onChange={(e) => setPriority(e.target.value)}
                        className="peer sr-only"
                      />
                      <div className={`rounded-lg border p-3 text-center transition ${p.color}`}>
                        <span className="block text-base">{p.icon}</span>
                        <span className="block text-xs font-bold text-slate-800 mt-0.5">{p.label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{p.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </FormField>
            </div>

            {/* Short Title */}
            <FormField
              label="Short title for your issue"
              required
              error={formErrors.title}
              helpText="One sentence that says what is wrong."
            >
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                placeholder="e.g. Ceiling fan in room 101 stopped working"
              />
            </FormField>

            {/* Full Description */}
            <FormField
              label="Describe the problem in detail"
              required
              error={formErrors.description}
              helpText="Mention when it started, how often it happens, and any other details. This helps the technician bring the right tools."
            >
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                placeholder="e.g. The fan stopped rotating yesterday evening. It makes a humming sound but blades do not move..."
              />
              <div className="mt-1 text-right text-[10px] text-slate-400">
                {description.length} / 2000 characters
              </div>
            </FormField>
          </div>

          {/* Step 3: Add a photo (optional) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Step 3 — Add a photo (optional)</h3>
              <p className="text-xs text-slate-500">A clear photo helps the team arrive prepared with the right parts</p>
            </div>

            {fileError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700" role="alert">
                {fileError}
              </div>
            )}

            {!selectedFile ? (
              <div className="flex justify-center rounded-lg border-2 border-dashed border-slate-300 px-6 py-8 hover:border-indigo-400 transition">
                <div className="text-center">
                  <svg className="mx-auto h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="mt-3 flex text-xs leading-6 text-slate-600 justify-center">
                    <label
                      htmlFor="attachment-upload"
                      className="relative cursor-pointer rounded-md font-bold text-indigo-600 focus-within:outline-hidden hover:text-indigo-500"
                    >
                      <span>Choose a photo</span>
                      <input
                        id="attachment-upload"
                        name="attachment"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>
                    <p className="pl-1">or drag and drop here</p>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    JPG, PNG, or WEBP · up to 5 MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {filePreview ? (
                      <img
                        src={filePreview}
                        alt="Preview of your chosen photo"
                        className="h-16 w-16 rounded-lg object-cover border border-slate-200 shadow-2xs"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                        IMG
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-800 truncate max-w-xs">{selectedFile.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; {selectedFile.type || 'Image'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-2xs hover:bg-rose-50 transition cursor-pointer"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove photo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <Link
              to="/student/complaints"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              ← Cancel and go back
            </Link>

            <div className="flex flex-col items-end gap-1">
              <button
                type="submit"
                id="submit-complaint-btn"
                disabled={submitting}
                className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer ${
                  !isAllocated
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {submitting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Sending your report…
                  </>
                ) : (
                  'Send my report →'
                )}
              </button>
              {!isAllocated && (
                <span className="text-[11px] font-medium text-amber-700">
                  Room assignment needed before sending
                </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

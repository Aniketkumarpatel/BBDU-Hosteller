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

  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
      errs.title = 'Title is required';
    } else if (title.trim().length < 3) {
      errs.title = 'Title must be at least 3 characters';
    } else if (title.trim().length > 120) {
      errs.title = 'Title cannot exceed 120 characters';
    }

    if (!description.trim()) {
      errs.description = 'Description is required';
    } else if (description.trim().length < 10) {
      errs.description = 'Please provide at least 10 characters describing the issue';
    } else if (description.trim().length > 2000) {
      errs.description = 'Description cannot exceed 2000 characters';
    }

    if (!category) errs.category = 'Category is required';
    if (!issueType) errs.issueType = 'Issue type is required';
    if (!priority) errs.priority = 'Priority is required';

    if (locationDescription && locationDescription.length > 200) {
      errs.locationDescription = 'Location description cannot exceed 200 characters';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (!studentDetails?.hostel || !studentDetails?.room) {
      setSubmitError(
        'You must have an assigned hostel and room in your profile before submitting complaints. Please contact your warden.'
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        issueType,
        priority,
        locationDescription: locationDescription.trim(),
      };

      const res = await complaintService.submitComplaint(payload);

      if (res.success && res.data) {
        navigate(`/student/complaints/${res.data.complaintId || res.data._id}`);
      } else {
        setSubmitError(res.message || 'Failed to submit complaint');
      }
    } catch (err) {
      setSubmitError(err?.response?.data?.message || err.message || 'Error submitting complaint');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    return (
      <DashboardLayout title="Submit Maintenance Complaint" roleLabel="Student">
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading resident location details..." />
        </div>
      </DashboardLayout>
    );
  }

  const isAllocated = Boolean(studentDetails?.hostel && studentDetails?.room);

  return (
    <DashboardLayout title="Submit Maintenance Complaint" roleLabel="Student">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Intro Banner */}
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40 p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-indigo-600 p-2 text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Hostel Maintenance &amp; Grievance Redressal</h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Log maintenance requests for electrical, plumbing, sanitation, or internet issues. A unique complaint ID will be generated to track its resolution.
              </p>
            </div>
          </div>
        </div>

        {/* Accommodation Status Warning if unallocated */}
        {!isAllocated && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <span className="font-bold">Accommodation Allocation Required:</span> Your student account does not have an active hostel and room assignment. Maintenance complaints must be tied to a verified residential room. Please contact your hostel warden.
          </div>
        )}

        {submitError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Location Binding (Read-only verification) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">1. Residential Location</h3>
                <p className="text-xs text-slate-500">Auto-populated from your official student record</p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 font-semibold uppercase">
                Verified Resident
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] font-medium text-slate-500">Hostel</span>
                <span className="mt-1 block font-semibold text-slate-900 text-xs">
                  {studentDetails?.hostel?.name || 'Unassigned'}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-mono">{studentDetails?.hostel?.code}</span>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] font-medium text-slate-500">Block / Wing</span>
                <span className="mt-1 block font-semibold text-slate-900 text-xs">
                  {studentDetails?.block?.name || 'Unassigned'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{studentDetails?.block?.code}</span>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] font-medium text-slate-500">Floor Level</span>
                <span className="mt-1 block font-semibold text-slate-900 text-xs">
                  {studentDetails?.floor?.name || (studentDetails?.floor?.floorNumber !== undefined ? `Floor ${studentDetails.floor.floorNumber}` : 'Unassigned')}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <span className="block text-[11px] font-medium text-slate-500">Room Number</span>
                <span className="mt-1 block font-bold text-indigo-700 text-xs font-mono">
                  {studentDetails?.room ? `Room ${studentDetails.room.roomNumber}` : 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Additional location notes */}
            <div className="mt-4">
              <FormField
                label="Specific Location Notes (Optional)"
                error={formErrors.locationDescription}
                helpText="e.g. Near window switchboard, balcony, attached washroom, study desk corner."
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

          {/* Section 2: Complaint Details */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">2. Issue Details</h3>
              <p className="text-xs text-slate-500">Select category, issue type, and descriptive details</p>
            </div>

            {/* Category & Issue Type Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Category" required error={formErrors.category}>
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

              <FormField label="Issue Type" required error={formErrors.issueType}>
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

            {/* Priority Selection */}
            <div>
              <FormField label="Priority Level" required error={formErrors.priority}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { value: 'LOW', label: 'Low', desc: 'Minor inconvenience', color: 'border-slate-300 peer-checked:border-blue-600 peer-checked:bg-blue-50/50' },
                    { value: 'MEDIUM', label: 'Medium', desc: 'Normal routine impact', color: 'border-slate-300 peer-checked:border-emerald-600 peer-checked:bg-emerald-50/50' },
                    { value: 'HIGH', label: 'High', desc: 'Disrupts daily living', color: 'border-slate-300 peer-checked:border-amber-600 peer-checked:bg-amber-50/50' },
                    { value: 'CRITICAL', label: 'Critical', desc: 'Hazard or emergency', color: 'border-slate-300 peer-checked:border-rose-600 peer-checked:bg-rose-50/50' },
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
                        <span className="block text-xs font-bold text-slate-800">{p.label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{p.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </FormField>
            </div>

            {/* Title */}
            <FormField label="Complaint Title" required error={formErrors.title}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                placeholder="e.g. Ceiling fan in room 101 vibrating loudly and stopped rotating"
              />
            </FormField>

            {/* Description */}
            <FormField
              label="Detailed Description"
              required
              error={formErrors.description}
              helpText="Please describe what happened, when it started, and any symptoms."
            >
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                placeholder="Explain the problem in detail so the technician brings the correct tools and replacement parts..."
              />
              <div className="mt-1 text-right text-[10px] text-slate-400">
                {description.length} / 2000 characters
              </div>
            </FormField>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <Link
              to="/student/complaints"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              &larr; Cancel and back to My Complaints
            </Link>

            <button
              type="submit"
              disabled={submitting || !isAllocated}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Submitting Ticket...
                </>
              ) : (
                'Submit Complaint'
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

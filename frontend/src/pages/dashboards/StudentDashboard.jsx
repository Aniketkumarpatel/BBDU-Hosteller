import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import dashboardService from '../../services/dashboardService.js';
import complaintService from '../../services/complaintService.js';
import studentServicesService from '../../services/studentServicesService.js';
import outpassService from '../../services/outpassService.js';
import { getUnreadCount } from '../../services/notificationService.js';
import messService from '../../services/messService.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { IS_PILOT_MODE } from '../../config/pilot.js';

function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 30) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

let studentDashboardCache = null;

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [statsData, setStatsData] = useState(() => studentDashboardCache?.statsData || null);
  const [recentComplaints, setRecentComplaints] = useState(() => studentDashboardCache?.recentComplaints || []);
  const [notices, setNotices] = useState(() => studentDashboardCache?.notices || []);
  const [serviceRequests, setServiceRequests] = useState(() => studentDashboardCache?.serviceRequests || []);
  const [outpasses, setOutpasses] = useState(() => studentDashboardCache?.outpasses || []);
  const [messFeedbacks, setMessFeedbacks] = useState(() => studentDashboardCache?.messFeedbacks || []);
  const [unreadCount, setUnreadCount] = useState(() => studentDashboardCache?.unreadCount || 0);
  const [loading, setLoading] = useState(() => !studentDashboardCache);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    if (!studentDashboardCache) {
      setLoading(true);
    }
    setError(null);
    try {
      const [statsRes, complaintsRes, noticesRes, requestsRes, outpassesRes, feedbacksRes, unreadRes] = await Promise.allSettled([
        dashboardService.getDashboardStats(),
        complaintService.getMyComplaints({ limit: 10 }),
        studentServicesService.getNotices({ limit: 4 }),
        studentServicesService.getServiceRequests({ limit: 10 }),
        outpassService.getOutpasses({ limit: 10 }),
        messService.getMessFeedbacks({ limit: 5 }),
        getUnreadCount(),
      ]);

      let newStats = studentDashboardCache?.statsData || null;
      let newComplaints = studentDashboardCache?.recentComplaints || [];
      let newNotices = studentDashboardCache?.notices || [];
      let newRequests = studentDashboardCache?.serviceRequests || [];
      let newOutpasses = studentDashboardCache?.outpasses || [];
      let newFeedbacks = studentDashboardCache?.messFeedbacks || [];
      let newUnread = studentDashboardCache?.unreadCount || 0;

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        newStats = statsRes.value.data;
        setStatsData(newStats);
      } else if (statsRes.status === 'rejected' && !studentDashboardCache) {
        throw new Error(statsRes.reason?.message || 'Failed to load stats');
      }

      if (complaintsRes.status === 'fulfilled' && complaintsRes.value?.success) {
        const list = complaintsRes.value.data?.complaints || complaintsRes.value.data || [];
        newComplaints = Array.isArray(list) ? list : [];
        setRecentComplaints(newComplaints);
      }

      if (noticesRes.status === 'fulfilled' && noticesRes.value?.success) {
        const list = noticesRes.value.data?.notices || noticesRes.value.data || [];
        newNotices = Array.isArray(list) ? list : [];
        setNotices(newNotices);
      }

      if (requestsRes.status === 'fulfilled' && requestsRes.value?.success) {
        const list = requestsRes.value.data?.requests || requestsRes.value.data || [];
        newRequests = Array.isArray(list) ? list : [];
        setServiceRequests(newRequests);
      }

      if (outpassesRes.status === 'fulfilled' && outpassesRes.value?.success) {
        const list = outpassesRes.value.data?.outpasses || outpassesRes.value.data || [];
        newOutpasses = Array.isArray(list) ? list : [];
        setOutpasses(newOutpasses);
      }

      if (feedbacksRes.status === 'fulfilled' && feedbacksRes.value?.success) {
        const list = feedbacksRes.value.data || [];
        newFeedbacks = Array.isArray(list) ? list : [];
        setMessFeedbacks(newFeedbacks);
      }

      if (unreadRes.status === 'fulfilled' && unreadRes.value?.success) {
        const count = unreadRes.value.data?.unreadCount ?? unreadRes.value.data?.count ?? 0;
        newUnread = typeof count === 'number' ? count : 0;
        setUnreadCount(newUnread);
      }

      studentDashboardCache = {
        statsData: newStats,
        recentComplaints: newComplaints,
        notices: newNotices,
        serviceRequests: newRequests,
        outpasses: newOutpasses,
        messFeedbacks: newFeedbacks,
        unreadCount: newUnread,
      };
    } catch (err) {
      if (!studentDashboardCache) {
        setError('Unable to load this section. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const studentName = statsData?.student?.name || user?.name || 'Resident';
  const metrics = statsData?.complaintMetrics || {
    total: 0,
    submitted: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    reopened: 0,
  };

  const pendingCount = (metrics.submitted || 0) + (metrics.inProgress || 0) + (metrics.reopened || 0);
  const resolvedCount = (metrics.resolved || 0) + (metrics.closed || 0);

  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return 'Not Assigned';
    return val;
  };

  // Build combined recent activity list safely from real data, sorted newest first
  const activities = [];

  recentComplaints.forEach((c) => {
    const rawDate = c.updatedAt || c.createdAt;
    activities.push({
      id: `complaint-${c._id}`,
      title: `Complaint: ${c.title || c.category || 'Maintenance Issue'}`,
      status: c.status || 'SUBMITTED',
      type: 'COMPLAINT',
      rawDate: rawDate ? new Date(rawDate).getTime() : 0,
      date: formatRelativeTime(rawDate),
      link: `/student/complaints/${c._id}`,
    });
  });

  serviceRequests.forEach((r) => {
    const rawDate = r.updatedAt || r.createdAt;
    activities.push({
      id: `request-${r._id}`,
      title: `Service Request: ${r.title || r.serviceType || r.category || 'Hostel Service'}`,
      status: r.status || 'SUBMITTED',
      type: 'SERVICE',
      rawDate: rawDate ? new Date(rawDate).getTime() : 0,
      date: formatRelativeTime(rawDate),
      link: `/student-services/requests/${r._id}`,
    });
  });

  outpasses.forEach((o) => {
    const rawDate = o.updatedAt || o.createdAt;
    activities.push({
      id: `outpass-${o._id}`,
      title: `Outpass: ${o.reason || o.type || 'Gate Pass Request'}`,
      status: o.status || 'PENDING',
      type: 'OUTPASS',
      rawDate: rawDate ? new Date(rawDate).getTime() : 0,
      date: formatRelativeTime(rawDate),
      link: `/outpass`,
    });
  });

  messFeedbacks.forEach((fb) => {
    const rawDate = fb.createdAt || fb.mealDate;
    activities.push({
      id: `feedback-${fb._id}`,
      title: `Meal Review: ${fb.mealType} (${fb.rating} ★ - ${fb.foodQuality || 'Rated'})`,
      status: 'SUBMITTED',
      type: 'FEEDBACK',
      rawDate: rawDate ? new Date(rawDate).getTime() : 0,
      date: formatRelativeTime(rawDate),
      link: `/mess`,
    });
  });

  // Sort activities descending by timestamp
  activities.sort((a, b) => b.rawDate - a.rawDate);

  const getPriorityBadgeClass = (priority) => {
    switch (String(priority).toUpperCase()) {
      case 'URGENT':
      case 'MANDATORY':
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <DashboardLayout title="Student Portal" roleLabel="Student">
      {loading ? (
        /* Section-Level Skeleton Loader (Req 12) */
        <div className="space-y-6 animate-pulse">
          <div className="h-32 rounded-2xl bg-slate-200" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-200" />
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="h-64 rounded-xl bg-slate-200 md:col-span-2" />
            <div className="h-64 rounded-xl bg-slate-200" />
          </div>
        </div>
      ) : error ? (
        /* Clean Error State (Req 13) */
        <div className="mx-auto my-12 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">Unable to load this section</h2>
          <p className="mt-1.5 text-xs text-slate-500">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. HEADER / WELCOME SECTION (Req 1) */}
          <div className="rounded-2xl border border-indigo-900/10 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 text-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 items-center justify-center">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  </span>
                  <span className="text-xs font-semibold tracking-wide text-emerald-300">
                    Hostel Services Online
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {getGreeting()}, {studentName} 👋
                </h1>
                <p className="mt-1 text-xs text-indigo-200 sm:text-sm">
                  BBDU Hosteller - Your hostel, complaints and services in one place.
                </p>
              </div>

              {/* Notification Indicator (Req 8) */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/student-services')}
                  className="group relative flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/20 focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
                  aria-label="View notifications"
                >
                  <svg className="h-4 w-4 text-indigo-200 transition group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-xs">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 3. QUICK STATISTICS (Req 3) */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
            <div className="group relative overflow-hidden rounded-xl border border-indigo-100 border-t-2 border-t-indigo-600 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">My Complaints</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition group-hover:scale-105">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">{metrics.total}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Total submitted tickets</p>
            </div>

            <div className="group relative overflow-hidden rounded-xl border border-amber-100 border-t-2 border-t-amber-500 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition group-hover:scale-105">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-amber-600">{pendingCount}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">In progress / pending</p>
            </div>

            <div className="group relative overflow-hidden rounded-xl border border-emerald-100 border-t-2 border-t-emerald-500 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Resolved</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition group-hover:scale-105">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-emerald-600">{resolvedCount}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Resolved &amp; verified</p>
            </div>

            <div className="group relative overflow-hidden rounded-xl border border-sky-100 border-t-2 border-t-sky-500 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Service Requests</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 transition group-hover:scale-105">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-sky-600">{serviceRequests.length}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Active room requests</p>
            </div>

            <div className="group relative overflow-hidden rounded-xl border border-purple-100 border-t-2 border-t-purple-500 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Notifications</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 transition group-hover:scale-105">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-purple-600">{unreadCount}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Unread notifications</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* 2. STUDENT PROFILE SUMMARY (Req 2) */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs md:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Student Profile &amp; Residence</h2>
                  <p className="text-[11px] text-slate-500">Official student identity and hostel assignment</p>
                </div>
                <StatusBadge status={statsData?.student?.isActive !== false} />
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg bg-slate-50/80 p-3">
                  <dt className="text-[11px] font-medium text-slate-500">Student Name</dt>
                  <dd className="mt-0.5 text-xs font-bold text-slate-900">{formatValue(statsData?.student?.name || user?.name)}</dd>
                </div>

                <div className="rounded-lg bg-slate-50/80 p-3">
                  <dt className="text-[11px] font-medium text-slate-500">University Email</dt>
                  <dd className="mt-0.5 text-xs font-bold text-slate-900 truncate">{formatValue(statsData?.student?.email || user?.email)}</dd>
                </div>

                <div className="rounded-lg bg-slate-50/80 p-3">
                  <dt className="text-[11px] font-medium text-slate-500">Student ID</dt>
                  <dd className="mt-0.5 font-mono text-xs font-bold text-indigo-700">
                    {formatValue(statsData?.student?.studentId || user?.studentId)}
                  </dd>
                </div>

                <div className="rounded-lg bg-slate-50/80 p-3">
                  <dt className="text-[11px] font-medium text-slate-500">Hostel</dt>
                  <dd className="mt-0.5 text-xs font-bold text-slate-900">
                    {statsData?.hostel?.name
                      ? `${statsData.hostel.name}${statsData.hostel.code ? ` (${statsData.hostel.code})` : ''}`
                      : (typeof user?.hostelId === 'object' && user?.hostelId?.name
                          ? `${user.hostelId.name}${user.hostelId.code ? ` (${user.hostelId.code})` : ''}`
                          : (user?.hostelId || 'Not Assigned'))}
                  </dd>
                </div>

                <div className="rounded-lg bg-slate-50/80 p-3">
                  <dt className="text-[11px] font-medium text-slate-500">Block / Wing</dt>
                  <dd className="mt-0.5 text-xs font-bold text-slate-900">
                    {statsData?.block?.name
                      ? `${statsData.block.name}${statsData.block.code ? ` (${statsData.block.code})` : ''}`
                      : (typeof user?.blockId === 'object' && user?.blockId?.name
                          ? `${user.blockId.name}${user.blockId.code ? ` (${user.blockId.code})` : ''}`
                          : (user?.blockId ? `Block ${user.blockId}` : 'Not Assigned'))}
                  </dd>
                </div>

                <div className="rounded-lg bg-slate-50/80 p-3">
                  <dt className="text-[11px] font-medium text-slate-500">Floor</dt>
                  <dd className="mt-0.5 text-xs font-bold text-slate-900">
                    {statsData?.floor
                      ? (statsData.floor.name || `Floor ${statsData.floor.floorNumber || statsData.floor}`)
                      : (typeof user?.floorId === 'object' && user?.floorId?.name
                          ? user.floorId.name
                          : (user?.floorId ? `Floor ${user.floorId}` : 'Not Assigned'))}
                  </dd>
                </div>

                <div className="rounded-lg bg-slate-50/80 p-3 sm:col-span-2 lg:col-span-3">
                  <dt className="text-[11px] font-medium text-slate-500">Room Allocation</dt>
                  <dd className="mt-0.5 text-xs font-bold text-indigo-700">
                    {statsData?.room?.roomNumber
                      ? `Room ${statsData.room.roomNumber} (${statsData.room.roomType || 'Standard'} • ${statsData.room.currentOccupancy || 1}/${statsData.room.capacity || 2} Occupied)`
                      : (user?.roomNumber ? `Room ${user.roomNumber}` : 'Not Assigned')}
                  </dd>
                </div>
              </dl>
            </div>

            {/* 4. QUICK ACTIONS (Req 4) */}
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Quick Actions</h3>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    to="/student/complaints/new"
                    className="flex flex-col items-center justify-center rounded-lg border border-indigo-200 bg-indigo-600 p-2.5 text-center text-white transition-all duration-200 hover:bg-indigo-700 hover:shadow-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
                  >
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="mt-1 text-[11px] font-bold">+ Submit Complaint</span>
                  </Link>

                  <Link
                    to="/student/complaints"
                    className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-2.5 text-center text-slate-800 transition-all duration-200 hover:bg-slate-50 hover:shadow-2xs"
                  >
                    <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="mt-1 text-[11px] font-semibold">My Complaints</span>
                  </Link>

                  {!IS_PILOT_MODE && (
                    <>
                      <Link
                        to="/outpass"
                        className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-2.5 text-center text-slate-800 transition-all duration-200 hover:bg-slate-50 hover:shadow-2xs"
                      >
                        <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="mt-1 text-[11px] font-semibold">Outpass &amp; Pass</span>
                      </Link>

                      <Link
                        to="/mess"
                        className="flex flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 text-center text-amber-900 transition-all duration-200 hover:bg-amber-100 hover:shadow-2xs"
                      >
                        <span className="text-base">🍽</span>
                        <span className="mt-0.5 text-[11px] font-semibold">Mess &amp; Dining</span>
                      </Link>

                      <Link
                        to="/student-services"
                        className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-2.5 text-center text-slate-800 transition-all duration-200 hover:bg-slate-50 hover:shadow-2xs"
                      >
                        <svg className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="mt-1 text-[11px] font-semibold">Student Services</span>
                      </Link>

                      <Link
                        to="/assets"
                        className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-2.5 text-center text-slate-800 transition-all duration-200 hover:bg-slate-50 hover:shadow-2xs"
                      >
                        <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span className="mt-1 text-[11px] font-semibold">Room Assets</span>
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-indigo-100 pt-3 text-[11px] text-slate-400 text-center">
                Official BBDU Hostel Portal
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* 5. RECENT ACTIVITY (Req 5) */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Recent Activity
                </h3>
                <Link to="/student/complaints" className="text-[11px] font-semibold text-indigo-600 hover:underline">
                  View All &rarr;
                </Link>
              </div>

              {activities.length > 0 ? (
                <div className="mt-3 divide-y divide-slate-100">
                  {activities.map((act) => (
                    <Link
                      key={act.id}
                      to={act.link}
                      className="group flex items-center justify-between py-2.5 transition hover:bg-slate-50/80 px-2 rounded-lg"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-[10px]">
                          {act.type === 'COMPLAINT' ? '🎫' : '📋'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition">
                            {act.title}
                          </p>
                          <p className="text-[10px] text-slate-400">{act.date}</p>
                        </div>
                      </div>
                      <span className="ml-2 shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                        {act.status}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                /* Empty State (Req 11) */
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-700">No recent activity</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Your recent complaints and requests will appear here.</p>
                  <Link
                    to="/student/complaints/new"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    + Create a Complaint
                  </Link>
                </div>
              )}
            </div>

            {/* 6. IMPORTANT NOTICES (Req 6) */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  Important Notices
                </h3>
                <Link to="/student-services" className="text-[11px] font-semibold text-indigo-600 hover:underline">
                  View Notices &rarr;
                </Link>
              </div>

              {notices.length > 0 ? (
                <div className="mt-3 space-y-2.5">
                  {notices.slice(0, 3).map((n) => (
                    <div key={n._id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{n.title}</span>
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getPriorityBadgeClass(n.priority)}`}>
                          {n.priority || 'GENERAL'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">{n.content || n.description}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Published: {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'Recent'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty State (Req 11) */
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-700">No new notices</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Check back later for official hostel announcements.</p>
                </div>
              )}
            </div>
          </div>

          {/* 7. HOSTEL SERVICE STATUS (Req 7) */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Hostel System Operational Status
              </h3>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                All Modules Live
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Complaints</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">Operational</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Mess Services</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">Operational</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Housekeeping</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">Operational</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Maintenance</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">Operational</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Student Services</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">Operational</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800">Outpass Gate</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">Operational</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

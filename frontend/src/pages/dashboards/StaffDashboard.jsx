import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import dashboardService from '../../services/dashboardService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import DashboardCard from '../../components/common/DashboardCard.jsx';

export default function StaffDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardService.getDashboardStats();
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.message || 'Failed to load staff dashboard');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error fetching stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <DashboardLayout title="Staff Operations Portal" roleLabel="Hostel Staff">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading your operations profile..." />
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load staff dashboard"
          message={error}
          onRetry={fetchStats}
        />
      ) : (
        <div className="space-y-6">
          {/* Welcome Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-teal-700 via-emerald-800 to-slate-900 p-6 text-white shadow-md">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Staff Operations Dashboard
                </span>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">
                  Welcome, {data?.staff?.name || user?.name}!
                </h1>
                <p className="mt-1 text-sm text-teal-200">
                  {data?.department ? `${data.department.name} Department` : 'Hostel Maintenance & Services'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-xs font-medium text-white">
                  Emp ID: {data?.staff?.employeeId || user?.employeeId || 'STAFF-001'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DashboardCard
              title="Department"
              value={data?.department ? data.department.name : 'General Maintenance'}
              subtitle={data?.department ? `Code: ${data.department.code}` : 'All Areas'}
              color="teal"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
            <DashboardCard
              title="Assigned Hostel"
              value={data?.hostel ? data.hostel.name : 'Campus Wide'}
              subtitle={data?.block ? `Block: ${data.block.name}` : 'All Sections'}
              color="indigo"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              }
            />
            <DashboardCard
              title="Operating Scope"
              value={data?.operationalOverview?.roomsCount ?? 0}
              subtitle="Rooms under maintenance jurisdiction"
              color="amber"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              }
            />
          </div>

          {/* Assigned Work & SLA Status Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-600 animate-pulse" />
                  Assigned Work &amp; SLA Status
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live timers and breach alerts for complaints assigned directly to your queue.
                </p>
              </div>
              <Link
                to="/staff/complaints"
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700 transition"
              >
                Go to Work Queue &rarr;
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-teal-50/70 p-3 text-center border border-teal-100">
                <span className="text-xl font-bold text-teal-700">{data?.slaStats?.active ?? 0}</span>
                <span className="block text-[11px] font-semibold text-teal-900 mt-0.5">Active Tickets</span>
              </div>
              <div className="rounded-lg bg-amber-50/70 p-3 text-center border border-amber-100">
                <span className="text-xl font-bold text-amber-700">{data?.slaStats?.dueSoon ?? 0}</span>
                <span className="block text-[11px] font-semibold text-amber-900 mt-0.5">Due Soon (&lt;4h)</span>
              </div>
              <div className="rounded-lg bg-rose-50/70 p-3 text-center border border-rose-100">
                <span className="text-xl font-bold text-rose-700">{data?.slaStats?.breached ?? 0}</span>
                <span className="block text-[11px] font-semibold text-rose-900 mt-0.5">Breached</span>
              </div>
              <div className="rounded-lg bg-purple-50/70 p-3 text-center border border-purple-100">
                <span className="text-xl font-bold text-purple-700">{data?.slaStats?.escalated ?? 0}</span>
                <span className="block text-[11px] font-semibold text-purple-900 mt-0.5">Escalated</span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Staff Details Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs md:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Staff Profile &amp; Assignment</h2>
                  <p className="text-xs text-slate-500">Service department &amp; jurisdictional location details</p>
                </div>
                <StatusBadge status={data?.staff?.isActive !== false} />
              </div>

              <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-slate-500">Staff Full Name</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{data?.staff?.name || user?.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Employee ID</dt>
                  <dd className="mt-1 text-sm font-semibold font-mono text-slate-900">
                    {data?.staff?.employeeId || user?.employeeId || 'Not Assigned'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Official Email</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{data?.staff?.email || user?.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Phone Number</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{data?.staff?.phone || user?.phone || 'Not Provided'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Department</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {data?.department ? `${data.department.name} (${data.department.code})` : 'General Maintenance'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Assigned Location</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {data?.hostel ? `${data.hostel.name}` : 'Campus-Wide Support'}
                    {data?.block && ` • ${data.block.name}`}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Assigned Work Queue Card */}
            <div className="flex flex-col justify-between rounded-xl border border-teal-100 bg-gradient-to-b from-teal-50/60 to-white p-6 shadow-xs">
              <div>
                <div className="flex items-center gap-2 text-teal-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <h3 className="text-sm font-bold text-slate-900">Assigned Work Queue</h3>
                </div>
                <div className="mt-4 rounded-lg border border-teal-100 bg-white p-3.5 shadow-2xs">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-teal-600">Active Queue</span>
                  <p className="mt-1.5 text-xs text-slate-700 leading-relaxed font-medium">
                    View complaints assigned to your department, acknowledge incoming tasks, and start repair work.
                  </p>
                  <div className="mt-3">
                    <Link
                      to="/staff/complaints"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700 transition"
                    >
                      Open Work Queue &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-teal-100 pt-4 text-[11px] text-slate-400 text-center">
                BBDU Hosteller • Staff Services System
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

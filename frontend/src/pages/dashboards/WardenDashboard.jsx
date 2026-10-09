import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import dashboardService from '../../services/dashboardService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardCard from '../../components/common/DashboardCard.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { IS_PILOT_MODE } from '../../config/pilot.js';

let wardenDashboardCache = null;

export default function WardenDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(() => wardenDashboardCache || null);
  const [loading, setLoading] = useState(() => !wardenDashboardCache);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    if (!wardenDashboardCache) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await dashboardService.getDashboardStats();
      if (res.success) {
        wardenDashboardCache = res.data;
        setData(res.data);
      } else if (!wardenDashboardCache) {
        setError(res.message || 'Failed to load warden dashboard');
      }
    } catch (err) {
      if (!wardenDashboardCache) {
        setError(err?.response?.data?.message || err.message || 'Error fetching stats');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const occupancyRate =
    data?.totalCapacity > 0
      ? Math.round((data.totalOccupancy / data.totalCapacity) * 100)
      : 0;

  return (
    <DashboardLayout title="Warden Hostel Management" roleLabel="Warden">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading hostel operational statistics..." />
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load hostel dashboard"
          message={error}
          onRetry={fetchStats}
        />
      ) : (
        <div className="space-y-6">
          {/* Welcome / Header Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-900 p-6 text-white shadow-md">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Warden Management Portal
                </span>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">
                  Welcome, Warden {user?.name}!
                </h1>
                <p className="mt-1 text-sm text-blue-200">
                  {data?.hostel
                    ? `Assigned Hostel: ${data.hostel.name} (${data.hostel.code}) • ${data.hostel.type} Accommodation`
                    : 'No hostel assigned yet'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/warden/complaints"
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Complaints Triage Queue
                </Link>
                {!IS_PILOT_MODE && (
                  <>
                    <Link
                      to="/warden/analytics"
                      className="rounded-lg bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Hostel Analytics
                    </Link>
                    <Link
                      to="/work-orders"
                      className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Work Orders
                    </Link>
                    <Link
                      to="/maintenance"
                      className="rounded-lg bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Maintenance
                    </Link>
                    <Link
                      to="/mess"
                      className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm"
                    >
                      <span>🍽</span>
                      Mess &amp; Dining
                    </Link>
                  </>
                )}
                <span className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-xs font-medium text-white">
                  Emp ID: {user?.employeeId || 'WRD-STAFF'}
                </span>
              </div>
            </div>
          </div>

          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DashboardCard
              title="Assigned Students"
              value={data?.studentsCount ?? 0}
              subtitle="Registered active residents"
              color="indigo"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
            />
            <DashboardCard
              title="Hostel Rooms"
              value={data?.roomsCount ?? 0}
              subtitle="Active inventory"
              color="emerald"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              }
            />
            <DashboardCard
              title="Hostel Blocks"
              value={data?.blocks?.length ?? 0}
              subtitle="Operational wings"
              color="amber"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
            <DashboardCard
              title="Hostel Staff"
              value={data?.staffCount ?? 0}
              subtitle="Assigned caretakers &amp; staff"
              color="rose"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
          </div>

          {/* Occupancy and Hostel Info */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Occupancy Bar */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs md:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Capacity &amp; Occupancy Distribution</h3>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
                  {occupancyRate}% Full
                </span>
              </div>

              <div className="mt-6">
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-2">
                  <span>Current Occupancy: <strong>{data?.totalOccupancy ?? 0}</strong> residents</span>
                  <span>Total Bed Capacity: <strong>{data?.totalCapacity ?? 0}</strong> beds</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all duration-500 ${
                      occupancyRate > 90 ? 'bg-rose-500' : occupancyRate > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, occupancyRate)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {data?.totalCapacity - data?.totalOccupancy} vacant beds currently available across {data?.roomsCount ?? 0} rooms.
                </p>
              </div>

              {/* Block Breakdown */}
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Hostel Blocks</h4>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {data?.blocks && data.blocks.length > 0 ? (
                    data.blocks.map((blk) => (
                      <div key={blk._id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-bold text-slate-900">{blk.name}</span>
                        <span className="block text-[10px] uppercase font-mono text-slate-500">Code: {blk.code}</span>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-xs text-slate-400">No blocks configured for this hostel yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Complaint Triage & Management Card */}
            <div className="flex flex-col justify-between rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-6 shadow-xs">
              <div>
                <div className="flex items-center gap-2 text-indigo-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 className="text-sm font-bold text-slate-900">Complaints Handling</h3>
                </div>
                <div className="mt-4 rounded-lg border border-indigo-100 bg-white p-3.5 shadow-2xs">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-indigo-600">Operational Triage</span>
                  <p className="mt-1.5 text-xs text-slate-700 leading-relaxed font-medium">
                    Review incoming student complaints, assign maintenance personnel, and monitor ticket progression.
                  </p>
                  <div className="mt-3">
                    <Link
                      to="/warden/complaints"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition"
                    >
                      Open Complaints Queue &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-indigo-100 pt-4 text-[11px] text-slate-400 text-center">
                BBDU Hosteller • Warden Management Engine
              </div>
            </div>
          </div>

          {/* SLA & Escalation Status Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 animate-pulse" />
                  Hostel SLA &amp; Escalation Monitoring
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time tracking of operational deadlines, urgent complaint timers, and escalated issues in your hostel.
                </p>
              </div>
              <Link
                to="/warden/complaints"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition"
              >
                View Hostel Complaints &rarr;
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-indigo-50/70 p-3 text-center border border-indigo-100">
                <span className="text-xl font-bold text-indigo-700">{data?.slaStats?.active ?? 0}</span>
                <span className="block text-[11px] font-semibold text-indigo-900 mt-0.5">Active SLAs</span>
              </div>
              <div className="rounded-lg bg-amber-50/70 p-3 text-center border border-amber-100">
                <span className="text-xl font-bold text-amber-700">{data?.slaStats?.dueSoon ?? 0}</span>
                <span className="block text-[11px] font-semibold text-amber-900 mt-0.5">Near Deadline (&lt;4h)</span>
              </div>
              <div className="rounded-lg bg-rose-50/70 p-3 text-center border border-rose-100">
                <span className="text-xl font-bold text-rose-700">{data?.slaStats?.breached ?? 0}</span>
                <span className="block text-[11px] font-semibold text-rose-900 mt-0.5">SLA Breached</span>
              </div>
              <div className="rounded-lg bg-purple-50/70 p-3 text-center border border-purple-100">
                <span className="text-xl font-bold text-purple-700">{data?.slaStats?.escalated ?? 0}</span>
                <span className="block text-[11px] font-semibold text-purple-900 mt-0.5">Escalated Tickets</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Assigned Residents Preview</h3>
                <p className="text-xs text-slate-500">Recently registered students in {data?.hostel?.name || 'this hostel'}</p>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Showing {data?.recentStudents?.length || 0} residents
              </span>
            </div>

            {data?.recentStudents && data.recentStudents.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Student Name</th>
                      <th className="px-4 py-2.5">Roll / Student ID</th>
                      <th className="px-4 py-2.5">Email</th>
                      <th className="px-4 py-2.5">Assigned Room</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentStudents.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900">{st.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{st.studentId || 'Pending'}</td>
                        <td className="px-4 py-3 text-slate-500">{st.email}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                            {st.roomNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={true} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                No students currently registered in this hostel.
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

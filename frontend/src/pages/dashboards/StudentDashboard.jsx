import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import dashboardService from '../../services/dashboardService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';

export default function StudentDashboard() {
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
        setError(res.message || 'Failed to load dashboard data');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error fetching dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const metrics = data?.complaintMetrics || {
    total: 0,
    submitted: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    reopened: 0,
  };

  return (
    <DashboardLayout title="Student Portal" roleLabel="Student">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading your resident details..." />
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load student profile"
          message={error}
          onRetry={fetchStats}
        />
      ) : (
        <div className="space-y-6">
          {/* Welcome Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 p-6 text-white shadow-md">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Resident Dashboard
                </span>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">
                  Welcome back, {data?.student?.name || user?.name}!
                </h1>
                <p className="mt-1 text-sm text-indigo-200">
                  BBDU Smart Hostel Resident Portal &amp; Complaint Redressal
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={data?.student?.isActive !== false} />
              </div>
            </div>
          </div>

          {/* Real Complaint Engine Integration Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">Maintenance Tickets &amp; Grievances</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time status of electrical, plumbing, sanitation, and civil issues logged from your room.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  to="/student/complaints"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  View My Complaints
                </Link>
                <Link
                  to="/mess"
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition flex items-center gap-1"
                >
                  <span>🍽</span> Mess &amp; Dining
                </Link>
                <Link
                  to="/student/complaints/new"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Submit a Complaint
                </Link>
              </div>
            </div>

            {/* Complaint Metric Counters */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg bg-indigo-50/70 p-3.5 text-center border border-indigo-100/60">
                <span className="text-2xl font-bold text-indigo-700">{metrics.total}</span>
                <span className="block text-[11px] font-semibold text-indigo-900 mt-0.5">Total Tickets</span>
              </div>
              <div className="rounded-lg bg-sky-50/70 p-3.5 text-center border border-sky-100/60">
                <span className="text-2xl font-bold text-sky-700">{metrics.submitted}</span>
                <span className="block text-[11px] font-semibold text-sky-900 mt-0.5">Submitted / Pending</span>
              </div>
              <div className="rounded-lg bg-amber-50/70 p-3.5 text-center border border-amber-100/60">
                <span className="text-2xl font-bold text-amber-700">{metrics.inProgress}</span>
                <span className="block text-[11px] font-semibold text-amber-900 mt-0.5">In Progress</span>
              </div>
              <div className="rounded-lg bg-purple-50/70 p-3.5 text-center border border-purple-100/60">
                <span className="text-2xl font-bold text-purple-700">{metrics.resolved}</span>
                <span className="block text-[11px] font-semibold text-purple-900 mt-0.5">Verify Resolution</span>
              </div>
              <div className="rounded-lg bg-rose-50/70 p-3.5 text-center border border-rose-100/60">
                <span className="text-2xl font-bold text-rose-700">{metrics.reopened || 0}</span>
                <span className="block text-[11px] font-semibold text-rose-900 mt-0.5">Reopened</span>
              </div>
              <div className="rounded-lg bg-emerald-50/70 p-3.5 text-center border border-emerald-100/60">
                <span className="text-2xl font-bold text-emerald-700">{metrics.closed}</span>
                <span className="block text-[11px] font-semibold text-emerald-900 mt-0.5">Closed</span>
              </div>
            </div>

            {/* Empty state when 0 complaints exist */}
            {metrics.total === 0 && (
              <div className="mt-5 rounded-lg border border-dashed border-slate-200 p-5 text-center">
                <p className="text-xs font-medium text-slate-600">No complaints submitted yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Have an issue in your room or wing? File a maintenance request to have the facilities team look into it.
                </p>
                <div className="mt-3 flex justify-center gap-3">
                  <Link
                    to="/student/complaints/new"
                    className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                  >
                    + Submit a Complaint
                  </Link>
                  <Link
                    to="/student/complaints"
                    className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                  >
                    View My Complaints
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Resident Profile Details */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs md:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Resident Information</h2>
                  <p className="text-xs text-slate-500">Official student identity and registration status</p>
                </div>
                <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                  {data?.student?.role || user?.role}
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-slate-500">Student Name</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{data?.student?.name || user?.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Roll Number / Student ID</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900 font-mono">
                    {data?.student?.studentId || user?.studentId || 'Not Assigned'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Registered Email</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{data?.student?.email || user?.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Phone Number</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{data?.student?.phone || user?.phone || 'Not Provided'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Academic Department</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {data?.department ? `${data.department.name} (${data.department.code})` : 'Not Assigned'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Account Status</dt>
                  <dd className="mt-1">
                    <StatusBadge status={data?.student?.isActive !== false} />
                  </dd>
                </div>
              </dl>
            </div>

            {/* Quick Actions Card */}
            <div className="flex flex-col justify-between rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/70 to-white p-6 shadow-xs">
              <div>
                <div className="flex items-center gap-2 text-indigo-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
                </div>
                <div className="mt-4 space-y-2">
                  <Link
                    to="/student/complaints/new"
                    className="block rounded-lg border border-indigo-200 bg-white p-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50/50 shadow-2xs transition"
                  >
                    + Submit Maintenance Ticket
                    <span className="block text-[11px] font-normal text-slate-500 mt-0.5">Report room repair or sanitation issues</span>
                  </Link>
                  <Link
                    to="/student/complaints"
                    className="block rounded-lg border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 shadow-2xs transition"
                  >
                    View All My Complaints ({metrics.total})
                    <span className="block text-[11px] font-normal text-slate-500 mt-0.5">Track resolution status and progress</span>
                  </Link>
                </div>
              </div>

              <div className="mt-6 border-t border-indigo-100 pt-4 text-[11px] text-slate-400 text-center">
                BBDU Hosteller Platform • Step 5.1 Active
              </div>
            </div>
          </div>

          {/* Allocation & Room Details */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Allocation Details */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900">Hostel Allocation Details</h2>
              <p className="mt-0.5 text-xs text-slate-500">Assigned residential location</p>

              {data?.hostel ? (
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Hostel</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{data.hostel.name}</dd>
                    <dd className="text-[11px] text-slate-500 uppercase">{data.hostel.type} • {data.hostel.code}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Block</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{data.block ? data.block.name : 'Unassigned'}</dd>
                    <dd className="text-[11px] text-slate-500 uppercase">{data.block?.code || '-'}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Floor</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {data.floor ? data.floor.name || `Floor ${data.floor.floorNumber}` : 'Unassigned'}
                    </dd>
                    <dd className="text-[11px] text-slate-500">Level {data.floor?.floorNumber ?? '-'}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Room</dt>
                    <dd className="mt-1 font-semibold text-indigo-700">
                      {data.room ? `Room ${data.room.roomNumber}` : 'Unassigned'}
                    </dd>
                    <dd className="text-[11px] text-slate-500">Type: {data.room?.roomType || '-'}</dd>
                  </div>

                  {data.room && (
                    <div className="col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Room Occupancy</span>
                        <span className="font-bold text-slate-900">
                          {data.room.currentOccupancy} / {data.room.capacity} beds occupied
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.round((data.room.currentOccupancy / (data.room.capacity || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </dl>
              ) : (
                <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-sm font-medium text-slate-600">No hostel room allocated yet.</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Contact the hostel administration or warden to assign your residential room.
                  </p>
                </div>
              )}
            </div>

            {/* Roommates Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900">Roommates</h2>
              <p className="mt-0.5 text-xs text-slate-500">Fellow residents sharing your room</p>

              {data?.roommates && data.roommates.length > 0 ? (
                <ul className="mt-4 divide-y divide-slate-100">
                  {data.roommates.map((mate) => (
                    <li key={mate.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 text-xs">
                          {mate.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{mate.name}</p>
                          <p className="text-xs text-slate-500">{mate.email}</p>
                        </div>
                      </div>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                        {mate.studentId || 'ID Pending'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-6 rounded-lg border border-dashed border-slate-200 p-6 text-center">
                  <p className="text-sm text-slate-600 font-medium">No other roommates in this room.</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {data?.room ? 'You currently have no co-residents assigned to this room.' : 'Allocate a room to view assigned roommates.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

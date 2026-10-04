import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import dashboardService from '../../services/dashboardService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardCard from '../../components/common/DashboardCard.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';

export default function AuthorityDashboard() {
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
        setError(res.message || 'Failed to load executive statistics');
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

  const totalCap = data?.totalCapacity || 0;
  const totalOcc = data?.totalOccupancy || 0;
  const occupancyRate = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0;

  return (
    <DashboardLayout title="Executive Authority Portal" roleLabel="Authority">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Aggregating campus-wide hostel analytics..." />
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load authority overview"
          message={error}
          onRetry={fetchStats}
        />
      ) : (
        <div className="space-y-6">
          {/* Executive Header Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 p-6 text-white shadow-md">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Campus Executive Oversight
                </span>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">
                  University Hostel Operations Overview
                </h1>
                <p className="mt-1 text-sm text-purple-200">
                  Welcome, {user?.name} • Babu Banarasi Das University Administration
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/authority/analytics"
                  className="rounded-lg bg-indigo-500 hover:bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Operational Intelligence
                </Link>
                <span className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white uppercase tracking-wider">
                  Campus Occupancy: {occupancyRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Key University-Wide Metric Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DashboardCard
              title="Total Hostels"
              value={data?.totalHostels ?? 0}
              subtitle="Registered campus residences"
              color="purple"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
            <DashboardCard
              title="Hostel Blocks"
              value={data?.totalBlocks ?? 0}
              subtitle="Wings &amp; sections"
              color="indigo"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
                </svg>
              }
            />
            <DashboardCard
              title="Total Rooms"
              value={data?.totalRooms ?? 0}
              subtitle="Campus-wide room units"
              color="emerald"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              }
            />
            <DashboardCard
              title="Campus Capacity"
              value={totalCap}
              subtitle={`${totalOcc} beds occupied (${occupancyRate}%)`}
              color="amber"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
          </div>

          {/* Demographic Breakdown Row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DashboardCard
              title="Resident Students"
              value={data?.totalStudents ?? 0}
              subtitle="Enrolled active residents"
              color="indigo"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
            />
            <DashboardCard
              title="Hostel Wardens"
              value={data?.totalWardens ?? 0}
              subtitle="Residential administrators"
              color="teal"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />
            <DashboardCard
              title="Maintenance Staff"
              value={data?.totalStaff ?? 0}
              subtitle="Service personnel"
              color="rose"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <DashboardCard
              title="Active User Accounts"
              value={data?.activeUsers ?? 0}
              subtitle="Current portal accounts"
              color="emerald"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>

          {/* Executive SLA & Escalation Oversight */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-600 animate-pulse" />
                  Campus-Wide SLA &amp; Escalation Oversight
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  High-level oversight of active service levels, breached deadlines, and complaints escalated to university authority.
                </p>
              </div>
              <Link
                to="/authority/complaints"
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-purple-800 transition"
              >
                Executive Complaints Review &rarr;
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-purple-50/70 p-3.5 text-center border border-purple-100">
                <span className="text-2xl font-bold text-purple-700">{data?.slaStats?.active ?? 0}</span>
                <span className="block text-xs font-semibold text-purple-900 mt-1">Active SLA Timers</span>
              </div>
              <div className="rounded-lg bg-rose-50/70 p-3.5 text-center border border-rose-100">
                <span className="text-2xl font-bold text-rose-700">{data?.slaStats?.breached ?? 0}</span>
                <span className="block text-xs font-semibold text-rose-900 mt-1">Breached Complaints</span>
              </div>
              <div className="rounded-lg bg-amber-50/70 p-3.5 text-center border border-amber-100">
                <span className="text-2xl font-bold text-amber-700">{data?.slaStats?.escalated ?? 0}</span>
                <span className="block text-xs font-semibold text-amber-900 mt-1">Escalated to Higher Tier</span>
              </div>
            </div>
          </div>

          {/* Hostel-wise Capacity vs Occupancy Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Hostel-wise Capacity &amp; Occupancy Breakdown</h3>
                <p className="text-xs text-slate-500">Live operational overview across all university hostels</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {data?.hostels?.length ?? 0} Hostels Registered
              </span>
            </div>

            {data?.hostels && data.hostels.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Hostel Name</th>
                      <th className="px-4 py-3">Code / Type</th>
                      <th className="px-4 py-3 text-center">Blocks</th>
                      <th className="px-4 py-3 text-center">Rooms</th>
                      <th className="px-4 py-3 text-center">Total Capacity</th>
                      <th className="px-4 py-3 text-center">Occupancy</th>
                      <th className="px-4 py-3">Occupancy %</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.hostels.map((h) => {
                      const occPercent = h.capacity > 0 ? Math.round((h.occupancy / h.capacity) * 100) : 0;
                      return (
                        <tr key={h._id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3.5 font-bold text-slate-900">{h.name}</td>
                          <td className="px-4 py-3.5">
                            <span className="font-mono text-xs font-semibold text-slate-700">{h.code}</span>
                            <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase font-semibold text-slate-600">
                              {h.type}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-medium text-slate-700">{h.blocksCount}</td>
                          <td className="px-4 py-3.5 text-center font-medium text-slate-700">{h.roomsCount}</td>
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-900">{h.capacity} beds</td>
                          <td className="px-4 py-3.5 text-center font-semibold text-indigo-700">{h.occupancy} residents</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className={`h-full ${
                                    occPercent > 90 ? 'bg-rose-500' : occPercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, occPercent)}%` }}
                                />
                              </div>
                              <span className="font-bold text-[11px] text-slate-700">{occPercent}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <StatusBadge status={h.isActive !== false} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                No hostel residences currently recorded in the database.
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

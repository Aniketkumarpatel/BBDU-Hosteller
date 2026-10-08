import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import dashboardService from '../../services/dashboardService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardCard from '../../components/common/DashboardCard.jsx';

let adminDashboardCache = null;

export default function AdminDashboard() {
  const [data, setData] = useState(() => adminDashboardCache || null);
  const [loading, setLoading] = useState(() => !adminDashboardCache);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    if (!adminDashboardCache) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await dashboardService.getDashboardStats();
      if (res.success) {
        adminDashboardCache = res.data;
        setData(res.data);
      } else if (!adminDashboardCache) {
        setError(res.message || 'Failed to load admin stats');
      }
    } catch (err) {
      if (!adminDashboardCache) {
        setError(err?.response?.data?.message || err.message || 'Error fetching stats');
      }
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

  const quickLinks = [
    {
      to: '/admin/analytics',
      title: 'Operational Analytics',
      count: 'Metrics',
      description: 'Live SLA compliance, resolution times, breakdown trends, and workload.',
      color: 'border-l-indigo-600',
      icon: (
        <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      to: '/admin/hostels',
      title: 'Hostels',
      count: data?.totalHostels ?? 0,
      description: 'Manage campus residences, types, and active statuses.',
      color: 'border-l-indigo-600',
      icon: (
        <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      to: '/admin/blocks',
      title: 'Blocks',
      count: data?.totalBlocks ?? 0,
      description: 'Hostel wings, building blocks, and code identifiers.',
      color: 'border-l-blue-600',
      icon: (
        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
        </svg>
      ),
    },
    {
      to: '/admin/floors',
      title: 'Floors',
      count: data?.totalFloors ?? 0,
      description: 'Floor levels, hierarchy mapping, and floor names.',
      color: 'border-l-cyan-600',
      icon: (
        <svg className="h-5 w-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      to: '/admin/rooms',
      title: 'Rooms',
      count: data?.totalRooms ?? 0,
      description: 'Room inventory, bed capacity, occupancy, and types.',
      color: 'border-l-emerald-600',
      icon: (
        <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
        </svg>
      ),
    },
    {
      to: '/admin/users',
      title: 'Users',
      count: data?.totalUsers ?? 0,
      description: 'Accounts across all roles: students, wardens, staff, admins.',
      color: 'border-l-amber-600',
      icon: (
        <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      to: '/admin/departments',
      title: 'Departments',
      count: data?.totalDepartments ?? 0,
      description: 'Academic branches & maintenance service divisions.',
      color: 'border-l-rose-600',
      icon: (
        <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      to: '/admin/sla-config',
      title: 'SLA Configuration & Control',
      count: 'Global',
      description: 'Configure Staff & Warden SLA response durations, breach reminders & auto-escalation.',
      color: 'border-l-indigo-700',
      icon: (
        <svg className="h-5 w-5 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      to: '/admin/sla-rules',
      title: 'SLA Rules Engine',
      count: data?.slaStats?.totalSlaRules ?? 0,
      description: 'Target resolution windows, reminder triggers & priorities.',
      color: 'border-l-purple-600',
      icon: (
        <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      to: '/admin/escalation-rules',
      title: 'Escalation Hierarchy',
      count: data?.slaStats?.totalEscalationRules ?? 0,
      description: 'Level-based auto-reassignment on SLA breach.',
      color: 'border-l-rose-700',
      icon: (
        <svg className="h-5 w-5 text-rose-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <LoadingSpinner size="lg" message="Loading admin management metrics..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Admin Dashboard Error" message={error} onRetry={fetchStats} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-md">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Super Admin Center
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">System Control &amp; Infrastructure</h1>
            <p className="mt-1 text-xs text-slate-300">
              Complete administrative authority over BBDU residential hierarchy, accounts, and departments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-xs text-white">
              Active Accounts: {data?.activeUsers ?? 0} / {data?.totalUsers ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Infrastructure Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <DashboardCard
          title="Hostels"
          value={data?.totalHostels ?? 0}
          subtitle="Campuses"
          color="indigo"
        />
        <DashboardCard
          title="Blocks"
          value={data?.totalBlocks ?? 0}
          subtitle="Wings"
          color="blue"
        />
        <DashboardCard
          title="Floors"
          value={data?.totalFloors ?? 0}
          subtitle="Levels"
          color="cyan"
        />
        <DashboardCard
          title="Rooms"
          value={data?.totalRooms ?? 0}
          subtitle="Inventory"
          color="emerald"
        />
        <DashboardCard
          title="Users"
          value={data?.totalUsers ?? 0}
          subtitle="All Roles"
          color="amber"
        />
        <DashboardCard
          title="Departments"
          value={data?.totalDepartments ?? 0}
          subtitle="Divisions"
          color="rose"
        />
      </div>

      {/* Role Breakdown & Capacity Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* User Role Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs md:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">User Account Distribution</h3>
            <Link to="/admin/users" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              Manage Users &rarr;
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg bg-indigo-50/70 p-3 text-center">
              <span className="text-xl font-bold text-indigo-700">{data?.totalStudents ?? 0}</span>
              <span className="block text-[11px] font-semibold text-indigo-900">Students</span>
            </div>
            <div className="rounded-lg bg-blue-50/70 p-3 text-center">
              <span className="text-xl font-bold text-blue-700">{data?.totalWardens ?? 0}</span>
              <span className="block text-[11px] font-semibold text-blue-900">Wardens</span>
            </div>
            <div className="rounded-lg bg-teal-50/70 p-3 text-center">
              <span className="text-xl font-bold text-teal-700">{data?.totalStaff ?? 0}</span>
              <span className="block text-[11px] font-semibold text-teal-900">Hostel Staff</span>
            </div>
            <div className="rounded-lg bg-purple-50/70 p-3 text-center">
              <span className="text-xl font-bold text-purple-700">{data?.totalAuthorities ?? 0}</span>
              <span className="block text-[11px] font-semibold text-purple-900">Authorities</span>
            </div>
            <div className="rounded-lg bg-rose-50/70 p-3 text-center">
              <span className="text-xl font-bold text-rose-700">{data?.totalSuperAdmins ?? 0}</span>
              <span className="block text-[11px] font-semibold text-rose-900">Admins</span>
            </div>
          </div>

          {/* Capacity and Occupancy Bar */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
              <span>Overall Campus Bed Occupancy</span>
              <span><strong>{totalOcc}</strong> / {totalCap} Beds ({occupancyRate}%)</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${Math.min(100, occupancyRate)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Operational Notice / Safety Card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-indigo-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h3 className="text-sm font-bold text-slate-900">RBAC Enforcement</h3>
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Super Admin level access is authenticated through JWT with strict database-level checks. All hierarchy mutations preserve referential integrity.
            </p>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-800">Database Guard:</span> Deletion of hostels, blocks, or floors with active dependent records is strictly blocked.
          </div>
        </div>
      </div>

      {/* SLA & Escalation Engine Quick Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-600 animate-pulse" />
              SLA Monitoring &amp; Automatic Escalation Engine
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative server-driven SLA cycles, automated breach detection &amp; hierarchical re-assignment.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/sla-config"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs transition"
            >
              SLA Control &amp; Parameters &rarr;
            </Link>
            <Link
              to="/admin/sla-rules"
              className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition"
            >
              Configure SLAs &rarr;
            </Link>
            <Link
              to="/admin/escalation-rules"
              className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
            >
              Escalation Matrix &rarr;
            </Link>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg bg-violet-50/70 p-3 text-center border border-violet-100">
            <span className="text-xl font-bold text-violet-700">{data?.slaStats?.active ?? 0}</span>
            <span className="block text-[11px] font-semibold text-violet-900 mt-0.5">Active SLAs</span>
          </div>
          <div className="rounded-lg bg-rose-50/70 p-3 text-center border border-rose-100">
            <span className="text-xl font-bold text-rose-700">{data?.slaStats?.breached ?? 0}</span>
            <span className="block text-[11px] font-semibold text-rose-900 mt-0.5">Breached Tickets</span>
          </div>
          <div className="rounded-lg bg-amber-50/70 p-3 text-center border border-amber-100">
            <span className="text-xl font-bold text-amber-700">{data?.slaStats?.escalated ?? 0}</span>
            <span className="block text-[11px] font-semibold text-amber-900 mt-0.5">Auto-Escalated</span>
          </div>
          <div className="rounded-lg bg-indigo-50/70 p-3 text-center border border-indigo-100">
            <span className="text-xl font-bold text-indigo-700">{data?.slaStats?.totalSlaRules ?? 0}</span>
            <span className="block text-[11px] font-semibold text-indigo-900 mt-0.5">SLA Rules</span>
          </div>
          <div className="rounded-lg bg-sky-50/70 p-3 text-center border border-sky-100">
            <span className="text-xl font-bold text-sky-700">{data?.slaStats?.totalEscalationRules ?? 0}</span>
            <span className="block text-[11px] font-semibold text-sky-900 mt-0.5">Hierarchy Rules</span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards Grid */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
          Direct Management Modules
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-md border-l-4 ${link.color}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">
                    {link.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">{link.description}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                  {link.icon}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-700">
                  {link.count} Records
                </span>
                <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition">
                  Manage &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

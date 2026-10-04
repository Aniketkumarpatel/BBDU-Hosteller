import { useState, useEffect, useMemo } from 'react';
import analyticsService from '../../services/analyticsService.js';
import hostelService from '../../services/hostelService.js';
import departmentService from '../../services/departmentService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';

export default function AnalyticsDashboardPage() {
  const { user } = useAuth();

  // Filters State
  const [range, setRange] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupBy, setGroupBy] = useState('day');
  const [hostelId, setHostelId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, departments, hostels, sla, workload
  const [exporting, setExporting] = useState(false);

  // Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hostelsList, setHostelsList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);

  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [statusDist, setStatusDist] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [slaData, setSlaData] = useState(null);
  const [escalations, setEscalations] = useState(null);
  const [workload, setWorkload] = useState([]);

  // Fetch Hostels & Departments list for dropdown filter
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'AUTHORITY') {
      hostelService.getHostels().then((res) => {
        if (res.success) setHostelsList(res.data);
      }).catch(() => {});

      departmentService.getDepartments().then((res) => {
        if (res.success) setDepartmentsList(res.data);
      }).catch(() => {});
    }
  }, [user]);

  // Query parameters object memoized
  const queryParams = useMemo(() => {
    const params = {};
    if (range === 'custom') {
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
    } else {
      params.range = range;
    }
    if (groupBy) params.groupBy = groupBy;
    if (hostelId) params.hostelId = hostelId;
    if (departmentId) params.departmentId = departmentId;
    if (category) params.category = category;
    if (priority) params.priority = priority;
    return params;
  }, [range, startDate, endDate, groupBy, hostelId, departmentId, category, priority]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        overviewRes,
        trendsRes,
        statusRes,
        categoriesRes,
        prioritiesRes,
        departmentsRes,
        hostelsRes,
        slaRes,
        escalationsRes,
        workloadRes,
      ] = await Promise.all([
        analyticsService.getOverview(queryParams),
        analyticsService.getTrends(queryParams),
        analyticsService.getStatusDistribution(queryParams),
        analyticsService.getCategories(queryParams),
        analyticsService.getPriorities(queryParams),
        analyticsService.getDepartments(queryParams),
        analyticsService.getHostels(queryParams),
        analyticsService.getSla(queryParams),
        analyticsService.getEscalations(queryParams),
        analyticsService.getWorkload(queryParams),
      ]);

      if (overviewRes.success) setOverview(overviewRes.data);
      if (trendsRes.success) setTrends(trendsRes.data.trends || []);
      if (statusRes.success) setStatusDist(statusRes.data.distribution || []);
      if (categoriesRes.success) setCategories(categoriesRes.data.categories || []);
      if (prioritiesRes.success) setPriorities(prioritiesRes.data.priorities || []);
      if (departmentsRes.success) setDepartments(departmentsRes.data.departments || []);
      if (hostelsRes.success) setHostels(hostelsRes.data.hostels || []);
      if (slaRes.success) setSlaData(slaRes.data);
      if (escalationsRes.success) setEscalations(escalationsRes.data);
      if (workloadRes.success) setWorkload(workloadRes.data.workload || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load operational analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [queryParams]);

  const handleExport = async (type) => {
    try {
      setExporting(true);
      await analyticsService.exportCsv(type, queryParams);
    } catch (err) {
      alert('Failed to export CSV: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  // Find max value in trends for SVG scaling
  const maxTrendVal = useMemo(() => {
    if (!trends || trends.length === 0) return 10;
    const max = Math.max(...trends.map((t) => Math.max(t.submitted, t.resolved, t.breached)));
    return max > 0 ? max : 10;
  }, [trends]);

  return (
    <div className="space-y-6">
      {/* Top Header & Export Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Analytics & Operational Intelligence
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Live metrics, SLA compliance performance, breakdown trends, and staff workload analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
            title="Refresh analytics data"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          {/* Export CSV Dropdown */}
          <div className="relative inline-block text-left group">
            <button
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Exporting...' : 'Export CSV'}
              <svg className="h-3.5 w-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute right-0 mt-1 hidden w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 z-20 group-hover:block">
              <button
                onClick={() => handleExport('complaints')}
                className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <span>📄</span> Export Complaints List
              </button>
              <button
                onClick={() => handleExport('departments')}
                className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <span>🏢</span> Export Departments
              </button>
              <button
                onClick={() => handleExport('hostels')}
                className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <span>🏘️</span> Export Hostels
              </button>
              <button
                onClick={() => handleExport('workload')}
                className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <span>👥</span> Export Staff Workload
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Date Presets */}
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            {['7d', '30d', '90d', 'all', 'custom'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  range === r
                    ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : r === 'all' ? 'All Time' : 'Custom'}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          {/* Group By */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 ml-auto">
            <span className="font-medium text-slate-500">Group:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>

          {/* Hostel Filter (Admin/Authority only) */}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'AUTHORITY') && (
            <select
              value={hostelId}
              onChange={(e) => setHostelId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All Hostels</option>
              {hostelsList.map((h) => (
                <option key={h._id} value={h._id}>{h.name} ({h.code})</option>
              ))}
            </select>
          )}

          {/* Department Filter (Admin/Authority only) */}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'AUTHORITY') && (
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All Departments</option>
              {departmentsList.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          )}

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            {['ELECTRICAL', 'PLUMBING', 'CLEANING', 'MESS', 'INTERNET', 'FURNITURE', 'SECURITY', 'ROOM', 'WATER', 'OTHER'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Priorities</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Clear Filters */}
          {(hostelId || departmentId || category || priority || range !== '30d') && (
            <button
              type="button"
              onClick={() => {
                setRange('30d');
                setStartDate('');
                setEndDate('');
                setGroupBy('day');
                setHostelId('');
                setDepartmentId('');
                setCategory('');
                setPriority('');
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <LoadingSpinner size="lg" message="Loading operational intelligence metrics..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadAnalytics} />
      ) : (
        <>
          {/* Main KPI Cards Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Logged</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{overview?.totalComplaints || 0}</p>
              <p className="mt-1 text-[11px] text-slate-500">Filtered period</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Open / Active</p>
              <p className="mt-2 text-2xl font-bold text-amber-900">{overview?.openComplaints || 0}</p>
              <p className="mt-1 text-[11px] text-amber-700 font-medium">{overview?.inProgressComplaints || 0} in progress</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Resolved</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{overview?.resolvedComplaints || 0}</p>
              <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                {overview?.totalComplaints > 0
                  ? Math.round((overview.resolvedComplaints / overview.totalComplaints) * 100)
                  : 0}% resolution rate
              </p>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">SLA Breached</p>
              <p className="mt-2 text-2xl font-bold text-rose-900">{overview?.slaBreachedComplaints || 0}</p>
              <p className="mt-1 text-[11px] text-rose-600 font-medium">
                {overview?.openComplaintsOlderThanSla || 0} currently overdue
              </p>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">SLA Compliance</p>
              <p className="mt-2 text-2xl font-bold text-indigo-900">{overview?.slaComplianceRate ?? 100}%</p>
              <p className="mt-1 text-[11px] text-indigo-700 font-medium">Within target deadline</p>
            </div>

            <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-700">Escalated</p>
              <p className="mt-2 text-2xl font-bold text-purple-900">{overview?.escalatedComplaints || 0}</p>
              <p className="mt-1 text-[11px] text-purple-600 font-medium">{overview?.reopenedComplaints || 0} reopened tickets</p>
            </div>
          </div>

          {/* Secondary Timing Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Average Resolution Time</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">{overview?.avgResolutionTimeHours || 0}</span>
                  <span className="text-xs font-semibold text-slate-600">Hours</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">From submission to confirmed resolution</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Average First Response Time</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">{overview?.avgFirstResponseTimeHours || 0}</span>
                  <span className="text-xs font-semibold text-slate-600">Hours</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">From submission to triage / initial assignment</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Navigation Tabs for Deep Dive Analytics */}
          <div className="border-b border-slate-200">
            <nav className="flex space-x-6 overflow-x-auto">
              {[
                { id: 'overview', label: 'Trends & Distributions' },
                { id: 'departments', label: 'Department Performance' },
                { id: 'hostels', label: 'Hostel Performance' },
                { id: 'sla', label: 'SLA & Escalation Engine' },
                { id: 'workload', label: 'Staff Workload' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`border-b-2 py-3 text-xs font-semibold transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* TAB 1: Trends & Distributions */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Volume Trend Bar Chart (SVG) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Complaint Volume Trends</h2>
                    <p className="text-xs text-slate-500">Chronological timeline of tickets submitted, resolved, and breached.</p>
                  </div>
                  <div className="mt-2 sm:mt-0 flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-xs bg-indigo-500"></span> Submitted</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-xs bg-emerald-500"></span> Resolved</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-xs bg-rose-500"></span> SLA Breached</span>
                  </div>
                </div>

                {trends.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No timeline data recorded for the selected filter range.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <div className="min-w-[600px] h-64 flex flex-col justify-end">
                      <div className="flex items-end gap-3 h-52 border-b border-slate-200 pb-2">
                        {trends.map((t) => {
                          const subHeight = Math.max(4, Math.round((t.submitted / maxTrendVal) * 180));
                          const resHeight = Math.max(0, Math.round((t.resolved / maxTrendVal) * 180));
                          const breHeight = Math.max(0, Math.round((t.breached / maxTrendVal) * 180));

                          return (
                            <div key={t.date} className="flex-1 flex flex-col items-center group relative">
                              {/* Hover Tooltip */}
                              <div className="absolute -top-16 hidden group-hover:flex flex-col items-center bg-slate-900 text-white rounded-md p-1.5 text-[10px] shadow-lg z-20 whitespace-nowrap">
                                <span className="font-bold">{t.date}</span>
                                <span>Submitted: {t.submitted} | Resolved: {t.resolved}</span>
                                {t.breached > 0 && <span className="text-rose-400 font-semibold">Breached: {t.breached}</span>}
                              </div>

                              <div className="w-full flex items-end justify-center gap-1 h-full">
                                <div style={{ height: `${subHeight}px` }} className="w-2.5 rounded-t-xs bg-indigo-500 transition-all hover:bg-indigo-600"></div>
                                <div style={{ height: `${resHeight}px` }} className="w-2.5 rounded-t-xs bg-emerald-500 transition-all hover:bg-emerald-600"></div>
                                {t.breached > 0 && (
                                  <div style={{ height: `${breHeight}px` }} className="w-2.5 rounded-t-xs bg-rose-500 transition-all hover:bg-rose-600"></div>
                                )}
                              </div>
                              <span className="mt-2 text-[10px] text-slate-500 truncate max-w-[50px] text-center">{t.date.slice(5)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Distributions Grid: Statuses, Categories, Priorities */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Status Breakdown */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Status Breakdown</h3>
                  <div className="space-y-3">
                    {statusDist.map((item) => (
                      <div key={item.status} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-700">{item.status.replace(/_/g, ' ')}</span>
                          <span className="font-bold text-slate-900">{item.count} <span className="text-[10px] text-slate-500">({item.percentage}%)</span></span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-600"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Category Distribution */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Category Distribution</h3>
                  <div className="space-y-3">
                    {categories.slice(0, 6).map((c) => (
                      <div key={c.category} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-700">{c.category}</span>
                          <span className="font-bold text-slate-900">{c.count} <span className="text-[10px] text-slate-500">({c.percentage}%)</span></span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-teal-500"
                            style={{ width: `${c.percentage}%` }}
                          />
                        </div>
                        {c.breachedCount > 0 && (
                          <p className="text-[10px] text-rose-600 font-medium">{c.breachedCount} breached ({c.breachRate}%)</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Priority Performance */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Priority Breakdown</h3>
                  <div className="space-y-3">
                    {priorities.map((p) => {
                      const colorMap = {
                        CRITICAL: 'text-rose-700 bg-rose-50 border-rose-200',
                        HIGH: 'text-amber-700 bg-amber-50 border-amber-200',
                        MEDIUM: 'text-blue-700 bg-blue-50 border-blue-200',
                        LOW: 'text-slate-700 bg-slate-50 border-slate-200',
                      };
                      return (
                        <div key={p.priority} className={`rounded-lg border p-3 ${colorMap[p.priority] || 'border-slate-200'}`}>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold">{p.priority}</span>
                            <span className="text-sm font-bold">{p.count} tickets</span>
                          </div>
                          <div className="mt-2 flex justify-between text-[11px] opacity-80">
                            <span>Avg resolution: {p.avgResolutionHours}h</span>
                            <span>Breached: {p.breachedCount}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Department Performance */}
          {activeTab === 'departments' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Department Operational Metrics</h3>
                <p className="text-xs text-slate-500">Evaluation of maintenance departments by volume, resolution efficiency, and SLA compliance.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Total Tickets</th>
                      <th className="px-4 py-3">In Progress</th>
                      <th className="px-4 py-3">Resolved</th>
                      <th className="px-4 py-3">SLA Breached</th>
                      <th className="px-4 py-3">Compliance Rate</th>
                      <th className="px-4 py-3">Avg Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {departments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                          No department complaints logged in the selected period.
                        </td>
                      </tr>
                    ) : (
                      departments.map((d) => (
                        <tr key={d.departmentId} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">{d.name}</td>
                          <td className="px-4 py-3 text-slate-500">{d.code}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{d.total}</td>
                          <td className="px-4 py-3 text-amber-700 font-medium">{d.inProgress}</td>
                          <td className="px-4 py-3 text-emerald-700 font-medium">{d.resolved}</td>
                          <td className="px-4 py-3">
                            <span className={d.breached > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                              {d.breached}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              d.complianceRate >= 85 ? 'bg-emerald-100 text-emerald-800' :
                              d.complianceRate >= 65 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {d.complianceRate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{d.avgResolutionHours} hrs</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Hostel Performance */}
          {activeTab === 'hostels' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Hostel Comparison & SLA Health</h3>
                <p className="text-xs text-slate-500">Complaint density and escalation activity across campus residences.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Hostel Name</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Total Complaints</th>
                      <th className="px-4 py-3">Active / Open</th>
                      <th className="px-4 py-3">Resolved</th>
                      <th className="px-4 py-3">SLA Breached</th>
                      <th className="px-4 py-3">Escalated</th>
                      <th className="px-4 py-3">Compliance Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hostels.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                          No hostel records found in current scope.
                        </td>
                      </tr>
                    ) : (
                      hostels.map((h) => (
                        <tr key={h.hostelId} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">{h.name}</td>
                          <td className="px-4 py-3 text-slate-500">{h.code}</td>
                          <td className="px-4 py-3 text-slate-500">{h.type}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{h.total}</td>
                          <td className="px-4 py-3 text-amber-700 font-medium">{h.open}</td>
                          <td className="px-4 py-3 text-emerald-700 font-medium">{h.resolved}</td>
                          <td className="px-4 py-3">
                            <span className={h.breached > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                              {h.breached}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-purple-700 font-medium">{h.escalated}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              h.complianceRate >= 85 ? 'bg-emerald-100 text-emerald-800' :
                              h.complianceRate >= 65 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {h.complianceRate}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SLA & Escalation Engine */}
          {activeTab === 'sla' && (
            <div className="space-y-6">
              {/* SLA Cycles Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Total SLA Cycles</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{slaData?.totalCycles || 0}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-xs">
                  <p className="text-xs font-semibold text-blue-700 uppercase">Active Cycles</p>
                  <p className="mt-2 text-2xl font-bold text-blue-900">{slaData?.activeCycles || 0}</p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-xs">
                  <p className="text-xs font-semibold text-rose-700 uppercase">Breached Cycles</p>
                  <p className="mt-2 text-2xl font-bold text-rose-900">{slaData?.breachedCycles || 0}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
                  <p className="text-xs font-semibold text-emerald-700 uppercase">Completed Cycles</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-900">{slaData?.completedCycles || 0}</p>
                </div>
              </div>

              {/* Multi-Level Escalation Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Escalations by Hierarchy Level</h3>
                  <div className="space-y-3">
                    {escalations?.byLevel?.map((item) => (
                      <div key={item.level} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{item.label}</p>
                          <p className="text-[10px] text-slate-500">Tier {item.level} automatic escalation trigger</p>
                        </div>
                        <span className="text-base font-bold text-purple-700">{item.count}</span>
                      </div>
                    ))}
                    {(!escalations?.byLevel || escalations.byLevel.length === 0) && (
                      <p className="text-xs text-slate-400 py-4 text-center">No escalations recorded in this period.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Escalations by Trigger</h3>
                  <div className="space-y-3">
                    {escalations?.byTrigger?.map((item) => (
                      <div key={item.trigger} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-xs font-bold text-slate-800">{item.trigger}</span>
                        <span className="text-base font-bold text-slate-900">{item.count}</span>
                      </div>
                    ))}
                    {(!escalations?.byTrigger || escalations.byTrigger.length === 0) && (
                      <p className="text-xs text-slate-400 py-4 text-center">No escalation triggers recorded.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Escalation Log */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Recent Automatic Escalation Events</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">Complaint</th>
                        <th className="px-4 py-3">Level</th>
                        <th className="px-4 py-3">From</th>
                        <th className="px-4 py-3">To Escalated Authority</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Triggered At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(!escalations?.recentEscalations || escalations.recentEscalations.length === 0) ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                            No escalation events logged.
                          </td>
                        </tr>
                      ) : (
                        escalations.recentEscalations.map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-indigo-600">{e.complaintRef}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold">
                                Level {e.level}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{e.fromUser} ({e.fromRole})</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{e.toUser} ({e.toRole})</td>
                            <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{e.reason}</td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              {new Date(e.triggeredAt).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Staff Workload */}
          {activeTab === 'workload' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Maintenance Personnel Workload & Output</h3>
                <p className="text-xs text-slate-500">Distribution of active workload, resolution velocity, and breach rates by staff member.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Staff Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Total Assigned</th>
                      <th className="px-4 py-3">Active Tickets</th>
                      <th className="px-4 py-3">Resolved</th>
                      <th className="px-4 py-3">SLA Breaches</th>
                      <th className="px-4 py-3">Resolution Rate</th>
                      <th className="px-4 py-3">Avg Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workload.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                          No staff assignments recorded in the selected period.
                        </td>
                      </tr>
                    ) : (
                      workload.map((w) => (
                        <tr key={w.userId} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">{w.name}</td>
                          <td className="px-4 py-3 text-slate-500">{w.email}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{w.totalAssigned}</td>
                          <td className="px-4 py-3 text-amber-700 font-medium">{w.active}</td>
                          <td className="px-4 py-3 text-emerald-700 font-medium">{w.resolved}</td>
                          <td className="px-4 py-3">
                            <span className={w.breached > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                              {w.breached}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              w.resolutionRate >= 80 ? 'bg-emerald-100 text-emerald-800' :
                              w.resolutionRate >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {w.resolutionRate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{w.avgResolutionHours} hrs</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

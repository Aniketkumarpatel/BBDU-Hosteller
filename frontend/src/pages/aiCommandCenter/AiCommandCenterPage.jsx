import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import aiCommandCenterService from '../../services/aiCommandCenterService.js';

export default function AiCommandCenterPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overviewData, setOverviewData] = useState(null);
  const [selectedHostel, setSelectedHostel] = useState('');

  // AI Assistant interactive state
  const [assistantQuery, setAssistantQuery] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResponse, setAssistantResponse] = useState(null);

  // Filter state
  const [insightFilter, setInsightFilter] = useState('ALL');
  const [recFilter, setRecFilter] = useState('ALL');

  const fetchOverview = async (hostelId = '') => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (hostelId) params.hostelId = hostelId;
      const res = await aiCommandCenterService.getOverview(params);
      if (res?.success) {
        setOverviewData(res.data);
      } else {
        setError('Unable to load AI command center data.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to fetch operational overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview(selectedHostel);
  }, [selectedHostel]);

  const handleAskAssistant = async (queryText) => {
    const q = queryText || assistantQuery;
    if (!q || !q.trim()) return;
    try {
      setAssistantLoading(true);
      const res = await aiCommandCenterService.askAssistant(q, {
        hostelId: selectedHostel || undefined,
      });
      if (res?.success) {
        setAssistantResponse(res.data);
      }
    } catch (err) {
      setAssistantResponse({
        query: q,
        answer: 'Failed to process inquiry. Please verify system connection.',
        items: [],
        suggestedActions: ['Check backend server logs.'],
      });
    } finally {
      setAssistantLoading(false);
    }
  };

  const getScoreBandStyle = (band, score) => {
    if (score >= 85) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        bar: 'bg-emerald-500',
        ring: 'text-emerald-600',
        badge: 'bg-emerald-100 text-emerald-800',
        label: 'Optimal Operations',
      };
    }
    if (score >= 70) {
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        bar: 'bg-amber-500',
        ring: 'text-amber-600',
        badge: 'bg-amber-100 text-amber-800',
        label: 'Moderate Operational Risk',
      };
    }
    if (score >= 50) {
      return {
        bg: 'bg-orange-50 text-orange-700 border-orange-200',
        bar: 'bg-orange-500',
        ring: 'text-orange-600',
        badge: 'bg-orange-100 text-orange-800',
        label: 'High Operational Risk',
      };
    }
    return {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      bar: 'bg-rose-500',
      ring: 'text-rose-600',
      badge: 'bg-rose-100 text-rose-800',
      label: 'Critical Intervention Needed',
    };
  };

  const healthScore = overviewData?.healthScore;
  const insights = overviewData?.insights || [];
  const recommendations = overviewData?.recommendations || [];
  const hostels = overviewData?.hostels || [];
  const scoreBand = getScoreBandStyle(healthScore?.band, healthScore?.overallScore || 0);

  const filteredInsights =
    insightFilter === 'ALL'
      ? insights
      : insights.filter((i) => i.affectedModule === insightFilter || i.category === insightFilter);

  const filteredRecs =
    recFilter === 'ALL'
      ? recommendations
      : recommendations.filter((r) => r.priority === recFilter || r.module === recFilter);

  const presetQueries = [
    'What are the most serious problems?',
    'Are there any SLA breach risks?',
    'How many students are outside right now?',
    'Which assets are repeatedly failing?',
    'Any cleaning or sanitation issues?',
  ];

  return (
    <DashboardLayout title="AI Hostel Command Center & Smart Operations">
      {/* Top Banner / Filter Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold tracking-wider uppercase text-indigo-300">
              Live Operational Intelligence
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Hostel Command & Executive Advisory</h2>
          <p className="mt-1 text-xs text-slate-300">
            Real-time multi-subsystem analysis spanning Complaints, Facilities, Housekeeping, Mess, and Curfew Security.
          </p>
        </div>

        {hostels.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-300">Filter Hostel:</label>
            <select
              value={selectedHostel}
              onChange={(e) => setSelectedHostel(e.target.value)}
              className="rounded-lg bg-slate-800/90 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Hostels (Campus-wide)</option>
              {hostels.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
          <p className="font-semibold">{error}</p>
          <button
            onClick={() => fetchOverview(selectedHostel)}
            className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Row 1: Operational Health Score & Subsystem Balance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Health Score Gauge Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                    Operational Health Score
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreBand.badge}`}>
                    {scoreBand.label}
                  </span>
                </div>

                <div className="mt-6 flex items-center justify-center">
                  <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-8 border-slate-100 shadow-inner">
                    <div className="text-center">
                      <span className="text-4xl font-black tracking-tight text-slate-900">
                        {healthScore?.overallScore ?? 100}
                      </span>
                      <span className="text-sm font-semibold text-slate-400">/100</span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-center text-xs text-slate-500">
                  Calculated deterministically from active SLA compliance, open work orders, sanitation quality, meal ratings, and curfew logs.
                </p>
              </div>

              {/* Subsystem Weight Bar Chart */}
              <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>Complaints &amp; SLA (Max 30)</span>
                  <span className="font-bold text-slate-800">{healthScore?.breakdown?.complaints?.score}/30</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-indigo-600"
                    style={{ width: `${((healthScore?.breakdown?.complaints?.score || 0) / 30) * 100}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>Maintenance &amp; Assets (Max 20)</span>
                  <span className="font-bold text-slate-800">{healthScore?.breakdown?.maintenance?.score}/20</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-blue-600"
                    style={{ width: `${((healthScore?.breakdown?.maintenance?.score || 0) / 20) * 100}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>Housekeeping Quality (Max 20)</span>
                  <span className="font-bold text-slate-800">{healthScore?.breakdown?.cleaning?.score}/20</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-cyan-600"
                    style={{ width: `${((healthScore?.breakdown?.cleaning?.score || 0) / 20) * 100}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>Dining &amp; Mess (Max 15)</span>
                  <span className="font-bold text-slate-800">{healthScore?.breakdown?.mess?.score}/15</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-amber-600"
                    style={{ width: `${((healthScore?.breakdown?.mess?.score || 0) / 15) * 100}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>Curfew &amp; Outpass (Max 15)</span>
                  <span className="font-bold text-slate-800">{healthScore?.breakdown?.security?.score}/15</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-emerald-600"
                    style={{ width: `${((healthScore?.breakdown?.security?.score || 0) / 15) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Explainability Breakdown: Positive & Negative Factors */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Explainable Score Drivers &amp; Penalties</h3>
                <p className="text-xs text-slate-500">
                  Transparent mathematical breakdown of points credited and deductions applied based on live operational indicators.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Positive Factors */}
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-xs font-bold text-emerald-800">
                        +
                      </span>
                      <h4 className="text-xs font-bold text-emerald-900">Positive Factors (Healthy Operations)</h4>
                    </div>
                    {healthScore?.positiveFactors?.length > 0 ? (
                      <ul className="space-y-2 text-xs text-emerald-800">
                        {healthScore.positiveFactors.map((f, i) => (
                          <li key={i} className="flex items-start justify-between gap-2 border-b border-emerald-100 pb-1.5 last:border-0 last:pb-0">
                            <span>{f.factor}</span>
                            <span className="font-semibold whitespace-nowrap text-emerald-700">{f.impact}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No positive bonus factors currently recorded.</p>
                    )}
                  </div>

                  {/* Negative Factors / Deductions */}
                  <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-200 text-xs font-bold text-rose-800">
                        -
                      </span>
                      <h4 className="text-xs font-bold text-rose-900">Deductions (Active Bottlenecks)</h4>
                    </div>
                    {healthScore?.negativeFactors?.length > 0 ? (
                      <ul className="space-y-2 text-xs text-rose-800">
                        {healthScore.negativeFactors.map((f, i) => (
                          <li key={i} className="flex items-start justify-between gap-2 border-b border-rose-100 pb-1.5 last:border-0 last:pb-0">
                            <span>{f.factor}</span>
                            <span className="font-bold whitespace-nowrap text-rose-700">{f.impact}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-emerald-700 font-medium">Zero operational deductions. Excellent subsystem balance!</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Raw Metrics Summary Strip */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-slate-100">
                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <div className="text-lg font-bold text-slate-900">{healthScore?.rawMetrics?.totalOpenComplaints || 0}</div>
                  <div className="text-[10px] font-medium text-slate-500 uppercase">Open Complaints</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <div className="text-lg font-bold text-slate-900">{healthScore?.rawMetrics?.breachedComplaints || 0}</div>
                  <div className="text-[10px] font-medium text-rose-600 uppercase font-semibold">SLA Breached</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <div className="text-lg font-bold text-slate-900">{healthScore?.rawMetrics?.overdueWorkOrders || 0}</div>
                  <div className="text-[10px] font-medium text-slate-500 uppercase">Overdue Orders</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <div className="text-lg font-bold text-slate-900">{healthScore?.rawMetrics?.overdueOutpasses || 0}</div>
                  <div className="text-[10px] font-medium text-rose-600 uppercase font-semibold">Overdue Curfew</div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: AI Operational Assistant (Interactive Live Q&A) */}
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-b from-indigo-50/60 to-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">
                    AI
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">AI Operational Assistant (Live Query Engine)</h3>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Ask conversational questions directly against active hostel database records.
                </p>
              </div>
            </div>

            {/* Inquiry preset prompt chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              {presetQueries.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setAssistantQuery(chip);
                    handleAskAssistant(chip);
                  }}
                  className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition shadow-2xs font-medium"
                >
                  &ldquo;{chip}&rdquo;
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskAssistant();
              }}
              className="mt-4 flex gap-2"
            >
              <input
                type="text"
                value={assistantQuery}
                onChange={(e) => setAssistantQuery(e.target.value)}
                placeholder="Ask about urgent complaints, overdue curfew, failing pumps, sanitation..."
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              />
              <button
                type="submit"
                disabled={assistantLoading || !assistantQuery.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {assistantLoading ? 'Analyzing...' : 'Inquire'}
              </button>
            </form>

            {/* Assistant Response Box */}
            {assistantResponse && (
              <div className="mt-4 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-medium text-indigo-600">Response for: &ldquo;{assistantResponse.query}&rdquo;</span>
                  <button
                    onClick={() => setAssistantResponse(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    &times; Dismiss
                  </button>
                </div>
                <p className="text-xs font-medium text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {assistantResponse.answer}
                </p>

                {assistantResponse.items?.length > 0 && (
                  <div className="mt-3">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Referenced Operational Records:</span>
                    <ul className="mt-1 space-y-1">
                      {assistantResponse.items.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs text-slate-700 bg-indigo-50/40 px-2 py-1 rounded">
                          <span className="font-semibold text-indigo-700">[{item.id}]</span>
                          <span>{item.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {assistantResponse.suggestedActions?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Suggested Managerial Actions:</span>
                    <ul className="mt-1 list-disc list-inside text-xs text-slate-700 space-y-0.5">
                      {assistantResponse.suggestedActions.map((act, idx) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 3: Executive AI Recommendations (Advisory for Human Approval) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Ranked Executive Recommendations</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {filteredRecs.length} Active
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Actionable advisory proposals for warden and authority review. AI assists decision-making; administrative human approval remains mandatory.
                </p>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium">Priority:</span>
                {['ALL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setRecFilter(p)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      recFilter === p
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredRecs.map((rec) => (
                <div
                  key={rec.id || rec.recommendationId}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 hover:border-slate-300 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                        {rec.module}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          rec.priority === 'URGENT'
                            ? 'bg-rose-100 text-rose-800'
                            : rec.priority === 'HIGH'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {rec.priority}
                      </span>
                    </div>

                    <h4 className="mt-2 text-xs font-bold text-slate-900">{rec.title}</h4>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{rec.rationale}</p>

                    <div className="mt-3 rounded-lg bg-white p-3 border border-slate-200/80">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                        Proposed Human Action
                      </span>
                      <p className="text-xs font-semibold text-slate-800 mt-0.5">{rec.proposedAction}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 italic">Advisory &bull; Requires Human Approval</span>
                    <span className="font-medium text-slate-600">{rec.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 4: Operational Insights & Anomaly Detections */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Operational Subsystem Insights</h3>
                <p className="text-xs text-slate-500">
                  Continuous pattern detection and risk assessment across all active hostel facilities.
                </p>
              </div>

              {/* Module Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {['ALL', 'COMPLAINTS', 'MAINTENANCE', 'CLEANING', 'MESS', 'OUTPASS'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setInsightFilter(m)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition whitespace-nowrap ${
                      insightFilter === m
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {filteredInsights.map((ins) => (
                <div
                  key={ins.insightId}
                  className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50/50 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          ins.category === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : ins.category === 'HIGH'
                            ? 'bg-orange-100 text-orange-800'
                            : ins.category === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {ins.category}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{ins.title}</span>
                      <span className="text-[10px] text-slate-400">[{ins.insightId}]</span>
                    </div>
                    <p className="text-xs text-slate-600">{ins.explanation}</p>
                    <div className="text-[11px] text-indigo-700 font-medium">
                      &rarr; Recommended: {ins.recommendedAction}
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <span className="text-xs font-bold text-slate-700 block">
                      {Math.round((ins.confidence || 0.9) * 100)}% Confidence
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                      Module: {ins.affectedModule}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

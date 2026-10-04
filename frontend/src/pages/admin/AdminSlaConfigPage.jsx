import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getSlaConfig,
  updateSlaConfig,
  triggerScheduler,
  verifySlaPipeline,
} from '../../services/slaService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';

export default function AdminSlaConfigPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [schedulerResult, setSchedulerResult] = useState(null);
  const [runningVerification, setRunningVerification] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // Form State
  const [staffToWardenHours, setStaffToWardenHours] = useState(24);
  const [wardenToAuthorityHours, setWardenToAuthorityHours] = useState(24);
  const [authorityToAdminHours, setAuthorityToAdminHours] = useState(24);
  const [reminderThresholdPercent, setReminderThresholdPercent] = useState(75);
  const [escalationEnabled, setEscalationEnabled] = useState(true);
  const [priorityDurations, setPriorityDurations] = useState({
    CRITICAL: 4,
    HIGH: 24,
    MEDIUM: 48,
    LOW: 72,
  });

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getSlaConfig();
      if (res.success && res.data) {
        setStaffToWardenHours(res.data.staffToWardenHours || 24);
        setWardenToAuthorityHours(res.data.wardenToAuthorityHours || 24);
        setAuthorityToAdminHours(res.data.authorityToAdminHours || 24);
        setReminderThresholdPercent(res.data.reminderThresholdPercent || 75);
        setEscalationEnabled(res.data.escalationEnabled !== false);
        if (res.data.priorityDurations) {
          setPriorityDurations({
            CRITICAL: res.data.priorityDurations.CRITICAL || 4,
            HIGH: res.data.priorityDurations.HIGH || 24,
            MEDIUM: res.data.priorityDurations.MEDIUM || 48,
            LOW: res.data.priorityDurations.LOW || 72,
          });
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load SLA configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMessage(null);
      setError(null);

      const payload = {
        staffToWardenHours: Number(staffToWardenHours),
        wardenToAuthorityHours: Number(wardenToAuthorityHours),
        authorityToAdminHours: Number(authorityToAdminHours),
        reminderThresholdPercent: Number(reminderThresholdPercent),
        escalationEnabled: Boolean(escalationEnabled),
        priorityDurations: {
          CRITICAL: Number(priorityDurations.CRITICAL),
          HIGH: Number(priorityDurations.HIGH),
          MEDIUM: Number(priorityDurations.MEDIUM),
          LOW: Number(priorityDurations.LOW),
        },
      };

      const res = await updateSlaConfig(payload);
      if (res.success) {
        setSuccessMessage('SLA configuration and escalation parameters updated successfully!');
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update SLA configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleRunScheduler = async () => {
    try {
      setRunningScheduler(true);
      setSchedulerResult(null);
      const res = await triggerScheduler();
      if (res.success) {
        setSchedulerResult(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to run scheduler');
    } finally {
      setRunningScheduler(false);
    }
  };

  const handleRunVerification = async () => {
    try {
      setRunningVerification(true);
      setVerificationResult(null);
      setError(null);
      const res = await verifySlaPipeline();
      if (res.success && res.data) {
        setVerificationResult(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Pipeline verification encountered an error');
    } finally {
      setRunningVerification(false);
    }
  };

  const handleResetDefaults = () => {
    setStaffToWardenHours(24);
    setWardenToAuthorityHours(24);
    setAuthorityToAdminHours(24);
    setReminderThresholdPercent(75);
    setEscalationEnabled(true);
    setPriorityDurations({
      CRITICAL: 4,
      HIGH: 24,
      MEDIUM: 48,
      LOW: 72,
    });
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <LoadingSpinner size="lg" message="Loading SLA & Escalation configuration..." />
      </div>
    );
  }

  if (error && !staffToWardenHours) {
    return <ErrorState title="Configuration Error" message={error} onRetry={loadConfig} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-violet-900 via-indigo-950 to-slate-900 p-6 text-white shadow-md">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Super Admin Control
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">SLA Configuration &amp; Escalation Control</h1>
            <p className="mt-1 text-xs text-slate-300 max-w-2xl">
              Configure operational response windows for maintenance staff, wardens, and authorities.
              Manage deadline reminders, automated breach transfers, and scheduler controls.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRunVerification}
              disabled={runningVerification}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {runningVerification ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Running Pipeline Diagnostic...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Run Pipeline Verification (Step 5.5)
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleRunScheduler}
              disabled={runningScheduler}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-violet-700 disabled:opacity-60 transition"
            >
              {runningScheduler ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Run Scheduler Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 shadow-2xs">
          <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 shadow-2xs">
          <svg className="h-5 w-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Step 5.5 Live Verification Diagnostic Results */}
      {verificationResult && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-indigo-200">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-bold text-indigo-950">
                Live SLA &amp; Automatic Escalation Pipeline Verified (Step 5.5)
              </h3>
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                {verificationResult.passedChecks} / {verificationResult.totalChecks} Checks Passed
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-indigo-700 font-mono">
                Duration: {verificationResult.durationMs}ms
              </span>
              <button
                type="button"
                onClick={() => setVerificationResult(null)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Dismiss &times;
              </button>
            </div>
          </div>

          <p className="text-xs text-indigo-800 font-medium">{verificationResult.summary}</p>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-1">
            {verificationResult.checks?.map((chk, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-indigo-100 bg-white p-3 shadow-2xs text-xs space-y-1"
              >
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{chk.name}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    &check; Passed
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{chk.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {schedulerResult && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-violet-100">
            <span className="text-xs font-bold text-violet-900 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-600" />
              Manual Scheduler Execution Completed
            </span>
            <button
              type="button"
              onClick={() => setSchedulerResult(null)}
              className="text-[11px] text-violet-600 hover:text-violet-800 font-semibold"
            >
              Dismiss &times;
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
            <div className="rounded-lg bg-white p-2.5 shadow-2xs">
              <span className="text-base font-bold text-slate-800">{schedulerResult.processedCount ?? 0}</span>
              <span className="block text-[10px] text-slate-500 font-semibold mt-0.5">Tickets Evaluated</span>
            </div>
            <div className="rounded-lg bg-white p-2.5 shadow-2xs">
              <span className="text-base font-bold text-amber-600">{schedulerResult.remindersRecorded ?? 0}</span>
              <span className="block text-[10px] text-slate-500 font-semibold mt-0.5">Reminders Flagged</span>
            </div>
            <div className="rounded-lg bg-white p-2.5 shadow-2xs">
              <span className="text-base font-bold text-purple-600">{schedulerResult.escalationsTriggered ?? 0}</span>
              <span className="block text-[10px] text-slate-500 font-semibold mt-0.5">Auto-Escalated</span>
            </div>
            <div className="rounded-lg bg-white p-2.5 shadow-2xs">
              <span className="text-base font-bold text-rose-600">{schedulerResult.breachesRecorded ?? 0}</span>
              <span className="block text-[10px] text-slate-500 font-semibold mt-0.5">Breaches Recorded</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Configuration Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Navigation Tabs to Granular Rule Catalogs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
              Global SLA Controls
            </span>
            <Link
              to="/admin/sla-rules"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Detailed SLA Rules &rarr;
            </Link>
            <Link
              to="/admin/escalation-rules"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Escalation Matrix Rules &rarr;
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Reset to Defaults
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {saving ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Dynamic Multi-Tier Escalation Hierarchy Progression Visualizer */}
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50 p-5 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Configured Escalation Chain Progression Preview
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-teal-200 bg-white p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Level 0: Initial Dispatch</span>
              <p className="mt-1 text-sm font-bold text-slate-900">Maintenance Staff</p>
              <div className="mt-2 text-[11px] text-slate-500">
                Resolution duration configured by ticket priority (e.g. {priorityDurations.MEDIUM}h for Medium)
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-white p-3.5 shadow-2xs relative">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Level 1: First Escalation</span>
              <p className="mt-1 text-sm font-bold text-slate-900">Hostel Warden</p>
              <div className="mt-2 text-xs font-semibold text-indigo-700">
                Allowed: {staffToWardenHours} Hours
              </div>
              <span className="block text-[10px] text-slate-400 mt-0.5">Staff &rarr; Warden window</span>
            </div>

            <div className="rounded-xl border border-purple-200 bg-white p-3.5 shadow-2xs relative">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Level 2: Second Escalation</span>
              <p className="mt-1 text-sm font-bold text-slate-900">Campus Authority</p>
              <div className="mt-2 text-xs font-semibold text-purple-700">
                Allowed: {wardenToAuthorityHours} Hours
              </div>
              <span className="block text-[10px] text-slate-400 mt-0.5">Warden &rarr; Authority window</span>
            </div>

            <div className="rounded-xl border border-rose-200 bg-white p-3.5 shadow-2xs relative">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Level 3: Executive Tier</span>
              <p className="mt-1 text-sm font-bold text-slate-900">Super Administrator</p>
              <div className="mt-2 text-xs font-semibold text-rose-700">
                Allowed: {authorityToAdminHours} Hours
              </div>
              <span className="block text-[10px] text-slate-400 mt-0.5">Authority &rarr; Super Admin</span>
            </div>
          </div>
        </div>

        {/* Section 1: Tier-to-Tier Escalation SLA Durations */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">1. Tier-to-Tier Escalation Windows</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify the maximum duration in hours granted to an assignee at each authority tier before the system automatically breaches and reassigns to the next superior tier.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {/* Staff -> Warden */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <label className="block text-xs font-bold text-slate-900">
                Staff &rarr; Warden SLA Duration
              </label>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Time granted to staff technician before auto-escalating to Hostel Warden (Level 1).
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="720"
                  step="1"
                  value={staffToWardenHours}
                  onChange={(e) => setStaffToWardenHours(e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
                <span className="text-xs font-semibold text-slate-600">Hours ({Math.round((staffToWardenHours / 24) * 10) / 10} days)</span>
              </div>
            </div>

            {/* Warden -> Authority */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <label className="block text-xs font-bold text-slate-900">
                Warden &rarr; Authority SLA Duration
              </label>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Time granted to Warden to intervene before ticket escalates to University Authority (Level 2).
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="720"
                  step="1"
                  value={wardenToAuthorityHours}
                  onChange={(e) => setWardenToAuthorityHours(e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
                <span className="text-xs font-semibold text-slate-600">Hours ({Math.round((wardenToAuthorityHours / 24) * 10) / 10} days)</span>
              </div>
            </div>

            {/* Authority -> Super Admin */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <label className="block text-xs font-bold text-slate-900">
                Authority &rarr; Super Admin Duration
              </label>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Time granted to Campus Authority before final escalation to Super Admin (Level 3).
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="720"
                  step="1"
                  value={authorityToAdminHours}
                  onChange={(e) => setAuthorityToAdminHours(e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
                <span className="text-xs font-semibold text-slate-600">Hours ({Math.round((authorityToAdminHours / 24) * 10) / 10} days)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Reminder Threshold & Automation Control */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Reminder Threshold Control */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">2. Deadline Reminder Threshold</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Triggers an advance reminder when resolution time exceeds this elapsed percentage.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-700">Reminder Trigger Percentage</span>
                <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                  {reminderThresholdPercent}% Elapsed
                </span>
              </div>
              <input
                type="range"
                min="25"
                max="95"
                step="5"
                value={reminderThresholdPercent}
                onChange={(e) => setReminderThresholdPercent(e.target.value)}
                className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>25% (Early alert)</span>
                <span>50% (Half-way)</span>
                <span>75% (Recommended)</span>
                <span>95% (Near breach)</span>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50/70 border border-amber-200/60 p-3 text-xs text-amber-900">
              <span className="font-bold">Calculated Example:</span> On a 24-hour SLA ticket at {reminderThresholdPercent}%, the reminder flag triggers after{' '}
              <strong>{(24 * (reminderThresholdPercent / 100)).toFixed(1)} hours</strong> ({((24 * (100 - reminderThresholdPercent)) / 100).toFixed(1)} hours before deadline).
            </div>
          </div>

          {/* Engine Automation Switch */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">3. Automatic Escalation Engine Status</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle whether the server background worker actively auto-reassigns breached complaints.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div>
                  <span className="text-xs font-bold text-slate-900">Auto-Escalation Engine</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {escalationEnabled
                      ? 'Actively running: breaches automatically trigger reassignment and audit logs.'
                      : 'Paused: complaints mark as breached but do NOT transfer to next tier.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={escalationEnabled}
                    onChange={(e) => setEscalationEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500 border border-slate-100">
              <span className="font-semibold text-slate-700">RBAC Guard:</span> SLA configuration updates and scheduler triggers are strictly locked to Super Administrators. All mutations are timestamped.
            </div>
          </div>
        </div>

        {/* Section 3: Baseline Priority SLA Durations */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">4. Baseline Priority SLA Durations (Level 0 / Initial Dispatch)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Default resolution targets assigned when a complaint is initially triaged to maintenance staff.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* CRITICAL */}
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
              <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                CRITICAL
              </span>
              <p className="mt-1 text-xs text-slate-600 font-medium">Emergency / Danger</p>
              <div className="mt-3 flex items-center gap-1.5">
                <input
                  type="number"
                  min="0.5"
                  max="168"
                  step="0.5"
                  value={priorityDurations.CRITICAL}
                  onChange={(e) =>
                    setPriorityDurations((prev) => ({ ...prev, CRITICAL: e.target.value }))
                  }
                  className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500"
                  required
                />
                <span className="text-xs font-semibold text-slate-600">Hours</span>
              </div>
            </div>

            {/* HIGH */}
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
              <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                HIGH
              </span>
              <p className="mt-1 text-xs text-slate-600 font-medium">Major Disruption</p>
              <div className="mt-3 flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="168"
                  step="1"
                  value={priorityDurations.HIGH}
                  onChange={(e) =>
                    setPriorityDurations((prev) => ({ ...prev, HIGH: e.target.value }))
                  }
                  className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500"
                  required
                />
                <span className="text-xs font-semibold text-slate-600">Hours</span>
              </div>
            </div>

            {/* MEDIUM */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                MEDIUM
              </span>
              <p className="mt-1 text-xs text-slate-600 font-medium">Standard Repair</p>
              <div className="mt-3 flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="336"
                  step="1"
                  value={priorityDurations.MEDIUM}
                  onChange={(e) =>
                    setPriorityDurations((prev) => ({ ...prev, MEDIUM: e.target.value }))
                  }
                  className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500"
                  required
                />
                <span className="text-xs font-semibold text-slate-600">Hours</span>
              </div>
            </div>

            {/* LOW */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                LOW
              </span>
              <p className="mt-1 text-xs text-slate-600 font-medium">Minor Routine</p>
              <div className="mt-3 flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="720"
                  step="1"
                  value={priorityDurations.LOW}
                  onChange={(e) =>
                    setPriorityDurations((prev) => ({ ...prev, LOW: e.target.value }))
                  }
                  className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500"
                  required
                />
                <span className="text-xs font-semibold text-slate-600">Hours</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Save Action Bar */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-500">
            Changes take effect immediately on subsequent SLA evaluations and assignment cycles.
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Reset Defaults
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {saving ? 'Saving...' : 'Save SLA Configuration'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

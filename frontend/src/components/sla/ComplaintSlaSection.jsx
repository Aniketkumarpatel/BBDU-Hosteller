import { useState, useEffect } from 'react';
import SlaBadge from './SlaBadge.jsx';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDuration = (ms) => {
  if (ms == null || isNaN(ms) || ms < 0) return '0 minutes';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
};

const getRoleDisplayName = (role) => {
  switch (role) {
    case 'HOSTEL_STAFF':
      return 'Maintenance Staff / Technician';
    case 'WARDEN':
      return 'Hostel Warden';
    case 'AUTHORITY':
      return 'Chief Warden / Campus Authority';
    case 'SUPER_ADMIN':
      return 'Super Administrator';
    default:
      return role ? role.replace(/_/g, ' ') : 'Unassigned';
  }
};

export default function ComplaintSlaSection({ complaint }) {
  if (!complaint) return null;

  const sla = complaint.sla || {};
  const escalations = complaint.escalations || [];
  const cycles = sla.cycles || [];
  const currentRule = complaint.slaRuleId || sla.slaRule;

  const isResolvedOrClosed =
    complaint.status === 'RESOLVED' ||
    complaint.status === 'STUDENT_VERIFICATION' ||
    complaint.status === 'CLOSED' ||
    complaint.slaStatus === 'COMPLETED';

  // State calculations
  const [timeRemainingText, setTimeRemainingText] = useState('');
  const [timeElapsedText, setTimeElapsedText] = useState('');
  const [statusCategory, setStatusCategory] = useState('WITHIN_SLA'); // WITHIN_SLA | NEAR_DEADLINE | BREACHED | RESOLVED

  useEffect(() => {
    const updateTimes = () => {
      const now = Date.now();

      // 1. Elapsed Time Calculation
      if (complaint.slaStartedAt) {
        const startMs = new Date(complaint.slaStartedAt).getTime();
        const endMs = isResolvedOrClosed
          ? new Date(complaint.resolvedAt || complaint.verifiedAt || complaint.updatedAt || now).getTime()
          : now;
        const elapsedMs = Math.max(0, endMs - startMs);
        setTimeElapsedText(formatDuration(elapsedMs));
      } else {
        setTimeElapsedText('Not started');
      }

      // 2. Remaining Time & Category Calculation
      if (isResolvedOrClosed) {
        setStatusCategory('RESOLVED');
        setTimeRemainingText('Resolution Complete');
        return;
      }

      if (!complaint.slaDueAt || complaint.slaStatus !== 'ACTIVE') {
        if (complaint.slaStatus === 'BREACHED') {
          setStatusCategory('BREACHED');
          setTimeRemainingText('SLA Breached');
        } else {
          setStatusCategory('WITHIN_SLA');
          setTimeRemainingText('SLA Pending Start');
        }
        return;
      }

      const dueMs = new Date(complaint.slaDueAt).getTime();
      const diffMs = dueMs - now;

      if (diffMs <= 0 || complaint.slaStatus === 'BREACHED') {
        setStatusCategory('BREACHED');
        const overdueMs = Math.abs(diffMs || 0);
        setTimeRemainingText(`BREACHED by ${formatDuration(overdueMs)}`);
        return;
      }

      // Check Near Deadline (< 25% remaining or reminderSentAt exists or < 2 hours)
      let nearDeadline = Boolean(complaint.reminderSentAt);
      if (!nearDeadline && complaint.slaStartedAt) {
        const startMs = new Date(complaint.slaStartedAt).getTime();
        const totalDuration = dueMs - startMs;
        if (totalDuration > 0 && diffMs <= totalDuration * 0.25) {
          nearDeadline = true;
        }
      } else if (diffMs < 2 * 60 * 60 * 1000) {
        nearDeadline = true;
      }

      if (nearDeadline) {
        setStatusCategory('NEAR_DEADLINE');
      } else {
        setStatusCategory('WITHIN_SLA');
      }

      setTimeRemainingText(`${formatDuration(diffMs)} remaining`);
    };

    updateTimes();
    const interval = setInterval(updateTimes, 15000);
    return () => clearInterval(interval);
  }, [
    complaint.slaDueAt,
    complaint.slaStartedAt,
    complaint.slaStatus,
    complaint.status,
    complaint.reminderSentAt,
    isResolvedOrClosed,
  ]);

  const escalationLevel = complaint.currentEscalationLevel || 0;

  // Escalation Hierarchy Nodes
  const hierarchyNodes = [
    { level: 0, role: 'HOSTEL_STAFF', title: 'Maintenance Staff', subtitle: 'Initial Handler' },
    { level: 1, role: 'WARDEN', title: 'Hostel Warden', subtitle: 'Level 1 Escalation' },
    { level: 2, role: 'AUTHORITY', title: 'Campus Authority', subtitle: 'Level 2 Escalation' },
    { level: 3, role: 'SUPER_ADMIN', title: 'Super Admin', subtitle: 'Level 3 Terminal' },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Service Level Agreement (SLA) &amp; Escalation Tracker
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time server-authoritative deadline tracking and multi-tier escalation hierarchy
          </p>
        </div>

        <SlaBadge
          slaStatus={complaint.slaStatus}
          slaDueAt={complaint.slaDueAt}
          slaStartedAt={complaint.slaStartedAt}
          reminderSentAt={complaint.reminderSentAt}
          complaintStatus={complaint.status}
          escalationLevel={escalationLevel}
          showCountdown={false}
        />
      </div>

      {/* Prominent State Banner */}
      <div className="mt-4">
        {statusCategory === 'WITHIN_SLA' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Status: Within SLA Target</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Complaint is operating within the expected resolution timeframe.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-lg">
              {timeRemainingText}
            </span>
          </div>
        )}

        {statusCategory === 'NEAR_DEADLINE' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-amber-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Status: Near SLA Deadline</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Over 75% of resolution time elapsed. Auto-escalation will engage if unresolved before deadline.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-amber-900 bg-amber-200/80 px-3 py-1 rounded-lg">
              {timeRemainingText}
            </span>
          </div>
        )}

        {statusCategory === 'BREACHED' && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-800">Status: SLA Breached</p>
                <p className="text-xs text-rose-700 mt-0.5">
                  Resolution deadline exceeded without closure. Complaint automatically escalated to next authority.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-rose-900 bg-rose-100 px-3 py-1 rounded-lg">
              Level {escalationLevel} Escalated
            </span>
          </div>
        )}

        {statusCategory === 'RESOLVED' && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sky-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4 text-sky-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-sky-800">Status: Resolved / Closed</p>
                <p className="text-xs text-sky-700 mt-0.5">
                  Complaint was marked resolved. Operational SLA cycles have concluded.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-sky-800 bg-sky-100 px-3 py-1 rounded-lg">
              Total Elapsed: {timeElapsedText}
            </span>
          </div>
        )}
      </div>

      {/* SLA Core Metrics Cards (6-Grid) */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* Metric 1: Current Authority / Assignee */}
        <div className="rounded-xl bg-slate-50/80 p-4 border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Current Authority / Assignee
          </span>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
              {complaint.assignedTo?.name ? complaint.assignedTo.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">
                {complaint.assignedTo?.name || 'Unassigned'}
              </p>
              <p className="text-[11px] font-medium text-indigo-600 truncate">
                {getRoleDisplayName(complaint.assignedTo?.role)}
              </p>
            </div>
          </div>
          {complaint.assignedTo?.email && (
            <p className="mt-2 text-[10px] text-slate-400 font-mono truncate">
              {complaint.assignedTo.email}
            </p>
          )}
        </div>

        {/* Metric 2: Escalation Level */}
        <div className="rounded-xl bg-slate-50/80 p-4 border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Current Escalation Level
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${escalationLevel > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              Level {escalationLevel}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {escalationLevel === 0
                ? '(Base Handler)'
                : escalationLevel === 1
                ? '(Hostel Warden)'
                : escalationLevel === 2
                ? '(Campus Authority)'
                : '(Super Administrator)'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {escalationLevel === 0 ? 'Standard operational window' : `Escalation count: ${complaint.escalationCount || 1}`}
          </p>
        </div>

        {/* Metric 3: Resolution Deadline */}
        <div className="rounded-xl bg-slate-50/80 p-4 border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            SLA Resolution Deadline
          </span>
          <p className="mt-2 text-sm font-bold text-slate-900">
            {formatDate(complaint.slaDueAt)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {complaint.reminderSentAt ? '75% Threshold reminder logged' : 'Calculated by server SLA engine'}
          </p>
        </div>

        {/* Metric 4: Remaining Time */}
        <div className="rounded-xl bg-slate-50/80 p-4 border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Remaining SLA Time
          </span>
          <p className={`mt-2 text-sm font-bold font-mono ${
            statusCategory === 'BREACHED'
              ? 'text-rose-600'
              : statusCategory === 'NEAR_DEADLINE'
              ? 'text-amber-700'
              : statusCategory === 'RESOLVED'
              ? 'text-sky-600'
              : 'text-emerald-700'
          }`}>
            {timeRemainingText}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Auto-ticks against authoritative server deadline
          </p>
        </div>

        {/* Metric 5: Time Elapsed */}
        <div className="rounded-xl bg-slate-50/80 p-4 border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Time Elapsed
          </span>
          <p className="mt-2 text-sm font-bold font-mono text-slate-800">
            {timeElapsedText}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Cycle started: {formatDate(complaint.slaStartedAt)}
          </p>
        </div>

        {/* Metric 6: Applicable SLA Rule */}
        <div className="rounded-xl bg-slate-50/80 p-4 border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Configured SLA Rule
          </span>
          <p className="mt-2 text-sm font-bold text-slate-900 truncate">
            {currentRule?.name || `${complaint.priority} Priority SLA`}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Target: {currentRule?.resolutionHours || (complaint.priority === 'CRITICAL' ? 4 : 24)}h resolution window
          </p>
        </div>
      </div>

      {/* Visual Escalation Hierarchy Chain */}
      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Authority Escalation Hierarchy
          </h4>
          <span className="text-[11px] text-slate-400">
            Automatic reassignment sequence on SLA deadline breach
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {hierarchyNodes.map((node, index) => {
            const isCurrent = escalationLevel === node.level;
            const isPast = escalationLevel > node.level;

            return (
              <div
                key={node.level}
                className={`relative rounded-xl p-3 border text-xs transition ${
                  isCurrent
                    ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-200 shadow-xs'
                    : isPast
                    ? 'border-slate-200 bg-slate-50/80 text-slate-600'
                    : 'border-dashed border-slate-200 bg-white text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {node.subtitle}
                  </span>
                  {isCurrent && (
                    <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                  )}
                  {isPast && (
                    <svg className="h-3.5 w-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className={`font-bold text-xs truncate ${isCurrent ? 'text-indigo-900' : 'text-slate-800'}`}>
                  {node.title}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {isCurrent
                    ? `Active Assignee (${complaint.assignedTo?.name || 'Assigned'})`
                    : isPast
                    ? 'Bypassed after breach'
                    : 'Next fallback authority'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Escalation Audit History Table */}
      {escalations.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Automatic Escalation History Audit ({escalations.length})
            </h4>
            <span className="text-[11px] text-slate-400">Chronological escalation log</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-700">
                <tr>
                  <th className="px-3.5 py-2.5">Level</th>
                  <th className="px-3.5 py-2.5">Previous Authority</th>
                  <th className="px-3.5 py-2.5">Escalated To</th>
                  <th className="px-3.5 py-2.5">Escalation Reason &amp; Trigger</th>
                  <th className="px-3.5 py-2.5">Escalated At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {escalations.map((esc, idx) => (
                  <tr key={esc._id || idx} className="hover:bg-slate-50/60">
                    <td className="px-3.5 py-2.5 font-bold text-amber-700 whitespace-nowrap">
                      Level {esc.escalationLevel}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-800">
                      <span className="font-semibold text-slate-900 block truncate">
                        {esc.fromUserId?.name || getRoleDisplayName(esc.fromRole)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {getRoleDisplayName(esc.fromRole)}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                      <span className="font-semibold text-indigo-900 block truncate">
                        {esc.toUserId?.name || getRoleDisplayName(esc.toRole)}
                      </span>
                      <span className="text-[10px] text-indigo-600 font-medium">
                        {getRoleDisplayName(esc.toRole)}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700 max-w-xs">
                      <p className="line-clamp-2 text-slate-800">{esc.reason}</p>
                      <span className="text-[10px] font-semibold text-slate-400">
                        Trigger: {esc.triggeredBy || 'AUTOMATIC_SLA_BREACH'}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">
                      {formatDate(esc.triggeredAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical SLA Cycles Audit */}
      {cycles.length > 1 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Historical SLA Operational Cycles ({cycles.length})
          </p>
          <div className="space-y-2">
            {cycles.map((c) => (
              <div
                key={c._id || c.cycleNumber}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2 text-xs border border-slate-100 gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">Cycle #{c.cycleNumber}</span>
                  <span className="text-[11px] text-slate-500">
                    (Level {c.escalationLevel} — {c.slaRuleSnapshot?.resolutionHours || 24}h target)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-600">
                    Started: {formatDate(c.startedAt)} | Due: {formatDate(c.dueAt)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    c.status === 'BREACHED'
                      ? 'bg-rose-100 text-rose-800'
                      : c.status === 'COMPLETED'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

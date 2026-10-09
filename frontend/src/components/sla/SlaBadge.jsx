import { useState, useEffect } from 'react';

/**
 * Format remaining milliseconds into human-readable duration
 */
const formatRemainingTime = (dueAt) => {
  if (!dueAt) return null;
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h left`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
};

export default function SlaBadge({
  slaStatus,
  slaDueAt,
  slaStartedAt,
  reminderSentAt,
  complaintStatus,
  escalationLevel = 0,
  showCountdown = true,
}) {
  const [countdown, setCountdown] = useState(() => formatRemainingTime(slaDueAt));

  useEffect(() => {
    if (!slaDueAt || slaStatus !== 'ACTIVE') return;

    setCountdown(formatRemainingTime(slaDueAt));
    const timer = setInterval(() => {
      setCountdown(formatRemainingTime(slaDueAt));
    }, 15000);

    return () => clearInterval(timer);
  }, [slaDueAt, slaStatus]);

  if (!slaStatus) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
        Not started
      </span>
    );
  }

  // 1. Resolved / Closed Check
  const isResolvedOrClosed =
    slaStatus === 'COMPLETED' ||
    complaintStatus === 'RESOLVED' ||
    complaintStatus === 'STUDENT_VERIFICATION' ||
    complaintStatus === 'CLOSED';

  // 2. Breached Check
  const diffMs = slaDueAt ? new Date(slaDueAt).getTime() - Date.now() : null;
  const isBreached =
    !isResolvedOrClosed &&
    (slaStatus === 'BREACHED' || (diffMs !== null && diffMs <= 0) || countdown === 'Overdue');

  // 3. Near Deadline Check (< 25% or reminderSentAt or < 2 hours)
  let isNearDeadline = false;
  if (!isResolvedOrClosed && !isBreached && slaStatus === 'ACTIVE' && diffMs !== null) {
    if (reminderSentAt) {
      isNearDeadline = true;
    } else if (slaStartedAt && slaDueAt) {
      const totalWindow = new Date(slaDueAt).getTime() - new Date(slaStartedAt).getTime();
      if (totalWindow > 0 && diffMs <= totalWindow * 0.25) {
        isNearDeadline = true;
      }
    } else if (diffMs < 2 * 60 * 60 * 1000) {
      isNearDeadline = true;
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {/* State 1: Resolved / Closed */}
      {isResolvedOrClosed && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200"
          aria-label="Issue is resolved or closed"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          Fixed / Closed
        </span>
      )}

      {/* State 2: Overdue */}
      {isBreached && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200"
          aria-label="Deadline has been missed"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping" />
          ⚠ Deadline missed
        </span>
      )}

      {/* State 3: Due soon */}
      {!isResolvedOrClosed && !isBreached && isNearDeadline && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-300"
          aria-label="Due soon"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Due soon
          {showCountdown && countdown && countdown !== 'Overdue' && (
            <span className="font-mono text-[10px] text-amber-900 bg-amber-100/90 px-1.5 py-0.2 rounded ml-0.5">
              {countdown}
            </span>
          )}
        </span>
      )}

      {/* State 4: On track */}
      {!isResolvedOrClosed && !isBreached && !isNearDeadline && slaStatus === 'ACTIVE' && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200"
          aria-label="On track — within deadline"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          On track
          {showCountdown && countdown && countdown !== 'Overdue' && (
            <span className="font-mono text-[10px] text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded ml-0.5">
              {countdown}
            </span>
          )}
        </span>
      )}

      {/* Escalation indicator */}
      {escalationLevel > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-300"
          title={`Escalated to Level ${escalationLevel} authority`}
          aria-label={`Escalated to senior authority — level ${escalationLevel}`}
        >
          <svg className="h-3 w-3 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Escalated (L{escalationLevel})
        </span>
      )}
    </div>
  );
}

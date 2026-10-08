import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import complaintService from '../../services/complaintService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import Modal from '../../components/common/Modal.jsx';
import SlaBadge from '../../components/sla/SlaBadge.jsx';
import ComplaintSlaSection from '../../components/sla/ComplaintSlaSection.jsx';

export default function ComplaintDetailPage() {
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [resolutions, setResolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verification modal states
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [acceptNote, setAcceptNote] = useState('');
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const [compRes, resHist] = await Promise.all([
        complaintService.getComplaintDetails(id),
        complaintService.getComplaintResolutions(id).catch(() => ({ data: [] })),
      ]);

      if (compRes.success && compRes.data) {
        setComplaint(compRes.data);
        setResolutions(resHist?.data || []);
      } else {
        setError(compRes.message || 'Failed to load complaint details');
      }
    } catch (err) {
      setError(
        err?.response?.status === 403
          ? 'You are not authorized to view this complaint.'
          : err?.response?.data?.message || err.message || 'Error loading complaint'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleAcceptSubmit = async (e) => {
    e.preventDefault();
    setAcceptSubmitting(true);
    setActionError('');
    try {
      const res = await complaintService.verifyComplaint(id, {
        decision: 'ACCEPT',
        verificationNote: acceptNote.trim(),
      });
      if (res.success) {
        setActionSuccess('Thank you! Complaint has been verified and closed.');
        setAcceptModalOpen(false);
        await fetchDetails();
      } else {
        setActionError(res.message || 'Failed to submit verification');
      }
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Verification failed');
    } finally {
      setAcceptSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim() || reopenReason.trim().length < 5) {
      setActionError('Please provide a specific reason (at least 5 characters) explaining why the issue is not fixed.');
      return;
    }
    setRejectSubmitting(true);
    setActionError('');
    try {
      const res = await complaintService.verifyComplaint(id, {
        decision: 'REJECT',
        reopenReason: reopenReason.trim(),
      });
      if (res.success) {
        setActionSuccess('Complaint reopened. Staff has been notified to resume work.');
        setRejectModalOpen(false);
        await fetchDetails();
      } else {
        setActionError(res.message || 'Failed to reopen complaint');
      }
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Reopening failed');
    } finally {
      setRejectSubmitting(false);
    }
  };

  const getPriorityBadge = (p) => {
    const map = {
      LOW: 'bg-blue-100 text-blue-700',
      MEDIUM: 'bg-emerald-100 text-emerald-700',
      HIGH: 'bg-amber-100 text-amber-700',
      CRITICAL: 'bg-rose-100 text-rose-700 font-bold',
    };
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[p] || 'bg-slate-100 text-slate-700'}`}>
        {p}
      </span>
    );
  };

  const getStatusBadge = (s) => {
    const map = {
      SUBMITTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      TRIAGED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
      ACKNOWLEDGED: 'bg-sky-50 text-sky-700 border-sky-200',
      IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
      STUDENT_VERIFICATION: 'bg-purple-100 text-purple-800 border-purple-300 font-bold animate-pulse',
      RESOLVED: 'bg-purple-50 text-purple-700 border-purple-200',
      CLOSED: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      REOPENED: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${map[s] || 'bg-slate-50 text-slate-700'}`}>
        <span className="h-2 w-2 rounded-full bg-current" />
        {s?.replace(/_/g, ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout title="Complaint Details" roleLabel="Student">
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading ticket details..." />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !complaint) {
    return (
      <DashboardLayout title="Complaint Details" roleLabel="Student">
        <div className="mx-auto max-w-lg">
          <ErrorState
            title="Unable to Access Ticket"
            message={error || 'Ticket not found'}
            onRetry={fetchDetails}
          />
          <div className="mt-4 text-center">
            <Link to="/student/complaints" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              &larr; Back to My Complaints
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isAwaitingVerification = complaint.status === 'STUDENT_VERIFICATION';
  const isClosed = complaint.status === 'CLOSED';
  const isReopened = complaint.status === 'REOPENED';

  return (
    <DashboardLayout title={`Ticket: ${complaint.complaintId}`} roleLabel="Student">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/student/complaints"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to My Complaints
          </Link>
          <span className="text-xs font-mono text-slate-400">ID: {complaint.complaintId}</span>
        </div>

        {/* Notifications */}
        {actionSuccess && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs font-medium text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess('')} className="text-emerald-600 hover:text-emerald-900">&times;</button>
          </div>
        )}

        {actionError && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError('')} className="text-rose-600 hover:text-rose-900">&times;</button>
          </div>
        )}

        {/* PROMINENT STUDENT VERIFICATION CARD */}
        {isAwaitingVerification && (
          <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-r from-purple-50 via-indigo-50 to-white p-6 shadow-md">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-200 px-3 py-1 text-xs font-bold text-purple-900">
                  <span className="h-2 w-2 rounded-full bg-purple-600 animate-ping" />
                  Action Required: Student Verification
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Your complaint has been marked as resolved!
                </h2>
                <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                  The maintenance technician has submitted resolution details. Please inspect your room/facility and confirm whether the issue has actually been fixed.
                </p>

                {/* Resolution note from technician */}
                {complaint.resolutionNote && (
                  <div className="mt-3 rounded-xl border border-purple-200 bg-white p-4 shadow-2xs">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-purple-700">
                      Technician Resolution Note
                    </span>
                    <p className="mt-1 text-xs text-slate-800 italic">
                      "{complaint.resolutionNote}"
                    </p>
                    <div className="mt-2 text-[10px] text-slate-400">
                      Resolved by: <span className="font-semibold text-slate-600">{complaint.resolvedBy?.name || 'Staff'}</span>
                      {complaint.resolvedAt && ` • ${new Date(complaint.resolvedAt).toLocaleString()}`}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0 pt-2">
                <button
                  onClick={() => {
                    setActionError('');
                    setActionSuccess('');
                    setAcceptModalOpen(true);
                  }}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Yes, Issue Fixed (Accept)
                </button>

                <button
                  onClick={() => {
                    setActionError('');
                    setActionSuccess('');
                    setRejectModalOpen(true);
                  }}
                  className="rounded-xl border border-rose-300 bg-white px-5 py-2.5 text-xs font-bold text-rose-700 shadow-2xs hover:bg-rose-50 transition flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Not Fixed — Reopen Complaint
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CLOSED STATUS BANNER */}
        {isClosed && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-emerald-900">Complaint Successfully Verified &amp; Closed</h3>
                <p className="text-xs text-emerald-800">
                  This issue was verified as fixed on {complaint.verifiedAt ? new Date(complaint.verifiedAt).toLocaleString() : 'N/A'}. No further actions are required.
                </p>
                {complaint.verificationNote && (
                  <p className="text-xs text-emerald-700 italic mt-1">
                    Your verification remark: "{complaint.verificationNote}"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REOPENED STATUS BANNER */}
        {isReopened && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="h-8 w-8 rounded-full bg-rose-500 flex items-center justify-center text-white shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-900">Complaint Reopened</h3>
                <p className="text-xs text-rose-800">
                  You reported that the issue was not fixed on {complaint.reopenedAt ? new Date(complaint.reopenedAt).toLocaleString() : 'recently'}. Maintenance staff has been queued to resume work.
                </p>
                {complaint.reopenReason && (
                  <p className="text-xs text-rose-700 font-medium italic mt-1">
                    Your stated reason: "{complaint.reopenReason}"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ticket Header Banner */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded">
                  {complaint.complaintId}
                </span>
                {getPriorityBadge(complaint.priority)}
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 uppercase">
                  {complaint.category}
                </span>
              </div>
              <h1 className="mt-2 text-xl font-bold text-slate-900">{complaint.title}</h1>
              <p className="text-xs text-slate-500">
                Issue Type: <span className="font-medium text-slate-700">{complaint.issueType?.replace(/_/g, ' ')}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <SlaBadge
                slaStatus={complaint.slaStatus}
                slaDueAt={complaint.slaDueAt}
                slaStartedAt={complaint.slaStartedAt}
                reminderSentAt={complaint.reminderSentAt}
                complaintStatus={complaint.status}
                escalationLevel={complaint.currentEscalationLevel}
              />
              {getStatusBadge(complaint.status)}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</h3>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-4 rounded-lg border border-slate-100">
              {complaint.description}
            </p>
          </div>

          {complaint.attachmentUrl && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Attached Photo / Evidence</h3>
              <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <a
                  href={complaint.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block shrink-0 group relative overflow-hidden rounded-lg border border-slate-300"
                >
                  <img
                    src={complaint.attachmentUrl}
                    alt={complaint.attachmentOriginalName || 'Complaint attachment'}
                    className="h-32 w-32 object-cover transition transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold">
                    View Full Image
                  </div>
                </a>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">
                    {complaint.attachmentOriginalName || 'Uploaded Attachment'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    File size: {complaint.attachmentSize ? `${(complaint.attachmentSize / 1024).toFixed(1)} KB` : 'N/A'}
                  </p>
                  <a
                    href={complaint.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 pt-1"
                  >
                    Open original image in new tab &rarr;
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SLA & Escalation Tracking Section */}
        <ComplaintSlaSection complaint={complaint} />

        {/* Visual Lifecycle Timeline */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Ticket Resolution Timeline
          </h2>

          <div className="mt-6 flow-root">
            <ul className="-mb-8">
              {/* Event 1: Submitted */}
              <li>
                <div className="relative pb-8">
                  <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                  <div className="relative flex space-x-3">
                    <div>
                      <span className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center ring-8 ring-white text-white">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Complaint Submitted</p>
                        <p className="text-[11px] text-slate-500">Ticket registered with ID {complaint.complaintId}</p>
                      </div>
                      <div className="whitespace-nowrap text-right text-[11px] text-slate-400">
                        {new Date(complaint.submittedAt || complaint.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </li>

              {/* Event 2: Triaged & Assigned */}
              {complaint.triagedAt && (
                <li>
                  <div className="relative pb-8">
                    <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-cyan-600 flex items-center justify-center ring-8 ring-white text-white">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                          </svg>
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Triaged &amp; Categorized</p>
                          <p className="text-[11px] text-slate-500">
                            Assigned to {complaint.departmentId?.name || 'Department'} &bull; Priority: {complaint.priority}
                          </p>
                        </div>
                        <div className="whitespace-nowrap text-right text-[11px] text-slate-400">
                          {new Date(complaint.triagedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )}

              {/* Event 3: Work Started */}
              {complaint.startedAt && (
                <li>
                  <div className="relative pb-8">
                    <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center ring-8 ring-white text-white">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Work in Progress</p>
                          <p className="text-[11px] text-slate-500">Technician started physical repairs/inspection</p>
                        </div>
                        <div className="whitespace-nowrap text-right text-[11px] text-slate-400">
                          {new Date(complaint.startedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )}

              {/* Event 4: Resolved / Verification Requested */}
              {complaint.resolvedAt && (
                <li>
                  <div className="relative pb-8">
                    <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center ring-8 ring-white text-white">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Resolution Submitted</p>
                          <p className="text-[11px] text-slate-500">
                            Technician reported: "{complaint.resolutionNote || 'Completed'}"
                          </p>
                        </div>
                        <div className="whitespace-nowrap text-right text-[11px] text-slate-400">
                          {new Date(complaint.resolvedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )}

              {/* Event 5: Reopened (if rejected) */}
              {complaint.reopenedAt && (
                <li>
                  <div className="relative pb-8">
                    <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-rose-600 flex items-center justify-center ring-8 ring-white text-white">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Resolution Rejected — Reopened</p>
                          <p className="text-[11px] text-slate-500">Student reason: "{complaint.reopenReason}"</p>
                        </div>
                        <div className="whitespace-nowrap text-right text-[11px] text-slate-400">
                          {new Date(complaint.reopenedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )}

              {/* Event 6: Closed (if accepted) */}
              {isClosed && (
                <li>
                  <div className="relative pb-8">
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center ring-8 ring-white text-white">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Complaint Closed</p>
                          <p className="text-[11px] text-slate-500">Student accepted resolution. Issue marked solved.</p>
                        </div>
                        <div className="whitespace-nowrap text-right text-[11px] text-slate-400">
                          {new Date(complaint.closedAt || complaint.verifiedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )}

              {/* Current Active Step if not closed */}
              {!isClosed && (
                <li>
                  <div className="relative pb-8">
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center ring-8 ring-white text-white animate-pulse">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Current Status: {complaint.status?.replace(/_/g, ' ')}</p>
                          <p className="text-[11px] text-slate-500">
                            {isAwaitingVerification
                              ? 'Awaiting your confirmation above.'
                              : `Currently in progress with maintenance staff.`}
                          </p>
                        </div>
                        <div className="whitespace-nowrap text-right text-[11px] text-slate-400">
                          {new Date(complaint.updatedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Location & Ticket Metadata Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Location Verification Details */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
              Location Details
            </h2>

            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[11px] text-slate-500">Hostel</dt>
                <dd className="mt-0.5 text-xs font-semibold text-slate-900">{complaint.hostelId?.name || '-'}</dd>
                <dd className="text-[10px] text-slate-400 uppercase font-mono">{complaint.hostelId?.code}</dd>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[11px] text-slate-500">Block / Wing</dt>
                <dd className="mt-0.5 text-xs font-semibold text-slate-900">{complaint.blockId?.name || '-'}</dd>
                <dd className="text-[10px] text-slate-400 font-mono">{complaint.blockId?.code}</dd>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[11px] text-slate-500">Floor Level</dt>
                <dd className="mt-0.5 text-xs font-semibold text-slate-900">
                  {complaint.floorId?.name || (complaint.floorId?.floorNumber !== undefined ? `Level ${complaint.floorId.floorNumber}` : '-')}
                </dd>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[11px] text-slate-500">Room Number</dt>
                <dd className="mt-0.5 text-xs font-bold text-indigo-700 font-mono">
                  Room {complaint.roomId?.roomNumber || '-'}
                </dd>
              </div>

              {complaint.locationDescription && (
                <div className="col-span-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <dt className="text-[11px] text-slate-500 font-medium">Specific Location Note</dt>
                  <dd className="mt-0.5 text-xs font-semibold text-slate-800">{complaint.locationDescription}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Ticket Information */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
              Registration Meta
            </h2>

            <dl className="mt-4 space-y-3">
              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Submitted By</dt>
                <dd className="font-semibold text-slate-900">{complaint.studentId?.name || 'You'}</dd>
              </div>

              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Student ID / Roll No</dt>
                <dd className="font-mono text-slate-700">{complaint.studentId?.studentId || 'Enrolled'}</dd>
              </div>

              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Assigned Department</dt>
                <dd className="font-medium text-slate-800">
                  {complaint.departmentId ? `${complaint.departmentId.name} (${complaint.departmentId.code})` : 'Triage In Progress'}
                </dd>
              </div>

              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Assigned Technician</dt>
                <dd className="font-medium text-slate-800">
                  {complaint.assignedTo ? complaint.assignedTo.name : 'Pending assignment'}
                </dd>
              </div>

              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Submitted On</dt>
                <dd className="text-slate-700">
                  {new Date(complaint.submittedAt || complaint.createdAt).toLocaleString()}
                </dd>
              </div>

              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Last Status Update</dt>
                <dd className="text-slate-700">
                  {new Date(complaint.updatedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* MODAL 1: ACCEPT VERIFICATION MODAL */}
      <Modal
        isOpen={acceptModalOpen}
        onClose={() => setAcceptModalOpen(false)}
        title="Confirm Issue Resolution"
        subtitle={`Confirm that the issue reported in ticket ${complaint.complaintId} is completely fixed`}
      >
        <form onSubmit={handleAcceptSubmit} className="space-y-4">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900">
            <strong>Important:</strong> By confirming resolution, this complaint will be marked as <strong>CLOSED</strong>. If you encounter issues later, you can submit a new complaint.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Feedback / Verification Note (Optional)
            </label>
            <textarea
              rows={3}
              value={acceptNote}
              onChange={(e) => setAcceptNote(e.target.value)}
              placeholder="E.g., Verified, tap was replaced and working properly now. Thank you!"
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAcceptModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={acceptSubmitting}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {acceptSubmitting ? 'Confirming...' : 'Yes, Confirm & Close Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: REJECT VERIFICATION (REOPEN) MODAL */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reopen Complaint"
        subtitle={`Report that the issue in ticket ${complaint.complaintId} was NOT fixed`}
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900">
            <strong>Mandatory Reason Required:</strong> Please specify what is still unresolved so the maintenance team can properly address it.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Why is the issue not fixed? <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="E.g., The technician visited but the water leakage resumed after 1 hour..."
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-rose-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rejectSubmitting}
              className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {rejectSubmitting ? 'Submitting...' : 'Reject & Reopen Ticket'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}

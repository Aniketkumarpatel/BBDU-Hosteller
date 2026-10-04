import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import Modal from '../../components/common/Modal.jsx';
import studentServicesService from '../../services/studentServicesService.js';
import api from '../../services/api.js';

const NOTICE_CATEGORIES = [
  'ALL',
  'GENERAL',
  'ACADEMIC',
  'HOSTEL',
  'MESS',
  'MAINTENANCE',
  'SECURITY',
  'EVENT',
  'EMERGENCY',
  'FINANCE',
];

const SERVICE_CATEGORIES = [
  'ROOM_CHANGE',
  'HOSTEL_TRANSFER',
  'ID_DOCUMENT',
  'ROOM_INSPECTION',
  'MAINTENANCE_FOLLOWUP',
  'MESS_SERVICE',
  'GENERAL_SERVICE',
  'OTHER',
];

const FEEDBACK_CATEGORIES = [
  'HOSTEL',
  'MESS',
  'CLEANING',
  'MAINTENANCE',
  'SECURITY',
  'COMMUNICATION',
  'OTHER',
];

export default function StudentServicesDashboardPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const isWarden = user?.role === 'WARDEN';
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const isStaff = user?.role === 'HOSTEL_STAFF';
  const canManage = isWarden || isAdmin;

  const [activeTab, setActiveTab] = useState('notices'); // 'notices' | 'requests' | 'contacts' | 'feedback'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Stats
  const [stats, setStats] = useState(null);

  // Notices
  const [notices, setNotices] = useState([]);
  const [noticeCategory, setNoticeCategory] = useState('ALL');
  const [noticeSearch, setNoticeSearch] = useState('');
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [showCreateNoticeModal, setShowCreateNoticeModal] = useState(false);
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    description: '',
    category: 'GENERAL',
    priority: 'NORMAL',
    targetAudience: 'ALL',
    requiresAcknowledgement: false,
    publishAt: '',
    expiresAt: '',
  });

  // Service Requests
  const [requests, setRequests] = useState([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState('');
  const [showCreateRequestModal, setShowCreateRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    category: 'ROOM_CHANGE',
    title: '',
    description: '',
    priority: 'NORMAL',
  });

  // Contacts
  const [contacts, setContacts] = useState([]);
  const [contactCategoryFilter, setContactCategoryFilter] = useState('');
  const [showCreateContactModal, setShowCreateContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    title: '',
    category: 'ADMINISTRATION',
    contactPerson: '',
    phoneNumber: '',
    altPhoneNumber: '',
    email: '',
    availableHours: '24x7',
    location: 'Main Office',
    isEmergency: false,
  });

  // Feedback
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState({
    category: 'HOSTEL',
    rating: 5,
    title: '',
    comment: '',
    isAnonymous: false,
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Hostels list for admin
  const [hostels, setHostels] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsRes, noticesRes, requestsRes, contactsRes, feedbackRes] =
        await Promise.allSettled([
          studentServicesService.getStats(),
          studentServicesService.getNotices({
            category: noticeCategory !== 'ALL' ? noticeCategory : undefined,
            search: noticeSearch || undefined,
          }),
          studentServicesService.getServiceRequests({
            status: requestStatusFilter || undefined,
          }),
          studentServicesService.getContacts({
            category: contactCategoryFilter || undefined,
          }),
          studentServicesService.getFeedback(),
        ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (noticesRes.status === 'fulfilled') setNotices(noticesRes.value.data.notices || []);
      if (requestsRes.status === 'fulfilled') setRequests(requestsRes.value.data.requests || []);
      if (contactsRes.status === 'fulfilled') setContacts(contactsRes.value.data || []);
      if (feedbackRes.status === 'fulfilled') setFeedbacks(feedbackRes.value.data.feedbacks || []);

      if (isAdmin) {
        try {
          const hRes = await api.get('/admin/hostels');
          setHostels(hRes.data.data?.hostels || hRes.data.data || []);
        } catch {
          // Ignore admin hostels error
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error loading student services');
    } finally {
      setLoading(false);
    }
  }, [noticeCategory, noticeSearch, requestStatusFilter, contactCategoryFilter, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Notice Handlers
  const handleAcknowledge = async (noticeId) => {
    try {
      await studentServicesService.acknowledgeNotice(noticeId);
      setActionSuccess('Notice acknowledged successfully!');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to acknowledge notice');
    }
  };

  const handleCreateNoticeSubmit = async (e) => {
    e.preventDefault();
    try {
      await studentServicesService.createNotice(noticeForm);
      setShowCreateNoticeModal(false);
      setNoticeForm({
        title: '',
        description: '',
        category: 'GENERAL',
        priority: 'NORMAL',
        targetAudience: 'ALL',
        requiresAcknowledgement: false,
        publishAt: '',
        expiresAt: '',
      });
      setActionSuccess('Notice published successfully!');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create notice');
    }
  };

  // Service Request Handlers
  const handleCreateRequestSubmit = async (e) => {
    e.preventDefault();
    try {
      await studentServicesService.createServiceRequest(requestForm);
      setShowCreateRequestModal(false);
      setRequestForm({
        category: 'ROOM_CHANGE',
        title: '',
        description: '',
        priority: 'NORMAL',
      });
      setActionSuccess('Service request submitted successfully!');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit service request');
    }
  };

  // Contact Handlers
  const handleCreateContactSubmit = async (e) => {
    e.preventDefault();
    try {
      await studentServicesService.createContact(contactForm);
      setShowCreateContactModal(false);
      setContactForm({
        title: '',
        category: 'ADMINISTRATION',
        contactPerson: '',
        phoneNumber: '',
        altPhoneNumber: '',
        email: '',
        availableHours: '24x7',
        location: 'Main Office',
        isEmergency: false,
      });
      setActionSuccess('Hostel contact added successfully!');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add contact');
    }
  };

  // Feedback Submit
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmittingFeedback(true);
      await studentServicesService.submitFeedback(feedbackForm);
      setFeedbackForm({
        category: 'HOSTEL',
        rating: 5,
        title: '',
        comment: '',
        isAnonymous: false,
      });
      setActionSuccess('Feedback submitted. Thank you for your feedback!');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const priorityBadgeColor = (priority) => {
    switch (priority) {
      case 'EMERGENCY':
        return 'bg-red-100 text-red-800 border-red-200 animate-pulse';
      case 'URGENT':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'HIGH':
      case 'IMPORTANT':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const statusBadgeColor = (status) => {
    switch (status) {
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-800';
      case 'CLOSED':
        return 'bg-slate-100 text-slate-800';
      case 'IN_PROGRESS':
      case 'ASSIGNED':
        return 'bg-indigo-100 text-indigo-800';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Title */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Student Services &amp; Digital Communication
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Official digital notices, student administrative services, emergency contacts &amp; feedback.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={() => setShowCreateNoticeModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700"
              >
                + Post Notice
              </button>
            )}
            {isStudent && (
              <button
                type="button"
                onClick={() => setShowCreateRequestModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700"
              >
                + Request Service
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => setShowCreateContactModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50"
              >
                + Add Contact
              </button>
            )}
          </div>
        </div>

        {/* Action Success Alert */}
        {actionSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {actionSuccess}
          </div>
        )}

        {/* Top Metric Overview Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Notices
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {stats.notices?.activeCount || 0}
                </span>
                {stats.notices?.urgentCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    {stats.notices.urgentCount} Urgent
                  </span>
                )}
              </div>
              {isStudent && stats.notices?.unacknowledgedCount > 0 && (
                <p className="mt-1 text-xs font-medium text-amber-600">
                  {stats.notices.unacknowledgedCount} unacknowledged
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Service Requests
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {stats.serviceRequests?.total || 0}
                </span>
                <span className="text-xs text-slate-500">
                  ({stats.serviceRequests?.submitted || 0} open)
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {stats.serviceRequests?.resolved || 0} resolved / {stats.serviceRequests?.closed || 0} closed
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Emergency Directory
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {stats.emergencyContactsCount || 0}
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  24x7 Available
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Campus &amp; Hostel helpdesks</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Satisfaction Rating
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">
                  {stats.feedback?.averageRating || '—'}
                </span>
                <span className="text-sm font-semibold text-amber-500">★</span>
                <span className="text-xs text-slate-400">/ 5.0</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {stats.feedback?.totalCount || 0} student ratings
              </p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('notices')}
            className={`border-b-2 px-4 py-2.5 transition ${
              activeTab === 'notices'
                ? 'border-indigo-600 font-bold text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Digital Bulletins &amp; Notices ({notices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`border-b-2 px-4 py-2.5 transition ${
              activeTab === 'requests'
                ? 'border-indigo-600 font-bold text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Service Requests ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            className={`border-b-2 px-4 py-2.5 transition ${
              activeTab === 'contacts'
                ? 'border-indigo-600 font-bold text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Emergency &amp; Contacts ({contacts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('feedback')}
            className={`border-b-2 px-4 py-2.5 transition ${
              activeTab === 'feedback'
                ? 'border-indigo-600 font-bold text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Hostel Feedback &amp; Ratings ({feedbacks.length})
          </button>
        </div>

        {/* TAB 1: NOTICES & BULLETINS */}
        {activeTab === 'notices' && (
          <div className="space-y-4">
            {/* Filter controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
                {NOTICE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNoticeCategory(cat)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                      noticeCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search notices..."
                value={noticeSearch}
                onChange={(e) => setNoticeSearch(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {loading ? (
              <div className="py-12"><LoadingSpinner /></div>
            ) : notices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                <p className="text-sm font-medium text-slate-500">No active notices found matching criteria.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {notices.map((n) => (
                  <div
                    key={n._id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:border-indigo-200 hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${priorityBadgeColor(
                            n.priority
                          )}`}
                        >
                          {n.priority}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          {new Date(n.publishAt || n.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <h3 className="mt-2.5 text-base font-bold text-slate-900">{n.title}</h3>
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-600">
                        {n.description || n.message}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                          {n.category}
                        </span>
                        <span>Scope: {n.targetAudience}</span>
                        {n.viewsCount !== undefined && <span>• {n.viewsCount} views</span>}
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => setSelectedNotice(n)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Read Full Bulletin →
                      </button>

                      {isStudent && n.requiresAcknowledgement && (
                        n.hasAcknowledged ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                            ✓ Acknowledged
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAcknowledge(n._id)}
                            className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white shadow-2xs hover:bg-amber-700"
                          >
                            Acknowledge
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SERVICE REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Status:</span>
                {['', 'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setRequestStatusFilter(st)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      requestStatusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st || 'ALL'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="py-12"><LoadingSpinner /></div>
            ) : requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                <p className="text-sm font-medium text-slate-500">No service requests found.</p>
                {isStudent && (
                  <button
                    type="button"
                    onClick={() => setShowCreateRequestModal(true)}
                    className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700"
                  >
                    Submit a Service Request
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Request ID</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Title</th>
                      <th className="px-4 py-3 font-semibold">Requester</th>
                      <th className="px-4 py-3 font-semibold">Assigned Staff</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {requests.map((r) => (
                      <tr key={r._id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-600">{r.requestId}</td>
                        <td className="px-4 py-3 font-medium text-slate-600">{r.category}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{r.title}</td>
                        <td className="px-4 py-3 text-slate-600">{r.studentId?.name || 'Student'}</td>
                        <td className="px-4 py-3 text-slate-600">{r.assignedTo?.name || 'Unassigned'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeColor(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/student-services/requests/${r._id}`}
                            className="font-bold text-indigo-600 hover:text-indigo-900"
                          >
                            View Details →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CONTACT DIRECTORY */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {['', 'EMERGENCY', 'WARDEN', 'SECURITY', 'MAINTENANCE', 'MESS', 'ADMINISTRATION'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setContactCategoryFilter(cat)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    contactCategoryFilter === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat || 'ALL CONTACTS'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-12"><LoadingSpinner /></div>
            ) : contacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                <p className="text-sm font-medium text-slate-500">No contact directory entries available.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {contacts.map((c) => (
                  <div
                    key={c._id}
                    className={`rounded-2xl border p-5 shadow-2xs transition ${
                      c.isEmergency
                        ? 'border-red-200 bg-red-50/20 hover:border-red-300'
                        : 'border-slate-200 bg-white hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                          c.isEmergency ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.category}
                      </span>
                      {c.isEmergency && (
                        <span className="flex h-2 w-2 rounded-full bg-red-600 animate-ping" />
                      )}
                    </div>

                    <h4 className="mt-2.5 text-base font-bold text-slate-900">{c.title}</h4>
                    {c.contactPerson && (
                      <p className="text-xs font-medium text-slate-600">Person: {c.contactPerson}</p>
                    )}

                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      <div>
                        <strong>Hours:</strong> {c.availableHours}
                      </div>
                      <div>
                        <strong>Location:</strong> {c.location}
                      </div>
                      {c.email && (
                        <div>
                          <strong>Email:</strong> {c.email}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <a
                        href={`tel:${c.phoneNumber}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700"
                      >
                        📞 Call {c.phoneNumber}
                      </a>
                      {c.altPhoneNumber && (
                        <span className="text-xs text-slate-400">Alt: {c.altPhoneNumber}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STUDENT FEEDBACK */}
        {activeTab === 'feedback' && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Feedback Submission Form */}
            {isStudent && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-1">
                <h3 className="text-base font-bold text-slate-900">Share Feedback</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Rate hostel operations, cleanliness, security, or food services.
                </p>

                <form onSubmit={handleFeedbackSubmit} className="mt-4 space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Category</label>
                    <select
                      value={feedbackForm.category}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, category: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                    >
                      {FEEDBACK_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Rating (1 to 5 Stars)</label>
                    <div className="mt-1 flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                          className={`h-9 w-9 rounded-xl text-sm font-bold transition ${
                            feedbackForm.rating >= star
                              ? 'bg-amber-400 text-slate-900 shadow-2xs'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Study room internet speed"
                      value={feedbackForm.title}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, title: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Comments</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Provide specific feedback or suggestions..."
                      value={feedbackForm.comment}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, comment: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="anonToggle"
                      checked={feedbackForm.isAnonymous}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, isAnonymous: e.target.checked })}
                      className="rounded-md border-slate-300"
                    />
                    <label htmlFor="anonToggle" className="text-xs text-slate-600">
                      Submit anonymously
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingFeedback}
                    className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </form>
              </div>
            )}

            {/* Past Feedbacks List */}
            <div className={`space-y-4 ${isStudent ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <h3 className="text-base font-bold text-slate-900">Recent Student Feedback &amp; Responses</h3>

              {feedbacks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                  No feedback records found.
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbacks.map((f) => (
                    <div key={f._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-500 font-bold">{'★'.repeat(f.rating)}</span>
                          <span className="text-xs font-bold text-slate-700">({f.rating}/5)</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {f.category}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(f.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="mt-2 text-sm font-bold text-slate-900">{f.title}</h4>
                      <p className="mt-1 text-xs text-slate-600">{f.comment}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        By: {f.studentId?.name || (f.isAnonymous ? 'Anonymous' : 'Student')}
                      </p>

                      {f.responseNote && (
                        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-700">
                          <strong className="text-indigo-600">Administration Response:</strong> {f.responseNote}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: CREATE NOTICE */}
        <Modal
          isOpen={showCreateNoticeModal}
          onClose={() => setShowCreateNoticeModal(false)}
          title="Post Digital Notice / Announcement"
          subtitle="Publish targeted hostel announcements and mandatory bulletins"
        >
          <form onSubmit={handleCreateNoticeSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Notice Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Scheduled Power Maintenance"
                value={noticeForm.title}
                onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Category</label>
                <select
                  value={noticeForm.category}
                  onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  {NOTICE_CATEGORIES.filter((c) => c !== 'ALL').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Priority</label>
                <select
                  value={noticeForm.priority}
                  onChange={(e) => setNoticeForm({ ...noticeForm, priority: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                  <option value="EMERGENCY">EMERGENCY</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Target Audience Scope</label>
              <select
                value={noticeForm.targetAudience}
                onChange={(e) => setNoticeForm({ ...noticeForm, targetAudience: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="ALL">ALL (Campus-Wide)</option>
                <option value="HOSTEL">HOSTEL</option>
                <option value="ROLE">ROLE (Students only)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Notice Content</label>
              <textarea
                rows={4}
                required
                placeholder="Provide detailed announcement information..."
                value={noticeForm.description}
                onChange={(e) => setNoticeForm({ ...noticeForm, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reqAck"
                checked={noticeForm.requiresAcknowledgement}
                onChange={(e) => setNoticeForm({ ...noticeForm, requiresAcknowledgement: e.target.checked })}
                className="rounded border-slate-300"
              />
              <label htmlFor="reqAck" className="text-xs font-medium text-slate-700">
                Require mandatory student acknowledgement
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateNoticeModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Publish Notice
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL: CREATE SERVICE REQUEST */}
        <Modal
          isOpen={showCreateRequestModal}
          onClose={() => setShowCreateRequestModal(false)}
          title="Submit Student Service Request"
          subtitle="Submit administrative requests such as room changes or document renewals"
        >
          <form onSubmit={handleCreateRequestSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Service Category</label>
              <select
                value={requestForm.category}
                onChange={(e) => setRequestForm({ ...requestForm, category: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Title</label>
              <input
                type="text"
                required
                placeholder="Brief summary of your request"
                value={requestForm.title}
                onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Detailed Description</label>
              <textarea
                rows={4}
                required
                placeholder="Explain the background and details of your request..."
                value={requestForm.description}
                onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateRequestModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Submit Request
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL: CREATE CONTACT */}
        <Modal
          isOpen={showCreateContactModal}
          onClose={() => setShowCreateContactModal(false)}
          title="Add Hostel Contact Directory Entry"
          subtitle="Add emergency, caretaker, or department phone numbers"
        >
          <form onSubmit={handleCreateContactSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Desk / Designation Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Night Caretaker Desk"
                value={contactForm.title}
                onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Category</label>
                <select
                  value={contactForm.category}
                  onChange={(e) => setContactForm({ ...contactForm, category: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  {['EMERGENCY', 'WARDEN', 'SECURITY', 'MAINTENANCE', 'MESS', 'ADMINISTRATION'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Contact Person (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Sharma"
                  value={contactForm.contactPerson}
                  onChange={(e) => setContactForm({ ...contactForm, contactPerson: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="+91..."
                  value={contactForm.phoneNumber}
                  onChange={(e) => setContactForm({ ...contactForm, phoneNumber: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Alternate Phone</label>
                <input
                  type="tel"
                  placeholder="Optional"
                  value={contactForm.altPhoneNumber}
                  onChange={(e) => setContactForm({ ...contactForm, altPhoneNumber: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Hours</label>
                <input
                  type="text"
                  placeholder="e.g. 24x7 or 9am - 6pm"
                  value={contactForm.availableHours}
                  onChange={(e) => setContactForm({ ...contactForm, availableHours: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Location</label>
                <input
                  type="text"
                  placeholder="e.g. Main Gate Desk"
                  value={contactForm.location}
                  onChange={(e) => setContactForm({ ...contactForm, location: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="emergencyFlag"
                checked={contactForm.isEmergency}
                onChange={(e) => setContactForm({ ...contactForm, isEmergency: e.target.checked })}
                className="rounded border-slate-300"
              />
              <label htmlFor="emergencyFlag" className="text-xs font-medium text-slate-700">
                Mark as Emergency Contact (Prioritized display)
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateContactModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Save Contact
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL: NOTICE DETAIL VIEW */}
        {selectedNotice && (
          <Modal
            isOpen={Boolean(selectedNotice)}
            onClose={() => setSelectedNotice(null)}
            title={selectedNotice.title}
            subtitle={`Posted on ${new Date(selectedNotice.publishAt || selectedNotice.createdAt).toLocaleDateString()}`}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${priorityBadgeColor(selectedNotice.priority)}`}>
                  {selectedNotice.priority}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  Category: {selectedNotice.category}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  Scope: {selectedNotice.targetAudience}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                {selectedNotice.description || selectedNotice.message}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <div>
                  Posted by: <strong>{selectedNotice.createdBy?.name || 'Administration'}</strong>
                </div>
                {isStudent && selectedNotice.requiresAcknowledgement && (
                  <div>
                    {selectedNotice.hasAcknowledged ? (
                      <span className="font-bold text-emerald-600">✓ Acknowledged</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleAcknowledge(selectedNotice._id);
                          setSelectedNotice(null);
                        }}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700"
                      >
                        Acknowledge Now
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}

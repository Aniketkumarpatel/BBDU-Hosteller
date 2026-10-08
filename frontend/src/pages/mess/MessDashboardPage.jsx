import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import messService from '../../services/messService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';

const MEALS = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const QUALITIES = ['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR', 'VERY_POOR'];

export default function MessDashboardPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const canManage = ['HOSTEL_STAFF', 'WARDEN', 'AUTHORITY', 'SUPER_ADMIN'].includes(user?.role);

  const [activeTab, setActiveTab] = useState("today"); // 'today', 'weekly', 'feedbacks', 'analytics', 'notices'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [messes, setMesses] = useState([]);
  const [selectedMessId, setSelectedMessId] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [weeklyMenus, setWeeklyMenus] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [notices, setNotices] = useState([]);

  // Modals
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMealType, setFeedbackMealType] = useState('LUNCH');
  const [feedbackMealDate, setFeedbackMealDate] = useState(new Date().toISOString().split('T')[0]);
  const [feedbackRating, setFeedbackRating] = useState(4);
  const [feedbackQuality, setFeedbackQuality] = useState('GOOD');
  const [feedbackTaste, setFeedbackTaste] = useState(4);
  const [feedbackHygiene, setFeedbackHygiene] = useState(4);
  const [feedbackQuantity, setFeedbackQuantity] = useState(4);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Menu Modal
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState({
    dayOfWeek: 'MONDAY',
    mealType: 'BREAKFAST',
    itemsText: '',
    notes: '',
    isPublished: true,
  });
  const [savingMenu, setSavingMenu] = useState(false);

  // Notice Modal
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    message: '',
    priority: 'NORMAL',
  });
  const [savingNotice, setSavingNotice] = useState(false);

  const fetchInitial = async () => {
    setLoading(true);
    setError(null);
    try {
      const messRes = await messService.getMesses();
      if (messRes.success && messRes.data.length > 0) {
        setMesses(messRes.data);
        const defaultMess = messRes.data[0];
        setSelectedMessId(defaultMess._id);
        await loadMessDetails(defaultMess._id);
      } else {
        setMesses([]);
        setLoading(false);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error loading mess records');
      setLoading(false);
    }
  };

  const loadMessDetails = async (messId) => {
    try {
      const [dashRes, menusRes, fbRes, analyticsRes, noticesRes] = await Promise.all([
        messService.getMessDashboard({ messId }),
        messService.getMenus(messId),
        messService.getMessFeedbacks({ messId }),
        messService.getFoodQualityAnalytics({ messId }),
        messService.getNotices({ messId }),
      ]);

      if (dashRes.success) setDashboardData(dashRes.data);
      if (menusRes.success) setWeeklyMenus(menusRes.data);
      if (fbRes.success) setFeedbacks(fbRes.data);
      if (analyticsRes.success) setAnalyticsData(analyticsRes.data);
      if (noticesRes.success) setNotices(noticesRes.data);
    } catch (err) {
      console.error('Error refreshing mess content:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitial();
  }, []);

  const handleMessChange = (e) => {
    const id = e.target.value;
    setSelectedMessId(id);
    loadMessDetails(id);
  };

  // Navigation & Date State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const getDayOfWeekFromDate = (dateStr) => {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  const handleDateChange = (newDateStr) => {
    setSelectedDate(newDateStr);
  };

  const changeDateByDays = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // Submit Feedback Handler
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    setFeedbackMsg(null);

    if (!selectedMessId) {
      setFeedbackMsg({
        type: 'error',
        text: 'Mess allocation is not available for your account.',
      });
      setSubmittingFeedback(false);
      return;
    }

    try {
      const res = await messService.submitFeedback({
        messId: selectedMessId,
        mealType: feedbackMealType,
        mealDate: feedbackMealDate || selectedDate,
        rating: Number(feedbackRating),
        foodQuality: feedbackQuality,
        taste: Number(feedbackTaste),
        hygiene: Number(feedbackHygiene),
        quantity: Number(feedbackQuantity),
        comments: feedbackComments,
      });

      if (res.success) {
        setFeedbackMsg({ type: 'success', text: 'Thank you! Meal feedback submitted successfully.' });
        setTimeout(() => {
          setShowFeedbackModal(false);
          setFeedbackMsg(null);
          setFeedbackComments('');
          loadMessDetails(selectedMessId);
        }, 1200);
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err.message || '';
      if (errMsg.toLowerCase().includes('already submitted') || errMsg.toLowerCase().includes('duplicate')) {
        setFeedbackMsg({
          type: 'error',
          text: 'You have already submitted feedback for this meal on this date.',
        });
      } else {
        setFeedbackMsg({
          type: 'error',
          text: errMsg || 'Error submitting meal feedback',
        });
      }
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Save Menu Handler (Supports Save Draft or Publish Menu)
  const handleSaveMenu = async (e, publishStatus = true) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingMenu(true);
    try {
      const items = menuForm.itemsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((name) => ({ name, category: 'Main Course' }));

      await messService.createOrUpdateMenu(selectedMessId, {
        dayOfWeek: menuForm.dayOfWeek,
        mealType: menuForm.mealType,
        menuItems: items,
        notes: menuForm.notes,
        isPublished: publishStatus,
      });

      setShowMenuModal(false);
      setMenuForm({
        dayOfWeek: 'MONDAY',
        mealType: 'BREAKFAST',
        itemsText: '',
        notes: '',
        isPublished: true,
      });
      loadMessDetails(selectedMessId);
    } catch (err) {
      alert(err?.response?.data?.message || 'Error saving menu');
    } finally {
      setSavingMenu(false);
    }
  };

  // Toggle Publish
  const handleTogglePublish = async (menu) => {
    try {
      if (menu.isPublished) {
        await messService.unpublishMenu(menu._id);
      } else {
        await messService.publishMenu(menu._id);
      }
      loadMessDetails(selectedMessId);
    } catch (err) {
      alert('Error updating publication status');
    }
  };

  // Post Notice Handler
  const handlePostNotice = async (e) => {
    e.preventDefault();
    setSavingNotice(true);
    try {
      await messService.createNotice({
        messId: selectedMessId,
        title: noticeForm.title,
        message: noticeForm.message,
        priority: noticeForm.priority,
      });
      setShowNoticeModal(false);
      setNoticeForm({ title: '', message: '', priority: 'NORMAL' });
      loadMessDetails(selectedMessId);
    } catch (err) {
      alert(err?.response?.data?.message || 'Error creating notice');
    } finally {
      setSavingNotice(false);
    }
  };

  const stats = dashboardData?.stats || {};
  const currentMess = messes.find((m) => m._id === selectedMessId) || dashboardData?.mess;
  const activeDayOfWeek = getDayOfWeekFromDate(selectedDate);

  // Helper to find menu for day of week & meal type
  const getMenuForMeal = (meal) => {
    // Look in weeklyMenus first
    const found = weeklyMenus.find(
      (m) => m.dayOfWeek === activeDayOfWeek && m.mealType === meal
    );
    if (found) return found;

    // Fallback to todayMenu if dates match today
    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedDate === todayStr && dashboardData?.todayMenu?.[meal]) {
      return dashboardData.todayMenu[meal];
    }
    return null;
  };

  return (
    <DashboardLayout
      title="Mess & Dining Management"
      roleLabel={user?.role}
    >
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading meal records and menus..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchInitial} />
      ) : (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {currentMess ? currentMess.name : 'Hostel Dining Hall'}
                </h1>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                  {currentMess?.code || 'ACTIVE'}
                </span>
                {currentMess?.hostelId?.name && (
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {currentMess.hostelId.name}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Daily catering schedule, food quality monitoring, hygiene compliance, and student feedback.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {messes.length > 1 && (
                <select
                  value={selectedMessId}
                  onChange={handleMessChange}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs focus:ring-2 focus:ring-indigo-500"
                >
                  {messes.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.code})
                    </option>
                  ))}
                </select>
              )}

              {isStudent && (
                <>
                  <button
                    onClick={() => {
                      setFeedbackMealType('LUNCH');
                      setFeedbackMealDate(selectedDate);
                      setShowFeedbackModal(true);
                    }}
                    className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 flex items-center gap-1.5"
                  >
                    <span>★</span> Rate Meal
                  </button>
                  <Link
                    to="/student/complaints/new"
                    className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 shadow-xs hover:bg-rose-100 flex items-center gap-1.5"
                  >
                    <span>⚠</span> Report Mess Issue
                  </Link>
                </>
              )}

              {canManage && (
                <>
                  <button
                    onClick={() => {
                      setMenuForm({
                        dayOfWeek: activeDayOfWeek,
                        mealType: 'BREAKFAST',
                        itemsText: '',
                        notes: '',
                        isPublished: true,
                      });
                      setShowMenuModal(true);
                    }}
                    className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700"
                  >
                    + Add Menu
                  </button>
                  <button
                    onClick={() => setShowNoticeModal(true)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                  >
                    + Post Notice
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Active Notices Banner */}
          {notices.length > 0 && (
            <div className="space-y-2">
              {notices.slice(0, 2).map((n) => (
                <div
                  key={n._id}
                  className={`flex items-start justify-between rounded-xl p-4 border text-xs ${
                    n.priority === 'URGENT'
                      ? 'border-rose-300 bg-rose-50/70 text-rose-900'
                      : n.priority === 'IMPORTANT'
                      ? 'border-amber-300 bg-amber-50/70 text-amber-900'
                      : 'border-blue-200 bg-blue-50/70 text-blue-900'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base">📢</span>
                    <div>
                      <p className="font-bold">{n.title}</p>
                      <p className="mt-0.5 text-slate-600">{n.message}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <p className="text-xs font-semibold uppercase text-slate-500">Average Rating</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {stats.averageRating ? `${stats.averageRating}` : '—'}
                </span>
                <span className="text-xs text-amber-500 font-bold">/ 5.0 ★</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">{stats.totalFeedbacks || 0} reviews recorded</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
              <p className="text-xs font-semibold uppercase text-emerald-700">Hygiene Score</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-950">
                  {stats.avgHygiene ? `${stats.avgHygiene}` : '—'}
                </span>
                <span className="text-xs text-emerald-600 font-bold">/ 5.0</span>
              </div>
              <div className="mt-1">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    stats.hygieneStatus === 'HEALTHY'
                      ? 'bg-emerald-200 text-emerald-800'
                      : stats.hygieneStatus === 'HYGIENE_ATTENTION_REQUIRED'
                      ? 'bg-amber-200 text-amber-800 animate-pulse'
                      : 'bg-rose-200 text-rose-800 animate-pulse'
                  }`}
                >
                  {stats.hygieneStatus?.replace(/_/g, ' ') || 'HEALTHY'}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-xs">
              <p className="text-xs font-semibold uppercase text-indigo-700">Taste & Quality</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-indigo-950">
                  {stats.avgTaste ? `${stats.avgTaste}` : '—'}
                </span>
                <span className="text-xs text-indigo-500 font-bold">/ 5.0</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Portion size: {stats.avgQuantity ? `${stats.avgQuantity}/5` : '—'}
              </p>
            </div>

            <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 shadow-xs">
              <p className="text-xs font-semibold uppercase text-purple-700">Mess Complaints</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-purple-950">
                  {dashboardData?.complaints?.open || 0}
                </span>
                <span className="text-xs text-purple-600 font-semibold">Open issues</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {dashboardData?.complaints?.resolved || 0} resolved this month
              </p>
            </div>
          </div>

          {/* Date Selector Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Select Date:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => changeDateByDays(-1)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  ◄ Previous Day
                </button>
                <button
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    selectedDate === new Date().toISOString().split('T')[0]
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => changeDateByDays(1)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Next Day ►
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
              <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 uppercase">
                {activeDayOfWeek}
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-200">
            <nav className="flex space-x-6 overflow-x-auto text-xs font-semibold">
              <button
                onClick={() => setActiveTab('today')}
                className={`pb-3 border-b-2 transition ${
                  activeTab === 'today'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Today's Mess Menu ({activeDayOfWeek})
              </button>
              <button
                onClick={() => setActiveTab('weekly')}
                className={`pb-3 border-b-2 transition ${
                  activeTab === 'weekly'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Menu Management &amp; Timetable
              </button>
              <button
                onClick={() => setActiveTab('feedbacks')}
                className={`pb-3 border-b-2 transition ${
                  activeTab === 'feedbacks'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Student Feedbacks ({feedbacks.length})
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`pb-3 border-b-2 transition ${
                  activeTab === 'analytics'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Operational &amp; Hygiene Analytics
              </button>
              <button
                onClick={() => setActiveTab('notices')}
                className={`pb-3 border-b-2 transition ${
                  activeTab === 'notices'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Mess Notices ({notices.length})
              </button>
            </nav>
          </div>

          {/* TAB 1: TODAY'S MESS MENU (4 AUTOMATIC MEAL CARDS) */}
          {activeTab === 'today' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                  TODAY'S MESS MENU — <span className="text-indigo-600 font-extrabold">{selectedDate} ({activeDayOfWeek})</span>
                </h2>
                <span className="text-xs text-slate-500">
                  {isStudent ? 'Published menus for your allocated mess' : 'Live Resident View'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {MEALS.map((meal) => {
                  const rawMenu = getMenuForMeal(meal);
                  // For students, ONLY published menus are visible!
                  const mealMenu = isStudent ? (rawMenu?.isPublished ? rawMenu : null) : rawMenu;
                  
                  const mealLabels = {
                    BREAKFAST: 'Breakfast',
                    LUNCH: 'Lunch',
                    SNACKS: 'Snacks',
                    DINNER: 'Dinner',
                  };

                  const mealTimings = {
                    BREAKFAST: '07:30 AM – 09:30 AM',
                    LUNCH: '12:30 PM – 02:30 PM',
                    SNACKS: '04:30 PM – 06:00 PM',
                    DINNER: '07:30 PM – 09:30 PM',
                  }[meal];

                  return (
                    <div
                      key={meal}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-200 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wide">
                              {mealLabels[meal]}
                            </h3>
                            <span className="text-[10px] text-slate-400">{mealTimings}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              mealMenu?.isPublished
                                ? 'bg-emerald-100 text-emerald-800'
                                : rawMenu
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {mealMenu?.isPublished ? 'Published' : rawMenu ? 'Draft (Hidden from students)' : 'Unscheduled'}
                          </span>
                        </div>

                        <div className="mt-3.5 space-y-2">
                          {mealMenu?.menuItems && mealMenu.menuItems.length > 0 ? (
                            mealMenu.menuItems.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0"
                              >
                                <span className="font-bold text-slate-800">{item.name}</span>
                                <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                  {item.category || 'Item'}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="py-6 text-center">
                              <p className="text-xs text-slate-400 italic">No menu published for this meal.</p>
                            </div>
                          )}
                        </div>

                        {mealMenu?.notes && (
                          <p className="mt-3 text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                            {mealMenu.notes}
                          </p>
                        )}
                      </div>

                      {isStudent && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                          {mealMenu ? (
                            <button
                              onClick={() => {
                                setFeedbackMealType(meal);
                                setFeedbackMealDate(selectedDate);
                                setShowFeedbackModal(true);
                              }}
                              className="w-full rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition flex items-center justify-center gap-1.5 shadow-2xs"
                            >
                              <span>⭐</span> Rate {mealLabels[meal]}
                            </button>
                          ) : (
                            <button
                              disabled
                              className="w-full rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed"
                            >
                              Rating Unavailable
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: MENU MANAGEMENT & TIMETABLE */}
          {activeTab === 'weekly' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">7-Day Menu Schedule &amp; Management</h3>
                  <p className="text-xs text-slate-500">View, edit drafts, and publish menus for all meal services.</p>
                </div>
                {canManage && (
                  <button
                    onClick={() => {
                      setMenuForm({
                        dayOfWeek: activeDayOfWeek,
                        mealType: 'BREAKFAST',
                        itemsText: '',
                        notes: '',
                        isPublished: true,
                      });
                      setShowMenuModal(true);
                    }}
                    className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
                  >
                    + Add Menu
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-3">Day of Week</th>
                      <th className="px-4 py-3">Meal Type</th>
                      <th className="px-4 py-3">Menu Offerings</th>
                      <th className="px-4 py-3">Status</th>
                      {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {weeklyMenus.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          No menu items configured for this mess.
                        </td>
                      </tr>
                    ) : (
                      weeklyMenus.map((menu) => (
                        <tr key={menu._id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-bold text-slate-800">{menu.dayOfWeek}</td>
                          <td className="px-4 py-3 font-semibold text-indigo-700">{menu.mealType}</td>
                          <td className="px-4 py-3 max-w-md">
                            <div className="flex flex-wrap gap-1.5">
                              {menu.menuItems?.map((it, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]"
                                >
                                  {it.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                menu.isPublished
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {menu.isPublished ? 'Published' : 'Draft'}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setMenuForm({
                                    dayOfWeek: menu.dayOfWeek,
                                    mealType: menu.mealType,
                                    itemsText: menu.menuItems?.map((i) => i.name).join('\n') || '',
                                    notes: menu.notes || '',
                                    isPublished: menu.isPublished,
                                  });
                                  setShowMenuModal(true);
                                }}
                                className="px-2.5 py-1 rounded text-[11px] font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleTogglePublish(menu)}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                                  menu.isPublished
                                    ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                                    : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >
                                {menu.isPublished ? 'Unpublish' : 'Publish'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: STUDENT FEEDBACKS */}
          {activeTab === 'feedbacks' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Student Dining Reviews</h3>
                  <p className="text-xs text-slate-500">Live resident feedback on taste, hygiene, and portions.</p>
                </div>
              </div>

              {feedbacks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No meal reviews submitted yet. Be the first to rate!
                </div>
              ) : (
                <div className="divide-y divide-slate-100 space-y-3">
                  {feedbacks.map((fb) => (
                    <div key={fb._id} className="pt-3 first:pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">
                            {fb.studentId?.name || 'Resident Student'}
                          </span>
                          <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {fb.mealType}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              fb.foodQuality === 'EXCELLENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : fb.foodQuality === 'POOR' || fb.foodQuality === 'VERY_POOR'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {fb.foodQuality}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                          {'★'.repeat(fb.rating)}
                          <span className="text-slate-400 text-[10px] ml-1">
                            {new Date(fb.mealDate || fb.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1 flex items-center gap-4 text-[11px] text-slate-500">
                        <span>Taste: {fb.taste}/5</span>
                        <span>•</span>
                        <span>Hygiene: {fb.hygiene}/5</span>
                        <span>•</span>
                        <span>Portion: {fb.quantity}/5</span>
                      </div>

                      {fb.comments && (
                        <p className="mt-1.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          "{fb.comments}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: OPERATIONAL & HYGIENE ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Meal-by-Meal Performance Grid */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="font-bold text-sm text-slate-900 mb-1">Meal Satisfaction Breakdown</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Metrics calculated across all authenticated student ratings.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {MEALS.map((meal) => {
                    const data = analyticsData?.mealRatings?.[meal] || { avgRating: 0, count: 0 };
                    return (
                      <div
                        key={meal}
                        className={`rounded-lg border p-4 ${
                          data.needsAttention
                            ? 'border-rose-300 bg-rose-50/50'
                            : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800">{meal}</span>
                          {data.needsAttention && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                              Needs Attention
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold text-slate-900">
                            {data.avgRating ? data.avgRating : '—'}
                          </span>
                          <span className="text-xs text-amber-500 font-bold">★</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{data.count} evaluations</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recurring Issues & Complaints Table */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="font-bold text-sm text-slate-900 mb-1">Repeated Food &amp; Mess Complaints</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Root operational challenges logged in the Complaint Engine for this dining facility.
                </p>

                {analyticsData?.repeatedIssues?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No complaints recorded for this mess.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                        <tr>
                          <th className="px-4 py-2.5">Issue Category</th>
                          <th className="px-4 py-2.5">Total Reports</th>
                          <th className="px-4 py-2.5">Open Complaints</th>
                          <th className="px-4 py-2.5">Latest Occurrence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analyticsData?.repeatedIssues?.map((issue, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-2.5 font-bold text-slate-800">{issue.issueType}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900">{issue.count}</td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  issue.openCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {issue.openCount} open
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">
                              {issue.latestOccurrence
                                ? new Date(issue.latestOccurrence).toLocaleDateString()
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: NOTICES */}
          {activeTab === 'notices' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Official Mess Notices &amp; Bulletins</h3>
                  <p className="text-xs text-slate-500">Announcements regarding timings, special menus, and closures.</p>
                </div>
                {canManage && (
                  <button
                    onClick={() => setShowNoticeModal(true)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
                  >
                    + Post Notice
                  </button>
                )}
              </div>

              {notices.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No notices posted for this mess.</p>
              ) : (
                <div className="divide-y divide-slate-100 space-y-3">
                  {notices.map((n) => (
                    <div key={n._id} className="pt-3 first:pt-0 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-slate-900">{n.title}</h4>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              n.priority === 'URGENT'
                                ? 'bg-rose-100 text-rose-800'
                                : n.priority === 'IMPORTANT'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {n.priority}
                          </span>
                          {!n.isActive && (
                            <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-700">{n.message}</p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          Posted by {n.createdBy?.name || 'Staff'} on {new Date(n.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {canManage && (
                        <button
                          onClick={async () => {
                            await messService.toggleNoticeActive(n._id, !n.isActive);
                            loadMessDetails(selectedMessId);
                          }}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          {n.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STUDENT FEEDBACK MODAL */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Rate Meal Quality</h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            {feedbackMsg && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs font-semibold ${
                  feedbackMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {feedbackMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmitFeedback} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Meal Service *</label>
                <select
                  value={feedbackMealType}
                  onChange={(e) => setFeedbackMealType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-medium"
                >
                  {MEALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Meal Date *</label>
                <input
                  type="date"
                  value={feedbackMealDate}
                  onChange={(e) => setFeedbackMealDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-medium"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Overall Rating (1 to 5 Stars)</label>
                <div className="mt-1 flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className={`h-9 w-9 rounded-lg font-bold text-sm transition ${
                        feedbackRating >= star
                          ? 'bg-amber-400 text-white'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Food Quality Category</label>
                <select
                  value={feedbackQuality}
                  onChange={(e) => setFeedbackQuality(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-medium"
                >
                  {QUALITIES.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Taste (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={feedbackTaste}
                    onChange={(e) => setFeedbackTaste(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-center"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Hygiene (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={feedbackHygiene}
                    onChange={(e) => setFeedbackHygiene(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-center"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Portion (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={feedbackQuantity}
                    onChange={(e) => setFeedbackQuantity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-center"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Comments &amp; Suggestions</label>
                <textarea
                  rows="2"
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  placeholder="Share feedback on seasoning, freshness, or hygiene..."
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700"
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / MANAGE MENU MODAL */}
      {showMenuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Create / Edit Mess Menu</h3>
              <button onClick={() => setShowMenuModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={(e) => handleSaveMenu(e, menuForm.isPublished)} className="mt-4 space-y-4 text-xs">
              {messes.length > 0 && (
                <div>
                  <label className="font-semibold text-slate-700">Mess Facility *</label>
                  <select
                    value={selectedMessId}
                    onChange={handleMessChange}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-medium"
                  >
                    {messes.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Day of Week *</label>
                  <select
                    value={menuForm.dayOfWeek}
                    onChange={(e) => setMenuForm({ ...menuForm, dayOfWeek: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Meal Type *</label>
                  <select
                    value={menuForm.mealType}
                    onChange={(e) => setMenuForm({ ...menuForm, mealType: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  >
                    {MEALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Menu Items * (One per line)</label>
                <textarea
                  rows="4"
                  value={menuForm.itemsText}
                  onChange={(e) => setMenuForm({ ...menuForm, itemsText: e.target.value })}
                  placeholder="Aloo Paratha&#10;Fresh Curd&#10;Masala Tea"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Special Notes</label>
                <input
                  type="text"
                  value={menuForm.notes}
                  onChange={(e) => setMenuForm({ ...menuForm, notes: e.target.value })}
                  placeholder="e.g. Sweet dish served on festival day"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMenuModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingMenu}
                  onClick={(e) => handleSaveMenu(e, false)}
                  className="rounded-lg border border-indigo-300 bg-indigo-50 px-3.5 py-2 font-bold text-indigo-700 hover:bg-indigo-100"
                >
                  {savingMenu ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  disabled={savingMenu}
                  onClick={(e) => handleSaveMenu(e, true)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700"
                >
                  {savingMenu ? 'Publishing...' : 'Publish Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NOTICE MODAL */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Post Mess Notice</h3>
              <button onClick={() => setShowNoticeModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handlePostNotice} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Notice Title</label>
                <input
                  type="text"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  placeholder="e.g. Breakfast timing changed on Sunday"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Priority Level</label>
                <select
                  value={noticeForm.priority}
                  onChange={(e) => setNoticeForm({ ...noticeForm, priority: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="IMPORTANT">IMPORTANT</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Announcement Details</label>
                <textarea
                  rows="3"
                  value={noticeForm.message}
                  onChange={(e) => setNoticeForm({ ...noticeForm, message: e.target.value })}
                  placeholder="Provide details about timings, changes, or maintenance..."
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNoticeModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNotice}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700"
                >
                  {savingNotice ? 'Posting...' : 'Post Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

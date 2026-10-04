import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import cleaningService from '../../services/cleaningService.js';
import api from '../../services/api.js';

const AREA_TYPES = [
  'ROOM',
  'WASHROOM',
  'CORRIDOR',
  'STAIRCASE',
  'COMMON_ROOM',
  'STUDY_AREA',
  'LOBBY',
  'OUTDOOR',
  'MESS_ADJACENT',
  'OTHER',
];

const CLEANING_TYPES = [
  'ROUTINE',
  'DEEP_CLEANING',
  'SANITIZATION',
  'WASHROOM_CLEANING',
  'WASTE_COLLECTION',
  'COMMON_AREA_CLEANING',
  'INSPECTION_CLEANING',
  'OTHER',
];

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'];

export default function CleaningDashboardPage() {
  const { user } = useAuth();
  const isSupervisor = ['WARDEN', 'AUTHORITY', 'SUPER_ADMIN'].includes(user?.role);
  const isStaff = user?.role === 'HOSTEL_STAFF';

  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks', 'areas', 'plans', 'workload'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Core Data
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [areas, setAreas] = useState([]);
  const [plans, setPlans] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // Filters
  const [selectedHostel, setSelectedHostel] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [activeTaskForComplete, setActiveTaskForComplete] = useState(null);
  const [completionChecklist, setCompletionChecklist] = useState([]);
  const [completionNote, setCompletionNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [activeTaskForVerify, setActiveTaskForVerify] = useState(null);
  const [qualityScore, setQualityScore] = useState(5);
  const [verificationNote, setVerificationNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    cleaningAreaId: '',
    title: '',
    cleaningType: 'ROUTINE',
    priority: 'MEDIUM',
    assignedTo: '',
    dueAtHours: 4,
  });

  const [showCreateAreaModal, setShowCreateAreaModal] = useState(false);
  const [areaForm, setAreaForm] = useState({
    name: '',
    areaType: 'ROOM',
    hostelId: '',
    locationDescription: '',
    priority: 'MEDIUM',
    notes: '',
  });

  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '',
    cleaningAreaId: '',
    cleaningType: 'ROUTINE',
    frequency: 'DAILY',
    frequencyInterval: 1,
    frequencyUnit: 'DAYS',
    preferredAssigneeId: '',
    estimatedDurationMinutes: 30,
  });

  // Action status message
  const [actionMsg, setActionMsg] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = selectedHostel ? { hostelId: selectedHostel } : {};
      const [statsRes, tasksRes, areasRes, plansRes, hostelsRes, usersRes] = await Promise.all([
        cleaningService.getDashboardStats(params),
        cleaningService.getTasks({
          ...params,
          status: taskStatusFilter || undefined,
          search: searchQuery || undefined,
          all: isSupervisor ? 'true' : undefined,
        }),
        cleaningService.getAreas(params),
        cleaningService.getPlans(params),
        api.get('/admin/hostels').catch(() => ({ data: { data: [] } })),
        api.get('/admin/users?role=HOSTEL_STAFF').catch(() => ({ data: { data: [] } })),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (tasksRes.success) setTasks(tasksRes.data);
      if (areasRes.success) setAreas(areasRes.data);
      if (plansRes.success) setPlans(plansRes.data);

      if (hostelsRes?.data?.data) {
        setHostels(hostelsRes.data.data);
        if (!selectedHostel && hostelsRes.data.data.length > 0 && user?.hostelId) {
          setSelectedHostel(user.hostelId);
        }
      }

      if (usersRes?.data?.data) {
        setStaffList(usersRes.data.data);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error loading housekeeping data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedHostel, taskStatusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleTriggerScheduler = async () => {
    try {
      setSubmittingAction(true);
      const res = await cleaningService.runScheduler();
      setActionMsg({
        type: 'success',
        text: `Scheduler run: ${res.data.tasksGenerated} tasks generated, ${res.data.tasksMarkedOverdue} marked overdue.`,
      });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Error running scheduler',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleTaskAction = async (taskId, action, payload = {}) => {
    try {
      setSubmittingAction(true);
      if (action === 'accept') await cleaningService.acceptTask(taskId);
      if (action === 'start') await cleaningService.startTask(taskId);
      if (action === 'hold') await cleaningService.holdTask(taskId, payload);
      if (action === 'resume') await cleaningService.resumeTask(taskId);
      if (action === 'cancel') await cleaningService.cancelTask(taskId, payload);

      setActionMsg({ type: 'success', text: `Task ${action}ed successfully.` });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || `Failed to ${action} task`,
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const openCompleteModal = (task) => {
    setActiveTaskForComplete(task);
    setCompletionChecklist(
      task.checklist && task.checklist.length > 0
        ? task.checklist.map((c) => ({ ...c, isCompleted: Boolean(c.isCompleted) }))
        : [{ item: 'Area cleaned and sanitized', isCompleted: true, note: '' }]
    );
    setCompletionNote('');
    setShowCompleteModal(true);
  };

  const submitCompleteTask = async (e) => {
    e.preventDefault();
    if (!activeTaskForComplete) return;
    try {
      setSubmittingAction(true);
      await cleaningService.completeTask(activeTaskForComplete._id, {
        checklist: completionChecklist,
        completionNote,
      });
      setShowCompleteModal(false);
      setActionMsg({
        type: 'success',
        text: `Task ${activeTaskForComplete.taskId} completed and queued for verification.`,
      });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Failed to complete task',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const openVerifyModal = (task) => {
    setActiveTaskForVerify(task);
    setQualityScore(5);
    setVerificationNote('');
    setIsRejecting(false);
    setRejectionReason('');
    setShowVerifyModal(true);
  };

  const submitVerifyOrReject = async (e) => {
    e.preventDefault();
    if (!activeTaskForVerify) return;
    try {
      setSubmittingAction(true);
      if (isRejecting) {
        if (!rejectionReason.trim()) {
          setActionMsg({ type: 'error', text: 'Rejection reason is required' });
          return;
        }
        await cleaningService.rejectTask(activeTaskForVerify._id, { rejectionReason });
        setActionMsg({
          type: 'success',
          text: `Task ${activeTaskForVerify.taskId} rejected and returned to staff for rework.`,
        });
      } else {
        await cleaningService.verifyTask(activeTaskForVerify._id, {
          qualityScore,
          verificationNote,
        });
        setActionMsg({
          type: 'success',
          text: `Task ${activeTaskForVerify.taskId} verified with quality score ${qualityScore}/5.`,
        });
      }
      setShowVerifyModal(false);
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Verification failed',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const submitCreateTask = async (e) => {
    e.preventDefault();
    try {
      setSubmittingAction(true);
      const dueAt = new Date(Date.now() + (taskForm.dueAtHours || 4) * 60 * 60 * 1000);
      await cleaningService.createTask({
        cleaningAreaId: taskForm.cleaningAreaId,
        title: taskForm.title,
        cleaningType: taskForm.cleaningType,
        priority: taskForm.priority,
        assignedTo: taskForm.assignedTo || undefined,
        dueAt,
      });
      setShowCreateTaskModal(false);
      setTaskForm({
        cleaningAreaId: '',
        title: '',
        cleaningType: 'ROUTINE',
        priority: 'MEDIUM',
        assignedTo: '',
        dueAtHours: 4,
      });
      setActionMsg({ type: 'success', text: 'Cleaning task created successfully.' });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Error creating task',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const submitCreateArea = async (e) => {
    e.preventDefault();
    try {
      setSubmittingAction(true);
      await cleaningService.createArea(areaForm);
      setShowCreateAreaModal(false);
      setAreaForm({
        name: '',
        areaType: 'ROOM',
        hostelId: '',
        locationDescription: '',
        priority: 'MEDIUM',
        notes: '',
      });
      setActionMsg({ type: 'success', text: 'Cleaning area registered successfully.' });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Error creating area',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const submitCreatePlan = async (e) => {
    e.preventDefault();
    try {
      setSubmittingAction(true);
      await cleaningService.createPlan(planForm);
      setShowCreatePlanModal(false);
      setPlanForm({
        name: '',
        cleaningAreaId: '',
        cleaningType: 'ROUTINE',
        frequency: 'DAILY',
        frequencyInterval: 1,
        frequencyUnit: 'DAYS',
        preferredAssigneeId: '',
        estimatedDurationMinutes: 30,
      });
      setActionMsg({ type: 'success', text: 'Recurring cleaning plan created.' });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Error creating plan',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status, isOverdue, isMissed) => {
    if (isMissed || status === 'MISSED') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">MISSED</span>;
    }
    if (isOverdue) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">OVERDUE</span>;
    }
    const styles = {
      CREATED: 'bg-slate-100 text-slate-800',
      ASSIGNED: 'bg-blue-100 text-blue-800',
      ACCEPTED: 'bg-indigo-100 text-indigo-800',
      IN_PROGRESS: 'bg-sky-100 text-sky-800',
      ON_HOLD: 'bg-amber-100 text-amber-800',
      COMPLETED: 'bg-emerald-100 text-emerald-800',
      VERIFIED: 'bg-green-100 text-green-900 font-bold',
      CANCELLED: 'bg-gray-200 text-gray-700',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <DashboardLayout title="Cleaning & Housekeeping Management" roleLabel={user?.role}>
      <div className="space-y-6">
        {/* Banner & Actions Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Housekeeping &amp; Sanitation Control</h2>
            <p className="text-xs text-slate-500 mt-1">
              Real-time monitoring, checklist inspections, quality scores, and recurring schedules across hostels.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hostels.length > 0 && (
              <select
                value={selectedHostel}
                onChange={(e) => setSelectedHostel(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Hostels</option>
                {hostels.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
              </select>
            )}

            {isSupervisor && (
              <>
                <button
                  onClick={handleTriggerScheduler}
                  disabled={submittingAction}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
                  title="Run background batch worker for task generation & overdue detection"
                >
                  ⚡ Run Scheduler
                </button>
                <button
                  onClick={() => setShowCreateAreaModal(true)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  + Add Area
                </button>
                <button
                  onClick={() => setShowCreatePlanModal(true)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  + Recurring Plan
                </button>
              </>
            )}

            <button
              onClick={() => setShowCreateTaskModal(true)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
            >
              + New Cleaning Task
            </button>
          </div>
        </div>

        {/* Action Alert Banner */}
        {actionMsg && (
          <div
            className={`p-4 rounded-lg text-xs font-medium flex items-center justify-between ${
              actionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{actionMsg.text}</span>
            <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
        )}

        {/* Operational KPI Metric Cards */}
        {stats?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tasks Today</span>
              <div className="text-xl font-bold text-slate-800 mt-1">{stats.summary.tasksToday}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{stats.summary.completedToday} completed</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Verified Tasks</span>
              <div className="text-xl font-bold text-emerald-600 mt-1">{stats.summary.verifiedToday}</div>
              <div className="text-[10px] text-emerald-500 mt-0.5">{stats.summary.verificationRate}% verification rate</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">In Progress</span>
              <div className="text-xl font-bold text-sky-600 mt-1">{stats.summary.inProgressToday}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Active cleaning runs</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Overdue / Missed</span>
              <div className="text-xl font-bold text-rose-600 mt-1">
                {stats.summary.totalOverdue} <span className="text-xs text-rose-400 font-normal">/ {stats.summary.totalMissed}</span>
              </div>
              <div className="text-[10px] text-rose-500 mt-0.5">SLA / window breach</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Quality Score</span>
              <div className="text-xl font-bold text-amber-500 mt-1">
                ★ {stats.summary.avgQualityScore} <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Supervisor inspections</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Areas &amp; Plans</span>
              <div className="text-xl font-bold text-indigo-600 mt-1">{stats.summary.totalAreas}</div>
              <div className="text-[10px] text-indigo-400 mt-0.5">{stats.summary.activePlans} active plans</div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-4">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'tasks' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🧹 Cleaning Tasks ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('areas')}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'areas' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📍 Cleaning Areas ({areas.length})
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'plans' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📅 Recurring Plans ({plans.length})
            </button>
            <button
              onClick={() => setActiveTab('workload')}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'workload' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              👥 Staff Workload &amp; Quality
            </button>
          </nav>
        </div>

        {/* TAB 1: CLEANING TASKS */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
              <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search task ID or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 w-full sm:w-64 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 transition"
                >
                  Search
                </button>
              </form>

              <div className="flex gap-2 w-full sm:w-auto">
                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
                >
                  <option value="">All Statuses</option>
                  <option value="CREATED">Created</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="MISSED">Missed</option>
                </select>
              </div>
            </div>

            {/* Tasks Table / Cards */}
            {loading ? (
              <LoadingSpinner />
            ) : tasks.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                No cleaning tasks found matching your criteria.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Task ID</th>
                        <th className="px-4 py-3">Location &amp; Area</th>
                        <th className="px-4 py-3">Type &amp; Priority</th>
                        <th className="px-4 py-3">Assignee</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Due Time</th>
                        <th className="px-4 py-3">Quality</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {tasks.map((task) => (
                        <tr key={task._id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{task.taskId}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{task.title}</div>
                            <div className="text-[11px] text-slate-400">
                              {task.cleaningAreaId?.name || 'Area'} &bull; {task.hostelId?.name || 'Hostel'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-medium text-slate-600">{task.cleaningType}</span>
                            <span
                              className={`ml-1.5 inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                task.priority === 'CRITICAL'
                                  ? 'bg-rose-100 text-rose-700'
                                  : task.priority === 'HIGH'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {task.assignedTo ? (
                              <div>
                                <div className="font-medium">{task.assignedTo.name}</div>
                                <div className="text-[10px] text-slate-400">{task.assignedTo.role}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(task.status, task.isOverdue, task.isMissed)}</td>
                          <td className="px-4 py-3 text-slate-500">
                            {new Date(task.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            <div className="text-[10px] text-slate-400">{new Date(task.dueAt).toLocaleDateString()}</div>
                          </td>
                          <td className="px-4 py-3">
                            {task.qualityScore ? (
                              <span className="text-amber-500 font-bold">★ {task.qualityScore}/5</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-1">
                            {/* Staff Actions */}
                            {task.status === 'ASSIGNED' && (
                              <button
                                onClick={() => handleTaskAction(task._id, 'accept')}
                                className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium text-[11px]"
                              >
                                Accept
                              </button>
                            )}
                            {task.status === 'ACCEPTED' && (
                              <button
                                onClick={() => handleTaskAction(task._id, 'start')}
                                className="px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium text-[11px]"
                              >
                                Start Work
                              </button>
                            )}
                            {task.status === 'IN_PROGRESS' && (
                              <>
                                <button
                                  onClick={() => openCompleteModal(task)}
                                  className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-medium text-[11px]"
                                >
                                  Complete
                                </button>
                                <button
                                  onClick={() => handleTaskAction(task._id, 'hold')}
                                  className="px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium text-[11px]"
                                >
                                  Hold
                                </button>
                              </>
                            )}
                            {task.status === 'ON_HOLD' && (
                              <button
                                onClick={() => handleTaskAction(task._id, 'resume')}
                                className="px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium text-[11px]"
                              >
                                Resume
                              </button>
                            )}

                            {/* Supervisor Verification Actions */}
                            {task.status === 'COMPLETED' && isSupervisor && (
                              <button
                                onClick={() => openVerifyModal(task)}
                                className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 font-semibold text-[11px]"
                              >
                                Inspect &amp; Verify
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CLEANING AREAS */}
        {activeTab === 'areas' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {areas.map((area) => (
                <div key={area._id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-semibold text-slate-500">{area.areaId}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                        {area.areaType}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm mt-1">{area.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {area.hostelId?.name} {area.blockId?.name ? `• ${area.blockId.name}` : ''}{' '}
                      {area.floorId?.floorNumber !== undefined ? `• Floor ${area.floorId.floorNumber}` : ''}
                    </p>
                    {area.locationDescription && (
                      <p className="text-[11px] text-slate-400 mt-1 italic">"{area.locationDescription}"</p>
                    )}

                    {/* Standard Checklist Preview */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Default Checklist ({area.customChecklist?.length || 0})
                      </span>
                      <ul className="mt-1 space-y-1">
                        {area.customChecklist?.slice(0, 3).map((item, idx) => (
                          <li key={idx} className="text-[11px] text-slate-600 flex items-center gap-1.5">
                            <span className="text-emerald-500">✓</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 flex items-center justify-between text-[11px]">
                    <span className={`font-semibold ${area.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {area.isActive ? '● Active Area' : '○ Inactive'}
                    </span>
                    <button
                      onClick={() => {
                        setTaskForm((prev) => ({ ...prev, cleaningAreaId: area._id }));
                        setShowCreateTaskModal(true);
                      }}
                      className="text-indigo-600 font-semibold hover:underline"
                    >
                      + Schedule Clean
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: RECURRING PLANS */}
        {activeTab === 'plans' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Plan ID</th>
                      <th className="px-4 py-3">Schedule Name</th>
                      <th className="px-4 py-3">Area Location</th>
                      <th className="px-4 py-3">Frequency</th>
                      <th className="px-4 py-3">Preferred Assignee</th>
                      <th className="px-4 py-3">Next Due</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {plans.map((plan) => (
                      <tr key={plan._id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{plan.planId}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{plan.name}</td>
                        <td className="px-4 py-3 text-slate-600">{plan.cleaningAreaId?.name || 'Area'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800">
                            {plan.frequency} ({plan.frequencyInterval} {plan.frequencyUnit})
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {plan.preferredAssigneeId ? plan.preferredAssigneeId.name : <span className="text-slate-400">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {new Date(plan.nextDueAt).toLocaleDateString()} {new Date(plan.nextDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${plan.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            {plan.isActive ? 'Active' : 'Paused'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: STAFF WORKLOAD */}
        {activeTab === 'workload' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs p-5">
              <h3 className="font-bold text-slate-800 text-sm mb-4">Today's Staff Workload &amp; Resolution Performance</h3>
              {stats?.staffWorkload && stats.staffWorkload.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.staffWorkload.map((staff) => {
                    const percent =
                      staff.totalTasks > 0 ? Math.round((staff.completedTasks / staff.totalTasks) * 100) : 0;
                    return (
                      <div key={staff.staffId} className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-800 text-sm">{staff.name}</h4>
                          <span className="text-[11px] text-slate-500">{staff.email}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                          <span>
                            Completed: <strong>{staff.completedTasks}</strong> / {staff.totalTasks} tasks
                          </span>
                          <span className="font-bold text-indigo-700">{percent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No staff assignments recorded for today.</p>
              )}
            </div>
          </div>
        )}

        {/* MODAL: COMPLETE TASK WITH CHECKLIST */}
        {showCompleteModal && activeTaskForComplete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Complete Task: {activeTaskForComplete.taskId}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Verify each checklist action item before submitting completion.
              </p>

              <form onSubmit={submitCompleteTask} className="mt-4 space-y-4">
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {completionChecklist.map((item, index) => (
                    <label
                      key={index}
                      className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={item.isCompleted}
                        onChange={(e) => {
                          const updated = [...completionChecklist];
                          updated[index].isCompleted = e.target.checked;
                          setCompletionChecklist(updated);
                        }}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="text-xs text-slate-700">{item.item}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Completion Notes / Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value)}
                    placeholder="e.g. Disinfected all fixtures, mopped dry, supplies replenished."
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCompleteModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                  >
                    Submit Completion
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: SUPERVISOR VERIFICATION & QUALITY SCORING */}
        {showVerifyModal && activeTaskForVerify && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Supervisor Quality Inspection: {activeTaskForVerify.taskId}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Area: {activeTaskForVerify.title} &bull; Performed by:{' '}
                {activeTaskForVerify.assignedTo?.name || 'Staff'}
              </p>

              <form onSubmit={submitVerifyOrReject} className="mt-4 space-y-4">
                <div className="flex items-center gap-4 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="decision"
                      checked={!isRejecting}
                      onChange={() => setIsRejecting(false)}
                      className="text-green-600"
                    />
                    Approve &amp; Verify
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="decision"
                      checked={isRejecting}
                      onChange={() => setIsRejecting(true)}
                      className="text-rose-600"
                    />
                    Reject for Rework
                  </label>
                </div>

                {!isRejecting ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Cleanliness Quality Score (1 to 5 Stars)
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setQualityScore(star)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                              qualityScore >= star
                                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            ★ {star}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Verification Inspection Note
                      </label>
                      <textarea
                        rows={2}
                        value={verificationNote}
                        onChange={(e) => setVerificationNote(e.target.value)}
                        placeholder="e.g. Spotless and well-sanitized. High standard maintained."
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-rose-700 mb-1">
                      Reason for Rejection (Required)
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Washbasins still streaked, waste bin not lined, floor requires second scrub."
                      className="w-full rounded-lg border border-rose-300 p-2 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowVerifyModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-xs ${
                      isRejecting ? 'bg-rose-600 hover:bg-rose-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isRejecting ? 'Reject & Send Rework' : 'Confirm Verification'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE MANUAL TASK */}
        {showCreateTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Create Cleaning Task</h3>
              <form onSubmit={submitCreateTask} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cleaning Area *</label>
                  <select
                    required
                    value={taskForm.cleaningAreaId}
                    onChange={(e) => setTaskForm({ ...taskForm, cleaningAreaId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  >
                    <option value="">Select Area</option>
                    {areas.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name} ({a.areaType})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Task Title</label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="Leave blank for automatic title"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cleaning Type</label>
                    <select
                      value={taskForm.cleaningType}
                      onChange={(e) => setTaskForm({ ...taskForm, cleaningType: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    >
                      {CLEANING_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Staff</label>
                    <select
                      value={taskForm.assignedTo}
                      onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    >
                      <option value="">Unassigned</option>
                      {staffList.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Window (Hours)</label>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={taskForm.dueAtHours}
                      onChange={(e) => setTaskForm({ ...taskForm, dueAtHours: parseInt(e.target.value, 10) || 4 })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateTaskModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE AREA */}
        {showCreateAreaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Register Cleaning Area</h3>
              <form onSubmit={submitCreateArea} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Area Name *</label>
                  <input
                    type="text"
                    required
                    value={areaForm.name}
                    onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                    placeholder="e.g. Block A Floor 2 East Washroom"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Area Type *</label>
                    <select
                      value={areaForm.areaType}
                      onChange={(e) => setAreaForm({ ...areaForm, areaType: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    >
                      {AREA_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hostel *</label>
                    <select
                      required
                      value={areaForm.hostelId}
                      onChange={(e) => setAreaForm({ ...areaForm, hostelId: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    >
                      <option value="">Select Hostel</option>
                      {hostels.map((h) => (
                        <option key={h._id} value={h._id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location Details</label>
                  <input
                    type="text"
                    value={areaForm.locationDescription}
                    onChange={(e) => setAreaForm({ ...areaForm, locationDescription: e.target.value })}
                    placeholder="e.g. Adjacent to staircase, near Room 204"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateAreaModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                  >
                    Save Area
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE RECURRING PLAN */}
        {showCreatePlanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Create Recurring Cleaning Schedule</h3>
              <form onSubmit={submitCreatePlan} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    placeholder="e.g. Daily Corridor Deep Clean"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Area *</label>
                  <select
                    required
                    value={planForm.cleaningAreaId}
                    onChange={(e) => setPlanForm({ ...planForm, cleaningAreaId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  >
                    <option value="">Select Area</option>
                    {areas.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency</label>
                    <select
                      value={planForm.frequency}
                      onChange={(e) => setPlanForm({ ...planForm, frequency: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Staff</label>
                    <select
                      value={planForm.preferredAssigneeId}
                      onChange={(e) => setPlanForm({ ...planForm, preferredAssigneeId: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    >
                      <option value="">Unassigned</option>
                      {staffList.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreatePlanModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                  >
                    Activate Schedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

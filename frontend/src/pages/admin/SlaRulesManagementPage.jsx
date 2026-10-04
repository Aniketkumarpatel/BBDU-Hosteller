import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  listSlaRules,
  createSlaRule,
  updateSlaRule,
  toggleSlaRuleStatus,
  triggerScheduler,
} from '../../services/slaService.js';
import { listDepartments } from '../../services/departmentService.js';

const COMPLAINT_CATEGORIES = [
  'ELECTRICAL',
  'PLUMBING',
  'CLEANING',
  'MESS',
  'INTERNET',
  'FURNITURE',
  'SECURITY',
  'ROOM',
  'WATER',
  'OTHER',
];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function SlaRulesManagementPage() {
  const [rules, setRules] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [schedulerMessage, setSchedulerMessage] = useState(null);
  const [runningScheduler, setRunningScheduler] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    priority: 'MEDIUM',
    category: '',
    departmentId: '',
    initialResponseHours: 2,
    resolutionHours: 48,
    reminderThresholdPercent: 75,
    escalationEnabled: true,
    escalationAfterHours: 0,
    isActive: true,
  });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rulesRes, deptsRes] = await Promise.all([
        listSlaRules({
          priority: priorityFilter || undefined,
          search: search || undefined,
        }),
        listDepartments(),
      ]);
      setRules(rulesRes.data || []);
      setDepartments(deptsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load SLA rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [priorityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenCreateModal = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      priority: 'MEDIUM',
      category: '',
      departmentId: '',
      initialResponseHours: 2,
      resolutionHours: 48,
      reminderThresholdPercent: 75,
      escalationEnabled: true,
      escalationAfterHours: 0,
      isActive: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      code: rule.code,
      description: rule.description || '',
      priority: rule.priority,
      category: rule.category || '',
      departmentId: rule.departmentId?._id || rule.departmentId || '',
      initialResponseHours: rule.initialResponseHours || 2,
      resolutionHours: rule.resolutionHours,
      reminderThresholdPercent: rule.reminderThresholdPercent || 75,
      escalationEnabled: rule.escalationEnabled !== false,
      escalationAfterHours: rule.escalationAfterHours || 0,
      isActive: rule.isActive !== false,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleToggleStatus = async (rule) => {
    try {
      await toggleSlaRuleStatus(rule._id, !rule.isActive);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to change status');
    }
  };

  const handleRunScheduler = async () => {
    try {
      setRunningScheduler(true);
      setSchedulerMessage(null);
      const res = await triggerScheduler();
      setSchedulerMessage(
        `Scheduler cycle complete: ${res.data?.processedCount || 0} active SLA tickets checked, ${
          res.data?.escalationsTriggered || 0
        } escalated, ${res.data?.remindersRecorded || 0} reminders flagged.`
      );
      loadData();
    } catch (err) {
      setSchedulerMessage('Scheduler run error: ' + (err.response?.data?.message || err.message));
    } finally {
      setRunningScheduler(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Rule Name and Code are required');
      return;
    }

    if (Number(formData.resolutionHours) <= 0) {
      setFormError('Resolution duration must be greater than 0 hours');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        code: formData.code.trim().toUpperCase(),
        category: formData.category || null,
        departmentId: formData.departmentId || null,
        initialResponseHours: Number(formData.initialResponseHours),
        resolutionHours: Number(formData.resolutionHours),
        reminderThresholdPercent: Number(formData.reminderThresholdPercent),
        escalationAfterHours: Number(formData.escalationAfterHours),
      };

      if (editingRule) {
        await updateSlaRule(editingRule._id, payload);
      } else {
        await createSlaRule(payload);
      }

      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save SLA rule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <Link
          to="/admin/sla-config"
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
        >
          &larr; Global SLA Control
        </Link>
        <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
          SLA Rules Catalog
        </span>
        <Link
          to="/admin/escalation-rules"
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
        >
          Escalation Matrix Rules &rarr;
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">SLA Rules Management</h1>
          <p className="text-sm text-slate-500">
            Configure resolution deadlines, reminder thresholds, and automated breach escalation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRunScheduler}
            disabled={runningScheduler}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 text-indigo-600 ${runningScheduler ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {runningScheduler ? 'Evaluating SLA...' : 'Run Scheduler Now'}
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add SLA Rule
          </button>
        </div>
      </div>

      {schedulerMessage && (
        <div className="rounded-lg bg-indigo-50 p-4 text-xs font-medium text-indigo-900 border border-indigo-200 flex items-center justify-between">
          <span>{schedulerMessage}</span>
          <button onClick={() => setSchedulerMessage(null)} className="text-indigo-500 hover:text-indigo-800">
            ✕
          </button>
        </div>
      )}

      {/* Filters and Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by rule name or code..."
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
          >
            Search
          </button>
        </form>
      </div>

      {/* Rules Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading configured SLA rules...</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600">{error}</div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No SLA rules found. Click "Add SLA Rule" to create one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Rule Name & Code</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Scope (Cat / Dept)</th>
                  <th className="px-4 py-3">Resolution Target</th>
                  <th className="px-4 py-3">Reminder Threshold</th>
                  <th className="px-4 py-3">Escalation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rules.map((rule) => (
                  <tr key={rule._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{rule.name}</div>
                      <span className="font-mono text-[10px] text-slate-400">{rule.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        rule.priority === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : rule.priority === 'HIGH'
                          ? 'bg-amber-100 text-amber-800'
                          : rule.priority === 'MEDIUM'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {rule.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{rule.category || 'All Categories'}</div>
                      <span className="text-[10px] text-slate-400">
                        {rule.departmentId?.name || 'All Departments'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {rule.resolutionHours} hours
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {rule.reminderThresholdPercent}% ({rule.reminderThresholdHours || +(rule.resolutionHours * (rule.reminderThresholdPercent / 100)).toFixed(1)}h)
                    </td>
                    <td className="px-4 py-3">
                      {rule.escalationEnabled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(rule)}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          rule.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(rule)}
                        className="font-medium text-indigo-600 hover:text-indigo-900 mr-2"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 my-8">
            <h3 className="text-lg font-bold text-slate-900">
              {editingRule ? 'Edit SLA Rule' : 'Create New SLA Rule'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify operational resolution duration and reminder triggers
            </p>

            {formError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Rule Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Critical Safety SLA"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Rule Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    disabled={!!editingRule}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SLA-SAFETY-01"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs uppercase disabled:bg-slate-100 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Priority Level *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Category Scope</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="">All Categories (Wildcard)</option>
                    {COMPLAINT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Department Scope</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                >
                  <option value="">All Departments (Wildcard)</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Resolution Hours *</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    required
                    value={formData.resolutionHours}
                    onChange={(e) => setFormData({ ...formData, resolutionHours: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400">Total duration allowed before SLA breach</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Reminder Threshold %</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={formData.reminderThresholdPercent}
                    onChange={(e) => setFormData({ ...formData, reminderThresholdPercent: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400">e.g. 75% flags ticket approaching deadline</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="escalationEnabled"
                  checked={formData.escalationEnabled}
                  onChange={(e) => setFormData({ ...formData, escalationEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="escalationEnabled" className="text-xs font-semibold text-slate-800">
                  Enable Automatic Escalation upon Breach
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isActive" className="text-xs font-semibold text-slate-800">
                  Rule Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  listEscalationRules,
  createEscalationRule,
  updateEscalationRule,
  toggleEscalationRuleStatus,
} from '../../services/slaService.js';
import { listDepartments } from '../../services/departmentService.js';
import { listHostels } from '../../services/hostelService.js';

const ROLES_LIST = [
  { value: 'HOSTEL_STAFF', label: 'Hostel Maintenance Staff' },
  { value: 'WARDEN', label: 'Hostel Warden' },
  { value: 'AUTHORITY', label: 'Chief Authority / Dean' },
  { value: 'SUPER_ADMIN', label: 'Super Administrator' },
];

export default function EscalationRulesManagementPage() {
  const [rules, setRules] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    escalationLevel: 1,
    fromRole: 'HOSTEL_STAFF',
    toRole: 'WARDEN',
    nextAuthorityRole: 'WARDEN',
    resolutionHours: 24,
    escalationAfterHours: 0,
    hostelId: '',
    isActive: true,
  });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rulesRes, hostelsRes, deptsRes] = await Promise.all([
        listEscalationRules(),
        listHostels(),
        listDepartments(),
      ]);
      setRules(rulesRes.data || []);
      setHostels(hostelsRes.data || []);
      setDepartments(deptsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load Escalation rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      code: '',
      escalationLevel: (rules.length || 0) + 1,
      fromRole: 'HOSTEL_STAFF',
      toRole: 'WARDEN',
      nextAuthorityRole: 'WARDEN',
      resolutionHours: 24,
      escalationAfterHours: 0,
      hostelId: '',
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
      escalationLevel: rule.escalationLevel,
      fromRole: rule.fromRole,
      toRole: rule.toRole,
      nextAuthorityRole: rule.nextAuthorityRole || rule.toRole,
      resolutionHours: rule.resolutionHours || 24,
      escalationAfterHours: rule.escalationAfterHours || 0,
      hostelId: rule.hostelId?._id || rule.hostelId || '',
      isActive: rule.isActive !== false,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleToggleStatus = async (rule) => {
    try {
      await toggleEscalationRuleStatus(rule._id, !rule.isActive);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update rule status');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Rule Name and Code are required');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        code: formData.code.trim().toUpperCase(),
        escalationLevel: Number(formData.escalationLevel),
        resolutionHours: Number(formData.resolutionHours),
        escalationAfterHours: Number(formData.escalationAfterHours),
        hostelId: formData.hostelId || null,
      };

      if (editingRule) {
        await updateEscalationRule(editingRule._id, payload);
      } else {
        await createEscalationRule(payload);
      }

      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save Escalation rule');
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
        <Link
          to="/admin/sla-rules"
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
        >
          SLA Rules Catalog
        </Link>
        <span className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
          Escalation Matrix Rules
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Escalation Rules & Authority Hierarchy
          </h1>
          <p className="text-sm text-slate-500">
            Configure automated routing chains when SLA deadlines are breached
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 self-start sm:self-auto"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Escalation Level
        </button>
      </div>

      {/* Visual Hierarchy Cards */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
          Configured Escalation Hierarchy Flow
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border-2 border-indigo-100 bg-indigo-50/50 p-4 relative">
            <span className="inline-block rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              Level 1
            </span>
            <h4 className="mt-2 text-sm font-bold text-slate-900">Staff &rarr; Warden</h4>
            <p className="text-xs text-slate-600 mt-1">
              Initial handler fails SLA deadline &rarr; ticket escalates directly to the assigned Hostel Warden.
            </p>
          </div>

          <div className="rounded-xl border-2 border-amber-100 bg-amber-50/50 p-4 relative">
            <span className="inline-block rounded-md bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              Level 2
            </span>
            <h4 className="mt-2 text-sm font-bold text-slate-900">Warden &rarr; Authority</h4>
            <p className="text-xs text-slate-600 mt-1">
              Warden fails secondary SLA cycle &rarr; ticket escalates to Campus Chief Authority / Dean.
            </p>
          </div>

          <div className="rounded-xl border-2 border-rose-100 bg-rose-50/50 p-4 relative">
            <span className="inline-block rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              Level 3
            </span>
            <h4 className="mt-2 text-sm font-bold text-slate-900">Authority &rarr; Super Admin</h4>
            <p className="text-xs text-slate-600 mt-1">
              Highest campus authority escalation &rarr; directly flags executive Super Administrator queue.
            </p>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading escalation hierarchy...</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600">{error}</div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No escalation rules found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Rule Name & Code</th>
                  <th className="px-4 py-3">Current Handler (From)</th>
                  <th className="px-4 py-3">Escalated To (Next Authority)</th>
                  <th className="px-4 py-3">New Cycle Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rules.map((rule) => (
                  <tr key={rule._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-bold text-indigo-700">
                      Level {rule.escalationLevel}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{rule.name}</div>
                      <span className="font-mono text-[10px] text-slate-400">{rule.code}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                        {rule.fromRole}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded bg-amber-50 px-2 py-0.5 font-bold text-amber-800 border border-amber-200">
                        &rarr; {rule.toRole || rule.nextAuthorityRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {rule.resolutionHours || 24} hours
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
                        className="font-medium text-indigo-600 hover:text-indigo-900"
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 my-8">
            <h3 className="text-lg font-bold text-slate-900">
              {editingRule ? 'Edit Escalation Rule' : 'Create Escalation Rule'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Define source role and target supervisory authority
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
                    placeholder="e.g. Level 1 Staff to Warden"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Rule Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingRule}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. ESC-LVL1"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs uppercase disabled:bg-slate-100 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Level *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.escalationLevel}
                    onChange={(e) => setFormData({ ...formData, escalationLevel: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">From Role *</label>
                  <select
                    value={formData.fromRole}
                    onChange={(e) => setFormData({ ...formData, fromRole: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  >
                    {ROLES_LIST.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Escalate To Role *</label>
                  <select
                    value={formData.toRole}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        toRole: e.target.value,
                        nextAuthorityRole: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  >
                    {ROLES_LIST.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">New Cycle SLA (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.resolutionHours}
                    onChange={(e) => setFormData({ ...formData, resolutionHours: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400">Duration allocated to the new authority</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Hostel Scope</label>
                  <select
                    value={formData.hostelId}
                    onChange={(e) => setFormData({ ...formData, hostelId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="">All Hostels</option>
                    {hostels.map((h) => (
                      <option key={h._id} value={h._id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="escActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="escActive" className="text-xs font-semibold text-slate-800">
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

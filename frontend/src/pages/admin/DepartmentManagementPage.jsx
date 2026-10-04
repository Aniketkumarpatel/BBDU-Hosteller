import { useState, useEffect, useMemo } from 'react';
import departmentService from '../../services/departmentService.js';
import DataTable from '../../components/common/DataTable.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
import FilterSelect from '../../components/common/FilterSelect.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Modal from '../../components/common/Modal.jsx';
import ConfirmationDialog from '../../components/common/ConfirmationDialog.jsx';
import FormField from '../../components/common/FormField.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';

const INITIAL_FORM = {
  name: '',
  code: '',
  description: '',
  isActive: true,
};

export default function DepartmentManagementPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await departmentService.getAllDepartments();
      if (res.success) {
        setDepartments(res.data);
      } else {
        setError(res.message || 'Failed to load departments');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error fetching departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.code.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === ''
          ? true
          : statusFilter === 'active'
          ? d.isActive
          : !d.isActive;

      return matchesSearch && matchesStatus;
    });
  }, [departments, search, statusFilter]);

  const handleOpenCreate = () => {
    setEditingDepartment(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dept) => {
    setEditingDepartment(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      isActive: dept.isActive,
    });
    setFormErrors({});
    setActionError(null);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Department name is required';
    if (!formData.code.trim()) errs.code = 'Department code is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setActionError(null);
    try {
      if (editingDepartment) {
        await departmentService.updateDepartment(editingDepartment._id, formData);
      } else {
        await departmentService.createDepartment(formData);
      }
      setIsModalOpen(false);
      fetchDepartments();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (dept) => {
    setActionError(null);
    try {
      await departmentService.toggleDepartmentStatus(dept._id);
      fetchDepartments();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Failed to update status');
    }
  };

  const handleOpenDelete = (dept) => {
    setDepartmentToDelete(dept);
    setActionError(null);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!departmentToDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await departmentService.deleteDepartment(departmentToDelete._id);
      setDeleteConfirmOpen(false);
      setDepartmentToDelete(null);
      fetchDepartments();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      header: 'Department Name',
      accessor: 'name',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.name}</div>
          {row.description && <div className="text-[11px] text-slate-500 truncate max-w-sm">{row.description}</div>}
        </div>
      ),
    },
    {
      header: 'Code',
      accessor: 'code',
      render: (row) => <span className="font-mono text-xs font-bold text-slate-800">{row.code}</span>,
    },
    {
      header: 'Assigned Members',
      accessor: 'memberCount',
      render: (row) => <span className="font-semibold text-indigo-700">{row.memberCount ?? 0}</span>,
    },
    {
      header: 'Status',
      accessor: 'isActive',
      render: (row) => <StatusBadge status={row.isActive} />,
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handleToggleStatus(row)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title={row.isActive ? 'Deactivate' : 'Activate'}
          >
            {row.isActive ? (
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleOpenEdit(row)}
            className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
            title="Edit Department"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleOpenDelete(row)}
            className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            title="Delete Department"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" message="Loading departments..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Department Error" message={error} onRetry={fetchDepartments} />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Department Management</h1>
          <p className="text-xs text-slate-500">Manage academic disciplines and facility service departments.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Department
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
          {actionError}
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Search department name or code..." />
        </div>
        <div className="w-36">
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All Status"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredDepartments}
        emptyMessage="No departments found matching your criteria."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDepartment ? 'Edit Department' : 'Create New Department'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Department Name" required error={formErrors.name}>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              placeholder="e.g. Electrical Maintenance"
            />
          </FormField>

          <FormField label="Department Code" required error={formErrors.code}>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase focus:border-indigo-500 focus:outline-hidden"
              placeholder="e.g. ELEC"
            />
          </FormField>

          <FormField label="Description">
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              placeholder="Brief description of department scope..."
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveDept"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isActiveDept" className="text-xs font-medium text-slate-700">
              Department is active
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingDepartment ? 'Update Department' : 'Create Department'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Department"
        message={`Are you sure you want to delete department "${departmentToDelete?.name}" (${departmentToDelete?.code})? Departments with registered members cannot be deleted.`}
        confirmText={deleting ? 'Deleting...' : 'Delete Department'}
        type="danger"
      />
    </div>
  );
}

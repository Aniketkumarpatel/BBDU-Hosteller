import { useState, useEffect, useMemo } from 'react';
import hostelService from '../../services/hostelService.js';
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
  type: 'BOYS',
  address: '',
  description: '',
  isActive: true,
};

export default function HostelManagementPage() {
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHostel, setEditingHostel] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [hostelToDelete, setHostelToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchHostels = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hostelService.getAllHostels();
      if (res.success) {
        setHostels(res.data);
      } else {
        setError(res.message || 'Failed to load hostels');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error fetching hostels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHostels();
  }, []);

  const filteredHostels = useMemo(() => {
    return hostels.filter((h) => {
      const matchesSearch =
        h.name.toLowerCase().includes(search.toLowerCase()) ||
        h.code.toLowerCase().includes(search.toLowerCase());
      const matchesType = !typeFilter || h.type === typeFilter;
      const matchesStatus =
        statusFilter === ''
          ? true
          : statusFilter === 'active'
          ? h.isActive
          : !h.isActive;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [hostels, search, typeFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingHostel(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (hostel) => {
    setEditingHostel(hostel);
    setFormData({
      name: hostel.name,
      code: hostel.code,
      type: hostel.type,
      address: hostel.address || '',
      description: hostel.description || '',
      isActive: hostel.isActive,
    });
    setFormErrors({});
    setActionError(null);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Hostel name is required';
    if (!formData.code.trim()) errs.code = 'Hostel code is required';
    if (!['BOYS', 'GIRLS', 'COED'].includes(formData.type)) errs.type = 'Invalid hostel type';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setActionError(null);
    try {
      if (editingHostel) {
        await hostelService.updateHostel(editingHostel._id, formData);
      } else {
        await hostelService.createHostel(formData);
      }
      setIsModalOpen(false);
      fetchHostels();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (hostel) => {
    setActionError(null);
    try {
      await hostelService.toggleHostelStatus(hostel._id);
      fetchHostels();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Failed to toggle status');
    }
  };

  const handleOpenDelete = (hostel) => {
    setHostelToDelete(hostel);
    setActionError(null);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!hostelToDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await hostelService.deleteHostel(hostelToDelete._id);
      setDeleteConfirmOpen(false);
      setHostelToDelete(null);
      fetchHostels();
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      header: 'Hostel Name',
      accessor: 'name',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.name}</div>
          {row.description && <div className="text-[11px] text-slate-500 truncate max-w-xs">{row.description}</div>}
        </div>
      ),
    },
    {
      header: 'Code',
      accessor: 'code',
      render: (row) => <span className="font-mono text-xs font-bold text-slate-800">{row.code}</span>,
    },
    {
      header: 'Type',
      accessor: 'type',
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
            row.type === 'BOYS'
              ? 'bg-blue-100 text-blue-700'
              : row.type === 'GIRLS'
              ? 'bg-rose-100 text-rose-700'
              : 'bg-purple-100 text-purple-700'
          }`}
        >
          {row.type}
        </span>
      ),
    },
    {
      header: 'Blocks',
      accessor: 'blocksCount',
      render: (row) => <span className="font-semibold text-slate-800">{row.blocksCount ?? 0}</span>,
    },
    {
      header: 'Rooms',
      accessor: 'roomsCount',
      render: (row) => <span className="font-semibold text-slate-800">{row.roomsCount ?? 0}</span>,
    },
    {
      header: 'Capacity',
      accessor: 'capacity',
      render: (row) => <span>{row.capacity ?? 0} beds</span>,
    },
    {
      header: 'Occupancy',
      accessor: 'occupancy',
      render: (row) => {
        const occRate = row.capacity > 0 ? Math.round(((row.occupancy || 0) / row.capacity) * 100) : 0;
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-indigo-700">{row.occupancy ?? 0}</span>
            <span className="text-[11px] text-slate-400">({occRate}%)</span>
          </div>
        );
      },
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
            title="Edit Hostel"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleOpenDelete(row)}
            className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            title="Delete Hostel"
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
        <LoadingSpinner size="lg" message="Loading hostels..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Hostel Error" message={error} onRetry={fetchHostels} />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hostel Management</h1>
          <p className="text-xs text-slate-500">Configure university residences, bed capacities, and operational status.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Hostel
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
          <SearchInput value={search} onChange={setSearch} placeholder="Search hostel name or code..." />
        </div>
        <div className="w-36">
          <FilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="All Types"
            options={[
              { value: 'BOYS', label: 'Boys' },
              { value: 'GIRLS', label: 'Girls' },
              { value: 'COED', label: 'Coed' },
            ]}
          />
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

      {/* Hostels Data Table */}
      <DataTable
        columns={columns}
        data={filteredHostels}
        emptyMessage="No hostels found matching your criteria."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingHostel ? 'Edit Hostel' : 'Create New Hostel'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Hostel Name" required error={formErrors.name}>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              placeholder="e.g. Tagore Boys Hostel"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Hostel Code" required error={formErrors.code}>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase focus:border-indigo-500 focus:outline-hidden"
                placeholder="e.g. TBH-1"
              />
            </FormField>

            <FormField label="Accommodation Type" required error={formErrors.type}>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="BOYS">Boys</option>
                <option value="GIRLS">Girls</option>
                <option value="COED">Coed</option>
              </select>
            </FormField>
          </div>

          <FormField label="Address / Campus Location">
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              placeholder="e.g. North Campus, Sector 4"
            />
          </FormField>

          <FormField label="Description">
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              placeholder="Brief description or facilities..."
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveHostel"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isActiveHostel" className="text-xs font-medium text-slate-700">
              Hostel is operational and active
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
              {submitting ? 'Saving...' : editingHostel ? 'Update Hostel' : 'Create Hostel'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Hostel"
        message={`Are you sure you want to delete hostel "${hostelToDelete?.name}" (${hostelToDelete?.code})? This action cannot be undone. Hostels with existing blocks or students cannot be deleted.`}
        confirmText={deleting ? 'Deleting...' : 'Delete Hostel'}
        type="danger"
      />
    </div>
  );
}

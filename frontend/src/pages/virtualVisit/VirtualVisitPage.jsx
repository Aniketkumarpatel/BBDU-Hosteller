import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import virtualVisitService from '../../services/virtualVisitService.js';
import PanoramaViewer from '../../components/virtualVisit/PanoramaViewer.jsx';
import RoomDetailsModal from '../../components/virtualVisit/RoomDetailsModal.jsx';

export default function VirtualVisitPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    hostels: [],
    blocks: [],
    floors: [],
    rooms: [],
    stats: {
      totalRooms: 0,
      availableRooms: 0,
      fullRooms: 0,
      totalCapacity: 0,
      occupiedBeds: 0,
      availableBeds: 0,
    },
  });

  // 1. Hostel Filter ("All Hostels" option)
  const [selectedHostel, setSelectedHostel] = useState('all');

  // 2. Block Filter (Block C & D = Juniors, Block A & B = Seniors)
  const [selectedBlock, setSelectedBlock] = useState('all');
  const [selectedBlockCategory, setSelectedBlockCategory] = useState('all'); // 'all', 'SENIORS', 'JUNIORS'

  // 3. Floor Filter (Strictly Floor 1, Floor 2, Floor 3)
  const [selectedFloor, setSelectedFloor] = useState('all');

  // 4. Room Type Filter (Single, Double, Triple) & AC / Non-AC
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [selectedCooling, setSelectedCooling] = useState('all'); // 'all', 'AC', 'NON_AC'

  // 5. Availability & Facilities Filter (Available Bed, Chair, Table, Almirah)
  const [filterAvailableBed, setFilterAvailableBed] = useState(false);
  const [filterChair, setFilterChair] = useState(false);
  const [filterTable, setFilterTable] = useState(false);
  const [filterAlmirah, setFilterAlmirah] = useState(false);

  // Search input
  const [searchQuery, setSearchQuery] = useState('');

  // Active Modals
  const [activePanoramaRoom, setActivePanoramaRoom] = useState(null);
  const [activeDetailRoom, setActiveDetailRoom] = useState(null);
  const [modalInitialTab, setModalInitialTab] = useState('photos');

  const userRole = (user?.role || '').toUpperCase();
  const canManage = userRole === 'WARDEN' || userRole === 'SUPER_ADMIN';

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await virtualVisitService.getExploreData();
      if (res?.success && res.data) {
        setData(res.data);
      } else {
        throw new Error('Failed to load virtual visit rooms');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error loading rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered rooms based on user criteria
  const filteredRooms = useMemo(() => {
    return (data.rooms || []).filter((room) => {
      // 1. Hostel Filter
      if (selectedHostel !== 'all') {
        const roomHostelId = String(room.hostelId?._id || room.hostelId);
        if (roomHostelId !== String(selectedHostel)) return false;
      }

      // 2. Block Filter
      const blockName = (room.blockId?.name || '').toLowerCase();
      const blockCode = (room.blockId?.code || '').toLowerCase();

      if (selectedBlock !== 'all') {
        if (selectedBlock === 'BLOCK-A' && !blockName.includes('block a') && !blockCode.includes('block-a') && blockCode !== 'a') return false;
        if (selectedBlock === 'BLOCK-B' && !blockName.includes('block b') && !blockCode.includes('block-b') && blockCode !== 'b') return false;
        if (selectedBlock === 'BLOCK-C' && !blockName.includes('block c') && !blockCode.includes('block-c') && blockCode !== 'c') return false;
        if (selectedBlock === 'BLOCK-D' && !blockName.includes('block d') && !blockCode.includes('block-d') && blockCode !== 'd') return false;
      }

      if (selectedBlockCategory === 'SENIORS') {
        const isSenior = blockName.includes('block a') || blockName.includes('block b') || blockName.includes('senior') || blockCode.includes('block-a') || blockCode.includes('block-b');
        if (!isSenior) return false;
      } else if (selectedBlockCategory === 'JUNIORS') {
        const isJunior = blockName.includes('block c') || blockName.includes('block d') || blockName.includes('junior') || blockCode.includes('block-c') || blockCode.includes('block-d');
        if (!isJunior) return false;
      }

      // 3. Floor Filter (Strictly Floor 1, 2, 3)
      if (selectedFloor !== 'all') {
        const roomFloorNum = Number(room.floorId?.floorNumber);
        if (roomFloorNum !== Number(selectedFloor)) return false;
      }

      // 4. Room Type Filter (Single, Double, Triple)
      if (selectedRoomType !== 'all') {
        if (room.roomType !== selectedRoomType) return false;
      }

      // 4. AC / Non-AC Option
      if (selectedCooling === 'AC') {
        if (!room.isAc && !room.facilities?.some((f) => /ac\b/i.test(f))) return false;
      } else if (selectedCooling === 'NON_AC') {
        if (room.isAc || room.facilities?.some((f) => /\bac\b/i.test(f) && !/non-ac/i.test(f))) return false;
      }

      // 5. Availability & Facilities Filter
      if (filterAvailableBed && room.availableBeds <= 0) {
        return false;
      }
      if (filterChair && !room.facilities?.some((f) => /chair/i.test(f))) {
        return false;
      }
      if (filterTable && !room.facilities?.some((f) => /table/i.test(f))) {
        return false;
      }
      if (filterAlmirah && !room.facilities?.some((f) => /almirah|cupboard/i.test(f))) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (room.roomNumber || '').toLowerCase();
        const bName = blockName;
        const hName = (room.hostelId?.name || '').toLowerCase();
        if (!num.includes(q) && !bName.includes(q) && !hName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [
    data.rooms,
    selectedHostel,
    selectedBlock,
    selectedBlockCategory,
    selectedFloor,
    selectedRoomType,
    selectedCooling,
    filterAvailableBed,
    filterChair,
    filterTable,
    filterAlmirah,
    searchQuery,
  ]);

  const handleMediaUpdated = (updatedRoom) => {
    setData((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) => (r._id === updatedRoom._id ? { ...r, ...updatedRoom } : r)),
    }));
    if (activeDetailRoom?._id === updatedRoom._id) {
      setActiveDetailRoom((prev) => ({ ...prev, ...updatedRoom }));
    }
  };

  const resetAllFilters = () => {
    setSelectedHostel('all');
    setSelectedBlock('all');
    setSelectedBlockCategory('all');
    setSelectedFloor('all');
    setSelectedRoomType('all');
    setSelectedCooling('all');
    setFilterAvailableBed(false);
    setFilterChair(false);
    setFilterTable(false);
    setFilterAlmirah(false);
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedHostel !== 'all' ||
    selectedBlock !== 'all' ||
    selectedBlockCategory !== 'all' ||
    selectedFloor !== 'all' ||
    selectedRoomType !== 'all' ||
    selectedCooling !== 'all' ||
    filterAvailableBed ||
    filterChair ||
    filterTable ||
    filterAlmirah ||
    searchQuery.trim() !== '';

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20">
      {/* Top Header Banner */}
      <section className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md text-xl">
                  🏛️
                </span>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    BBDU Hostel Room Virtual Visit
                  </h1>
                  <p className="text-xs sm:text-sm font-medium text-slate-500">
                    Explore Senior &amp; Junior Blocks in 360° with 4 facility images, 15s walkthrough videos, and live occupancy.
                  </p>
                </div>
              </div>
            </div>

            {/* Strict Read-Only Badge */}
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-2 text-xs font-bold text-amber-900 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Strictly Read-Only • No Booking / Reservations Allowed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* WARDEN MEDIA MANAGEMENT STUDIO BANNER */}
        {canManage && (
          <section className="relative overflow-hidden rounded-3xl border-2 border-purple-300 bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 p-6 text-white shadow-xl">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 border border-purple-400/40 px-3 py-1 text-xs font-bold text-purple-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>👑 Warden Media Management Studio Active</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Hostel Room Media &amp; Walkthrough Studio
                </h2>
                <p className="text-xs sm:text-sm text-purple-200/90 max-w-2xl leading-relaxed">
                  As Warden, you can upload real photographs (up to 6 per room) and short video tours (up to 2 per room, ~15s). Students have strictly read-only access.
                </p>
              </div>

              {/* Quick 1-Click Upload buttons for showcase rooms */}
              <div className="flex flex-wrap items-center gap-2">
                {data.rooms.map((rm) => (
                  <button
                    key={rm._id}
                    type="button"
                    onClick={() => {
                      setActiveDetailRoom(rm);
                      setModalInitialTab('upload');
                    }}
                    className="flex items-center gap-1.5 rounded-2xl border border-purple-400/40 bg-purple-900/50 hover:bg-purple-800/80 px-3.5 py-2 text-xs font-black text-white shadow-sm transition active:scale-95"
                  >
                    <span>📤</span>
                    <span>Upload Media ({rm.roomType})</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* COMPREHENSIVE FILTER BAR (HIGHLIGHTED) */}
        <section
          aria-label="Room Filters"
          className="relative overflow-hidden rounded-3xl border-2 border-indigo-400/90 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 p-6 shadow-xl shadow-indigo-100/70 ring-4 ring-indigo-500/10 space-y-5 transition duration-300"
        >
          {/* Radiant top accent bar */}
          <div className="absolute top-0 left-6 right-6 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-sm" />

          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-indigo-100/80">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md text-base">
                🎯
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Search &amp; Filter Virtual Visit Rooms
                  </h2>
                  <span className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-0.5 text-xs font-black text-white shadow-xs">
                    {filteredRooms.length} of {data.rooms.length} Rooms
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-500">
                  Filter showcase rooms by hostel, block wing, floor, sharing type, and verified facilities.
                </p>
              </div>
            </div>

            {/* Quick Search Input */}
            <div className="relative w-full md:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search room 101, 202, block..."
                className="w-full rounded-2xl border-2 border-indigo-100 bg-white/95 pl-9 pr-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 shadow-2xs focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 transition"
              />
              <span className="absolute left-3 top-2.5 text-indigo-500 text-xs">🔍</span>
            </div>
          </div>

          {/* Primary Dropdown Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* 1. HOSTEL FILTER */}
            <div>
              <label className="block text-[11px] font-black text-indigo-950 mb-1.5 flex items-center gap-1">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black">1</span>
                Hostel
              </label>
              <select
                value={selectedHostel}
                onChange={(e) => setSelectedHostel(e.target.value)}
                className="w-full rounded-2xl border-2 border-indigo-100 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-xs hover:border-indigo-300 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition"
              >
                <option value="all">All Hostels</option>
                {data.hostels.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. BLOCK FILTER (C & D = Juniors, A & B = Seniors) */}
            <div>
              <label className="block text-[11px] font-black text-indigo-950 mb-1.5 flex items-center gap-1">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black">2</span>
                Block
              </label>
              <select
                value={selectedBlock}
                onChange={(e) => {
                  setSelectedBlock(e.target.value);
                  setSelectedBlockCategory('all');
                }}
                className="w-full rounded-2xl border-2 border-indigo-100 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-xs hover:border-indigo-300 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition"
              >
                <option value="all">All Blocks</option>
                <option value="BLOCK-A">Block A (Seniors)</option>
                <option value="BLOCK-B">Block B (Seniors)</option>
                <option value="BLOCK-C">Block C (Juniors)</option>
                <option value="BLOCK-D">Block D (Juniors)</option>
              </select>
            </div>

            {/* 3. FLOOR FILTER (Sirf 3 floors: Floor 1, 2, 3) */}
            <div>
              <label className="block text-[11px] font-black text-indigo-950 mb-1.5 flex items-center gap-1">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black">3</span>
                Floor
              </label>
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="w-full rounded-2xl border-2 border-indigo-100 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-xs hover:border-indigo-300 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition"
              >
                <option value="all">All Floors</option>
                <option value="1">Floor 1</option>
                <option value="2">Floor 2</option>
                <option value="3">Floor 3</option>
              </select>
            </div>

            {/* 4. ROOM TYPE FILTER (Single, Double, Triple) */}
            <div>
              <label className="block text-[11px] font-black text-indigo-950 mb-1.5 flex items-center gap-1">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black">4</span>
                Room Sharing Type
              </label>
              <select
                value={selectedRoomType}
                onChange={(e) => setSelectedRoomType(e.target.value)}
                className="w-full rounded-2xl border-2 border-indigo-100 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-xs hover:border-indigo-300 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition"
              >
                <option value="all">All Sharing Types</option>
                <option value="SINGLE">Single Sharing</option>
                <option value="DOUBLE">Double Sharing</option>
                <option value="TRIPLE">Triple Sharing</option>
              </select>
            </div>

            {/* 4b. AC / NON-AC FILTER */}
            <div>
              <label className="block text-[11px] font-black text-indigo-950 mb-1.5 flex items-center gap-1">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black">❄️</span>
                AC / Non-AC
              </label>
              <select
                value={selectedCooling}
                onChange={(e) => setSelectedCooling(e.target.value)}
                className="w-full rounded-2xl border-2 border-indigo-100 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-xs hover:border-indigo-300 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition"
              >
                <option value="all">All (AC &amp; Non-AC)</option>
                <option value="AC">AC (Air Conditioned)</option>
                <option value="NON_AC">Non-AC</option>
              </select>
            </div>
          </div>

          {/* Quick Category Buttons for Seniors / Juniors */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-indigo-100/70">
            <span className="text-xs font-black text-slate-700">Block Wing:</span>
            <button
              type="button"
              onClick={() => {
                setSelectedBlockCategory('all');
                setSelectedBlock('all');
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                selectedBlockCategory === 'all' && selectedBlock === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              All Wings
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedBlockCategory('SENIORS');
                setSelectedBlock('all');
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                selectedBlockCategory === 'SENIORS'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-300'
                  : 'bg-indigo-50/80 border border-indigo-200 text-indigo-800 hover:bg-indigo-100'
              }`}
            >
              Seniors (Block A &amp; B)
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedBlockCategory('JUNIORS');
                setSelectedBlock('all');
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                selectedBlockCategory === 'JUNIORS'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-200 ring-2 ring-purple-300'
                  : 'bg-purple-50/80 border border-purple-200 text-purple-800 hover:bg-purple-100'
              }`}
            >
              Juniors (Block C &amp; D)
            </button>
          </div>

          {/* 5. AVAILABILITY & FACILITIES FILTER CHIPS */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-indigo-100/70">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black">5</span>
                Facility Filters:
              </span>

              <button
                type="button"
                onClick={() => setFilterAvailableBed((v) => !v)}
                className={`flex items-center gap-1.5 rounded-2xl border-2 px-3 py-1.5 text-xs font-black transition shadow-xs ${
                  filterAvailableBed
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-4 ring-emerald-100 shadow-emerald-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>🛏️</span>
                <span>Available Bed</span>
                {filterAvailableBed && <span className="text-emerald-700 font-black">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setFilterChair((v) => !v)}
                className={`flex items-center gap-1.5 rounded-2xl border-2 px-3 py-1.5 text-xs font-black transition shadow-xs ${
                  filterChair
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-4 ring-indigo-100 shadow-indigo-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>🪑</span>
                <span>Chair</span>
                {filterChair && <span className="text-indigo-700 font-black">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setFilterTable((v) => !v)}
                className={`flex items-center gap-1.5 rounded-2xl border-2 px-3 py-1.5 text-xs font-black transition shadow-xs ${
                  filterTable
                    ? 'border-purple-500 bg-purple-50 text-purple-900 ring-4 ring-purple-100 shadow-purple-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>📑</span>
                <span>Table</span>
                {filterTable && <span className="text-purple-700 font-black">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setFilterAlmirah((v) => !v)}
                className={`flex items-center gap-1.5 rounded-2xl border-2 px-3 py-1.5 text-xs font-black transition shadow-xs ${
                  filterAlmirah
                    ? 'border-amber-500 bg-amber-50 text-amber-900 ring-4 ring-amber-100 shadow-amber-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>🚪</span>
                <span>Almirah</span>
                {filterAlmirah && <span className="text-amber-700 font-black">✓</span>}
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-black text-rose-700 hover:bg-rose-100 transition shadow-2xs"
              >
                Reset all filters ✕
              </button>
            )}
          </div>
        </section>

        {/* 6. ROOMS GRID (SPECIFICALLY THE 3 VIRTUAL VISIT ROOMS) */}
        <section aria-label="Virtual Visit Rooms">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-96 animate-pulse rounded-3xl bg-slate-200" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
              <p className="text-base font-bold text-rose-800">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="mt-4 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-rose-700"
              >
                Retry
              </button>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-2xl">
                🔎
              </span>
              <h3 className="mt-3 text-base font-bold text-slate-800">No rooms match your filter criteria</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Please adjust your filters or click reset to view the 3 showcase rooms.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-4 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredRooms.map((room) => {
                const photos = Array.isArray(room.photos) ? room.photos : [];
                const videos = Array.isArray(room.videos) ? room.videos : [];
                const coverPhoto = photos[0] || null;

                return (
                  <article
                    key={room._id}
                    className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm transition hover:shadow-md hover:border-indigo-200"
                  >
                    {/* Media Header (Photos & Video) */}
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-900 flex items-center justify-center">
                      {coverPhoto ? (
                        <img
                          src={coverPhoto}
                          alt={`Room - ${room.roomType}`}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-102"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 p-4 text-center text-white">
                          <span className="text-3xl">🏛️</span>
                          <span className="mt-1 text-xs font-bold text-slate-300">Room</span>
                          <span className="text-[10px] text-slate-400">Photos will be uploaded by Warden</span>
                        </div>
                      )}

                      {/* AC / Non-AC Badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider shadow-xs ${
                            room.isAc
                              ? 'bg-sky-500 text-white'
                              : 'bg-amber-600 text-white'
                          }`}
                        >
                          {room.isAc ? '❄️ AC' : 'Non-AC'}
                        </span>
                        <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                          {room.roomType}
                        </span>
                      </div>

                      {/* Availability Pill */}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-xs ${
                            room.isAvailable
                              ? 'bg-emerald-500 text-white'
                              : 'bg-rose-500 text-white'
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          {room.isAvailable ? `${room.availableBeds} Bed Open` : 'Full'}
                        </span>
                      </div>

                      {/* Bottom Media Bar */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
                        <span className="rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                          📷 {photos.length} {photos.length === 1 ? 'Photograph' : 'Photographs'}
                        </span>
                        {videos.length > 0 && (
                          <span className="rounded-lg bg-indigo-900/80 px-2 py-0.5 text-[10px] font-bold text-indigo-200 backdrop-blur-md">
                            🎬 ~15s Walkthrough
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Room Specs & Details */}
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-black text-slate-900">
                            Room
                          </h3>
                          <p className="text-xs font-semibold text-indigo-700">
                            {room.blockId?.name || 'Block'} • {room.floorId?.name || (Number.isInteger(room.floorId?.floorNumber) ? `Floor ${room.floorId?.floorNumber}` : 'Floor')}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {room.hostelId?.name}
                          </p>
                        </div>

                        <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {room.capacity} {room.capacity === 1 ? 'Bed' : 'Beds'}
                        </span>
                      </div>

                      <p className="mt-2.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {room.description || 'Virtual Visit Room with complete student facilities.'}
                      </p>

                      {/* Verified Facilities Chips */}
                      <div className="mt-3.5 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Verified Facilities:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                            🛏️ Available Bed ({room.availableBeds})
                          </span>
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/60">
                            🪑 Chair
                          </span>
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/60">
                            📑 Table
                          </span>
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/60">
                            🚪 Almirah
                          </span>
                          {room.isAc && (
                            <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200/60">
                              ❄️ AC
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions (Strictly Read-Only) */}
                      <div className="mt-auto pt-5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDetailRoom(room);
                            setModalInitialTab('photos');
                          }}
                          className="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 active:scale-95 text-center"
                        >
                          📷 View 4 Images
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveDetailRoom(room);
                            setModalInitialTab('videos');
                          }}
                          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 active:scale-95 text-center"
                        >
                          🎬 ~15s Video
                        </button>
                      </div>

                      {/* Warden Only Upload Action Button */}
                      {canManage && (
                        <div className="mt-3 pt-3 border-t border-purple-100">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDetailRoom(room);
                              setModalInitialTab('upload');
                            }}
                            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-600 to-indigo-700 py-2.5 px-4 text-xs font-black text-white shadow-md shadow-purple-200 transition hover:brightness-110 active:scale-95"
                          >
                            <span>📤</span>
                            <span>Upload Room Photos &amp; Video (Warden)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* 360 Panorama Modal */}
      {activePanoramaRoom && (
        <PanoramaViewer
          src={activePanoramaRoom.panorama360}
          title={`Room • ${activePanoramaRoom.roomType} 360° Virtual Tour`}
          onClose={() => setActivePanoramaRoom(null)}
        />
      )}

      {/* Room Details Modal */}
      {activeDetailRoom && (
        <RoomDetailsModal
          room={activeDetailRoom}
          initialTab={modalInitialTab}
          canManage={canManage}
          onClose={() => setActiveDetailRoom(null)}
          onOpenPanorama={(r) => {
            setActiveDetailRoom(null);
            setActivePanoramaRoom(r);
          }}
          onMediaUpdated={handleMediaUpdated}
        />
      )}
    </div>
  );
}

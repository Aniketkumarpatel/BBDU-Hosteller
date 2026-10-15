import { useState } from 'react';
import virtualVisitService from '../../services/virtualVisitService.js';

export default function RoomDetailsModal({
  room,
  initialTab = 'photos',
  onClose,
  onOpenPanorama,
  canManage = false,
  onMediaUpdated,
}) {
  const [activeMediaTab, setActiveMediaTab] = useState(initialTab || 'photos'); // 'photos' | 'videos' | 'upload'
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);

  // Warden Upload & Management State
  const [showUploader, setShowUploader] = useState(initialTab === 'upload' || canManage);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [selectedPanorama, setSelectedPanorama] = useState(null);
  const [deletingUrl, setDeletingUrl] = useState('');

  if (!room) return null;

  const photos = Array.isArray(room.photos) ? room.photos : [];
  const videos = Array.isArray(room.videos) ? room.videos : [];
  const activePhoto = photos[activePhotoIdx] || photos[0];
  const activeVideo = videos[activeVideoIdx] || videos[0];

  const remainingPhotos = Math.max(0, 6 - photos.length);
  const remainingVideos = Math.max(0, 2 - videos.length);

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []).slice(0, remainingPhotos);
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setSelectedPhotos(files);
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const handleRemoveSelectedPhoto = (idx) => {
    if (photoPreviews[idx]) {
      URL.revokeObjectURL(photoPreviews[idx]);
    }
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  // Handle uploading photos (max 6 total) and videos (max 2 total)
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    if (selectedPhotos.length === 0 && selectedVideos.length === 0 && !selectedPanorama) {
      setUploadError('Please choose at least one photo or video to upload.');
      return;
    }

    if (photos.length + selectedPhotos.length > 6) {
      setUploadError(`Maximum 6 photos allowed. You can only add ${remainingPhotos} more photo(s).`);
      return;
    }

    if (videos.length + selectedVideos.length > 2) {
      setUploadError(`Maximum 2 short videos allowed. You can only add ${remainingVideos} more video(s).`);
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      for (const p of selectedPhotos) {
        formData.append('photos', p);
      }
      for (const v of selectedVideos) {
        formData.append('videos', v);
      }
      if (selectedPanorama) {
        formData.append('panorama', selectedPanorama);
      }

      const res = await virtualVisitService.uploadRoomMedia(room._id, formData);
      if (res?.success && res.data) {
        setUploadSuccess('Real media uploaded successfully!');
        photoPreviews.forEach((url) => URL.revokeObjectURL(url));
        setSelectedPhotos([]);
        setPhotoPreviews([]);
        setSelectedVideos([]);
        setSelectedPanorama(null);
        if (onMediaUpdated) onMediaUpdated(res.data);
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Handle deleting a single photo or video
  const handleDeleteMedia = async (type, url) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      setDeletingUrl(url);
      setUploadError('');
      const res = await virtualVisitService.deleteRoomMediaItem(room._id, type, url);
      if (res?.success && res.data) {
        if (type === 'photo' && activePhotoIdx >= res.data.photos?.length) {
          setActivePhotoIdx(Math.max(0, (res.data.photos?.length || 1) - 1));
        }
        if (type === 'video' && activeVideoIdx >= res.data.videos?.length) {
          setActiveVideoIdx(Math.max(0, (res.data.videos?.length || 1) - 1));
        }
        if (onMediaUpdated) onMediaUpdated(res.data);
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || err.message || 'Failed to delete media');
    } finally {
      setDeletingUrl('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Room Details"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-5 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 text-lg font-bold">
              🚪
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">Room</h3>
                <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs font-semibold text-slate-700 uppercase">
                  {room.roomType}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500">
                {[
                  room.hostelId?.name,
                  room.blockId?.name?.startsWith('Block') ? room.blockId?.name : (room.blockId?.name ? `Block ${room.blockId.name}` : ''),
                  room.floorId?.name || (Number.isInteger(room.floorId?.floorNumber) ? `Floor ${room.floorId?.floorNumber}` : ''),
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-200/60 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-6">
          {/* Media Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveMediaTab('photos')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeMediaTab === 'photos'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>📷 Photos</span>
                <span className="rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">
                  {photos.length}/6
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMediaTab('videos')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeMediaTab === 'videos'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>🎬 Walkthrough Videos</span>
                <span className="rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">
                  {videos.length}/2
                </span>
              </button>

              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveMediaTab('upload');
                    setShowUploader(true);
                  }}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                    activeMediaTab === 'upload'
                      ? 'bg-gradient-to-r from-brand-700 to-brand-700 text-white shadow-md ring-2 ring-brand-300'
                      : 'bg-brand-100 text-brand-800 hover:bg-brand-200'
                  }`}
                >
                  <span>📤</span>
                  <span>Upload Media (Warden)</span>
                  <span className="rounded-full bg-brand-800/20 px-1.5 py-0.2 text-[9px] uppercase font-black">
                    Studio
                  </span>
                </button>
              )}
            </div>

            {room.panorama360 && (
              <button
                type="button"
                onClick={() => onOpenPanorama(room)}
                className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-800 transition"
              >
                <span>🌐 360° Tour</span>
              </button>
            )}
          </div>

          {/* Quick Warden upload banner in viewer tabs */}
          {canManage && activeMediaTab !== 'upload' && (
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-brand-50 to-brand-50 px-4 py-2.5 border border-brand-200/80 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-base">👑</span>
                <span className="text-xs font-bold text-brand-800">
                  Warden Media Manager Active ({photos.length}/6 Photos • {videos.length}/2 Videos)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveMediaTab('upload');
                  setShowUploader(true);
                }}
                className="rounded-xl bg-brand-700 px-3 py-1 text-xs font-bold text-white shadow-2xs hover:bg-brand-800 transition active:scale-95"
              >
                📤 Upload / Replace Media &rarr;
              </button>
            </div>
          )}

          {/* Dedicated Warden Upload Studio Tab View */}
          {activeMediaTab === 'upload' && canManage && (
            <div className="space-y-4 rounded-3xl border-2 border-brand-300 bg-gradient-to-br from-brand-50/70 via-white to-brand-50/50 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-100 pb-3">
                <div>
                  <h4 className="text-sm font-black text-brand-800 flex items-center gap-2">
                    <span>👑</span>
                    <span>Warden Room Media Upload Center</span>
                  </h4>
                  <p className="text-xs font-medium text-brand-800/80">
                    Upload official real photos (up to 6) and 15s walkthrough videos (up to 2). Students can only view.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="rounded-lg bg-brand-100 px-2.5 py-1 text-brand-800">
                    📷 {photos.length}/6 Photos
                  </span>
                  <span className="rounded-lg bg-brand-100 px-2.5 py-1 text-brand-800">
                    🎬 {videos.length}/2 Videos
                  </span>
                </div>
              </div>

              {uploadError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 border border-rose-200 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700 border border-emerald-200 flex items-center gap-2">
                  <span>✅</span>
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {/* Current Uploaded Items with Delete Option */}
              {(photos.length > 0 || videos.length > 0) && (
                <div>
                  <p className="text-xs font-bold text-slate-800 mb-2">Current Room Media in Database:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {photos.map((p, i) => (
                      <div key={p + i} className="group relative aspect-video overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-2xs">
                        <img src={p} alt="" className="h-full w-full object-cover" />
                        <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-xs">
                          Photo {i + 1}
                        </span>
                        <button
                          type="button"
                          disabled={deletingUrl === p}
                          onClick={() => handleDeleteMedia('photo', p)}
                          className="absolute top-1 right-1 rounded-md bg-rose-600 p-1 text-white opacity-90 transition hover:opacity-100 shadow-sm"
                          title="Delete this photo"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    {videos.map((v, i) => (
                      <div key={v + i} className="group relative aspect-video overflow-hidden rounded-xl border-2 border-brand-300 bg-brand-800 flex items-center justify-center shadow-2xs">
                        <span className="text-white text-xs font-bold">🎬 Video {i + 1}</span>
                        <button
                          type="button"
                          disabled={deletingUrl === v}
                          onClick={() => handleDeleteMedia('video', v)}
                          className="absolute top-1 right-1 rounded-md bg-rose-600 p-1 text-white opacity-90 transition hover:opacity-100 shadow-sm"
                          title="Delete this video"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Form */}
              <form onSubmit={handleUploadSubmit} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Photo picker */}
                  <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-white p-3.5 transition hover:border-brand-400">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <span>📷</span>
                        <span>Room Photos (JPG / PNG)</span>
                      </label>
                      <span className={`text-[11px] font-bold ${remainingPhotos === 0 ? 'text-rose-600' : 'text-brand-600'}`}>
                        {remainingPhotos === 0 ? 'Limit (6/6)' : `${remainingPhotos} slots left`}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={remainingPhotos === 0}
                      onChange={handlePhotoSelect}
                      className="block w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-700 disabled:opacity-50 cursor-pointer"
                    />
                    {selectedPhotos.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold text-emerald-700">
                            ✓ {selectedPhotos.length} real photo(s) selected:
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              photoPreviews.forEach((url) => URL.revokeObjectURL(url));
                              setSelectedPhotos([]);
                              setPhotoPreviews([]);
                            }}
                            className="text-[10px] font-bold text-rose-600 hover:underline"
                          >
                            Clear all
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {photoPreviews.map((preview, idx) => (
                            <div key={preview} className="relative aspect-video rounded-lg overflow-hidden border border-brand-200 bg-slate-100 group">
                              <img src={preview} alt="" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleRemoveSelectedPhoto(idx)}
                                className="absolute top-0.5 right-0.5 rounded-full bg-rose-600 p-0.5 text-white shadow-xs hover:bg-rose-700"
                                title="Remove this photo"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Video picker */}
                  <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-white p-3.5 transition hover:border-brand-400">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <span>🎬</span>
                        <span>Short Video (MP4 / WebM, ~15s)</span>
                      </label>
                      <span className={`text-[11px] font-bold ${remainingVideos === 0 ? 'text-rose-600' : 'text-brand-600'}`}>
                        {remainingVideos === 0 ? 'Limit (2/2)' : `${remainingVideos} slots left`}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      disabled={remainingVideos === 0}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []).slice(0, remainingVideos);
                        setSelectedVideos(files);
                      }}
                      className="block w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-700 disabled:opacity-50 cursor-pointer"
                    />
                    {selectedVideos.length > 0 && (
                      <p className="mt-1.5 text-[11px] font-bold text-emerald-700">
                        ✓ {selectedVideos.length} video(s) selected for upload
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-medium text-slate-500">
                    Allowed: Max 6 Photos &amp; Max 2 Videos per room. Real files only.
                  </span>
                  <button
                    type="submit"
                    disabled={uploading || (selectedPhotos.length === 0 && selectedVideos.length === 0 && !selectedPanorama)}
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-600 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-brand-200 transition hover:brightness-110 active:scale-95 disabled:opacity-40"
                  >
                    <span>{uploading ? '⏳ Uploading Media...' : '💾 Save & Upload to Room'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Media Viewport */}
          {activeMediaTab === 'photos' && (
            <div className="space-y-3">
              {photos.length > 0 ? (
                <>
                  <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900 shadow-inner">
                    <img
                      src={activePhoto}
                      alt={`Room real photograph ${activePhotoIdx + 1}`}
                      className="h-full w-full object-cover transition duration-300"
                    />

                    {/* Photo index indicator */}
                    <div className="absolute bottom-3 left-3 rounded-full bg-slate-950/70 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                      Photo {activePhotoIdx + 1} of {photos.length} (Max 6)
                    </div>

                    {/* 360° Quick Launch Badge */}
                    {room.panorama360 && (
                      <button
                        type="button"
                        onClick={() => onOpenPanorama(room)}
                        className="absolute bottom-3 right-3 flex items-center gap-2 rounded-2xl bg-brand-600/90 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-brand-700 active:scale-95"
                      >
                        <span>360° View</span>
                      </button>
                    )}
                  </div>

                  {/* Thumbnail Row */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map((p, i) => (
                      <button
                        key={p + i}
                        type="button"
                        onClick={() => setActivePhotoIdx(i)}
                        className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                          activePhotoIdx === i
                            ? 'border-brand-600 ring-2 ring-brand-200'
                            : 'border-slate-200 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={p} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                    📷
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-slate-800">No Photos Uploaded Yet</h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    {canManage
                      ? 'As a Warden, you can upload up to 6 real photographs of this room below.'
                      : 'The hostel warden will upload actual photographs of this room (up to 6 photos).'}
                  </p>
                  {canManage && !showUploader && (
                    <button
                      type="button"
                      onClick={() => setShowUploader(true)}
                      className="mt-3 rounded-xl bg-brand-600 px-4 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-brand-700"
                    >
                      + Upload Photos Now
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeMediaTab === 'videos' && (
            <div className="space-y-3">
              {videos.length > 0 ? (
                <>
                  <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 shadow-inner flex items-center justify-center">
                    {activeVideo.endsWith('.svg') ? (
                      <img
                        key={activeVideo}
                        src={activeVideo}
                        alt="Walkthrough Video Preview"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <video
                        key={activeVideo}
                        src={activeVideo}
                        controls
                        playsInline
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>

                  {/* Video Selector */}
                  <div className="flex items-center gap-2">
                    {videos.map((v, i) => (
                      <button
                        key={v + i}
                        type="button"
                        onClick={() => setActiveVideoIdx(i)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                          activeVideoIdx === i
                            ? 'border-brand-600 bg-brand-50 text-brand-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>🎬 Video {i + 1}</span>
                      </button>
                    ))}
                    <span className="text-[11px] text-slate-400 ml-auto font-medium">
                      Short Walkthrough Clip (Max 2)
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                    🎬
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-slate-800">No Short Videos Uploaded Yet</h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    {canManage
                      ? 'As a Warden, you can upload up to 2 short video walkthrough clips for this room below.'
                      : 'The hostel warden will upload short walkthrough clips of this room (up to 2 videos).'}
                  </p>
                  {canManage && !showUploader && (
                    <button
                      type="button"
                      onClick={() => setShowUploader(true)}
                      className="mt-3 rounded-xl bg-brand-600 px-4 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-brand-700"
                    >
                      + Upload Video Now
                    </button>
                  )}
                </div>
              )}
            </div>
          )}



          {/* Availability & Occupancy Bar */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Live Database Status
              </span>
              <span
                className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                  room.isAvailable
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {room.isAvailable
                  ? `Available (${room.availableBeds} ${room.availableBeds === 1 ? 'bed' : 'beds'} open)`
                  : 'Fully Occupied (0 beds open)'}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white p-2.5 shadow-2xs border border-slate-100">
                <p className="text-xs text-slate-500 font-medium">Total Capacity</p>
                <p className="text-lg font-bold text-slate-900">{room.capacity} Beds</p>
              </div>
              <div className="rounded-xl bg-white p-2.5 shadow-2xs border border-slate-100">
                <p className="text-xs text-slate-500 font-medium">Current Occupants</p>
                <p className="text-lg font-bold text-brand-700">{room.currentOccupancy}</p>
              </div>
              <div className="rounded-xl bg-white p-2.5 shadow-2xs border border-slate-100">
                <p className="text-xs text-slate-500 font-medium">Available Beds</p>
                <p className={`text-lg font-bold ${room.availableBeds > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {room.availableBeds}
                </p>
              </div>
            </div>

            {/* Visual Bed Slot Representation */}
            <div className="mt-3.5 flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Bed Allocation:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {Array.from({ length: room.capacity }).map((_, idx) => {
                  const isOccupied = idx < room.currentOccupancy;
                  return (
                    <span
                      key={idx}
                      title={isOccupied ? `Occupied (Student Bed ${idx + 1})` : `Available Bed ${idx + 1}`}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition ${
                        isOccupied
                          ? 'bg-brand-600 text-white shadow-2xs'
                          : 'border-2 border-dashed border-emerald-400 bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      🛏
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Room Facilities */}
          <div>
            <h4 className="text-sm font-bold text-slate-900">Room &amp; Hostel Facilities</h4>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {(room.facilities || []).map((fac) => (
                <span
                  key={fac}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  {fac}
                </span>
              ))}
            </div>
          </div>

          {/* Strict Read-Only Notice */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <span className="text-base">ℹ️</span>
            <div>
              <p className="font-bold">Strictly Read-Only Virtual Tour Preview</p>
              <p className="text-amber-800/90 mt-0.5">
                Room allotment, booking, and fees are strictly handled via university administrative offices. Self-allotment or online booking is not permitted.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Close
          </button>

          {room.panorama360 && (
            <button
              type="button"
              onClick={() => onOpenPanorama(room)}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-brand-700 active:scale-95"
            >
              <span>Explore 360° View</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

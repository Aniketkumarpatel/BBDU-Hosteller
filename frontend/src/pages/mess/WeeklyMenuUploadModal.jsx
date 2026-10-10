import { useState } from 'react';
import messService from '../../services/messService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const MEALS = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];

export const OFFICIAL_BBDU_MENU = {
  MONDAY: {
    BREAKFAST: ['Ajwain Paratha', 'Matar Chola', 'Tea', 'Milk 200 ml', 'Banana- 02'],
    LUNCH: ['Black Masoor Dal', 'Lauki Jeera Sabji', 'Rice', 'Boondi Raita', 'Salad', 'Achaar', 'Roti'],
    SNACKS: ['Vegetable Chowmein', 'Sauce', 'Tea'],
    DINNER: ['Mix Daal', 'Aaloo Lobiya ki Sabji', 'Roti', 'Rice', 'Salad', 'Achaar', 'Baalu Shahi'],
  },
  TUESDAY: {
    BREAKFAST: ['Vegetable Suji Upma', 'Bread Butter- 04', 'Milk 200 ml', 'Tea', 'Banana- 02'],
    LUNCH: ['Arhar Daal', 'Aaloo Pyaj Sabji', 'Kheera Raita', 'Rice', 'Salad', 'Achaar', 'Roti'],
    SNACKS: ['Namakpara', 'Tea'],
    DINNER: ['Chola', 'Aaloo Jeera', 'Poori/Bhatoora', 'Jeera Rice', 'Salad', 'Achaar', 'Icecream- 01 (Amul, Creambell, Havmor, Vadilal)'],
  },
  WEDNESDAY: {
    BREAKFAST: ['Aaloo Paratha with Hari Chatni', 'Meethi Daliya', 'Tea', 'Banana- 02', 'Egg- 02'],
    LUNCH: ['Paneer Butter Masala', 'Dal Panchmail', 'Boondi Raita', 'Rice', 'Roti', 'Salad', 'Achaar'],
    SNACKS: ['Matar Chaat with Onion and chilly', 'Meethi Chatni or Vegetable Paasta with sauce', 'Tea'],
    DINNER: ['Arhar Daal', 'Aaloo Soyabean lutputi sabji', 'Roti', 'Rice', 'Salad', 'Achaar', 'Meethi Boondi'],
  },
  THURSDAY: {
    BREAKFAST: ['Vegetable Poha', 'Sprouts', 'Cornflakes', 'Tea', 'Milk 200 ml', 'Banana- 02'],
    LUNCH: ['Kadhi Pakoda', 'Aaloo Jeera with Kasuri Methi', 'Rice', 'Salad', 'Achaar', 'Roti'],
    SNACKS: ['Bhelpuri', 'Tea'],
    DINNER: ['Lauki Chana Daal', 'Aaloo Parval Sookhi Sabji', 'Roti', 'Rice', 'Salad', 'Achaar', 'Rice Kheer'],
  },
  FRIDAY: {
    BREAKFAST: ['Poori', 'Aaloo Matar Tamatar ki Sabji', 'Tea', 'Milk 200 ml', 'Banana- 02'],
    LUNCH: ['Rajma Masala', 'Mix Vegetable', 'Rice', 'Kheera Raita', 'Salad', 'Achaar', 'Roti'],
    SNACKS: ['Samosa- 02', 'Meethi Chatni', 'Tea'],
    DINNER: ['Matar Paneer', 'Veg Biryani', 'Boondi Raita', 'Salad', 'Achaar', 'Roti', 'Fruits Custard'],
  },
  SATURDAY: {
    BREAKFAST: ['Idli Sambhar', 'Milk 200 ml', 'Tea', 'Cornflakes', 'Banana- 02'],
    LUNCH: ['Arhar Daal', 'Aaloo Parval', 'Roti', 'Rice', 'Boondi Raita', 'Salad', 'Achaar'],
    SNACKS: ['Aaloo Matar Sandwich- 02', 'Sauce', 'Tea'],
    DINNER: ['Black Masoor Dal', 'Lauki Kofta', 'Roti', 'Rice', 'Salad', 'Achaar', 'Suji Halwa'],
  },
  SUNDAY: {
    BREAKFAST: ['Chana Daal Kachauri', 'Hari Chatni', 'Milk 200 ml', 'Tea', 'Banana- 02'],
    LUNCH: ['Tehri', 'Aloo Tamatar Sabji', 'Hari Chatni', 'Dahi', 'Papad', 'Salad', 'Achaar', 'Roti'],
    SNACKS: ['Chana Masala', 'Tea'],
    DINNER: ['Arhar Dal Tadka', 'Kashmiri Dum Aaloo', 'Egg Curry- 02', 'Rice', 'Roti', 'Salad', 'Achaar', 'Jalebi- 02'],
  },
};

export default function WeeklyMenuUploadModal({ isOpen, onClose, messId, onSchedulePublished }) {
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [activeDay, setActiveDay] = useState('MONDAY');
  const [editedSchedule, setEditedSchedule] = useState(null);

  if (!isOpen) return null;

  const handleLoadOfficialPreset = () => {
    setExtractedData({
      fileName: 'BBDU_Hostel_Mess_Timetable_w.e.f._22.09.2026.png',
      fileType: 'IMAGE',
      summary: {
        totalDaysDetected: 7,
        totalMealsDetected: 28,
        confidence: 'HIGH',
        daysDetected: DAYS,
        warnings: [],
      },
    });
    setEditedSchedule(JSON.parse(JSON.stringify(OFFICIAL_BBDU_MENU)));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleStartExtraction = async () => {
    if (!file) {
      setError('Please select a photo or PDF of the weekly menu timetable.');
      return;
    }

    try {
      setExtracting(true);
      setError(null);
      const formData = new FormData();
      formData.append('menuFile', file);

      const res = await messService.uploadWeeklyMenuPhoto(messId, formData);
      if (res.success && res.data) {
        setExtractedData(res.data);
        setEditedSchedule(JSON.parse(JSON.stringify(res.data.parsedSchedule)));
      } else {
        setError(res.message || 'Failed to extract menu schedule.');
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || err.message || 'Error occurred while processing menu document.'
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleItemChange = (day, meal, idx, value) => {
    if (!editedSchedule) return;
    const updated = { ...editedSchedule };
    updated[day][meal][idx] = value;
    setEditedSchedule(updated);
  };

  const handleAddItem = (day, meal) => {
    if (!editedSchedule) return;
    const updated = { ...editedSchedule };
    updated[day][meal] = [...updated[day][meal], 'New Dish Item'];
    setEditedSchedule(updated);
  };

  const handleRemoveItem = (day, meal, idx) => {
    if (!editedSchedule) return;
    const updated = { ...editedSchedule };
    updated[day][meal] = updated[day][meal].filter((_, i) => i !== idx);
    setEditedSchedule(updated);
  };

  const handleConfirmAndPublish = async () => {
    if (!editedSchedule) return;

    try {
      setPublishing(true);
      setError(null);

      const res = await messService.publishWeeklySchedule(messId, editedSchedule);
      if (res.success) {
        if (onSchedulePublished) {
          onSchedulePublished(res.data);
        }
        handleClose();
      } else {
        setError(res.message || 'Failed to publish weekly schedule.');
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || err.message || 'Error publishing weekly schedule to database.'
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setExtractedData(null);
    setEditedSchedule(null);
    setError(null);
    setExtracting(false);
    setPublishing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>📷</span> One-Time Weekly Menu Photo Upload &amp; Schedule
            </h2>
            <p className="text-xs text-slate-500">
              Upload your hostel's weekly timetable once. The system extracts and automatically updates daily menus.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-start gap-2">
              <span className="font-bold">⚠</span>
              <p>{error}</p>
            </div>
          )}

          {/* STEP 1: Upload Dropzone (if not extracted yet) */}
          {!extractedData && !extracting && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-8 text-center hover:bg-indigo-50/70 transition">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 text-2xl shadow-xs">
                  📷
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">
                  Select Weekly Hostel Mess Timetable Photo or PDF
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                  Supports JPG, JPEG, PNG photos and PDF documents up to 10MB. Clear lighting and visible text give the highest OCR accuracy.
                </p>

                <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <label className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition">
                    Browse File
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {file && (
                    <span className="text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                      📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-indigo-100/80 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={handleLoadOfficialPreset}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition"
                  >
                    <span>📋</span> Load Official BBDU Hostel Timetable (w.e.f. 22.09.2026)
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-800">💡 How it works:</p>
                <p>1. Local OCR scans Monday through Sunday $\times$ Breakfast, Lunch, Snacks, Dinner.</p>
                <p>2. You review and verify the extracted dish names in the editable preview below.</p>
                <p>3. Confirm once to publish persistently — student and warden dashboards automatically update each day!</p>
              </div>
            </div>
          )}

          {/* EXTRACTION IN PROGRESS SPINNER */}
          {extracting && (
            <div className="py-16 text-center space-y-3">
              <LoadingSpinner size="lg" message="Scanning weekly timetable with OCR..." />
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Analyzing weekday columns and meal items. This usually takes 3 to 8 seconds...
              </p>
            </div>
          )}

          {/* STEP 2: REVIEW & EDIT EXTRACTED SCHEDULE */}
          {extractedData && editedSchedule && (
            <div className="space-y-4">
              {/* Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-800">
                    Extracted from: <span className="font-mono text-indigo-700">{extractedData.fileName}</span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      extractedData.summary?.confidence === 'HIGH'
                        ? 'bg-emerald-100 text-emerald-800'
                        : extractedData.summary?.confidence === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    Confidence: {extractedData.summary?.confidence || 'OK'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {extractedData.summary?.totalMealsDetected || 0} meals detected across {extractedData.summary?.totalDaysDetected || 0} days
                  </span>
                </div>

                <button
                  onClick={() => {
                    setExtractedData(null);
                    setEditedSchedule(null);
                    setFile(null);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Upload Different Photo
                </button>
              </div>

              {extractedData.summary?.warnings?.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                  {extractedData.summary.warnings.map((w, i) => (
                    <p key={i}>ℹ {w}</p>
                  ))}
                </div>
              )}

              {/* Day Selector Tabs */}
              <div className="flex space-x-1.5 overflow-x-auto border-b border-slate-200 pb-2">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => setActiveDay(day)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                      activeDay === day
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              {/* Meal Cards for Active Day */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MEALS.map((meal) => {
                  const items = editedSchedule[activeDay]?.[meal] || [];
                  return (
                    <div
                      key={meal}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          {meal} ({items.length} items)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddItem(activeDay, meal)}
                          className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-100"
                        >
                          + Add Item
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {items.length > 0 ? (
                          items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={item}
                                onChange={(e) =>
                                  handleItemChange(activeDay, meal, idx, e.target.value)
                                }
                                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(activeDay, meal, idx)}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                title="Remove dish"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="py-3 text-center text-xs text-slate-400 italic">
                            No dishes detected for {meal.toLowerCase()}. Click "+ Add Item" to add.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            onClick={handleClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancel
          </button>

          {!extractedData ? (
            <button
              onClick={handleStartExtraction}
              disabled={!file || extracting}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {extracting ? 'Extracting...' : 'Extract Timetable with OCR →'}
            </button>
          ) : (
            <button
              onClick={handleConfirmAndPublish}
              disabled={publishing}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {publishing ? 'Publishing Schedule...' : '✓ Confirm & Publish Weekly Schedule'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

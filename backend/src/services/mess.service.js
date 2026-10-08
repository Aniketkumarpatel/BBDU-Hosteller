import mongoose from 'mongoose';
import {
  Mess,
  MessMenu,
  MessFeedback,
  MessNotice,
  Complaint,
  Hostel,
  User,
  Counter,
} from '../models/index.js';
import { getNextSequence } from '../models/Counter.js';
import {
  MEAL_TYPES,
  MEAL_TYPE_VALUES,
  DAYS_OF_WEEK,
  FOOD_QUALITIES,
  FOOD_QUALITY_VALUES,
  HYGIENE_ALERT_THRESHOLDS,
  MESS_NOTICE_PRIORITIES,
} from '../constants/mess.constants.js';
import { NOTIFICATION_TYPES } from '../constants/notification.constants.js';
import { ROLES } from '../constants/roles.js';
import { createNotification, createBatchNotifications } from './notification.service.js';
import ApiError from '../utils/ApiError.js';

// ==========================================
// ID GENERATORS
// ==========================================

export const generateMessId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`mess_${year}`);
  return `MESS-${year}-${String(seq).padStart(5, '0')}`;
};

export const generateMenuId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`menu_${year}`);
  return `MENU-${year}-${String(seq).padStart(5, '0')}`;
};

export const generateFeedbackId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`feedback_${year}`);
  return `FB-${year}-${String(seq).padStart(5, '0')}`;
};

export const generateNoticeId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`mess_notice_${year}`);
  return `MNOT-${year}-${String(seq).padStart(5, '0')}`;
};

// ==========================================
// 1. MESS MANAGEMENT
// ==========================================

export const createMess = async (data, user) => {
  const { name, code, hostelId, description, managerId, capacity } = data;

  if (!name || !code || !hostelId) {
    throw new ApiError(400, 'Mess name, code, and hostel reference are required');
  }

  const existingCode = await Mess.findOne({ code: code.trim().toUpperCase() }).lean();
  if (existingCode) {
    throw new ApiError(409, `Mess code "${code.trim().toUpperCase()}" is already in use`);
  }

  const hostel = await Hostel.findById(hostelId).lean();
  if (!hostel) {
    throw new ApiError(404, 'Associated hostel not found');
  }

  const messId = await generateMessId();

  const mess = await Mess.create({
    messId,
    name: name.trim(),
    code: code.trim().toUpperCase(),
    hostelId,
    description: description?.trim() || '',
    managerId: managerId || null,
    capacity: capacity ? Number(capacity) : 250,
    isActive: true,
  });

  return mess;
};

export const ensureMessSeeded = async () => {
  try {
    const count = await Mess.countDocuments();
    if (count > 0) return;

    const hostels = await Hostel.find().lean();
    if (!hostels || hostels.length === 0) return;

    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const sampleMenus = {
      BREAKFAST: ['Aloo Paratha', 'Curd', 'Pickle', 'Tea/Coffee', 'Sprouts'],
      LUNCH: ['Paneer Butter Masala', 'Dal Tadka', 'Jeera Rice', 'Roti', 'Salad', 'Gulab Jamun'],
      SNACKS: ['Samosa', 'Mint Chutney', 'Tea/Coffee', 'Biscuits'],
      DINNER: ['Mix Veg', 'Dal Fry', 'Steamed Rice', 'Chapati', 'Kheer'],
    };

    for (const hostel of hostels) {
      const code = (hostel.code || hostel.name.substring(0, 3)).toUpperCase() + '-MESS-' + Math.floor(Math.random() * 1000);
      const messId = await generateMessId();
      const mess = await Mess.create({
        messId,
        name: `${hostel.name} Mess`,
        code,
        hostelId: hostel._id,
        description: `Central Dining & Mess Facility for ${hostel.name}`,
        capacity: 300,
        isActive: true,
      });

      for (const day of days) {
        for (const mealType of ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER']) {
          const menuId = await generateMenuId();
          await MessMenu.create({
            menuId,
            messId: mess._id,
            dayOfWeek: day,
            mealType,
            menuItems: sampleMenus[mealType],
            notes: `Freshly prepared ${mealType.toLowerCase()} items for ${day}`,
            isPublished: true,
          });
        }
      }
    }
  } catch (err) {
    console.error('[messService] Auto seed error:', err.message);
  }
};

export const getMesses = async (query = {}) => {
  await ensureMessSeeded();
  const filter = {};

  if (query.hostelId && mongoose.isValidObjectId(query.hostelId)) {
    filter.hostelId = query.hostelId;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ name: regex }, { code: regex }, { messId: regex }];
  }

  const messes = await Mess.find(filter)
    .populate('hostelId', 'name code type')
    .populate('managerId', 'name email phone employeeId')
    .sort({ createdAt: -1 })
    .lean();

  return messes;
};

export const getMessById = async (id) => {
  let query;
  if (mongoose.isValidObjectId(id)) {
    query = { _id: id };
  } else {
    query = { messId: id.toUpperCase() };
  }

  const mess = await Mess.findOne(query)
    .populate('hostelId', 'name code type')
    .populate('managerId', 'name email phone employeeId')
    .lean();

  if (!mess) {
    throw new ApiError(404, 'Mess not found');
  }

  return mess;
};

export const updateMess = async (id, data, user) => {
  const mess = await Mess.findById(id);
  if (!mess) {
    throw new ApiError(404, 'Mess not found');
  }

  if (data.name !== undefined) mess.name = data.name.trim();
  if (data.description !== undefined) mess.description = data.description.trim();
  if (data.capacity !== undefined) mess.capacity = Number(data.capacity);
  if (data.managerId !== undefined) mess.managerId = data.managerId || null;
  if (data.isActive !== undefined) mess.isActive = Boolean(data.isActive);

  await mess.save();
  return mess;
};

// ==========================================
// 2. MENU MANAGEMENT
// ==========================================

export const createOrUpdateMenu = async (messId, data, user) => {
  const { dayOfWeek, mealType, menuItems, notes, effectiveDate, isPublished } = data;

  if (!dayOfWeek || !mealType) {
    throw new ApiError(400, 'dayOfWeek and mealType are required');
  }

  const normalizedDay = dayOfWeek.trim().toUpperCase();
  const normalizedMeal = mealType.trim().toUpperCase();

  if (!DAYS_OF_WEEK.includes(normalizedDay)) {
    throw new ApiError(400, `Invalid day of week: ${dayOfWeek}`);
  }
  if (!MEAL_TYPE_VALUES.includes(normalizedMeal)) {
    throw new ApiError(400, `Invalid meal type: ${mealType}`);
  }

  const mess = await Mess.findById(messId);
  if (!mess) {
    throw new ApiError(404, 'Mess not found');
  }

  let menu = await MessMenu.findOne({
    messId,
    dayOfWeek: normalizedDay,
    mealType: normalizedMeal,
  });

  if (menu) {
    if (menuItems !== undefined) menu.menuItems = menuItems;
    if (notes !== undefined) menu.notes = notes;
    if (effectiveDate !== undefined) menu.effectiveDate = effectiveDate;
    if (isPublished !== undefined) menu.isPublished = Boolean(isPublished);
    menu.updatedBy = user._id;
    await menu.save();
  } else {
    const menuId = await generateMenuId();
    menu = await MessMenu.create({
      menuId,
      messId,
      dayOfWeek: normalizedDay,
      mealType: normalizedMeal,
      menuItems: menuItems || [],
      notes: notes || '',
      effectiveDate: effectiveDate || null,
      isPublished: Boolean(isPublished),
      createdBy: user._id,
      updatedBy: user._id,
    });
  }

  return menu;
};

export const getMenus = async (messId, query = {}, user = null) => {
  const filter = { messId };

  if (query.dayOfWeek) {
    filter.dayOfWeek = query.dayOfWeek.trim().toUpperCase();
  }
  if (query.mealType) {
    filter.mealType = query.mealType.trim().toUpperCase();
  }

  // If user is a student, only show published menus unless requested explicitly
  if (user && user.role === ROLES.STUDENT) {
    filter.isPublished = true;
  } else if (query.isPublished !== undefined) {
    filter.isPublished = query.isPublished === 'true' || query.isPublished === true;
  }

  const menus = await MessMenu.find(filter)
    .populate('createdBy', 'name')
    .sort({ dayOfWeek: 1, mealType: 1 })
    .lean();

  return menus;
};

export const getTodayMenu = async (messId, user = null) => {
  await ensureMessSeeded();
  const mess = await Mess.findById(messId).lean();
  if (!mess) {
    throw new ApiError(404, 'Mess not found');
  }

  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayDayOfWeek = days[new Date().getDay()];

  const filter = {
    messId,
    dayOfWeek: todayDayOfWeek,
  };

  // If student, require isPublished: true
  if (user && user.role === ROLES.STUDENT) {
    filter.isPublished = true;
  }

  const menus = await MessMenu.find(filter).lean();

  const meals = {
    dayOfWeek: todayDayOfWeek,
    BREAKFAST: null,
    LUNCH: null,
    SNACKS: null,
    DINNER: null,
  };

  for (const m of menus) {
    if (meals[m.mealType] !== undefined) {
      meals[m.mealType] = m;
    }
  }

  return {
    mess,
    today: new Date().toISOString().split('T')[0],
    dayOfWeek: todayDayOfWeek,
    meals,
  };
};

export const publishMenu = async (menuId, user) => {
  const menu = await MessMenu.findById(menuId).populate('messId');
  if (!menu) {
    throw new ApiError(404, 'Menu not found');
  }

  menu.isPublished = true;
  menu.updatedBy = user._id;
  await menu.save();

  // Notify students in this mess's hostel
  Promise.resolve().then(async () => {
    try {
      const hostelId = menu.messId?.hostelId;
      if (hostelId) {
        const students = await User.find({
          hostelId,
          role: ROLES.STUDENT,
          isActive: true,
        }).select('_id').lean();

        const recipientIds = students.map((s) => s._id);
        if (recipientIds.length > 0) {
          await createBatchNotifications(recipientIds, {
            type: NOTIFICATION_TYPES.MESS_MENU_PUBLISHED,
            title: 'Mess Menu Published',
            message: `${menu.dayOfWeek} ${menu.mealType} menu has been published for ${menu.messId.name}.`,
            relatedEntityType: 'MESS_MENU',
            relatedEntityId: menu._id,
            metadata: {
              messId: menu.messId._id,
              dayOfWeek: menu.dayOfWeek,
              mealType: menu.mealType,
            },
          });
        }
      }
    } catch (err) {
      console.error('[messService] Publish notification error:', err.message);
    }
  });

  return menu;
};

export const unpublishMenu = async (menuId, user) => {
  const menu = await MessMenu.findById(menuId);
  if (!menu) {
    throw new ApiError(404, 'Menu not found');
  }

  menu.isPublished = false;
  menu.updatedBy = user._id;
  await menu.save();

  return menu;
};

// ==========================================
// 3. STUDENT FOOD FEEDBACK
// ==========================================

export const submitFeedback = async (data, studentUser) => {
  if (studentUser.role !== ROLES.STUDENT) {
    throw new ApiError(403, 'Only students can submit meal feedback');
  }

  let { messId, mealType, mealDate, rating, foodQuality, taste, hygiene, quantity, comments } = data;

  if (!messId && studentUser.hostelId) {
    const studentMess = await Mess.findOne({ hostelId: studentUser.hostelId });
    if (studentMess) messId = studentMess._id;
  }

  if (!messId || !mealType || !mealDate || rating === undefined || !foodQuality) {
    throw new ApiError(400, 'messId, mealType, mealDate, rating (1-5), and foodQuality are required');
  }

  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    throw new ApiError(400, 'Rating must be an integer between 1 and 5');
  }

  const normalizedMeal = mealType.trim().toUpperCase();
  if (!MEAL_TYPE_VALUES.includes(normalizedMeal)) {
    throw new ApiError(400, `Invalid meal type: ${mealType}`);
  }

  const normalizedQuality = foodQuality.trim().toUpperCase();
  if (!FOOD_QUALITY_VALUES.includes(normalizedQuality)) {
    throw new ApiError(400, `Invalid food quality: ${foodQuality}`);
  }

  const mess = await Mess.findById(messId);
  if (!mess) {
    throw new ApiError(404, 'Mess not found');
  }

  // Normalize mealDate to UTC midnight (YYYY-MM-DD)
  const parsedDate = new Date(mealDate);
  if (isNaN(parsedDate.getTime())) {
    throw new ApiError(400, 'Invalid meal date format');
  }
  const normalizedDate = new Date(
    Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate())
  );

  // Duplicate Check: one feedback per student per mess per meal per day
  const existing = await MessFeedback.findOne({
    studentId: studentUser._id,
    messId: mess._id,
    mealDate: normalizedDate,
    mealType: normalizedMeal,
  });

  if (existing) {
    throw new ApiError(
      409,
      `You have already submitted feedback for ${normalizedMeal} on ${normalizedDate.toISOString().split('T')[0]}`
    );
  }

  const feedbackId = await generateFeedbackId();

  const feedback = await MessFeedback.create({
    feedbackId,
    studentId: studentUser._id,
    hostelId: studentUser.hostelId || mess.hostelId,
    messId: mess._id,
    mealType: normalizedMeal,
    mealDate: normalizedDate,
    rating: numRating,
    foodQuality: normalizedQuality,
    taste: taste ? Number(taste) : 3,
    hygiene: hygiene ? Number(hygiene) : 3,
    quantity: quantity ? Number(quantity) : 3,
    comments: comments?.trim() || '',
  });

  // Operational Hygiene & Quality Monitoring Check
  Promise.resolve().then(async () => {
    try {
      if (feedback.hygiene < 3 || feedback.rating <= 2) {
        // Compute recent 7-day hygiene average
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const stats = await MessFeedback.aggregate([
          {
            $match: {
              messId: mess._id,
              createdAt: { $gte: sevenDaysAgo },
            },
          },
          {
            $group: {
              _id: null,
              avgHygiene: { $avg: '$hygiene' },
              avgRating: { $avg: '$rating' },
              count: { $sum: 1 },
            },
          },
        ]);

        if (stats.length > 0 && stats[0].count >= HYGIENE_ALERT_THRESHOLDS.MIN_REVIEWS) {
          const avgHygiene = stats[0].avgHygiene;
          if (avgHygiene < HYGIENE_ALERT_THRESHOLDS.ALERT_THRESHOLD_RATING) {
            // Find authorities and hostel warden
            const wardensAndAuthorities = await User.find({
              $or: [
                { role: ROLES.AUTHORITY },
                { role: ROLES.WARDEN, hostelId: mess.hostelId },
                { role: ROLES.SUPER_ADMIN },
              ],
              isActive: true,
            }).select('_id').lean();

            const recipientIds = wardensAndAuthorities.map((u) => u._id);
            if (recipientIds.length > 0) {
              await createBatchNotifications(recipientIds, {
                type: NOTIFICATION_TYPES.MESS_HYGIENE_ALERT,
                title: 'Mess Hygiene Alert: Attention Required',
                message: `Mess "${mess.name}" has recorded an average hygiene score of ${avgHygiene.toFixed(1)}/5 over ${stats[0].count} recent reviews. Immediate inspection recommended.`,
                relatedEntityType: 'MESS',
                relatedEntityId: mess._id,
                metadata: {
                  messId: mess._id,
                  avgHygiene: Math.round(avgHygiene * 10) / 10,
                  totalReviews: stats[0].count,
                },
              });
            }
          }
        }
      }
    } catch (alertErr) {
      console.error('[messService] Hygiene alert evaluation error:', alertErr.message);
    }
  });

  return feedback;
};

export const getMyFeedbacks = async (studentUser, query = {}) => {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit || '10', 10)));
  const skip = (page - 1) * limit;

  const filter = { studentId: studentUser._id };
  if (query.mealType) {
    filter.mealType = query.mealType.trim().toUpperCase();
  }

  const [feedbacks, total] = await Promise.all([
    MessFeedback.find(filter)
      .populate('messId', 'name code')
      .sort({ mealDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MessFeedback.countDocuments(filter),
  ]);

  return {
    feedbacks,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getMessFeedbacks = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.messId && mongoose.isValidObjectId(query.messId)) {
    filter.messId = query.messId;
  }
  if (query.mealType) {
    filter.mealType = query.mealType.trim().toUpperCase();
  }
  if (query.rating) {
    filter.rating = Number(query.rating);
  }
  if (query.foodQuality) {
    filter.foodQuality = query.foodQuality.trim().toUpperCase();
  }

  const [feedbacks, total] = await Promise.all([
    MessFeedback.find(filter)
      .populate('studentId', 'name studentId email')
      .populate('messId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MessFeedback.countDocuments(filter),
  ]);

  return {
    feedbacks,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// ==========================================
// 4. MESS NOTICES
// ==========================================

export const createNotice = async (data, user) => {
  const { messId, title, message, priority, effectiveUntil } = data;

  if (!messId || !title || !message) {
    throw new ApiError(400, 'messId, title, and message are required');
  }

  const mess = await Mess.findById(messId);
  if (!mess) {
    throw new ApiError(404, 'Mess not found');
  }

  const noticeId = await generateNoticeId();

  const notice = await MessNotice.create({
    noticeId,
    messId: mess._id,
    title: title.trim(),
    message: message.trim(),
    priority: priority ? priority.trim().toUpperCase() : 'NORMAL',
    effectiveFrom: new Date(),
    effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
    isActive: true,
    createdBy: user._id,
  });

  // Notify students of hostel
  Promise.resolve().then(async () => {
    try {
      const students = await User.find({
        hostelId: mess.hostelId,
        role: ROLES.STUDENT,
        isActive: true,
      }).select('_id').lean();

      const recipientIds = students.map((s) => s._id);
      if (recipientIds.length > 0) {
        await createBatchNotifications(recipientIds, {
          type: NOTIFICATION_TYPES.MESS_NOTICE_POSTED,
          title: `Mess Notice: ${notice.title}`,
          message: notice.message,
          relatedEntityType: 'MESS_NOTICE',
          relatedEntityId: notice._id,
          metadata: {
            messId: mess._id,
            priority: notice.priority,
          },
        });
      }
    } catch (notifErr) {
      console.error('[messService] Notice notification error:', notifErr.message);
    }
  });

  return notice;
};

export const getNotices = async (messId, query = {}) => {
  const filter = { messId };

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  } else {
    filter.isActive = true;
  }

  const notices = await MessNotice.find(filter)
    .populate('createdBy', 'name role')
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  return notices;
};

export const toggleNoticeActive = async (noticeId, isActive, user) => {
  const notice = await MessNotice.findById(noticeId);
  if (!notice) {
    throw new ApiError(404, 'Notice not found');
  }

  notice.isActive = Boolean(isActive);
  await notice.save();

  return notice;
};

// ==========================================
// 5. DASHBOARD & OPERATIONAL ANALYTICS
// ==========================================

export const getMessDashboard = async (user, query = {}) => {
  await ensureMessSeeded();
  let targetMessId = query.messId;

  // Resolve mess context if not provided
  if (!targetMessId) {
    if (user.hostelId) {
      const hostelMess = await Mess.findOne({ hostelId: user.hostelId, isActive: true }).lean();
      if (hostelMess) {
        targetMessId = hostelMess._id;
      }
    }
    if (!targetMessId) {
      const firstMess = await Mess.findOne({ isActive: true }).lean();
      if (firstMess) {
        targetMessId = firstMess._id;
      }
    }
  }

  if (!targetMessId) {
    return {
      mess: null,
      todayMenu: null,
      stats: {
        totalFeedbacks: 0,
        averageRating: 0,
        avgHygiene: 0,
        avgTaste: 0,
        avgQuantity: 0,
        hygieneStatus: 'HEALTHY',
      },
      qualityBreakdown: {},
      complaints: { open: 0, resolved: 0 },
      notices: [],
      recentFeedbacks: [],
    };
  }

  const mess = await Mess.findById(targetMessId)
    .populate('hostelId', 'name code')
    .populate('managerId', 'name email phone')
    .lean();

  if (!mess) {
    throw new ApiError(404, 'Mess not found');
  }

  // Today's menu
  const todayMenuData = await getTodayMenu(mess._id, user);

  // Ratings aggregation
  const feedbackStats = await MessFeedback.aggregate([
    { $match: { messId: mess._id } },
    {
      $group: {
        _id: null,
        totalFeedbacks: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        avgTaste: { $avg: '$taste' },
        avgHygiene: { $avg: '$hygiene' },
        avgQuantity: { $avg: '$quantity' },
      },
    },
  ]);

  const stats = feedbackStats[0] || {
    totalFeedbacks: 0,
    avgRating: 0,
    avgTaste: 0,
    avgHygiene: 0,
    avgQuantity: 0,
  };

  const avgHygieneRounded = Math.round((stats.avgHygiene || 0) * 10) / 10;
  let hygieneStatus = 'HEALTHY';
  if (stats.totalFeedbacks >= HYGIENE_ALERT_THRESHOLDS.MIN_REVIEWS) {
    if (avgHygieneRounded < HYGIENE_ALERT_THRESHOLDS.CRITICAL_THRESHOLD_RATING) {
      hygieneStatus = 'CRITICAL_HYGIENE_ATTENTION';
    } else if (avgHygieneRounded < HYGIENE_ALERT_THRESHOLDS.ALERT_THRESHOLD_RATING) {
      hygieneStatus = 'HYGIENE_ATTENTION_REQUIRED';
    }
  }

  // Food Quality category distribution
  const qualityStats = await MessFeedback.aggregate([
    { $match: { messId: mess._id } },
    {
      $group: {
        _id: '$foodQuality',
        count: { $sum: 1 },
      },
    },
  ]);

  const qualityBreakdown = {};
  FOOD_QUALITY_VALUES.forEach((q) => {
    qualityBreakdown[q] = 0;
  });
  qualityStats.forEach((s) => {
    if (s._id) qualityBreakdown[s._id] = s.count;
  });

  // Complaints in Category MESS for this mess/hostel
  const complaintStats = await Complaint.aggregate([
    {
      $match: {
        category: 'MESS',
        $or: [{ messId: mess._id }, { hostelId: mess.hostelId }],
      },
    },
    {
      $group: {
        _id: {
          isOpen: {
            $in: ['$status', ['SUBMITTED', 'TRIAGED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'REOPENED']],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  let openComplaints = 0;
  let resolvedComplaints = 0;
  complaintStats.forEach((c) => {
    if (c._id.isOpen) openComplaints += c.count;
    else resolvedComplaints += c.count;
  });

  // Notices
  const notices = await MessNotice.find({ messId: mess._id, isActive: true })
    .sort({ priority: -1, createdAt: -1 })
    .limit(5)
    .lean();

  // Recent feedbacks
  const recentFeedbacks = await MessFeedback.find({ messId: mess._id })
    .populate('studentId', 'name studentId')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return {
    mess,
    todayMenu: todayMenuData.meals,
    stats: {
      totalFeedbacks: stats.totalFeedbacks,
      averageRating: Math.round((stats.avgRating || 0) * 10) / 10,
      avgTaste: Math.round((stats.avgTaste || 0) * 10) / 10,
      avgHygiene: avgHygieneRounded,
      avgQuantity: Math.round((stats.avgQuantity || 0) * 10) / 10,
      hygieneStatus,
    },
    qualityBreakdown,
    complaints: {
      open: openComplaints,
      resolved: resolvedComplaints,
    },
    notices,
    recentFeedbacks,
  };
};

export const getFoodQualityAnalytics = async (user, query = {}) => {
  const match = {};
  if (query.messId && mongoose.isValidObjectId(query.messId)) {
    match.messId = new mongoose.Types.ObjectId(query.messId);
  } else if (user.hostelId && user.role !== ROLES.SUPER_ADMIN && user.role !== ROLES.AUTHORITY) {
    const hostelMess = await Mess.findOne({ hostelId: user.hostelId }).lean();
    if (hostelMess) {
      match.messId = hostelMess._id;
    }
  }

  // 1. Ratings by Meal Type
  const mealTypeStats = await MessFeedback.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$mealType',
        avgRating: { $avg: '$rating' },
        avgTaste: { $avg: '$taste' },
        avgHygiene: { $avg: '$hygiene' },
        avgQuantity: { $avg: '$quantity' },
        count: { $sum: 1 },
      },
    },
    { $sort: { avgRating: 1 } },
  ]);

  const mealRatings = {};
  MEAL_TYPE_VALUES.forEach((meal) => {
    mealRatings[meal] = {
      avgRating: 0,
      avgHygiene: 0,
      count: 0,
      needsAttention: false,
    };
  });

  mealTypeStats.forEach((m) => {
    const roundedRating = Math.round(m.avgRating * 10) / 10;
    mealRatings[m._id] = {
      avgRating: roundedRating,
      avgHygiene: Math.round(m.avgHygiene * 10) / 10,
      avgTaste: Math.round(m.avgTaste * 10) / 10,
      avgQuantity: Math.round(m.avgQuantity * 10) / 10,
      count: m.count,
      needsAttention: m.count >= 2 && roundedRating < 3.0,
    };
  });

  // 2. Daily rating trend (last 14 days)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const trendStats = await MessFeedback.aggregate([
    {
      $match: {
        ...match,
        mealDate: { $gte: fourteenDaysAgo },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$mealDate' } },
        avgRating: { $avg: '$rating' },
        avgHygiene: { $avg: '$hygiene' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // 3. Repeated / Recurring Complaints in Category MESS
  const complaintMatch = { category: 'MESS' };
  if (match.messId) {
    complaintMatch.$or = [{ messId: match.messId }];
  }

  const repeatedIssues = await Complaint.aggregate([
    { $match: complaintMatch },
    {
      $group: {
        _id: '$issueType',
        count: { $sum: 1 },
        openCount: {
          $sum: {
            $cond: [
              {
                $in: ['$status', ['SUBMITTED', 'TRIAGED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'REOPENED']],
              },
              1,
              0,
            ],
          },
        },
        latestOccurrence: { $max: '$createdAt' },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return {
    mealRatings,
    trend: trendStats.map((t) => ({
      date: t._id,
      avgRating: Math.round(t.avgRating * 10) / 10,
      avgHygiene: Math.round(t.avgHygiene * 10) / 10,
      count: t.count,
    })),
    repeatedIssues: repeatedIssues.map((i) => ({
      issueType: i._id,
      count: i.count,
      openCount: i.openCount,
      latestOccurrence: i.latestOccurrence,
    })),
  };
};

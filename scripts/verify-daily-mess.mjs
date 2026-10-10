// scripts/verify-daily-mess.mjs
const BASE = 'http://127.0.0.1:5000/api';

console.log('====================================================');
console.log('STARTING RIGOROUS RUNTIME VERIFICATION');
console.log('====================================================');

// --- Auth Setup ---
const adminLogin = await fetch(BASE + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@bbdu.ac.in', password: 'Password@123' })
}).then(r => r.json());
if (!adminLogin.success) throw new Error('Admin login failed');
const adminToken = adminLogin.data.token;
console.log('✓ Admin authenticated');

const studentLogin = await fetch(BASE + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'student@bbdu.ac.in', password: 'Password@123' })
}).then(r => r.json());
if (!studentLogin.success) throw new Error('Student login failed');
const studentToken = studentLogin.data.token;
const studentUser = studentLogin.data.user;
console.log('✓ Student authenticated:', studentUser.name, 'Hostel:', studentUser.hostelId);

// --- Check Student Allocated Mess ---
const messesRes = await fetch(BASE + '/messes', {
  headers: { Authorization: 'Bearer ' + adminToken }
}).then(r => r.json());
const messes = messesRes.data;
console.log('✓ Messes retrieved:', messes.length, 'mess(es) in database');
const targetMess = messes[0];
const messId = targetMess._id;
console.log('✓ Using Mess:', targetMess.name, '(' + targetMess.code + ') ID:', messId);

// --- POINT 3: Check whether Add Menu form saves a menu for a specific date ---
console.log('\n--- TESTING POINT 3: Save Menu for Specific Date ---');
const testDate = '2026-10-18'; // SUNDAY
const saveDateRes = await fetch(BASE + '/messes/' + messId + '/menus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
  body: JSON.stringify({
    date: testDate,
    mealType: 'LUNCH',
    menuItems: [
      { name: 'Shahi Paneer', category: 'Main Course' },
      { name: 'Jeera Rice', category: 'Rice' },
      { name: 'Butter Naan', category: 'Bread' },
      { name: 'Gulab Jamun', category: 'Dessert' }
    ],
    notes: 'Sunday Special Feast',
    isPublished: true,
  })
}).then(r => r.json());
console.log('Point 3 Result:', {
  success: saveDateRes.success,
  date: saveDateRes.data?.date,
  dayOfWeek: saveDateRes.data?.dayOfWeek,
  mealType: saveDateRes.data?.mealType,
  itemsCount: saveDateRes.data?.menuItems?.length,
  firstItem: saveDateRes.data?.menuItems?.[0]?.name,
  notes: saveDateRes.data?.notes,
});
if (saveDateRes.data?.date !== testDate) throw new Error('Date was not saved correctly!');

// --- POINT 4: Verify selecting a date loads published menu for that date ---
console.log('\n--- TESTING POINT 4: Loading Menu for Selected Date ---');
const loadDateRes = await fetch(BASE + '/messes/' + messId + '/menus/today?date=' + testDate, {
  headers: { Authorization: 'Bearer ' + adminToken }
}).then(r => r.json());
console.log('Point 4 Result:', {
  success: loadDateRes.success,
  queryDate: loadDateRes.data?.date,
  dayOfWeek: loadDateRes.data?.dayOfWeek,
  lunchLoaded: Boolean(loadDateRes.data?.meals?.LUNCH),
  lunchItems: loadDateRes.data?.meals?.LUNCH?.menuItems?.map(i => i.name),
  isScheduledOverride: loadDateRes.data?.meals?.LUNCH?.isScheduledOverride,
});
if (loadDateRes.data?.meals?.LUNCH?.menuItems?.[0]?.name !== 'Shahi Paneer') {
  throw new Error('Menu for selected date did not match!');
}

// --- POINT 5: Verify Student sees ONLY published menus ---
console.log('\n--- TESTING POINT 5: Student View (Only Published Menus) ---');
const draftDate = '2026-10-19'; // MONDAY
// 1. Staff creates draft menu (isPublished: false)
const createDraft = await fetch(BASE + '/messes/' + messId + '/menus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
  body: JSON.stringify({
    date: draftDate,
    mealType: 'DINNER',
    menuItems: [{ name: 'Paneer Bhurji', category: 'Main Course' }],
    notes: 'Draft dinner menu',
    isPublished: false,
  })
}).then(r => r.json());
console.log('Draft menu created (isPublished: false):', createDraft.data?._id);

// 2. Student queries draft date: must be null
const studentDraftView = await fetch(BASE + '/messes/' + messId + '/menus/today?date=' + draftDate, {
  headers: { Authorization: 'Bearer ' + studentToken }
}).then(r => r.json());
console.log('Student view for draft dinner (expecting null):', studentDraftView.data?.meals?.DINNER);
if (studentDraftView.data?.meals?.DINNER !== null) {
  throw new Error('FAILED: Student was able to view unpublished draft menu!');
}

// 3. Staff publishes the menu
const publishRes = await fetch(BASE + '/messes/menus/' + createDraft.data._id + '/publish', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + adminToken }
}).then(r => r.json());
console.log('Menu published by staff:', publishRes.success);

// 4. Student queries again: now visible
const studentPublishedView = await fetch(BASE + '/messes/' + messId + '/menus/today?date=' + draftDate, {
  headers: { Authorization: 'Bearer ' + studentToken }
}).then(r => r.json());
console.log('Student view after publication:', studentPublishedView.data?.meals?.DINNER?.menuItems?.[0]?.name);
if (!studentPublishedView.data?.meals?.DINNER) {
  throw new Error('FAILED: Student could not view published menu!');
}

// --- POINT 6: Verify weekly recurring menus work as intended ---
console.log('\n--- TESTING POINT 6: Weekly Recurring Menus & Priority Override ---');
// 1. Staff creates recurring menu for FRIDAY dinner (date: null)
const recurringSave = await fetch(BASE + '/messes/' + messId + '/menus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
  body: JSON.stringify({
    dayOfWeek: 'FRIDAY',
    mealType: 'DINNER',
    menuItems: [{ name: 'Dal Makhani', category: 'Main Course' }, { name: 'Laccha Paratha', category: 'Bread' }],
    notes: 'Every Friday Dinner',
    isPublished: true,
  })
}).then(r => r.json());
console.log('Recurring Friday menu saved:', recurringSave.data?.dayOfWeek, recurringSave.data?.date);

// 2. Query Friday 2026-10-16 (no date override): should return recurring Dal Makhani
const friday1 = await fetch(BASE + '/messes/' + messId + '/menus/today?date=2026-10-16', {
  headers: { Authorization: 'Bearer ' + studentToken }
}).then(r => r.json());
console.log('Friday 2026-10-16 (Recurring fallback):', {
  date: friday1.data?.date,
  dayOfWeek: friday1.data?.dayOfWeek,
  dinnerItem: friday1.data?.meals?.DINNER?.menuItems?.[0]?.name,
  isScheduledOverride: friday1.data?.meals?.DINNER?.isScheduledOverride,
});
if (friday1.data?.meals?.DINNER?.menuItems?.[0]?.name !== 'Dal Makhani') {
  throw new Error('FAILED: Recurring weekly menu did not load!');
}

// 3. Now add date-specific override for Friday 2026-10-23
const fridayOverride = await fetch(BASE + '/messes/' + messId + '/menus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
  body: JSON.stringify({
    date: '2026-10-23',
    mealType: 'DINNER',
    menuItems: [{ name: 'Special Dum Biryani', category: 'Main Course' }],
    notes: 'Special Friday Feast Override',
    isPublished: true,
  })
}).then(r => r.json());
console.log('Override added for 2026-10-23:', fridayOverride.data?.menuItems?.[0]?.name);

// 4. Query 2026-10-23: should return Special Dum Biryani (isScheduledOverride: true)
const friday2 = await fetch(BASE + '/messes/' + messId + '/menus/today?date=2026-10-23', {
  headers: { Authorization: 'Bearer ' + studentToken }
}).then(r => r.json());
console.log('Friday 2026-10-23 (Date override):', {
  date: friday2.data?.date,
  dinnerItem: friday2.data?.meals?.DINNER?.menuItems?.[0]?.name,
  isScheduledOverride: friday2.data?.meals?.DINNER?.isScheduledOverride,
});
if (friday2.data?.meals?.DINNER?.menuItems?.[0]?.name !== 'Special Dum Biryani') {
  throw new Error('FAILED: Date override did not take precedence!');
}

// 5. Query 2026-10-16 again: should STILL be Dal Makhani (unaffected!)
const friday1Again = await fetch(BASE + '/messes/' + messId + '/menus/today?date=2026-10-16', {
  headers: { Authorization: 'Bearer ' + studentToken }
}).then(r => r.json());
console.log('Friday 2026-10-16 (Still recurring):', {
  dinnerItem: friday1Again.data?.meals?.DINNER?.menuItems?.[0]?.name,
  isScheduledOverride: friday1Again.data?.meals?.DINNER?.isScheduledOverride,
});
if (friday1Again.data?.meals?.DINNER?.menuItems?.[0]?.name !== 'Dal Makhani') {
  throw new Error('FAILED: Other recurring date was incorrectly mutated!');
}

// --- POINT 7: Check changing date or moving to next day loads correct menu ---
console.log('\n--- TESTING POINT 7: Sequential Date Stepping ---');
const dateSequence = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'];
const expectedDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

for (let i = 0; i < dateSequence.length; i++) {
  const dStr = dateSequence[i];
  const expDay = expectedDays[i];
  const res = await fetch(BASE + '/messes/' + messId + '/menus/today?date=' + dStr, {
    headers: { Authorization: 'Bearer ' + studentToken }
  }).then(r => r.json());
  console.log(`Step ${i + 1}: ${dStr} -> Day: ${res.data?.dayOfWeek} (expected ${expDay}) [OK: ${res.data?.dayOfWeek === expDay}]`);
  if (res.data?.dayOfWeek !== expDay) throw new Error(`Day mismatch for ${dStr}`);
}

console.log('\n====================================================');
console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY WITH 100% PASS RATE');
console.log('====================================================');

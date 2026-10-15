import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  todayKey,
  hourAtHostel,
  shiftDay,
  weekdayOf,
  buildDayStrip,
  mealPhase,
  canRate,
  starsToFeedback,
  parseDishes,
  dishesText,
  menuStatus,
  ratedMap,
  sortNotices,
} from '../src/utils/messPresentation.js';

test('todayKey and hourAtHostel use the hostel time zone, not the phone\'s', () => {
  // 20:00 UTC on 14 October is 01:30 on 15 October in India
  const moment = new Date('2026-10-14T20:00:00Z');
  assert.equal(todayKey(moment), '2026-10-15');
  assert.equal(hourAtHostel(moment), 1);
  // midnight in India is hour 0, never 24
  assert.equal(hourAtHostel(new Date('2026-10-14T18:30:00Z')), 0);
});

test('shiftDay and weekdayOf work on plain calendar dates across month ends', () => {
  assert.equal(shiftDay('2026-10-31', 1), '2026-11-01');
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(weekdayOf('2026-10-15'), 'THURSDAY');
  assert.equal(weekdayOf('2026-10-18'), 'SUNDAY');
});

test('buildDayStrip gives yesterday, today and tomorrow by default and any other span on request', () => {
  assert.deepEqual(buildDayStrip('2026-10-15'), [
    { key: '2026-10-14', offset: -1 },
    { key: '2026-10-15', offset: 0 },
    { key: '2026-10-16', offset: 1 },
  ]);
  const week = buildDayStrip('2026-10-15', 1, 6);
  assert.equal(week.length, 8);
  assert.equal(week.at(-1).key, '2026-10-21');
});

test('mealPhase marks past days served, future days later, and follows the hour today', () => {
  const base = { today: '2026-10-15' };
  assert.equal(mealPhase({ ...base, meal: 'DINNER', dateKey: '2026-10-14', hour: 9 }), 'served');
  assert.equal(mealPhase({ ...base, meal: 'BREAKFAST', dateKey: '2026-10-16', hour: 20 }), 'later');
  // 12 o'clock: breakfast served, lunch now, snacks next, dinner later
  assert.equal(mealPhase({ ...base, meal: 'BREAKFAST', dateKey: '2026-10-15', hour: 12 }), 'served');
  assert.equal(mealPhase({ ...base, meal: 'LUNCH', dateKey: '2026-10-15', hour: 12 }), 'now');
  assert.equal(mealPhase({ ...base, meal: 'SNACKS', dateKey: '2026-10-15', hour: 12 }), 'next');
  assert.equal(mealPhase({ ...base, meal: 'DINNER', dateKey: '2026-10-15', hour: 12 }), 'later');
  // in the evening nothing is "next" after dinner
  assert.equal(mealPhase({ ...base, meal: 'DINNER', dateKey: '2026-10-15', hour: 20 }), 'now');
});

test('canRate only for meals already served or being served that have a published menu', () => {
  assert.equal(canRate({ phase: 'served', hasMenu: true }), true);
  assert.equal(canRate({ phase: 'now', hasMenu: true }), true);
  assert.equal(canRate({ phase: 'next', hasMenu: true }), false);
  assert.equal(canRate({ phase: 'later', hasMenu: true }), false);
  assert.equal(canRate({ phase: 'served', hasMenu: false }), false);
});

test('starsToFeedback turns one tap into every field the server needs', () => {
  assert.deepEqual(starsToFeedback(5), { rating: 5, foodQuality: 'EXCELLENT', taste: 5, hygiene: 5, quantity: 5 });
  assert.deepEqual(starsToFeedback(1), { rating: 1, foodQuality: 'VERY_POOR', taste: 1, hygiene: 1, quantity: 1 });
  assert.equal(starsToFeedback(4).foodQuality, 'GOOD');
  assert.equal(starsToFeedback(3).foodQuality, 'AVERAGE');
  assert.equal(starsToFeedback(2).foodQuality, 'POOR');
});

test('starsToFeedback lets the quick answers override only their own score and clamps bad input', () => {
  const f = starsToFeedback(4, { taste: 'bad', clean: 'good' });
  assert.equal(f.rating, 4);
  assert.equal(f.taste, 1);
  assert.equal(f.hygiene, 5);
  assert.equal(f.quantity, 4);
  assert.equal(starsToFeedback(9).rating, 5);
  assert.equal(starsToFeedback(0).rating, 1);
  assert.equal(starsToFeedback(undefined).rating, 1);
});

test('parseDishes accepts lines or commas, removes blanks and repeats, and refuses unreasonable lists', () => {
  assert.deepEqual(parseDishes('Dal\n Rice, Roti\n\nDal').items.map((i) => i.name), ['Dal', 'Rice', 'Roti']);
  assert.equal(parseDishes('Dal').items[0].category, 'Main Course');
  assert.equal(parseDishes('  \n ').problem, 'empty');
  assert.equal(parseDishes(Array.from({ length: 21 }, (_, i) => `Dish ${i}`).join('\n')).problem, 'tooMany');
  assert.equal(parseDishes('x'.repeat(61)).problem, 'tooLong');
  assert.equal(parseDishes('Dal').problem, null);
});

test('dishesText and menuStatus describe a stored menu', () => {
  const menu = { menuItems: [{ name: 'Poha' }, { name: 'Tea' }], isPublished: true };
  assert.equal(dishesText(menu), 'Poha\nTea');
  assert.equal(dishesText(null), '');
  assert.equal(menuStatus(menu), 'published');
  assert.equal(menuStatus({ ...menu, isPublished: false }), 'draft');
  assert.equal(menuStatus(null), 'missing');
  assert.equal(menuStatus({ menuItems: [], isPublished: true }), 'missing');
});

test('ratedMap remembers which meals the student already rated', () => {
  const map = ratedMap([
    { mealDate: '2026-10-15T00:00:00.000Z', mealType: 'LUNCH', rating: 4 },
    { mealDate: '2026-10-14T00:00:00.000Z', mealType: 'DINNER', rating: 2 },
    { mealType: 'LUNCH', rating: 5 },
  ]);
  assert.equal(map.get('2026-10-15|LUNCH'), 4);
  assert.equal(map.get('2026-10-14|DINNER'), 2);
  assert.equal(map.size, 2);
  assert.equal(ratedMap(null).size, 0);
});

test('sortNotices puts urgent first, then important, then the newest of the rest', () => {
  const sorted = sortNotices([
    { _id: 'a', priority: 'NORMAL', createdAt: '2026-10-10' },
    { _id: 'b', priority: 'URGENT', createdAt: '2026-10-01' },
    { _id: 'c', priority: 'NORMAL', createdAt: '2026-10-12' },
    { _id: 'd', priority: 'IMPORTANT', createdAt: '2026-10-05' },
  ]).map((n) => n._id);
  assert.deepEqual(sorted, ['b', 'd', 'c', 'a']);
  assert.deepEqual(sortNotices(undefined), []);
});

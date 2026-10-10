import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARY, translate, SUPPORTED_LANGUAGES } from '../src/i18n/dictionary.js';
import {
  COMPLAINT_CATEGORY_VALUES,
  COMPLAINT_PRIORITY_VALUES,
} from '../../backend/src/constants/complaint.constants.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('English and Hindi have exactly the same keys', () => {
  const en = Object.keys(DICTIONARY.en).sort();
  const hi = Object.keys(DICTIONARY.hi).sort();
  assert.deepEqual(hi.filter((k) => !en.includes(k)), [], 'keys only in Hindi');
  assert.deepEqual(en.filter((k) => !hi.includes(k)), [], 'keys missing in Hindi');
});

test('no label is empty or only whitespace', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    for (const [key, value] of Object.entries(DICTIONARY[lang])) {
      assert.equal(typeof value, 'string', `${lang}.${key} must be a string`);
      assert.ok(value.trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test('placeholders match between languages so no value is lost in translation', () => {
  for (const key of Object.keys(DICTIONARY.en)) {
    assert.deepEqual(
      placeholders(DICTIONARY.hi[key]),
      placeholders(DICTIONARY.en[key]),
      `placeholders differ for ${key}`
    );
  }
});

test('every backend complaint category and priority has a label in both languages', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    for (const category of COMPLAINT_CATEGORY_VALUES) {
      assert.ok(DICTIONARY[lang][`category.${category}`], `${lang} missing category.${category}`);
    }
    for (const priority of COMPLAINT_PRIORITY_VALUES) {
      assert.ok(DICTIONARY[lang][`priority.${priority}`], `${lang} missing priority.${priority}`);
    }
  }
});

test('Hindi labels really are Hindi (contain Devanagari) except the language names', () => {
  const allowedLatin = new Set(['lang.en']);
  for (const [key, value] of Object.entries(DICTIONARY.hi)) {
    if (allowedLatin.has(key)) continue;
    assert.ok(/[ऀ-ॿ]/.test(value), `hi.${key} has no Devanagari text: ${value}`);
  }
});

test('translate fills placeholders, falls back to English, then to the key', () => {
  assert.equal(translate('en', 'jobs.hello', { name: 'Ramesh' }), 'Hello, Ramesh');
  assert.equal(translate('hi', 'jobs.hello', { name: 'Ramesh' }), 'नमस्ते, Ramesh');
  assert.equal(translate('fr', 'action.finish'), 'Work finished', 'unknown language uses English');
  assert.equal(translate('en', 'no.such.key'), 'no.such.key');
  assert.equal(translate('en', 'due.late'), 'Late by {time}', 'unfilled placeholder stays visible');
  assert.equal(translate('en', 'time.hours', { n: 0 }), '0 hr', 'zero is a real value');
});

test('the agreed plain-language terms are used for the core actions', () => {
  assert.equal(DICTIONARY.en['action.acknowledge'], 'I got it');
  assert.equal(DICTIONARY.en['action.start'], 'Start work');
  assert.equal(DICTIONARY.en['action.finish'], 'Work finished');
  assert.equal(DICTIONARY.en['stage.working'], 'Being fixed');
  assert.equal(DICTIONARY.en['section.waiting'], 'Waiting for student to confirm');
  assert.equal(DICTIONARY.en['priority.CRITICAL'], 'Very urgent');
  assert.equal(DICTIONARY.en['priority.LOW'], 'Can wait');
});

test('every password rule code has a plain-language message in both languages', async () => {
  const { getPasswordPolicyIssue } = await import('../src/utils/passwordPolicy.js');
  const cases = { short: 'length', abcdefgh1: 'upper', ABCDEFGH1: 'lower', Abcdefgh: 'digit', Abcdefg1: '' };
  for (const [password, expected] of Object.entries(cases)) {
    assert.equal(getPasswordPolicyIssue(password), expected, password);
  }
  assert.equal(getPasswordPolicyIssue('A1a'.repeat(50)), 'max');
  for (const code of ['length', 'max', 'upper', 'lower', 'digit']) {
    for (const lang of SUPPORTED_LANGUAGES) {
      assert.ok(DICTIONARY[lang][`pw.err.${code}`], `${lang} is missing pw.err.${code}`);
    }
  }
});

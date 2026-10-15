import test from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed } from '../src/utils/corsOrigin.js';

const allowedOrigins = ['https://hosteller.bbdu.ac.in'];

test('1. A request with no Origin header (curl, mobile app, test runner) is allowed', () => {
  assert.equal(isOriginAllowed(undefined, { allowedOrigins, isProduction: true }), true);
});

test('2. An origin listed in CLIENT_URL is allowed, also in production', () => {
  assert.equal(isOriginAllowed('https://hosteller.bbdu.ac.in', { allowedOrigins, isProduction: true }), true);
});

test('3. In production nothing outside the list is allowed, not even localhost', () => {
  assert.equal(isOriginAllowed('https://evil.example.com', { allowedOrigins, isProduction: true }), false);
  assert.equal(isOriginAllowed('http://localhost:5173', { allowedOrigins, isProduction: true }), false);
  assert.equal(isOriginAllowed('http://192.168.1.20:5173', { allowedOrigins, isProduction: true }), false);
});

test('4. Outside production, localhost and private network addresses are allowed', () => {
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://192.168.1.20:5173', 'http://10.0.0.5:5173', 'http://172.16.4.9:5173', 'http://172.31.255.1:5173']) {
    assert.equal(isOriginAllowed(origin, { allowedOrigins, isProduction: false }), true, origin);
  }
});

test('5. Outside production, an unknown website is still refused', () => {
  assert.equal(isOriginAllowed('https://evil.example.com', { allowedOrigins, isProduction: false }), false);
});

test('6. Look-alike hosts are not mistaken for localhost or a private address', () => {
  for (const origin of [
    'https://evil-localhost.com',
    'https://localhost.evil.com',
    'https://127.0.0.1.evil.com',
    'http://192.168.1.20.evil.com',
    'http://172.32.0.1:5173',
    'http://172.15.0.1:5173',
    'ftp://localhost',
    'not a url',
  ]) {
    assert.equal(isOriginAllowed(origin, { allowedOrigins, isProduction: false }), false, origin);
  }
});

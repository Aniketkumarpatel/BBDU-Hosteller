import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { safeExtension, isRoomMediaUrl, removeUploadedFiles } from '../src/utils/uploadFiles.js';

test('1. The saved extension comes from the checked file type, never from the file name', () => {
  assert.equal(safeExtension('image/png'), '.png');
  assert.equal(safeExtension('IMAGE/JPEG'), '.jpg');
  assert.equal(safeExtension('video/quicktime'), '.mov');
  assert.equal(safeExtension('application/pdf'), '.pdf');
});

test('2. Types that are not on the list get no extension at all', () => {
  for (const mime of ['text/html', 'image/svg+xml', 'application/javascript', '', undefined, null]) {
    assert.equal(safeExtension(mime), '', String(mime));
  }
});

test('3. Only files this server stored for rooms are accepted as room media URLs', () => {
  assert.equal(isRoomMediaUrl('/uploads/rooms/photos/room-photo-1-2.jpg'), true);
  assert.equal(isRoomMediaUrl('/uploads/rooms/videos/room-video-1-2.mp4'), true);
  assert.equal(isRoomMediaUrl('/uploads/rooms/photos/room101-1-bed.svg'), true);
});

test('4. Other websites, scripts, other folders and path tricks are refused as room media URLs', () => {
  for (const value of [
    'https://evil.example/pixel.png',
    '//evil.example/pixel.png',
    'javascript:alert(1)',
    'data:text/html,<script>1</script>',
    '/uploads/complaints/complaint-1.png',
    '/uploads/rooms/photos/../../complaints/x.png',
    '/uploads/rooms/photos/',
    '/uploads/rooms/photos/a b.png',
    '',
    42,
    null,
    undefined,
  ]) {
    assert.equal(isRoomMediaUrl(value), false, String(value));
  }
});

test('5. removeUploadedFiles deletes what multer wrote and ignores missing files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbdu-upload-'));
  const a = path.join(dir, 'a.png');
  const b = path.join(dir, 'b.mp4');
  fs.writeFileSync(a, 'x');
  fs.writeFileSync(b, 'y');
  await removeUploadedFiles({ photos: [{ path: a }], videos: [{ path: b }, { path: path.join(dir, 'missing.mp4') }] });
  assert.equal(fs.existsSync(a), false);
  assert.equal(fs.existsSync(b), false);
  await removeUploadedFiles(undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

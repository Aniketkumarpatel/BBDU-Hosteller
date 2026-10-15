import fs from 'fs';
import path from 'path';
import env from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Room from '../src/models/Room.js';

const photosDir = path.join(process.cwd(), 'uploads', 'rooms', 'photos');
const videosDir = path.join(process.cwd(), 'uploads', 'rooms', 'videos');

if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

function generateSvgCard({ roomNum, type, tag, title, details, icon, bgGradient, accentColor }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradient[0]}"/>
        <stop offset="100%" stop-color="${bgGradient[1]}"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04"/>
      </linearGradient>
    </defs>
    <rect width="800" height="480" fill="url(#bgGrad)"/>
    <circle cx="700" cy="80" r="140" fill="${accentColor}" fill-opacity="0.15" />
    <circle cx="100" cy="400" r="180" fill="#ffffff" fill-opacity="0.04" />
    
    <rect x="50" y="45" width="700" height="390" rx="24" fill="url(#cardGrad)" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2"/>
    
    <!-- Top Bar -->
    <rect x="75" y="70" width="160" height="34" rx="10" fill="${accentColor}" fill-opacity="0.3" stroke="${accentColor}" stroke-width="1.5"/>
    <text x="155" y="92" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">ROOM ${roomNum} • ${type}</text>
    
    <rect x="585" y="70" width="140" height="34" rx="10" fill="#ffffff" fill-opacity="0.15"/>
    <text x="655" y="92" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#ffffff" text-anchor="middle">${tag}</text>

    <!-- Center Icon Feature -->
    <g transform="translate(140, 240)">
      <circle cx="0" cy="0" r="70" fill="#ffffff" fill-opacity="0.1" stroke="${accentColor}" stroke-width="3"/>
      <text x="0" y="24" font-size="64" text-anchor="middle">${icon}</text>
    </g>

    <!-- Content Text -->
    <text x="250" y="210" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="800" fill="#ffffff">${title}</text>
    <text x="250" y="250" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500" fill="#e2e8f0">${details[0]}</text>
    <text x="250" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500" fill="#cbd5e1">${details[1]}</text>
    <text x="250" y="310" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="500" fill="#94a3b8">${details[2]}</text>

    <!-- Verified Facility Badge -->
    <rect x="75" y="380" width="230" height="32" rx="8" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="1"/>
    <text x="190" y="401" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="bold" fill="#34d399" text-anchor="middle">✓ BBDU Verified Facility</text>

    <text x="700" y="401" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#94a3b8" text-anchor="end">Warden Inspected</text>
  </svg>`;
}

function generateVideoPlaceholderSvg({ roomNum, type, acStatus }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="100%" height="100%">
    <defs>
      <linearGradient id="vidBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="50%" stop-color="#1e1b4b"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
    </defs>
    <rect width="800" height="480" fill="url(#vidBg)"/>
    <circle cx="400" cy="210" r="54" fill="#4f46e5" fill-opacity="0.4" stroke="#818cf8" stroke-width="2"/>
    <polygon points="390,190 422,210 390,230" fill="#ffffff"/>
    
    <text x="400" y="295" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">15-Second Room Walkthrough Video</text>
    <text x="400" y="325" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="#94a3b8" text-anchor="middle">Room ${roomNum} • ${type} (${acStatus}) • Full 360° Walkthrough</text>

    <rect x="280" y="360" width="240" height="34" rx="10" fill="#ffffff" fill-opacity="0.1" stroke="#ffffff" stroke-opacity="0.2"/>
    <text x="400" y="382" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#c7d2fe" text-anchor="middle">⏱ Approx 15s Walkthrough Clip</text>
  </svg>`;
}

await connectDB();

// 1. Room 101 (Single AC)
const r101Assets = [
  generateSvgCard({
    roomNum: '101',
    type: 'SINGLE SHARING',
    tag: 'FACILITY 1 OF 4',
    title: 'Individual Wooden Bed',
    details: ['High-density foam mattress provided', 'Clean linen & protected headboard', 'Immediate Availability (1 Bed Open)'],
    icon: '🛏️',
    bgGradient: ['#1e1b4b', '#312e81'],
    accentColor: '#818cf8',
  }),
  generateSvgCard({
    roomNum: '101',
    type: 'SINGLE SHARING',
    tag: 'FACILITY 2 OF 4',
    title: 'Study Table & Ergonomic Chair',
    details: ['Spacious wooden writing desk', 'Ergonomic lumbar support study chair', 'Dedicated reading light power point'],
    icon: '🪑',
    bgGradient: ['#0f172a', '#1e293b'],
    accentColor: '#38bdf8',
  }),
  generateSvgCard({
    roomNum: '101',
    type: 'SINGLE SHARING',
    tag: 'FACILITY 3 OF 4',
    title: 'Personal Steel Almirah',
    details: ['Heavy-gauge rustproof steel wardrobe', 'Internal locker for valuables', 'Full-length hanging & storage shelves'],
    icon: '🚪',
    bgGradient: ['#1e1b4b', '#1e293b'],
    accentColor: '#a855f7',
  }),
  generateSvgCard({
    roomNum: '101',
    type: 'SINGLE SHARING',
    tag: 'FACILITY 4 OF 4',
    title: 'Air Conditioner (AC) Unit',
    details: ['High-efficiency energy-saving AC unit', 'Individual climate control thermostat', '24x7 Inverter & Generator power backup'],
    icon: '❄️',
    bgGradient: ['#0c4a6e', '#075985'],
    accentColor: '#38bdf8',
  }),
];

// 2. Room 202 (Double Non-AC)
const r202Assets = [
  generateSvgCard({
    roomNum: '202',
    type: 'DOUBLE SHARING',
    tag: 'FACILITY 1 OF 4',
    title: 'Twin Available Beds',
    details: ['Spacious 2-sharing layout with ample gap', 'Supportive orthopaedic mattresses', '1 Available Bed open for viewing'],
    icon: '🛏️',
    bgGradient: ['#1e1b4b', '#1e293b'],
    accentColor: '#6366f1',
  }),
  generateSvgCard({
    roomNum: '202',
    type: 'DOUBLE SHARING',
    tag: 'FACILITY 2 OF 4',
    title: 'Dual Study Tables & Chairs',
    details: ['Two separate individual study workstations', 'Two padded study chairs with backrest', 'Independent charging sockets per desk'],
    icon: '🪑',
    bgGradient: ['#1e293b', '#334155'],
    accentColor: '#38bdf8',
  }),
  generateSvgCard({
    roomNum: '202',
    type: 'DOUBLE SHARING',
    tag: 'FACILITY 3 OF 4',
    title: 'Dual Storage Almirahs',
    details: ['Two separate lockable steel almirahs', 'Dedicated luggage & book compartments', 'Secure key sets provided'],
    icon: '🚪',
    bgGradient: ['#14532d', '#166534'],
    accentColor: '#4ade80',
  }),
  generateSvgCard({
    roomNum: '202',
    type: 'DOUBLE SHARING',
    tag: 'FACILITY 4 OF 4',
    title: 'Ceiling Fan & Natural Cross-Ventilation',
    details: ['High-speed ceiling fans (Non-AC configuration)', 'Large window overlooking university greenery', 'Continuous fresh air & natural daylight'],
    icon: '🪟',
    bgGradient: ['#78350f', '#92400e'],
    accentColor: '#fbbf24',
  }),
];

// 3. Room 303 (Triple AC)
const r303Assets = [
  generateSvgCard({
    roomNum: '303',
    type: 'TRIPLE SHARING',
    tag: 'FACILITY 1 OF 4',
    title: '3-Bed Junior Wing Layout',
    details: ['Well-spaced triple bed arrangement', 'Premium cotton mattresses & clean pillows', '2 Available Beds open for preview'],
    icon: '🛏️',
    bgGradient: ['#1e1b4b', '#312e81'],
    accentColor: '#818cf8',
  }),
  generateSvgCard({
    roomNum: '303',
    type: 'TRIPLE SHARING',
    tag: 'FACILITY 2 OF 4',
    title: '3 Study Tables & 3 Chairs',
    details: ['Three dedicated study tables for junior students', 'Three sturdy ergonomic study chairs', 'High-speed Wi-Fi access at all desks'],
    icon: '🪑',
    bgGradient: ['#0f172a', '#1e293b'],
    accentColor: '#38bdf8',
  }),
  generateSvgCard({
    roomNum: '303',
    type: 'TRIPLE SHARING',
    tag: 'FACILITY 3 OF 4',
    title: '3 Independent Steel Almirahs',
    details: ['Three full-size individual steel almirahs', 'Each with private secure locker & key', 'Organized clothes rails & shelves'],
    icon: '🚪',
    bgGradient: ['#4a044e', '#701a75'],
    accentColor: '#e879f9',
  }),
  generateSvgCard({
    roomNum: '303',
    type: 'TRIPLE SHARING',
    tag: 'FACILITY 4 OF 4',
    title: 'Air Conditioning (AC) & Power Backup',
    details: ['Split AC unit tailored for triple room size', '24x7 campus inverter backup support', 'Fresh air exhaust ventilation'],
    icon: '❄️',
    bgGradient: ['#0c4a6e', '#0369a1'],
    accentColor: '#38bdf8',
  }),
];

// Write photo SVGs
fs.writeFileSync(path.join(photosDir, 'room101-1-bed.svg'), r101Assets[0]);
fs.writeFileSync(path.join(photosDir, 'room101-2-table-chair.svg'), r101Assets[1]);
fs.writeFileSync(path.join(photosDir, 'room101-3-almirah.svg'), r101Assets[2]);
fs.writeFileSync(path.join(photosDir, 'room101-4-ac.svg'), r101Assets[3]);

fs.writeFileSync(path.join(photosDir, 'room202-1-bed.svg'), r202Assets[0]);
fs.writeFileSync(path.join(photosDir, 'room202-2-table-chair.svg'), r202Assets[1]);
fs.writeFileSync(path.join(photosDir, 'room202-3-almirah.svg'), r202Assets[2]);
fs.writeFileSync(path.join(photosDir, 'room202-4-ventilation.svg'), r202Assets[3]);

fs.writeFileSync(path.join(photosDir, 'room303-1-bed.svg'), r303Assets[0]);
fs.writeFileSync(path.join(photosDir, 'room303-2-table-chair.svg'), r303Assets[1]);
fs.writeFileSync(path.join(photosDir, 'room303-3-almirah.svg'), r303Assets[2]);
fs.writeFileSync(path.join(photosDir, 'room303-4-ac.svg'), r303Assets[3]);

// Write video card representations
fs.writeFileSync(path.join(videosDir, 'room101-walkthrough.svg'), generateVideoPlaceholderSvg({ roomNum: '101', type: 'Single Sharing', acStatus: 'AC' }));
fs.writeFileSync(path.join(videosDir, 'room202-walkthrough.svg'), generateVideoPlaceholderSvg({ roomNum: '202', type: 'Double Sharing', acStatus: 'Non-AC' }));
fs.writeFileSync(path.join(videosDir, 'room303-walkthrough.svg'), generateVideoPlaceholderSvg({ roomNum: '303', type: 'Triple Sharing', acStatus: 'AC' }));

// Update MongoDB rooms with these 4 images & 1 video
const r101 = await Room.findOne({ roomNumber: '101', isVirtualVisitRoom: true });
if (r101) {
  r101.photos = [
    '/uploads/rooms/photos/room101-1-bed.svg',
    '/uploads/rooms/photos/room101-2-table-chair.svg',
    '/uploads/rooms/photos/room101-3-almirah.svg',
    '/uploads/rooms/photos/room101-4-ac.svg',
  ];
  r101.videos = ['/uploads/rooms/videos/room101-walkthrough.svg'];
  r101.facilities = ['Available Bed', 'Chair', 'Table', 'Almirah', 'AC', 'High-Speed Wi-Fi', 'Geyser', 'Power Backup'];
  r101.isAc = true;
  await r101.save();
}

const r202 = await Room.findOne({ roomNumber: '202', isVirtualVisitRoom: true });
if (r202) {
  r202.photos = [
    '/uploads/rooms/photos/room202-1-bed.svg',
    '/uploads/rooms/photos/room202-2-table-chair.svg',
    '/uploads/rooms/photos/room202-3-almirah.svg',
    '/uploads/rooms/photos/room202-4-ventilation.svg',
  ];
  r202.videos = ['/uploads/rooms/videos/room202-walkthrough.svg'];
  r202.facilities = ['Available Bed', 'Chair', 'Table', 'Almirah', 'Non-AC', 'High-Speed Wi-Fi', 'Geyser', 'Power Backup'];
  r202.isAc = false;
  await r202.save();
}

const r303 = await Room.findOne({ roomNumber: '303', isVirtualVisitRoom: true });
if (r303) {
  r303.photos = [
    '/uploads/rooms/photos/room303-1-bed.svg',
    '/uploads/rooms/photos/room303-2-table-chair.svg',
    '/uploads/rooms/photos/room303-3-almirah.svg',
    '/uploads/rooms/photos/room303-4-ac.svg',
  ];
  r303.videos = ['/uploads/rooms/videos/room303-walkthrough.svg'];
  r303.facilities = ['Available Bed', 'Chair', 'Table', 'Almirah', 'AC', 'High-Speed Wi-Fi', 'Geyser', 'Power Backup'];
  r303.isAc = true;
  await r303.save();
}

console.log('✓ Successfully created 4 clear facility images and 15s walkthrough video cards for all 3 rooms!');
await disconnectDB();

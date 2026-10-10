import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { createWorker } from 'tesseract.js';
import ApiError from '../utils/ApiError.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];

// Multilingual day aliases (English, Hindi, Hinglish)
const DAY_PATTERNS = [
  { day: 'MONDAY', regex: /\b(monday|mon|somwar|somvaar|som|सोमवार|सोम)\b/i },
  { day: 'TUESDAY', regex: /\b(tuesday|tue|tues|mangalwar|mangalvaar|mangal|मंगलवार|मंगल)\b/i },
  { day: 'WEDNESDAY', regex: /\b(wednesday|wed|budhwar|budhvaar|budh|बुधवार|बुध)\b/i },
  { day: 'THURSDAY', regex: /\b(thursday|thu|thur|thurs|guruwar|guruvaar|veerwar|brihaspatiwar|गुरुवार|वीरवार|बृहस्पतिवार|गुरु)\b/i },
  { day: 'FRIDAY', regex: /\b(friday|fri|shukrawar|shukravaar|shukra|शुक्रवार|शुक्र)\b/i },
  { day: 'SATURDAY', regex: /\b(saturday|sat|shaniwar|shanivaar|shani|शनिवार|शनि)\b/i },
  { day: 'SUNDAY', regex: /\b(sunday|sun|raviwar|ravivaar|itwar|itvaar|itwaar|रविवार|इतवार|रवि)\b/i },
];

// Multilingual meal aliases (English, Hindi, Hinglish)
const MEAL_PATTERNS = [
  { meal: 'BREAKFAST', regex: /\b(breakfast|bfast|bkfst|brkfast|nashta|nasta|naashta|जलपान|नाश्ता)\b/i },
  { meal: 'LUNCH', regex: /\b(lunch|lnch|midday|dopahar|दोपहर का खाना|दोपहर|भोजन)\b/i },
  { meal: 'SNACKS', regex: /\b(snacks|snack|tea|hi-tea|chai|sham ka nashta|चाय|शाम का नाश्ता)\b/i },
  { meal: 'DINNER', regex: /\b(dinner|dnr|supper|raat ka khana|ratri|ratri bhoj|रात्रि भोज|रात का खाना|रात्रि)\b/i },
];

/**
 * Clean and split text into individual dish item names
 */
export const splitAndCleanDishes = (text) => {
  if (!text || typeof text !== 'string') return [];

  // Remove noise headers or time indicators like (7:30 - 9:00 AM)
  let clean = text.replace(/\(\s*\d{1,2}:\d{2}.*?\)/gi, ' ');
  clean = clean.replace(/\[\s*\d{1,2}:\d{2}.*?\]/gi, ' ');
  // Remove day or meal labels if caught inside text
  clean = clean.replace(/\b(breakfast|lunch|snacks|dinner|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s*[:\-]?/gi, ' ');

  // Split on commas, semicolons, bullets, plus signs, newlines, or pipes
  const rawItems = clean
    .split(/[,;\n\r•\+\|/]/)
    .map((item) => item.replace(/^[:–\-*•\d\.\)\s]+/, '').replace(/[:–\-*•\s]+$/, '').trim())
    .filter((item) => {
      // Filter out empty items, digits-only, or very short non-word strings
      if (item.length < 2) return false;
      if (/^\d+$/.test(item)) return false;
      if (/^(am|pm|hrs|time|menu|items|special)$/i.test(item)) return false;
      return true;
    });

  // Deduplicate case-insensitively while preserving natural capitalization
  const uniqueItems = [];
  const seen = new Set();
  for (const item of rawItems) {
    const lower = item.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
};

/**
 * Extract text from images using local Tesseract.js OCR
 */
export const extractTextFromImage = async (filePath) => {
  let worker = null;
  try {
    worker = await createWorker('eng');
    const ret = await worker.recognize(filePath);
    return ret?.data?.text || '';
  } catch (err) {
    throw new ApiError(500, `OCR Engine error processing image: ${err.message}`);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // Safe ignore
      }
    }
  }
};

/**
 * Extract text from PDF files using pdf-parse
 */
export const extractTextFromPdf = async (filePath) => {
  let parser = null;
  try {
    const fileBuffer = fs.readFileSync(filePath);
    parser = new PDFParse({ data: fileBuffer });
    const result = await parser.getText();
    const text = result?.text || '';
    return text;
  } catch (err) {
    throw new ApiError(500, `PDF text extraction error: ${err.message}`);
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Safe ignore
      }
    }
  }
};

/**
 * Parse extracted raw text into a structured 7-day weekly timetable
 */
export const parseWeeklyTimetable = (rawText) => {
  // Initialize standard empty structure
  const schedule = {};
  for (const day of DAYS_OF_WEEK) {
    schedule[day] = {
      BREAKFAST: [],
      LUNCH: [],
      SNACKS: [],
      DINNER: [],
    };
  }

  const warnings = [];

  if (!rawText || rawText.trim().length === 0) {
    return {
      parsedSchedule: schedule,
      summary: {
        totalDaysDetected: 0,
        totalMealsDetected: 0,
        confidence: 'LOW',
        daysDetected: [],
        warnings: ['No readable text could be found in the uploaded file.'],
      },
    };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let currentDay = null;
  let currentMeal = null;
  const daysDetectedSet = new Set();
  let totalMealsDetected = 0;

  for (const line of lines) {
    // 1. Check if the line begins or contains a day heading
    let matchedDay = null;
    for (const dp of DAY_PATTERNS) {
      if (dp.regex.test(line)) {
        matchedDay = dp.day;
        break;
      }
    }

    if (matchedDay) {
      currentDay = matchedDay;
      daysDetectedSet.add(matchedDay);
      currentMeal = null; // Reset meal when day changes
    }

    // 2. Check if the line also has a meal identifier
    let lineMeal = null;
    for (const mp of MEAL_PATTERNS) {
      if (mp.regex.test(line)) {
        lineMeal = mp.meal;
        break;
      }
    }

    if (lineMeal) {
      currentMeal = lineMeal;
      if (currentDay) {
        // Extract content after meal keyword
        const parts = line.split(new RegExp(`\\b${lineMeal}\\b`, 'i'));
        const itemPortion = parts[1] || '';
        const dishes = splitAndCleanDishes(itemPortion);
        if (dishes.length > 0) {
          schedule[currentDay][currentMeal].push(...dishes);
        }
      }
      continue;
    }

    // 3. If line belongs to an active day and meal, collect items
    if (currentDay && currentMeal) {
      const dishes = splitAndCleanDishes(line);
      if (dishes.length > 0) {
        schedule[currentDay][currentMeal].push(...dishes);
      }
    }
  }

  // Deduplicate and clean collected items per day & meal
  for (const day of DAYS_OF_WEEK) {
    for (const meal of MEAL_TYPES) {
      const unique = Array.from(new Set(schedule[day][meal]));
      schedule[day][meal] = unique;
      if (unique.length > 0) {
        totalMealsDetected++;
      }
    }
  }

  // Calculate extraction confidence
  let confidence = 'LOW';
  if (daysDetectedSet.size >= 5 && totalMealsDetected >= 15) {
    confidence = 'HIGH';
  } else if (daysDetectedSet.size >= 2 || totalMealsDetected >= 6) {
    confidence = 'MEDIUM';
  }

  if (daysDetectedSet.size < 7) {
    const missingDays = DAYS_OF_WEEK.filter((d) => !daysDetectedSet.has(d));
    warnings.push(
      `Detected ${daysDetectedSet.size} of 7 weekdays. Missing or incomplete: ${missingDays.join(', ')}.`
    );
  }

  return {
    parsedSchedule: schedule,
    summary: {
      totalDaysDetected: daysDetectedSet.size,
      totalMealsDetected,
      confidence,
      daysDetected: Array.from(daysDetectedSet),
      warnings,
    },
  };
};

/**
 * Main service entrypoint for document menu extraction
 */
export const extractWeeklyMenuFromFile = async ({ filePath, originalName, mimeType }) => {
  if (!fs.existsSync(filePath)) {
    throw new ApiError(404, 'Uploaded file not found on server');
  }

  const ext = path.extname(originalName || filePath).toLowerCase();
  const isPdf = ext === '.pdf' || mimeType === 'application/pdf';

  let rawText = '';
  let fileType = isPdf ? 'PDF' : 'IMAGE';

  try {
    if (isPdf) {
      rawText = await extractTextFromPdf(filePath);
      // Check if PDF is a scanned image without a native text layer
      if (!rawText || rawText.trim().length < 15) {
        return {
          fileName: path.basename(originalName || 'document.pdf'),
          fileType: 'PDF',
          rawText: '',
          parsedSchedule: parseWeeklyTimetable('').parsedSchedule,
          summary: {
            totalDaysDetected: 0,
            totalMealsDetected: 0,
            confidence: 'LOW',
            daysDetected: [],
            warnings: [
              'This PDF appears to be a scanned image without an embedded digital text layer. For best results, please take a clear photo/screenshot and upload as a JPG or PNG.',
            ],
          },
        };
      }
    } else {
      rawText = await extractTextFromImage(filePath);
    }

    const { parsedSchedule, summary } = parseWeeklyTimetable(rawText);

    return {
      fileName: path.basename(originalName || 'timetable'),
      fileType,
      rawText,
      parsedSchedule,
      summary,
    };
  } finally {
    // Requirement: Securely clean up temporary files without leaving clutter
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Safe ignore file deletion error
    }
  }
};

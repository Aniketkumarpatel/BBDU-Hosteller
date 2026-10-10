import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // fallback
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Mess, MessMenu } from '../src/models/index.js';

export const OFFICIAL_BBDU_MENU = {
  MONDAY: {
    BREAKFAST: [
      'Ajwain Paratha',
      'Matar Chola',
      'Tea',
      'Milk 200 ml',
      'Banana- 02',
    ],
    LUNCH: [
      'Black Masoor Dal',
      'Lauki Jeera Sabji',
      'Rice',
      'Boondi Raita',
      'Salad',
      'Achaar',
      'Roti',
    ],
    SNACKS: [
      'Vegetable Chowmein',
      'Sauce',
      'Tea',
    ],
    DINNER: [
      'Mix Daal',
      'Aaloo Lobiya ki Sabji',
      'Roti',
      'Rice',
      'Salad',
      'Achaar',
      'Baalu Shahi',
    ],
  },
  TUESDAY: {
    BREAKFAST: [
      'Vegetable Suji Upma',
      'Bread Butter- 04',
      'Milk 200 ml',
      'Tea',
      'Banana- 02',
    ],
    LUNCH: [
      'Arhar Daal',
      'Aaloo Pyaj Sabji',
      'Kheera Raita',
      'Rice',
      'Salad',
      'Achaar',
      'Roti',
    ],
    SNACKS: [
      'Namakpara',
      'Tea',
    ],
    DINNER: [
      'Chola',
      'Aaloo Jeera',
      'Poori / Bhatoora',
      'Jeera Rice',
      'Salad',
      'Achaar',
      'Icecream- 01 (Amul, Creambell, Havmor, Vadilal)',
    ],
  },
  WEDNESDAY: {
    BREAKFAST: [
      'Aaloo Paratha with Hari Chatni',
      'Meethi Daliya',
      'Tea',
      'Banana- 02',
      'Egg- 02',
    ],
    LUNCH: [
      'Paneer Butter Masala',
      'Dal Panchmail',
      'Boondi Raita',
      'Rice',
      'Roti',
      'Salad',
      'Achaar',
    ],
    SNACKS: [
      'Matar Chaat with Onion and chilly',
      'Meethi Chatni or Vegetable Paasta with sauce',
      'Tea',
    ],
    DINNER: [
      'Arhar Daal',
      'Aaloo Soyabean lutputi sabji',
      'Roti',
      'Rice',
      'Salad',
      'Achaar',
      'Meethi Boondi',
    ],
  },
  THURSDAY: {
    BREAKFAST: [
      'Vegetable Poha',
      'Sprouts',
      'Cornflakes',
      'Tea',
      'Milk 200 ml',
      'Banana- 02',
    ],
    LUNCH: [
      'Kadhi Pakoda',
      'Aaloo Jeera with Kasuri Methi',
      'Rice',
      'Salad',
      'Achaar',
      'Roti',
    ],
    SNACKS: [
      'Bhelpuri',
      'Tea',
    ],
    DINNER: [
      'Lauki Chana Daal',
      'Aaloo Parval Sookhi Sabji',
      'Roti',
      'Rice',
      'Salad',
      'Achaar',
      'Rice Kheer',
    ],
  },
  FRIDAY: {
    BREAKFAST: [
      'Poori',
      'Aaloo Matar Tamatar ki Sabji',
      'Tea',
      'Milk 200 ml',
      'Banana- 02',
    ],
    LUNCH: [
      'Rajma Masala',
      'Mix Vegetable',
      'Rice',
      'Kheera Raita',
      'Salad',
      'Achaar',
      'Roti',
    ],
    SNACKS: [
      'Samosa- 02',
      'Meethi Chatni',
      'Tea',
    ],
    DINNER: [
      'Matar Paneer',
      'Veg Biryani',
      'Boondi Raita',
      'Salad',
      'Achaar',
      'Roti',
      'Fruits Custard',
    ],
  },
  SATURDAY: {
    BREAKFAST: [
      'Idli Sambhar',
      'Milk 200 ml',
      'Tea',
      'Cornflakes',
      'Banana- 02',
    ],
    LUNCH: [
      'Arhar Daal',
      'Aaloo Parval',
      'Roti',
      'Rice',
      'Boondi Raita',
      'Salad',
      'Achaar',
    ],
    SNACKS: [
      'Aaloo Matar Sandwich- 02',
      'Sauce',
      'Tea',
    ],
    DINNER: [
      'Black Masoor Dal',
      'Lauki Kofta',
      'Roti',
      'Rice',
      'Salad',
      'Achaar',
      'Suji Halwa',
    ],
  },
  SUNDAY: {
    BREAKFAST: [
      'Chana Daal Kachauri',
      'Hari Chatni',
      'Milk 200 ml',
      'Tea',
      'Banana- 02',
    ],
    LUNCH: [
      'Tehri',
      'Aloo Tamatar Sabji',
      'Hari Chatni',
      'Dahi',
      'Papad',
      'Salad',
      'Achaar',
      'Roti',
    ],
    SNACKS: [
      'Chana Masala',
      'Tea',
    ],
    DINNER: [
      'Arhar Dal Tadka',
      'Kashmiri Dum Aaloo',
      'Egg Curry- 02',
      'Rice',
      'Roti',
      'Salad',
      'Achaar',
      'Jalebi- 02',
    ],
  },
};

async function applyOfficialMenu() {
  await connectDB(process.env.MONGODB_URI);
  const messes = await Mess.find();
  console.log(`Found ${messes.length} messes in MongoDB Atlas.`);

  for (const mess of messes) {
    console.log(`Applying official menu to ${mess.name} (${mess.code})...`);

    // First, remove old date-specific overrides from previous verification tests so the weekly timetable shines
    const deleteOverrides = await MessMenu.deleteMany({
      messId: mess._id,
      date: { $ne: null },
    });
    console.log(`Cleared ${deleteOverrides.deletedCount} old date-specific overrides.`);

    const days = Object.keys(OFFICIAL_BBDU_MENU);
    for (const day of days) {
      for (const meal of ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER']) {
        const dishNames = OFFICIAL_BBDU_MENU[day][meal];
        const menuItems = dishNames.map((name) => ({ name, category: 'Main Course' }));

        const filter = {
          messId: mess._id,
          dayOfWeek: day,
          mealType: meal,
          $or: [{ date: null }, { date: { $exists: false } }],
        };

        let existing = await MessMenu.findOne(filter);
        if (existing) {
          existing.menuItems = menuItems;
          existing.notes = `Official BBDU Hostel Timetable (w.e.f. 22.09.2026) for ${day}`;
          existing.isPublished = true;
          await existing.save();
          console.log(`✓ Updated ${day} ${meal} (${dishNames.length} items)`);
        } else {
          await MessMenu.create({
            menuId: `MENU-2026-${Math.floor(10000 + Math.random() * 90000)}`,
            messId: mess._id,
            date: null,
            dayOfWeek: day,
            mealType: meal,
            menuItems,
            notes: `Official BBDU Hostel Timetable (w.e.f. 22.09.2026) for ${day}`,
            isPublished: true,
          });
          console.log(`✓ Created ${day} ${meal} (${dishNames.length} items)`);
        }
      }
    }
  }

  console.log('🎉 All 7 days & 28 meals from the official BBDU timetable are now saved in Atlas DB!');
  await disconnectDB();
}

applyOfficialMenu().catch(console.error);

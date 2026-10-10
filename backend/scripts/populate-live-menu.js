import { connectDB, disconnectDB } from '../src/config/db.js';
import { Mess, MessMenu } from '../src/models/index.js';
import dotenv from 'dotenv';
dotenv.config();

async function populateWeeklyMenu() {
  await connectDB(process.env.MONGODB_URI);
  const mess = await Mess.findOne();
  if (!mess) {
    console.log('No mess found');
    return;
  }
  console.log('Populating 7-day weekly schedule for mess:', mess.name, mess._id);

  const weeklySchedule = {
    MONDAY: {
      BREAKFAST: ['Aloo Paratha', 'Fresh Curd', 'Pickle', 'Hot Tea / Coffee'],
      LUNCH: ['Dal Makhani', 'Jeera Rice', 'Tawa Butter Roti', 'Green Salad', 'Boondi Raita'],
      SNACKS: ['Crispy Samosa', 'Mint Chutney', 'Masala Chai'],
      DINNER: ['Shahi Paneer', 'Steamed Rice', 'Chapati', 'Hot Gulab Jamun'],
    },
    TUESDAY: {
      BREAKFAST: ['Indori Poha', 'Boiled Eggs / Sprouts', 'Hot Tea / Milk'],
      LUNCH: ['Punjabi Rajma Masala', 'Steamed Basmati Rice', 'Roti', 'Cucumber Raita'],
      SNACKS: ['Vegetable Cutlet', 'Tomato Sauce', 'Tea'],
      DINNER: ['Mix Vegetable Curry', 'Yellow Dal Tadka', 'Jeera Rice', 'Roti', 'Kheer'],
    },
    WEDNESDAY: {
      BREAKFAST: ['South Indian Idli Sambar', 'Coconut Chutney', 'Filter Coffee'],
      LUNCH: ['Amritsari Chole', 'Bhature / Roti', 'Jeera Rice', 'Onion Salad'],
      SNACKS: ['Veg Grilled Sandwich', 'Chai'],
      DINNER: ['Kadai Paneer', 'Dal Fry', 'Steamed Rice', 'Butter Roti', 'Moong Dal Halwa'],
    },
    THURSDAY: {
      BREAKFAST: ['Methi Paratha', 'Butter', 'Curd', 'Tea'],
      LUNCH: ['Kadhi Pakoda', 'Steamed Rice', 'Roti', 'Aloo Gobi', 'Papad'],
      SNACKS: ['Bread Pakoda', 'Green Chutney', 'Tea'],
      DINNER: ['Matar Paneer', 'Dal Tadka', 'Jeera Rice', 'Tawa Chapati', 'Fruit Custard'],
    },
    FRIDAY: {
      BREAKFAST: ['Veg Upma', 'Coconut Chutney', 'Boiled Eggs / Sprouts', 'Tea'],
      LUNCH: ['Dal Palak', 'Steamed Rice', 'Roti', 'Aloo Jeera Dry', 'Salad'],
      SNACKS: ['Onion Pakoda', 'Chai', 'Biscuits'],
      DINNER: ['Hyderabadi Veg Biryani', 'Mix Veg Raita', 'Mirchi Ka Salan', 'Gulab Jamun'],
    },
    SATURDAY: {
      BREAKFAST: ['Mumbai Pav Bhaji', 'Butter Pav', 'Chopped Onions', 'Hot Tea'],
      LUNCH: ['Rajma Chawal', 'Tawa Roti', 'Mixed Pickle', 'Green Salad'],
      SNACKS: ['Roasted Masala Peanuts', 'Tea / Coffee', 'Cookies'],
      DINNER: ['Paneer Butter Masala', 'Yellow Dal Fry', 'Jeera Rice', 'Chapati', 'Ice Cream'],
    },
    SUNDAY: {
      BREAKFAST: ['Bedmi Puri', 'Aloo Sabzi', 'Suji Halwa', 'Special Chai'],
      LUNCH: ['Sunday Special Feast: Shahi Paneer', 'Dal Makhani', 'Butter Naan', 'Veg Pulao', 'Gulab Jamun'],
      SNACKS: ['Veg Cheese Burger / Puff', 'Cold Coffee / Tea'],
      DINNER: ['Dal Khichdi', 'Desi Ghee', 'Papad', 'Achar', 'Curd'],
    },
  };

  const days = Object.keys(weeklySchedule);
  for (const day of days) {
    for (const meal of ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER']) {
      const dishes = weeklySchedule[day][meal].map((name) => ({ name, category: 'Main Course' }));
      let existing = await MessMenu.findOne({
        messId: mess._id,
        dayOfWeek: day,
        mealType: meal,
        $or: [{ date: null }, { date: { $exists: false } }],
      });

      if (existing) {
        existing.menuItems = dishes;
        existing.isPublished = true;
        existing.notes = `Weekly recurring schedule for ${day}`;
        await existing.save();
        console.log('Updated', day, meal, dishes.length, 'items');
      } else {
        await MessMenu.create({
          menuId: `MENU-2026-${Math.floor(10000 + Math.random() * 90000)}`,
          messId: mess._id,
          date: null,
          dayOfWeek: day,
          mealType: meal,
          menuItems: dishes,
          notes: `Weekly recurring schedule for ${day}`,
          isPublished: true,
        });
        console.log('Created', day, meal, dishes.length, 'items');
      }
    }
  }

  console.log('✓ Successfully populated 7-day weekly schedule for all 28 meal slots!');
  await disconnectDB();
}

populateWeeklyMenu().catch(console.error);

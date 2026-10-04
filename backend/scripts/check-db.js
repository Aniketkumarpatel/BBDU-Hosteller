/**
 * Connectivity check:  npm run db:check
 * Connects with MONGODB_URI from backend/.env, builds model indexes and prints
 * the collections / indexes. Exit code 1 if the URI is missing or unreachable.
 */
import env from '../src/config/env.js';
import { connectDB, disconnectDB, getDbStatus } from '../src/config/db.js';
import { allModels } from '../src/models/index.js';

if (!env.MONGODB_URI) {
  console.error('MONGODB_URI is not set in backend/.env - configuration required.');
  process.exit(1);
}

try {
  await connectDB();
  console.log('Status:', getDbStatus());
  for (const [name, model] of Object.entries(allModels)) {
    try {
      const indexes = await model.collection.indexes();
      console.log(`- ${name} (${model.collection.name}): ${indexes.map((i) => i.name).join(', ')}`);
    } catch (_e) {
      // Collection may not have been created yet
      console.log(`- ${name} (${model.collection.name}): [uninitialized/empty]`);
    }
  }
  await disconnectDB();
  console.log('OK');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

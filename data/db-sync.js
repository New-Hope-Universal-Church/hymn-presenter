/**
 * db-sync.js
 * Checks the lyrics API for a newer dataset. Called from Help -> Check for
 * Database Updates. Startup uses the same call (Database._syncFromCloud).
 * When the local cache is already current the API sends nothing back.
 */

async function syncDatabase(db) {
  try {
    const { changed, version } = await db._syncFromCloud();
    return changed
      ? { status: 'updated', version, message: 'Database synced successfully.' }
      : { status: 'up-to-date', version, message: 'Your hymn database is the latest version.' };
  } catch (err) {
    console.log('Sync failed:', err.message);
    return { status: 'offline', message: 'Could not reach server. Using local cache.' };
  }
}

module.exports = { syncDatabase };

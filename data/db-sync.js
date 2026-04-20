/**
 * db-sync.js
 * Triggers a fresh sync from Supabase into the local cache.
 * Called manually from Help → Check for Database Updates.
 *
 * Uses the FULL sync (drop + rebuild) so any stale rows or rows
 * deleted by other clients are cleared out. The startup sync
 * (Database._syncFromCloud) uses the safer upsert-only merge to
 * avoid wiping concurrent writes from the user.
 */

async function syncDatabase(db) {
  try {
    await db._syncFromCloudFull();
    return { status: 'updated', message: 'Database synced successfully.' };
  } catch (err) {
    console.log('Sync failed:', err.message);
    return { status: 'offline', message: 'Could not reach server. Using local cache.' };
  }
}

module.exports = { syncDatabase };
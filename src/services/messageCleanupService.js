/**
 * Message retention cleanup service
 * Automatically deletes messages older than 7 days to prevent database bloat
 */
import { pool } from "../db/index.js";

export async function deleteOldMessages() {
  try {
    const result = await pool.query(
      `SELECT delete_old_messages() AS deleted_count;`,
    );

    if (result.rows.length > 0) {
      console.log(
        `[MessageCleanup] Cleanup completed at ${new Date().toISOString()}`,
      );
    }
    return result.rows;
  } catch (error) {
    console.error(
      `[MessageCleanup] Error deleting old messages:`,
      error.message,
    );
    throw error;
  }
}

/**
 * Start the message cleanup job
 * Runs every 24 hours (once a day)
 * Can be called during application startup
 */
export function startMessageCleanupJob(intervalMs = 24 * 60 * 60 * 1000) {
  console.log(
    `[MessageCleanup] Starting message cleanup job (runs every ${intervalMs / (60 * 60 * 1000)} hours)`,
  );

  // Run cleanup immediately on startup
  deleteOldMessages().catch((err) => {
    console.error("[MessageCleanup] Initial cleanup failed:", err.message);
  });

  // Schedule recurring cleanup
  setInterval(() => {
    deleteOldMessages().catch((err) => {
      console.error("[MessageCleanup] Scheduled cleanup failed:", err.message);
    });
  }, intervalMs);
}

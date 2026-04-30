/**
 * Message retention cleanup service
 * Automatically deletes messages older than 7 days to prevent database bloat
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function deleteOldMessages() {
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await prisma.message.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    console.log(
      `[MessageCleanup] Deleted ${result.count} old messages at ${new Date().toISOString()}`,
    );
    return result;
  } catch (error) {
    console.error(
      "[MessageCleanup] Error deleting old messages:",
      error.message,
    );
    throw error;
  }
}

/**
 * Start the message cleanup job
 * Runs every 24 hours (once a day)
 */
function startMessageCleanupJob(intervalMs = 24 * 60 * 60 * 1000) {
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

module.exports = { deleteOldMessages, startMessageCleanupJob };

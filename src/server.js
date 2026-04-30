const env = require("./config/env");
const { createApp } = require("./app");
const { startMessageCleanupJob } = require("./services/messageCleanupService");

const app = createApp();

// Start message cleanup job (runs every 24 hours)
startMessageCleanupJob();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${env.port}`);
});

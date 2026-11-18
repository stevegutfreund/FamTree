const path = require("path");
const FILE = path.basename(__filename).split(".js")[0].toUpperCase();

const memberService = require("./member.service");
const backupService = require("./backup.service");

module.exports = {
  init,
};

async function init() {
  await memberService.load();

  // Initialize backup system
  backupService.scheduleAutoBackup();

  // Create initial backup on startup
  try {
    await backupService.createBackup("System startup backup");
    logger.info(`[${FILE}] Initial backup created successfully`);
  } catch (error) {
    logger.warn(`[${FILE}] Failed to create initial backup: ${error.message}`);
  }
}

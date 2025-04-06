const { ipcMain } = require("electron");
const { processImages } = require("../process/processImages");
const { loadSettings } = require("./settingsHandler");
const fs = require("fs");
const path = require("path");

// Get the app data path for logging
const { app } = require("electron");
const logPath = path.join(app.getPath("userData"), "processing-log.txt");

// Simple helper to log errors safely
function logError(message) {
  console.error(message);
  try {
    fs.appendFileSync(
      logPath,
      `${new Date().toISOString()} - ${message}\n`,
      "utf8"
    );
  } catch (err) {
    console.error("Failed to write to log file:", err);
  }
}

const progressTracker = {
  total: 0,
  processed: 0,
  reset() {
    this.total = 0;
    this.processed = 0;
  },
  setTotal(total) {
    this.total = total;
    try {
      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send("processing-start", { total });
        console.log("Sent processing-start event to renderer:", { total });
      } else {
        logError("Cannot send processing-start: mainWindow not available");
      }
    } catch (err) {
      logError(`Error in setTotal: ${err.message}`);
    }
  },
  increment() {
    this.processed++;
    try {
      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send("processing-progress", {
          current: this.processed,
          total: this.total,
          percent: Math.round((this.processed / this.total) * 100),
        });
      } else {
        logError("Cannot send processing-progress: mainWindow not available");
      }
    } catch (err) {
      logError(`Error in increment: ${err.message}`);
    }
  },
};

function registerProcessingHandler() {
  ipcMain.handle("submit-config", async (event, config) => {
    try {
      const settings = loadSettings();

      progressTracker.reset();

      const onBatchStart = (total) => progressTracker.setTotal(total);
      const onImageProcessed = () => progressTracker.increment();

      global.progressEvents = { onBatchStart, onImageProcessed };

      const results = await processImages(
        config.path,
        {
          titleLength: settings.titleLength,
          descriptionLength: settings.descriptionLength,
          keywordCount: settings.keywordCount,
          isPremium: settings.isPremium,
        },
        settings.apiKey
      );

      if (results.outputDir && !results.outputDirectory) {
        results.outputDirectory = results.outputDir;
      }

      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send("processing-results", results);
        console.log("Sent processing-results event to renderer");
      } else {
        logError("Cannot send processing-results: mainWindow not available");
      }

      return { success: true, message: "Processing completed successfully" };
    } catch (err) {
      console.error("Processing error:", err);
      logError(`Processing error: ${err.message}\n${err.stack}`);

      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send("processing-error", err.message);
      } else {
        logError("Cannot send processing-error: mainWindow not available");
      }

      return { success: false, message: err.message };
    } finally {
      global.progressEvents = null;
    }
  });
}

module.exports = { registerProcessingHandler };

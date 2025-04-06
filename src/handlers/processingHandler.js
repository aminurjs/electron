const { ipcMain } = require("electron");
const { processImages } = require("../process/processImages");
const { loadSettings } = require("./settingsHandler");

let mainWindow;

function setMainWindow(win) {
  mainWindow = win;
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
    mainWindow?.webContents.send("processing-start", { total });
  },
  increment() {
    this.processed++;
    mainWindow?.webContents.send("processing-progress", {
      current: this.processed,
      total: this.total,
      percent: Math.round((this.processed / this.total) * 100),
    });
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

      mainWindow.webContents.send("processing-results", results);
      return { success: true, message: "Processing completed successfully" };
    } catch (err) {
      console.error("Processing error:", err);
      mainWindow?.webContents.send("processing-error", err.message);
      return { success: false, message: err.message };
    } finally {
      global.progressEvents = null;
    }
  });
}

module.exports = { registerProcessingHandler, setMainWindow };

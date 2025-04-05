const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { processImages } = require("./process/processImages");

// Global reference to main window
let mainWindow = null;

// Settings path
const settingsPath = path.join(app.getPath("userData"), "settings.json");

// Default settings
const defaultSettings = {
  apiKey: "",
  titleLength: 90,
  descriptionLength: 120,
  keywordCount: 20,
  isPremium: false,
};

// Load settings
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
  return defaultSettings;
}

// Save settings
function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving settings:", error);
    return false;
  }
}

// Progress tracking
const progressTracker = {
  total: 0,
  processed: 0,
  reset() {
    this.total = 0;
    this.processed = 0;
  },
  setTotal(total) {
    this.total = total;
    if (mainWindow) {
      mainWindow.webContents.send("processing-start", { total });
    }
  },
  increment() {
    this.processed++;
    if (mainWindow) {
      mainWindow.webContents.send("processing-progress", {
        current: this.processed,
        total: this.total,
        percent: Math.round((this.processed / this.total) * 100),
      });
    }
  },
};

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // mainWindow.webContents.openDevTools();
  return mainWindow;
}

// Function to count images in a directory
async function countImagesInDirectory(directoryPath) {
  try {
    const files = await fs.promises.readdir(directoryPath);
    const imageExtensions = [".jpg", ".jpeg", ".png"];

    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });

    return imageFiles.length;
  } catch (error) {
    console.error("Error counting images:", error);
    return 0;
  }
}

app.whenReady().then(() => {
  mainWindow = createWindow();

  // Handle path selection from the main process
  ipcMain.handle("select-path", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (!canceled) {
      const selectedPath = filePaths[0];
      console.log("Selected path:", selectedPath);

      // Count images in the directory
      const imageCount = await countImagesInDirectory(selectedPath);
      console.log("Total images:", imageCount);

      return { path: selectedPath, imageCount };
    }
    return null;
  });

  // Handle settings loading
  ipcMain.handle("load-settings", async () => {
    return loadSettings();
  });

  // Handle settings saving
  ipcMain.handle("save-settings", async (event, settings) => {
    return saveSettings(settings);
  });

  // Handle form submission
  ipcMain.handle("submit-config", async (event, config) => {
    try {
      // Load settings
      const settings = loadSettings();

      // Reset progress tracker and notify the renderer about starting
      progressTracker.reset();

      // Register progress event handlers
      const onBatchStart = (total) => {
        progressTracker.setTotal(total);
      };

      const onImageProcessed = () => {
        progressTracker.increment();
      };

      // Add event listeners for the progress events
      global.progressEvents = {
        onBatchStart,
        onImageProcessed,
      };

      // Process images with progress tracking
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

      console.log("Processing complete:", {
        total: results.total,
        successful: results.successful.length,
        failed: results.failed.length,
        outputDir: results.outputDir,
      });

      mainWindow.webContents.send("processing-results", results);
      return { success: true, message: "Processing completed successfully" };
    } catch (error) {
      console.error("Error processing images:", error);
      mainWindow.webContents.send("processing-error", error.message);
      return { success: false, message: error.message };
    } finally {
      // Clean up event listeners
      global.progressEvents = null;
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

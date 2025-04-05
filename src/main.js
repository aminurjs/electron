const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { processImages } = require("./process/processImages");

// Global reference to main window
let mainWindow = null;

// Settings path
const settingsPath = path.join(app.getPath("userData"), "settings.json");
// Window state path
const windowStatePath = path.join(app.getPath("userData"), "window-state.json");

// Default settings
const defaultSettings = {
  apiKey: "",
  titleLength: 90,
  descriptionLength: 120,
  keywordCount: 20,
  isPremium: false,
};

// Default window state
const defaultWindowState = {
  width: 1100,
  height: 800,
  isMaximized: false,
  x: undefined,
  y: undefined,
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

// Load window state
function loadWindowState() {
  try {
    if (fs.existsSync(windowStatePath)) {
      const data = fs.readFileSync(windowStatePath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading window state:", error);
  }
  return defaultWindowState;
}

// Function to ensure the window is visible on screen
function ensureWindowVisible(windowState) {
  const { screen } = require("electron");
  const displays = screen.getAllDisplays();

  // Ensure minimum window size
  const MIN_WIDTH = 800;
  const MIN_HEIGHT = 600;

  const newState = { ...windowState };

  // Apply minimum size constraints
  newState.width = Math.max(newState.width, MIN_WIDTH);
  newState.height = Math.max(newState.height, MIN_HEIGHT);

  if (newState.x === undefined || newState.y === undefined) {
    return newState;
  }

  // Check if window is within any display bounds
  const visible = displays.some((display) => {
    const bounds = display.bounds;
    return (
      newState.x >= bounds.x &&
      newState.y >= bounds.y &&
      newState.x + newState.width <= bounds.x + bounds.width &&
      newState.y + newState.height <= bounds.y + bounds.height
    );
  });

  // If not visible on any display, reset position
  if (!visible) {
    delete newState.x;
    delete newState.y;
  }

  return newState;
}

// Save window state
function saveWindowState(window) {
  if (!window) return false;

  const windowState = {
    isMaximized: window.isMaximized(),
    width: window.isMaximized()
      ? defaultWindowState.width
      : window.getBounds().width,
    height: window.isMaximized()
      ? defaultWindowState.height
      : window.getBounds().height,
    x: window.getBounds().x,
    y: window.getBounds().y,
  };

  try {
    fs.writeFileSync(windowStatePath, JSON.stringify(windowState, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving window state:", error);
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

function createWindow() {
  // Load saved window state
  const windowState = loadWindowState();
  // Ensure window is visible on a connected display
  const validWindowState = ensureWindowVisible(windowState);

  mainWindow = new BrowserWindow({
    width: validWindowState.width,
    height: validWindowState.height,
    x: validWindowState.x,
    y: validWindowState.y,
    frame: false, // Removes default window top bar
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged, // Disable devtools in production
    },
  });

  // Set window to maximized state if it was maximized when closed
  if (validWindowState.isMaximized) {
    mainWindow.maximize();
  }

  // Remove default menu bar
  mainWindow.setMenu(null);

  // Load your UI
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Listen for maximize/unmaximize events
  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("maximize-change", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("maximize-change", false);
  });

  // Save window state when window is resized or moved
  mainWindow.on("resize", () => {
    saveWindowState(mainWindow);
  });

  mainWindow.on("move", () => {
    saveWindowState(mainWindow);
  });

  // Only open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

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
        outputDirectory: results.outputDirectory,
      });

      // Ensure the outputDirectory property is available
      if (results.outputDir && !results.outputDirectory) {
        results.outputDirectory = results.outputDir;
      }

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

  // Handle opening output directory
  ipcMain.handle("open-output-directory", async (event, directoryPath) => {
    if (directoryPath && fs.existsSync(directoryPath)) {
      shell.openPath(directoryPath);
      return { success: true };
    } else {
      return { success: false, message: "Directory does not exist" };
    }
  });

  // Handle window controls
  ipcMain.handle("window-control", async (event, command) => {
    switch (command) {
      case "minimize":
        mainWindow.minimize();
        return { success: true };
      case "maximize":
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        return {
          success: true,
          isMaximized: mainWindow.isMaximized(),
        };
      case "close":
        mainWindow.close();
        return { success: true };
      default:
        return { success: false, message: "Unknown command" };
    }
  });

  // Handle window state query
  ipcMain.handle("get-window-state", () => {
    if (!mainWindow) {
      return { error: "Window not available" };
    }
    return {
      isMaximized: mainWindow.isMaximized(),
      isMinimized: mainWindow.isMinimized(),
      isFullScreen: mainWindow.isFullScreen(),
    };
  });
});

app.on("window-all-closed", () => {
  // Save window state when window is closed
  if (mainWindow) {
    saveWindowState(mainWindow);
  }

  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

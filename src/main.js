const { app, Menu } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const { createMainWindow } = require("./createMainWindow");
const fs = require("fs");

// Create the utils directory if it doesn't exist
const utilsDir = path.join(__dirname, "utils");
if (!fs.existsSync(utilsDir)) {
  try {
    fs.mkdirSync(utilsDir);
  } catch (err) {
    console.error("Failed to create utils directory:", err);
  }
}

// Simple logging function for debugging before the debug module is loaded
function logStartup(message) {
  console.log(`[STARTUP] ${message}`);
  const logPath = path.join(app.getPath("userData"), "startup-log.txt");
  try {
    fs.appendFileSync(
      logPath,
      `${new Date().toISOString()} - ${message}\n`,
      "utf8"
    );
  } catch (err) {
    console.error("Failed to write startup log:", err);
  }
}

// Log app startup
logStartup("App starting...");

// Try to load handlers
let handlers;
try {
  handlers = require("./handlers/index");
  logStartup("Handlers loaded successfully");
} catch (error) {
  logStartup(`Failed to load handlers: ${error.message}`);
  logStartup(`Stack: ${error.stack}`);

  // Define fallback handlers
  handlers = {
    registerSettingsHandlers: () => {
      logStartup("Using fallback settings handler");
      const { ipcMain } = require("electron");
      const settingsPath = path.join(app.getPath("userData"), "settings.json");

      const defaultSettings = {
        apiKey: "",
        titleLength: 90,
        descriptionLength: 120,
        keywordCount: 20,
        isPremium: false,
      };

      ipcMain.handle("load-settings", () => {
        logStartup("Handling load-settings request");
        try {
          if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
          }
        } catch (err) {
          logStartup(`Error loading settings: ${err.message}`);
        }
        return defaultSettings;
      });

      ipcMain.handle("save-settings", (event, settings) => {
        logStartup("Handling save-settings request");
        try {
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
          return true;
        } catch (err) {
          logStartup(`Error saving settings: ${err.message}`);
          return false;
        }
      });
    },
    registerPathHandler: () => {
      logStartup("Using fallback path handler");
      const { ipcMain, dialog } = require("electron");

      ipcMain.handle("select-path", async () => {
        logStartup("Handling select-path request");
        const { canceled, filePaths } = await dialog.showOpenDialog({
          properties: ["openDirectory"],
        });

        if (!canceled) {
          const selectedPath = filePaths[0];
          // Count images in directory
          try {
            const files = await fs.promises.readdir(selectedPath);
            const imageExtensions = [".jpg", ".jpeg", ".png"];
            const imageCount = files.filter((file) => {
              const ext = path.extname(file).toLowerCase();
              return imageExtensions.includes(ext);
            }).length;

            return { path: selectedPath, imageCount };
          } catch (err) {
            logStartup(`Error counting images: ${err.message}`);
            return { path: selectedPath, imageCount: 0 };
          }
        }
        return null;
      });
    },
    registerProcessingHandler: () => {
      logStartup("Using fallback processing handler");
      const { ipcMain } = require("electron");

      ipcMain.handle("submit-config", async (event, config) => {
        logStartup(`Handling submit-config request: ${JSON.stringify(config)}`);
        // Minimal placeholder implementation
        setTimeout(() => {
          if (global.mainWindow && !global.mainWindow.isDestroyed()) {
            global.mainWindow.webContents.send("processing-start", {
              total: 1,
            });

            setTimeout(() => {
              global.mainWindow.webContents.send("processing-progress", {
                current: 1,
                total: 1,
                percent: 100,
              });

              setTimeout(() => {
                global.mainWindow.webContents.send("processing-results", {
                  total: 1,
                  successful: [],
                  failed: [],
                  outputDirectory: config.path,
                  allResults: [],
                });
              }, 500);
            }, 1000);
          }
        }, 500);

        return { success: true, message: "Processing submitted" };
      });
    },
    registerOutputHandler: () => {
      logStartup("Using fallback output handler");
      const { ipcMain, shell } = require("electron");

      ipcMain.handle("open-output-directory", async (event, directoryPath) => {
        logStartup(`Handling open-output-directory request: ${directoryPath}`);
        if (directoryPath && fs.existsSync(directoryPath)) {
          shell.openPath(directoryPath);
          return { success: true };
        } else {
          return { success: false, message: "Directory does not exist" };
        }
      });
    },
  };
}

let mainWindow;
global.mainWindow = null;

// Configure auto updater defaults
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Handle uncaught exceptions with proper logging
process.on("uncaughtException", (err) => {
  logStartup(`Uncaught Exception: ${err.message}\nStack: ${err.stack}`);
  console.error("Uncaught Exception:", err);
});

app.whenReady().then(() => {
  // Remove menu for better performance and reduced memory usage
  Menu.setApplicationMenu(null);

  // Create the main window and store reference
  try {
    mainWindow = createMainWindow();
    global.mainWindow = mainWindow;
    logStartup("Main window created successfully");

    // Add event listener to track window destruction
    mainWindow.on("closed", () => {
      logStartup("Main window closed");
      global.mainWindow = null;
    });

    // Register all IPC handlers with error handling
    try {
      handlers.registerSettingsHandlers();
      logStartup("Settings handlers registered");
    } catch (error) {
      logStartup(
        `Failed to register settings handlers: ${error.message}\nStack: ${error.stack}`
      );
    }

    try {
      handlers.registerPathHandler();
      logStartup("Path handler registered");
    } catch (error) {
      logStartup(
        `Failed to register path handler: ${error.message}\nStack: ${error.stack}`
      );
    }

    try {
      handlers.registerProcessingHandler();
      logStartup("Processing handler registered");
    } catch (error) {
      logStartup(
        `Failed to register processing handler: ${error.message}\nStack: ${error.stack}`
      );
    }

    try {
      handlers.registerOutputHandler();
      logStartup("Output handler registered");
    } catch (error) {
      logStartup(
        `Failed to register output handler: ${error.message}\nStack: ${error.stack}`
      );
    }

    // Send a test message to the renderer to confirm IPC is working
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          "message",
          "IPC connection established successfully"
        );
        logStartup("Sent test message to renderer");
      }
    }, 2000);

    // Check for updates after app is fully loaded
    setTimeout(() => {
      try {
        autoUpdater.checkForUpdates();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            "message",
            `Checking for updates. Current version ${app.getVersion()}`
          );
        }
        logStartup("Checking for updates");
      } catch (error) {
        logStartup(`Failed to check for updates: ${error.message}`);
      }
    }, 5000);
  } catch (error) {
    logStartup(
      `Failed to create main window: ${error.message}\nStack: ${error.stack}`
    );
  }

  // Set the dock icon on macOS only
  if (process.platform === "darwin") {
    try {
      const iconPath = path.join(__dirname, "assets", "icon.png");
      if (fs.existsSync(iconPath)) {
        app.dock.setIcon(iconPath);
        logStartup("Dock icon set successfully");
      } else {
        logStartup(`Icon file not found at ${iconPath}`);
      }
    } catch (error) {
      logStartup(`Failed to set dock icon: ${error.message}`);
    }
  }

  // Open DevTools only in development
  if (!app.isPackaged) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools();
      logStartup("DevTools opened");
    }
  }
});

// Auto-updater event listeners
autoUpdater.on("update-available", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "message",
      `Update available. Current version ${app.getVersion()}`
    );
  }
  autoUpdater.downloadUpdate().catch((err) => {
    console.error("Download update error:", err);
    logStartup(`Download update error: ${err.message}`);
  });
});

autoUpdater.on("update-not-available", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "message",
      `No update available. Current version ${app.getVersion()}`
    );
  }
});

autoUpdater.on("update-downloaded", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "message",
      `Update downloaded. Current version ${app.getVersion()}`
    );
  }
});

autoUpdater.on("error", (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("message", info?.toString() || "Update error");
  }
  logStartup(`Auto-updater error: ${info?.toString()}`);
});

app.on("window-all-closed", () => {
  logStartup("All windows closed");
  if (process.platform !== "darwin") app.quit();
});

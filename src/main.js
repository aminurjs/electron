const { app, Menu, BrowserWindow } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const { createMainWindow } = require("./createMainWindow");
const fs = require("fs");
const { net } = require("electron");
const { API_CONFIG } = require("./config/env");

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
        secretKey: "",
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

        try {
          // Load settings
          const settingsPath = path.join(
            app.getPath("userData"),
            "settings.json"
          );
          let settings = {};

          try {
            if (fs.existsSync(settingsPath)) {
              settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
            }
          } catch (err) {
            return {
              success: false,
              message: `Error loading settings: ${err.message}`,
            };
          }

          // In fallback mode, we'll just check if the key exists but not actually validate it
          try {
            if (!settings.secretKey) {
              throw new Error("Secret key is not set");
            }

            // Skip actual API validation in fallback mode
            logStartup("Fallback mode: Skipping actual API validation");
            const mockValidation = {
              isValid: true,
              isActive: true,
              username: "fallback_user",
            };

            logStartup(
              `Using mock API validation in fallback mode. Username: ${mockValidation.username}`
            );
          } catch (error) {
            logStartup(`API key validation error: ${error.message}`);

            if (global.mainWindow && !global.mainWindow.isDestroyed()) {
              global.mainWindow.webContents.send(
                "processing-error",
                `API validation failed: ${error.message}`
              );
            }

            return {
              success: false,
              message: `API validation failed: ${error.message}`,
            };
          }

          // Proceed with processing
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
        } catch (error) {
          logStartup(`Error handling submit-config: ${error.message}`);
          return {
            success: false,
            message: `Error handling submit-config: ${error.message}`,
          };
        }
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
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = true;

// Handle uncaught exceptions with proper logging
process.on("uncaughtException", (err) => {
  logStartup(`Uncaught Exception: ${err.message}\nStack: ${err.stack}`);
  console.error("Uncaught Exception:", err);
});

// Add version IPC handler
const { ipcMain } = require("electron");
const { loadSettings } = require("./handlers/settingsHandler");
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

// Add a flag to track if we're in the background
let isAppInBackground = false;

// Listen for app activation and suspension
app.on("browser-window-blur", () => {
  isAppInBackground = true;
  logStartup("App moved to background");
});

app.on("browser-window-focus", () => {
  isAppInBackground = false;
  logStartup("App moved to foreground");
});

// Additional check for app with no visible windows
setInterval(() => {
  if (isAppInBackground && BrowserWindow.getAllWindows().length === 0) {
    logStartup("App is in background with no windows, quitting...");
    app.quit();
  }
}, 5000); // Check every 5 seconds

app.whenReady().then(() => {
  // Set app icon explicitly
  if (process.platform === "win32") {
    app.setAppUserModelId(app.name);
  }

  // Set the application icon for all platforms
  try {
    const iconPath = path.resolve(__dirname, "assets", "icon.ico");
    logStartup(`Setting application icon: ${iconPath}`);
    if (fs.existsSync(iconPath)) {
      app.setPath("userData", app.getPath("userData"));
    } else {
      logStartup(`Icon file not found: ${iconPath}`);
    }
  } catch (error) {
    logStartup(`Error setting icon: ${error.message}`);
  }

  // Remove menu for better performance and reduced memory usage
  Menu.setApplicationMenu(null);

  // Create the main window and store reference
  try {
    mainWindow = createMainWindow();
    global.mainWindow = mainWindow;
    logStartup("Main window created successfully");

    // Check API status when app starts
    checkApiStatus().then((status) => {
      logStartup(
        `Initial API status check completed: ${status?.status || "unknown"}`
      );
    });

    // Set up periodic API status check (every hour)
    setInterval(() => {
      checkApiStatus();
    }, 60 * 60 * 1000); // Every hour

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

  // Open DevTools only in development
  if (!app.isPackaged) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools();
      logStartup("DevTools opened");
    }
  }
});

// Auto-updater event listeners
autoUpdater.on("update-available", (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "message",
      `Update available. Current version ${app.getVersion()}. Downloading...`
    );
  }
  logStartup(`Update available: ${info.version}`);
});

autoUpdater.on("update-not-available", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "message",
      `No update available. Current version ${app.getVersion()}`
    );
  }
  logStartup("No update available");
});

autoUpdater.on("update-downloaded", (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "message",
      `Update downloaded. Will install when app is closed. Current version ${app.getVersion()}`
    );
  }
  logStartup(`Update downloaded: ${info.version}`);
});

autoUpdater.on("download-progress", (progressObj) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "message",
      `Downloading update: ${Math.round(progressObj.percent)}%`
    );
  }
  logStartup(`Download progress: ${Math.round(progressObj.percent)}%`);
});

autoUpdater.on("error", (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("message", info?.toString() || "Update error");
  }
  logStartup(`Auto-updater error: ${info?.toString()}`);
});

// Handle app quit to ensure update installation
app.on("before-quit", (event) => {
  if (autoUpdater.isUpdaterActive()) {
    event.preventDefault();
    logStartup("Update is being installed, waiting for completion...");
  }
});

app.on("window-all-closed", () => {
  logStartup("All windows closed");
  // If there's an update ready to install, wait for it
  if (autoUpdater.isUpdaterActive()) {
    logStartup("Waiting for update installation before quitting...");
    setTimeout(() => {
      app.quit();
    }, 5000); // Give 5 seconds for the update to install
  } else {
    app.quit();
  }
});

// Function to check API status
async function getStatus(secretKey) {
  return new Promise((resolve, reject) => {
    if (!secretKey) {
      reject(new Error("Secret key is not set"));
      return;
    }

    const request = net.request({
      method: "GET",
      protocol: API_CONFIG.VALIDATION_PROTOCOL,
      hostname: API_CONFIG.VALIDATION_HOST,
      path: "/api/keys/stats",
    });

    request.setHeader("x-api-key", secretKey);
    request.setHeader("Content-Type", "application/json");

    let responseData = "";

    request.on("response", (response) => {
      response.on("data", (chunk) => {
        responseData += chunk.toString();
      });

      response.on("end", () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.success && parsed.data) {
            console.log("API status retrieved");
            resolve(parsed.data); // contains expiresIn, status
          } else {
            reject(new Error(parsed.message || "Failed to fetch API status"));
          }
        } catch (err) {
          reject(new Error(`Failed to parse status response: ${err.message}`));
        }
      });
    });

    request.on("error", (error) => {
      reject(new Error(`API status request failed: ${error.message}`));
    });

    request.end(); // GET request with headers only
  });
}

// Function to check API status and update UI
async function checkApiStatus() {
  try {
    const settings = loadSettings();

    if (!settings.secretKey) {
      logStartup("Secret key is not set");
      return;
    }

    const status = await getStatus(settings.secretKey);
    logStartup(
      `API Status: ${status.status}, Expires in: ${status.expiresIn} days`
    );

    // Send status to renderer
    if (global.mainWindow && !global.mainWindow.isDestroyed()) {
      global.mainWindow.webContents.send("api-status-update", status);
    }

    return status;
  } catch (error) {
    logStartup(`Error checking API status: ${error.message}`);
    if (global.mainWindow && !global.mainWindow.isDestroyed()) {
      global.mainWindow.webContents.send("api-status-update", {
        status: "error",
        error: error.message,
      });
    }
  }
}

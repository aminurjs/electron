const { BrowserWindow, app, screen } = require("electron");
const path = require("path");
const fs = require("fs");

// Path for storing window state
const windowStatePath = path.join(app.getPath("userData"), "window-state.json");
const defaultWindowState = {
  width: 1100,
  height: 800,
  isMaximized: false,
  x: undefined,
  y: undefined,
};

// Constants
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

/**
 * Load saved window state from disk
 * @returns {Object} Window state object
 */
function loadWindowState() {
  try {
    if (fs.existsSync(windowStatePath)) {
      return JSON.parse(fs.readFileSync(windowStatePath, "utf-8"));
    }
  } catch (err) {
    console.error("Failed to load window state:", err);
  }
  return defaultWindowState;
}

/**
 * Ensure the window is visible on one of the available displays
 * @param {Object} windowState - Current window state
 * @returns {Object} Validated window state
 */
function ensureWindowVisible(windowState) {
  const displays = screen.getAllDisplays();
  const newState = { ...windowState };

  // Enforce minimum dimensions
  newState.width = Math.max(newState.width, MIN_WIDTH);
  newState.height = Math.max(newState.height, MIN_HEIGHT);

  // Skip position check if x/y coordinates are undefined
  if (newState.x === undefined || newState.y === undefined) return newState;

  // Check if window is visible on any display
  const visible = displays.some((d) => {
    const bounds = d.bounds;
    return (
      newState.x >= bounds.x &&
      newState.y >= bounds.y &&
      newState.x + newState.width <= bounds.x + bounds.width &&
      newState.y + newState.height <= bounds.y + bounds.height
    );
  });

  // Reset position if window is not visible
  if (!visible) {
    delete newState.x;
    delete newState.y;
  }

  return newState;
}

/**
 * Save window state to disk
 * @param {BrowserWindow} window - Electron browser window
 */
function saveWindowState(window) {
  if (!window || window.isDestroyed()) return;

  const bounds = window.getBounds();
  const state = {
    isMaximized: window.isMaximized(),
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
  };

  try {
    fs.writeFileSync(windowStatePath, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error("Failed to save window state:", err);
  }
}

/**
 * Create and configure the main application window
 * @returns {BrowserWindow} Configured Electron browser window
 */
function createMainWindow() {
  const windowState = loadWindowState();
  const validWindowState = ensureWindowVisible(windowState);

  const win = new BrowserWindow({
    width: validWindowState.width,
    height: validWindowState.height,
    minWidth: 400,
    minHeight: 300,
    x: validWindowState.x,
    y: validWindowState.y,
    frame: true,
    show: false, // Hide until ready
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
      // Performance optimizations
      backgroundThrottling: false,
      webSecurity: true,
    },
  });

  // Throttle save operations using a debounce technique
  let saveTimeout = null;
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveWindowState(win), 500);
  };

  // Load the application once window is configured
  win
    .loadFile(path.join(__dirname, "index.html"))
    .then(() => {
      if (validWindowState.isMaximized) {
        win.maximize();
      }
      win.show();
    })
    .catch((err) => {
      console.error("Failed to load application:", err);
    });

  // Set up event listeners with debounced save
  win.on("resize", debouncedSave);
  win.on("move", debouncedSave);
  win.on("close", () => saveWindowState(win));

  // Extend window with message method for IPC communication
  win.showMessage = (message) => {
    if (!win.isDestroyed()) {
      win.webContents.send("message", message);
    }
  };

  return win;
}

module.exports = {
  createMainWindow,
};

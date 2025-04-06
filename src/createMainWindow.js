// createMainWindow.js
const { BrowserWindow, app } = require("electron");
const path = require("path");
const fs = require("fs");

const windowStatePath = path.join(app.getPath("userData"), "window-state.json");
const defaultWindowState = {
  width: 1100,
  height: 800,
  isMaximized: false,
  x: undefined,
  y: undefined,
};

function loadWindowState() {
  try {
    if (fs.existsSync(windowStatePath)) {
      return JSON.parse(fs.readFileSync(windowStatePath, "utf-8"));
    }
  } catch (err) {
    console.error("Failed to load window state", err);
  }
  return defaultWindowState;
}

function ensureWindowVisible(windowState) {
  const { screen } = require("electron");
  const displays = screen.getAllDisplays();
  const newState = { ...windowState };
  const MIN_WIDTH = 800;
  const MIN_HEIGHT = 600;

  newState.width = Math.max(newState.width, MIN_WIDTH);
  newState.height = Math.max(newState.height, MIN_HEIGHT);

  if (newState.x === undefined || newState.y === undefined) return newState;

  const visible = displays.some((d) => {
    const bounds = d.bounds;
    return (
      newState.x >= bounds.x &&
      newState.y >= bounds.y &&
      newState.x + newState.width <= bounds.x + bounds.width &&
      newState.y + newState.height <= bounds.y + bounds.height
    );
  });

  if (!visible) {
    delete newState.x;
    delete newState.y;
  }

  return newState;
}

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
    console.error("Failed to save window state", err);
  }
}

function createMainWindow() {
  const windowState = loadWindowState();
  const validWindowState = ensureWindowVisible(windowState);

  const win = new BrowserWindow({
    width: validWindowState.width,
    height: validWindowState.height,
    x: validWindowState.x,
    y: validWindowState.y,
    frame: true,
    show: false,
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  win.loadFile(path.join(__dirname, "index.html")).then(() => {
    if (validWindowState.isMaximized) {
      win.maximize();
    }
    win.show();
  });

  win.on("resize", () => saveWindowState(win));
  win.on("move", () => saveWindowState(win));
  win.on("close", () => saveWindowState(win));

  return win;
}

module.exports = {
  createMainWindow,
};

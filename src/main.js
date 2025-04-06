const { app, Menu } = require("electron");

const { registerSettingsHandlers } = require("./handlers/settingsHandler");
const { registerPathHandler } = require("./handlers/pathHandler");
const { registerProcessingHandler } = require("./handlers/processingHandler");
const { registerOutputHandler } = require("./handlers/outputHandler");
const { createMainWindow } = require("./createMainWindow");

let mainWindow;

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  mainWindow = createMainWindow();

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
  registerSettingsHandlers();
  registerPathHandler();
  registerProcessingHandler();
  registerOutputHandler();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

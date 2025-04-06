const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

const settingsPath = path.join(
  require("electron").app.getPath("userData"),
  "settings.json"
);

const defaultSettings = {
  apiKey: "",
  secretKey: "",
  titleLength: 90,
  descriptionLength: 120,
  keywordCount: 20,
  isPremium: false,
};

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    }
  } catch (err) {
    console.error("Error loading settings:", err);
  }
  return defaultSettings;
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (err) {
    console.error("Error saving settings:", err);
    return false;
  }
}

function registerSettingsHandlers() {
  ipcMain.handle("load-settings", async () => loadSettings());
  ipcMain.handle("save-settings", async (event, settings) =>
    saveSettings(settings)
  );
}

module.exports = { registerSettingsHandlers, loadSettings };

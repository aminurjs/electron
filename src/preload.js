const { contextBridge, ipcRenderer } = require("electron");

// Set up IPC event listeners
contextBridge.exposeInMainWorld("electronAPI", {
  // File dialog handling
  selectPath: () => ipcRenderer.invoke("select-path"),

  // Form submission
  submitConfig: (config) => ipcRenderer.invoke("submit-config", config),

  // Processing events listeners
  onProcessingStart: (callback) => ipcRenderer.on("processing-start", callback),
  onProcessingProgress: (callback) =>
    ipcRenderer.on("processing-progress", callback),
  onProcessingResults: (callback) =>
    ipcRenderer.on("processing-results", callback),
  onProcessingError: (callback) => ipcRenderer.on("processing-error", callback),

  // Settings management
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  loadSettings: () => ipcRenderer.invoke("load-settings"),

  // File management
  openOutputDirectory: (path) =>
    ipcRenderer.invoke("open-output-directory", path),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke("window-control", "minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window-control", "maximize"),
  closeWindow: () => ipcRenderer.invoke("window-control", "close"),
  onMaximizeChange: (callback) =>
    ipcRenderer.on("maximize-change", (_, isMaximized) =>
      callback(isMaximized)
    ),
  getWindowState: () => ipcRenderer.invoke("get-window-state"),

  // Cleanup function to remove listeners when needed
  removeAllListeners: (channel) => {
    if (channel) {
      ipcRenderer.removeAllListeners(channel);
    } else {
      [
        "processing-start",
        "processing-progress",
        "processing-results",
        "processing-error",
        "maximize-change",
      ].forEach((channel) => ipcRenderer.removeAllListeners(channel));
    }
  },
});

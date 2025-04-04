const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  selectPath: () => ipcRenderer.invoke("select-path"),
  submitConfig: (config) => ipcRenderer.invoke("submit-config", config),
});

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Safe IPC wrapper to handle errors and provide a consistent interface for all IPC calls
 * @param {string} channel - The IPC channel to call
 * @param  {...any} args - Arguments to pass to the channel
 * @returns {Promise<any>} - Promise that resolves with the result or rejects with an error
 */
const invokeIPC = async (channel, ...args) => {
  console.log(`Invoking IPC channel: ${channel}`, args);
  try {
    const result = await ipcRenderer.invoke(channel, ...args);
    console.log(`IPC channel ${channel} result:`, result);
    return result;
  } catch (error) {
    console.error(`Error invoking ${channel}:`, error);
    throw error;
  }
};

/**
 * Create a safe wrapper for IPC event listeners
 * @param {string} channel - The IPC channel to listen to
 * @param {Function} callback - Callback function to handle the event
 * @returns {Function} - Function to remove the event listener
 */
const listenToIPC = (channel, callback) => {
  console.log(`Setting up listener for channel: ${channel}`);
  // Create a wrapped callback that handles errors
  const wrappedCallback = (event, ...args) => {
    console.log(`Received event on channel ${channel}:`, args);
    try {
      callback(...args);
    } catch (error) {
      console.error(`Error in ${channel} listener:`, error);
    }
  };

  // Add the event listener
  ipcRenderer.on(channel, wrappedCallback);

  // Return a function to remove the listener
  return () => {
    console.log(`Removing listener for channel: ${channel}`);
    ipcRenderer.removeListener(channel, wrappedCallback);
  };
};

// Expose protected APIs to the renderer process
const api = {
  // Generic IPC invoke method
  invoke: (channel, ...args) => invokeIPC(channel, ...args),

  // File system module
  files: {
    selectPath: () => invokeIPC("select-path"),
    openOutputDirectory: (path) => invokeIPC("open-output-directory", path),
  },

  // Settings module
  settings: {
    save: (settings) => invokeIPC("save-settings", settings),
    load: () => invokeIPC("load-settings"),
  },

  // Processing module
  processing: {
    submit: (config) => invokeIPC("submit-config", config),
    onStart: (callback) => listenToIPC("processing-start", callback),
    onProgress: (callback) => listenToIPC("processing-progress", callback),
    onResults: (callback) => listenToIPC("processing-results", callback),
    onError: (callback) => listenToIPC("processing-error", callback),
  },

  // Application module
  app: {
    onMessage: (callback) => listenToIPC("message", callback),
    getVersion: () => invokeIPC("get-app-version"),
    onApiStatusUpdate: (callback) => listenToIPC("api-status-update", callback),
  },

  // Cleanup helper
  cleanup: {
    removeListeners: (channels) => {
      if (Array.isArray(channels)) {
        channels.forEach((channel) => ipcRenderer.removeAllListeners(channel));
      } else if (typeof channels === "string") {
        ipcRenderer.removeAllListeners(channels);
      } else {
        [
          "processing-start",
          "processing-progress",
          "processing-results",
          "processing-error",
          "message",
        ].forEach((channel) => ipcRenderer.removeAllListeners(channel));
      }
    },
  },
};

console.log("Exposing electronAPI to window:", api);
contextBridge.exposeInMainWorld("electronAPI", api);

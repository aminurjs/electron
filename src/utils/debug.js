/**
 * Debug utility for Electron application
 */

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

// Path for the debug log file
const logPath = path.join(app.getPath("userData"), "debug-log.txt");

// Clear log on startup
if (fs.existsSync(logPath)) {
  try {
    fs.writeFileSync(logPath, "", "utf8");
  } catch (err) {
    console.error("Failed to clear debug log file:", err);
  }
}

/**
 * Log a message to both console and debug file
 * @param {string} message - Message to log
 * @param {any} data - Optional data to log with the message
 */
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;

  // Log to console
  console.log(logMessage);
  if (data) console.log(data);

  // Log to file
  try {
    const fileContent = `${logMessage}\n${
      data ? JSON.stringify(data, null, 2) + "\n" : ""
    }`;
    fs.appendFileSync(logPath, fileContent, "utf8");
  } catch (err) {
    console.error("Failed to write to debug log file:", err);
  }
}

/**
 * Log an error to both console and debug file
 * @param {string} message - Error message
 * @param {Error} error - Error object
 */
function logError(message, error) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ERROR: ${message}`;

  // Log to console
  console.error(logMessage);
  if (error) console.error(error);

  // Log to file
  try {
    let errorData = "";
    if (error) {
      errorData = `${error.message}\nStack: ${error.stack}\n`;
    }
    const fileContent = `${logMessage}\n${errorData}`;
    fs.appendFileSync(logPath, fileContent, "utf8");
  } catch (err) {
    console.error("Failed to write error to debug log file:", err);
  }
}

/**
 * Create a wrapper for registering IPC handlers with debug logging
 * @param {Function} registerFn - The original registration function
 * @param {string} name - Name of the handler group
 * @returns {Function} - Wrapped function with logging
 */
function wrapHandlerRegistration(registerFn, name) {
  return function () {
    log(`Registering IPC handlers: ${name}`);
    try {
      registerFn();
      log(`Successfully registered IPC handlers: ${name}`);
    } catch (error) {
      logError(`Failed to register IPC handlers: ${name}`, error);
      throw error;
    }
  };
}

module.exports = { log, logError, wrapHandlerRegistration };

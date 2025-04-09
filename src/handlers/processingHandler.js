const { ipcMain, net, app } = require("electron");
const { processImages } = require("../process/processImages");
const { loadSettings } = require("./settingsHandler");
const fs = require("fs");
const path = require("path");
const { API_CONFIG } = require("../config/env");

// Get the app data path for logging
const logPath = path.join(app.getPath("userData"), "processing-log.txt");

function getDeviceId() {
  const deviceFilePath = path.join(app.getPath("userData"), "device-id.txt");

  // If the file exists, read the device ID
  if (fs.existsSync(deviceFilePath)) {
    return fs.readFileSync(deviceFilePath, "utf8").trim();
  }

  // If not, generate and save a new one
  const newId = require("crypto").randomUUID();
  fs.writeFileSync(deviceFilePath, newId, "utf8");
  return newId;
}

// Simple helper to log errors safely
function logError(message) {
  console.error(message);
  try {
    fs.appendFileSync(
      logPath,
      `${new Date().toISOString()} - ${message}\n`,
      "utf8"
    );
  } catch (err) {
    console.error("Failed to write to log file:", err);
  }
}

async function validateApiKey(secretKey) {
  return new Promise((resolve, reject) => {
    if (!secretKey) {
      reject(new Error("Secret key is not set"));
      return;
    }

    const request = net.request({
      method: "POST",
      protocol: API_CONFIG.VALIDATION_PROTOCOL,
      hostname: API_CONFIG.VALIDATION_HOST,
      path: "/api/keys/validate",
    });

    // Set the x-api-key header
    request.setHeader("x-api-key", secretKey);
    request.setHeader("x-device-id", getDeviceId());
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
            console.log("API key validation successful");
            resolve(parsed.data);
          } else {
            reject(new Error("Invalid API key"));
          }
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });

    request.on("error", (error) => {
      reject(new Error(`API validation failed: ${error.message}`));
    });

    request.end(); // No body is sent, just a POST with headers
  });
}

const progressTracker = {
  total: 0,
  processed: 0,
  reset() {
    this.total = 0;
    this.processed = 0;
  },
  setTotal(total) {
    this.total = total;
    try {
      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send("processing-start", { total });
        console.log("Sent processing-start event to renderer:", { total });
      } else {
        logError("Cannot send processing-start: mainWindow not available");
      }
    } catch (err) {
      logError(`Error in setTotal: ${err.message}`);
    }
  },
  increment() {
    this.processed++;
    try {
      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send("processing-progress", {
          current: this.processed,
          total: this.total,
          percent: Math.round((this.processed / this.total) * 100),
        });
      } else {
        logError("Cannot send processing-progress: mainWindow not available");
      }
    } catch (err) {
      logError(`Error in increment: ${err.message}`);
    }
  },
};

function registerProcessingHandler() {
  ipcMain.handle("submit-config", async (event, config) => {
    try {
      const settings = loadSettings();

      // Validate API key before processing
      try {
        if (!settings.secretKey) {
          throw new Error("Secret key is not set");
        }

        const validation = await validateApiKey(settings.secretKey);
        console.log("API key validation:", validation);

        if (!validation.isValid || !validation.isActive) {
          throw new Error(
            !validation.isValid ? "Invalid API key" : "API key is not active"
          );
        }

        console.log(
          "API key is valid and active. Username:",
          validation.username
        );
      } catch (error) {
        logError(`API key validation error: ${error.message}`);
        throw new Error(`API validation failed: ${error.message}`);
      }

      progressTracker.reset();

      const onBatchStart = (total) => progressTracker.setTotal(total);
      const onImageProcessed = () => progressTracker.increment();

      global.progressEvents = { onBatchStart, onImageProcessed };

      const results = await processImages(
        config.path,
        {
          titleLength: settings.titleLength,
          descriptionLength: settings.descriptionLength,
          keywordCount: settings.keywordCount,
          isPremium: settings.isPremium,
        },
        settings.apiKey
      );

      if (results.outputDir && !results.outputDirectory) {
        results.outputDirectory = results.outputDir;
      }

      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send("processing-results", results);
        console.log("Sent processing-results event to renderer");
      } else {
        logError("Cannot send processing-results: mainWindow not available");
      }

      return { success: true, message: "Processing completed successfully" };
    } catch (err) {
      console.error("Processing error:", err);
      logError(`Processing error: ${err.message}\n${err.stack}`);

      if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send("processing-error", err.message);
      } else {
        logError("Cannot send processing-error: mainWindow not available");
      }

      return { success: false, message: err.message };
    } finally {
      global.progressEvents = null;
    }
  });
}

module.exports = { registerProcessingHandler, validateApiKey };

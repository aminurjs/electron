// Test script for debugging IPC communications
const { ipcMain, app } = require("electron");
const path = require("fs");
const fs = require("fs");

// Configure logging
const logPath = path.join(app.getPath("userData"), "ipc-test-log.txt");

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;

  console.log(logMessage);

  try {
    fs.appendFileSync(logPath, logMessage);
  } catch (error) {
    console.error("Failed to write to log file:", error);
  }
}

/**
 * Test IPC registration and communication for the processing handler
 * @param {object} mainWindow - The main window reference
 */
function testProcessingIPC(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    log("ERROR: Cannot test IPC - mainWindow is invalid or destroyed");
    return;
  }

  // Register dummy event handler to test progress updates
  ipcMain.handle("test-processing", async () => {
    log("Test processing handler called");

    // Send test events to renderer
    setTimeout(() => {
      log("Sending test processing-start event");
      try {
        mainWindow.webContents.send("processing-start", { total: 5 });
        log("Successfully sent processing-start event");
      } catch (error) {
        log(`ERROR sending processing-start: ${error.message}`);
      }

      // Send progress updates
      let current = 0;
      const interval = setInterval(() => {
        current++;
        try {
          log(`Sending progress update ${current}/5`);
          mainWindow.webContents.send("processing-progress", {
            current,
            total: 5,
            percent: Math.round((current / 5) * 100),
          });
        } catch (error) {
          log(`ERROR sending processing-progress: ${error.message}`);
          clearInterval(interval);
        }

        // When complete, send results
        if (current >= 5) {
          clearInterval(interval);
          setTimeout(() => {
            try {
              log("Sending processing-results event");
              mainWindow.webContents.send("processing-results", {
                total: 5,
                successful: [
                  { filename: "test1.jpg" },
                  { filename: "test2.jpg" },
                ],
                failed: [{ filename: "test3.jpg", error: "Test error" }],
                allResults: [
                  { filename: "test1.jpg" },
                  { filename: "test2.jpg" },
                  { filename: "test3.jpg", error: "Test error" },
                ],
                outputDirectory: app.getPath("desktop"),
              });
              log("Successfully sent processing-results event");
            } catch (error) {
              log(`ERROR sending processing-results: ${error.message}`);
            }
          }, 1000);
        }
      }, 1000);
    }, 500);

    return { success: true, message: "Test processing started" };
  });

  log("Registered test-processing handler");
}

// Export functions for use in main.js
module.exports = {
  testProcessingIPC,
};

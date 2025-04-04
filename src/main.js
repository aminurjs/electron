const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { processImages } = require("./process/processImages");

// Create the main window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.webContents.openDevTools();
  return mainWindow;
}

// Function to count images in a directory
async function countImagesInDirectory(directoryPath) {
  try {
    const files = await fs.promises.readdir(directoryPath);
    const imageExtensions = [".jpg", ".jpeg", ".png"];

    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });

    return imageFiles.length;
  } catch (error) {
    console.error("Error counting images:", error);
    return 0;
  }
}

app.whenReady().then(() => {
  const mainWindow = createWindow();

  // Handle path selection from the main process
  ipcMain.handle("select-path", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (!canceled) {
      const selectedPath = filePaths[0];
      console.log("Selected path:", selectedPath);

      // Count images in the directory
      const imageCount = await countImagesInDirectory(selectedPath);
      console.log("Total images:", imageCount);

      return { path: selectedPath, imageCount };
    }
    return null;
  });

  // Handle form submission
  ipcMain.handle("submit-config", async (event, config) => {
    processImages(
      config.path,
      {
        titleLength: config.titleLength,
        descriptionLength: config.descLength,
        keywordCount: config.keywordCount,
      },
      config.apiKey
    )
      .then((results) => {
        console.log("Processing results:", results);
        mainWindow.webContents.send("processing-results", results);
      })
      .catch((error) => {
        console.error("Error processing images:", error);
        mainWindow.webContents.send("processing-error", error.message);
      });

    // Here you would typically process the config or send it to an API
    // For now, we're just logging it and returning success
    return { success: true, message: "Configuration received successfully" };
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

const { ipcMain, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

async function countImagesInDirectory(directoryPath) {
  try {
    const files = await fs.promises.readdir(directoryPath);
    const imageExtensions = [".jpg", ".jpeg", ".png"];
    return files.filter((file) =>
      imageExtensions.includes(path.extname(file).toLowerCase())
    ).length;
  } catch (err) {
    console.error("Error counting images:", err);
    return 0;
  }
}

function registerPathHandler() {
  ipcMain.handle("select-path", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (!canceled && filePaths.length > 0) {
      const selectedPath = filePaths[0];
      const imageCount = await countImagesInDirectory(selectedPath);
      return { path: selectedPath, imageCount };
    }
    return null;
  });
}

module.exports = { registerPathHandler };

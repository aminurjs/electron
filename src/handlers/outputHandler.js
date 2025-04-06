const { ipcMain, shell } = require("electron");
const fs = require("fs");

function registerOutputHandler() {
  ipcMain.handle("open-output-directory", async (event, directoryPath) => {
    if (directoryPath && fs.existsSync(directoryPath)) {
      await shell.openPath(directoryPath);
      return { success: true };
    } else {
      return { success: false, message: "Directory does not exist" };
    }
  });
}

module.exports = { registerOutputHandler };

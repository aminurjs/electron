const fs = require("fs");

function cleanupTempFilesAsync(tempFiles) {
  Promise.all(
    tempFiles.map((path) =>
      fs.promises
        .unlink(path)
        .catch((err) => console.error(`Failed to delete ${path}:`, err))
    )
  ).catch((err) => console.error("Error during cleanup:", err));
}

module.exports = { cleanupTempFilesAsync };

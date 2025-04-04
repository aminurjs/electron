const fs = require("fs");

function cleanupTempFilesAsync(tempFiles) {
  if (!tempFiles || !tempFiles.length) return;

  // Filter out any paths that are null/undefined or in output directories
  const filesToCleanup = tempFiles.filter(
    (path) =>
      path && typeof path === "string" && !path.includes("processed_images")
  );

  if (filesToCleanup.length === 0) return;

  Promise.all(
    filesToCleanup.map((path) =>
      fs.promises
        .unlink(path)
        .catch((err) => console.error(`Failed to delete ${path}:`, err))
    )
  ).catch((err) => console.error("Error during cleanup:", err));
}

module.exports = { cleanupTempFilesAsync };

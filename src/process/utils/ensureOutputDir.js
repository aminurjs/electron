const fs = require("fs");
const path = require("path");

async function ensureOutputDirectory(originalPath, customOutputDir = null) {
  if (customOutputDir) {
    if (!fs.existsSync(customOutputDir)) {
      await fs.promises.mkdir(customOutputDir, { recursive: true });
    }
    return customOutputDir;
  }

  // Fallback to default behavior if no custom dir is provided
  const baseDir = path.dirname(originalPath);
  const outputDir = path.join(baseDir, "processed");

  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  return outputDir;
}

module.exports = { ensureOutputDirectory };

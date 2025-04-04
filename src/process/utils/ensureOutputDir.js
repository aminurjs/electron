const fs = require("fs");
const path = require("path");

async function ensureOutputDirectory(originalPath) {
  const baseDir = path.dirname(originalPath);
  const outputDir = path.join(baseDir, "processed");

  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  return outputDir;
}

module.exports = { ensureOutputDirectory };

const path = require("path");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

async function uploadToGemini(filePath, mimeType, apiKey) {
  const fileManager = new GoogleAIFileManager(apiKey);
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: path.basename(filePath),
  });
  return uploadResult.file;
}
module.exports = { uploadToGemini };

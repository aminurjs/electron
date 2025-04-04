const fs = require("fs");
const path = require("path");
const { prepareMetadata } = require("./utils/exif.utils");
const { ExiftoolProcess } = require("node-exiftool");
const { getMimeType } = require("./utils/getMimeType");
const { ensureOutputDirectory } = require("./utils/ensureOutputDir");

/**
 * Adds metadata to an image file
 * @param {string} imagePath - Path to the image file
 * @param {object} metadata - Metadata to add
 * @returns {Promise<object>} - Operation result
 */
async function addMetadataToImage(imagePath, metadata) {
  const ext = path.extname(imagePath).toLowerCase();
  const outputDir = await ensureOutputDirectory(imagePath);
  const fileName = path.basename(imagePath);
  const outputPath = path.join(outputDir, fileName);

  // Copy the original file to the output directory
  await fs.promises.copyFile(imagePath, outputPath);

  const ep = new ExiftoolProcess(exiftoolBin);
  try {
    await ep.open();
    const metadataToWrite = prepareMetadata(metadata, ext);

    // Write main metadata
    await ep.writeMetadata(outputPath, metadataToWrite, ["overwrite_original"]);

    // Special handling for PNG keywords
    if (ext === ".png" && metadata.keywords?.length) {
      await ep.writeMetadata(
        outputPath,
        {
          Keywords: metadata.keywords,
          "XMP:Subject": metadata.keywords,
          "XMP-dc:Subject": metadata.keywords,
          "PNG:Keywords": metadata.keywords.join(";"),
        },
        ["overwrite_original"]
      );
    }

    return {
      status: true,
      message: "Metadata added successfully",
      outputPath,
      mimeType: getMimeType(outputPath),
    };
  } catch (error) {
    console.error(`Error adding metadata to ${fileName}:`, error);
    return {
      status: false,
      message: `Failed to add metadata: ${error.message}`,
      outputPath: null,
    };
  } finally {
    await ep.close();
  }
}
module.exports = { addMetadataToImage };

const fs = require("fs");
const path = require("path");
const { prepareMetadata } = require("./utils/exif.utils");
const { exiftool } = require("exiftool-vendored");
const { getMimeType } = require("./utils/getMimeType");
const { ensureOutputDirectory } = require("./utils/ensureOutputDir");

/**
 * Adds metadata to an image file
 * @param {string} imagePath - Path to the image file
 * @param {object} metadata - Metadata to add
 * @param {string} customOutputPath - Optional custom output path for the processed image
 * @returns {Promise<object>} - Operation result
 */
async function addMetadataToImage(
  imagePath,
  metadata,
  customOutputPath = null
) {
  const ext = path.extname(imagePath).toLowerCase();

  let outputPath;
  if (customOutputPath) {
    // Use the custom output path directly
    outputPath = customOutputPath;

    // Ensure the directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true });
    }
  } else {
    // Use the default directory
    const outputDir = await ensureOutputDirectory(imagePath);
    const fileName = path.basename(imagePath);
    outputPath = path.join(outputDir, fileName);
  }

  // Copy the original file to the output path
  await fs.promises.copyFile(imagePath, outputPath);

  try {
    // Prepare metadata based on file type
    let metadataToWrite = prepareMetadata(metadata, ext);

    // For PNG files, include keywords directly in the main metadata object
    // instead of writing them separately
    if (ext === ".png" && metadata.keywords?.length) {
      // These are the fields that are known to work for PNG keywords
      metadataToWrite = {
        ...metadataToWrite,
        Keywords: metadata.keywords,
        "XMP:Subject": metadata.keywords,
        "XMP-dc:Subject": metadata.keywords,
        // Remove problematic fields
        // "PNG:Keywords": undefined,
        // "PNG-iTXt:Keywords": undefined
      };
    }

    // Write metadata with -overwrite_original flag to prevent backup files
    await exiftool.write(outputPath, metadataToWrite, ["-overwrite_original"]);

    // Clean up any potential _original files that might have been created
    const originalFilePath = `${outputPath}_original`;
    if (fs.existsSync(originalFilePath)) {
      await fs.promises.unlink(originalFilePath);
    }

    return {
      status: true,
      message: "Metadata added successfully",
      outputPath,
      mimeType: getMimeType(outputPath),
    };
  } catch (error) {
    console.error(
      `Error adding metadata to ${path.basename(imagePath)}:`,
      error
    );
    return {
      status: false,
      message: `Failed to add metadata: ${error.message}`,
      outputPath: null,
    };
  }
}

/**
 * Adds metadata directly to a file without creating copies
 * @param {string} filePath - Path to the file to modify
 * @param {object} metadata - Metadata to add
 * @returns {Promise<object>} - Operation result
 */
async function addMetadataDirectly(filePath, metadata) {
  try {
    const ext = path.extname(filePath).toLowerCase();

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return {
        status: false,
        message: `File not found: ${filePath}`,
      };
    }

    // Prepare metadata based on file type
    let metadataToWrite = prepareMetadata(metadata, ext);

    // For PNG files, include keywords directly in the main metadata object
    // instead of writing them separately
    if (ext === ".png" && metadata.keywords?.length) {
      metadataToWrite = {
        ...metadataToWrite,
        Keywords: metadata.keywords,
        "XMP:Subject": metadata.keywords,
        "XMP-dc:Subject": metadata.keywords,
      };
    }

    // Write metadata with -overwrite_original flag to prevent backup files
    await exiftool.write(filePath, metadataToWrite, ["-overwrite_original"]);

    // Clean up any potential _original files that might have been created
    const originalFilePath = `${filePath}_original`;
    if (fs.existsSync(originalFilePath)) {
      await fs.promises.unlink(originalFilePath);
    }

    return {
      status: true,
      message: "Metadata added successfully",
      filePath,
      mimeType: getMimeType(filePath),
    };
  } catch (error) {
    console.error(
      `Error adding metadata to ${path.basename(filePath)}:`,
      error
    );
    return {
      status: false,
      message: `Failed to add metadata: ${error.message}`,
      filePath,
    };
  }
}

module.exports = { addMetadataToImage, addMetadataDirectly };

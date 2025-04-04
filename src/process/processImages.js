const fs = require("fs");
const path = require("path");

const {
  processBatchWithConcurrencyLimit,
} = require("./processBatchWithConcurrencyLimit");
const { processFallbackIndividual } = require("./processFallbackIndividual");

async function processImages(parentDir, options, apiKey) {
  // Create output directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(parentDir, `processed_images_${timestamp}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  }

  const images = fs
    .readdirSync(parentDir)
    .filter(
      (file) =>
        file.toLowerCase().endsWith(".jpg") ||
        file.toLowerCase().endsWith(".png") ||
        file.toLowerCase().endsWith(".jpeg")
    )
    .map((file) => ({
      filename: file,
      path: path.join(parentDir, file),
      outputPath: path.join(outputDir, file),
    }));

  const { titleLength, descriptionLength, keywordCount } = options;

  try {
    const processResults = await processBatchWithConcurrencyLimit(
      images,
      { titleLength, descriptionLength, keywordCount, outputDir },
      apiKey
    );

    // Identify successful and failed results
    const successfulResults = processResults.filter((result) => !result.error);
    let failedResults = processResults.filter((result) => result.error);

    // If we have failed images, try processing them individually as a fallback
    if (failedResults.length > 0) {
      console.log(
        `${failedResults.length} images failed batch processing. Attempting individual processing...`
      );

      // Filter out the original images that failed
      const failedImageObjects = images.filter((img) =>
        failedResults.some((failure) => failure.filename === img.filename)
      );

      if (failedImageObjects.length > 0) {
        // Process failed images individually
        const fallbackResults = await processFallbackIndividual(
          failedImageObjects,
          { titleLength, descriptionLength, keywordCount, outputDir },
          apiKey
        );

        // Update results with successful individual processing
        const newlySuccessful = fallbackResults.filter(
          (result) => !result.error
        );
        const stillFailed = fallbackResults.filter((result) => result.error);

        // Log individual processing results
        console.log(
          `Individual processing results: ${newlySuccessful.length} successful, ${stillFailed.length} failed`
        );

        // Add newly successful results to the successful array
        successfulResults.push(...newlySuccessful);

        // Update failed results to only include those that still failed
        failedResults = stillFailed;
      }
    }

    // Log final processing stats
    console.log(`- Total images: ${images.length}`);
    console.log(`- Successfully processed: ${successfulResults.length}`);
    console.log(`- Failed after all retries: ${failedResults.length}`);

    // Detailed logging for any remaining failed images
    if (failedResults.length > 0) {
      console.log(
        `The following images could not be processed after all attempts:`
      );
      failedResults.forEach((failure) => {
        console.log(`- ${failure.filename}: ${failure.error}`);
      });
    }

    // Return all results
    return {
      total: images.length,
      successful: successfulResults,
      failed: failedResults,
      allResults: [...successfulResults, ...failedResults],
      outputDir: outputDir,
    };
  } catch (error) {
    console.error(`Error in background processing for batch:`, error);
    throw error;
  }
}

module.exports = {
  processImages,
};

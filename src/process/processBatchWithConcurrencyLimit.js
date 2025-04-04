const fs = require("fs");
const { Semaphore } = require("./semaphore");
const { processBatch } = require("./processBatch");
const { batchImages } = require("./batchImages");

const MAX_CONCURRENT_UPLOAD_REQUESTS = 10;
const IMAGE_BATCH_SIZE = 5;

async function processBatchWithConcurrencyLimit(images, options, apiKey) {
  const results = [];
  const totalImages = images.length;
  const concurrencyLimit = MAX_CONCURRENT_UPLOAD_REQUESTS;
  console.log(
    `Processing ${totalImages} images with concurrency limit ${concurrencyLimit}`
  );

  // Group images into batches for multi-image processing
  const imageBatches = batchImages(images, IMAGE_BATCH_SIZE);

  // Process batches with concurrency limit
  const semaphore = new Semaphore(concurrencyLimit);
  const processPromises = imageBatches.map(async (batch, batchIndex) => {
    const release = await semaphore.acquire();
    try {
      // Verify files exist before processing
      const validImages = batch.filter(
        (item) => item.path && fs.existsSync(item.path)
      );

      if (validImages.length === 0) {
        console.error(`No valid files in batch ${batchIndex + 1}`);
        return batch.map((item) => ({
          filename: item.originalname,
          error: `File not found: ${item.path}`,
          status: "failed",
        }));
      }

      // Process batch together
      const batchResults = await processBatch(validImages, options, apiKey);

      return batchResults;
    } catch (error) {
      console.error(
        `Error processing batch ${batchIndex + 1}: ${error.message}`
      );
      return batch.map((item) => ({
        filename: item.originalname,
        error: error.message || "Unknown error",
        status: "failed",
      }));
    } finally {
      release();
    }
  });

  // Wait for all promises to settle
  const allResults = await Promise.allSettled(processPromises);

  // Process results
  allResults.forEach((result) => {
    if (result.status === "fulfilled") {
      results.push(...result.value);
    } else {
      results.push({
        filename: "unknown",
        error: result.reason?.message || "Unknown error",
        status: "failed",
      });
    }
  });

  return results;
}

module.exports = { processBatchWithConcurrencyLimit };

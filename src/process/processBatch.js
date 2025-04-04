const fs = require("fs");
const path = require("path");
const os = require("os");
const mime = require("mime");
const sharp = require("sharp");
const { uploadToGemini } = require("./uploadGemini");
const { BASE_PROMPT, FORBIDDEN_KEYWORDS } = require("./ai/prompt");
const { Semaphore } = require("./semaphore");
const getGeminiConfig = require("./ai/config");
const { repairJson } = require("./repairJson");
const { validateMetadata } = require("./validateMetadata");
const { addMetadataToImage } = require("./addMetadataToImage");
const { cleanupTempFilesAsync } = require("./cleanupTempFilesAsync");

const MAX_CONCURRENT_UPLOAD_REQUESTS = 10;

async function processBatch(batch, options, apiKey) {
  const { model, generationConfig, safetySettings } = getGeminiConfig(apiKey);
  const { titleLength, descriptionLength, keywordCount } = options;
  const results = [];
  const tempFiles = [];

  try {
    // Create temporary directory for processing if it doesn't exist
    const tempDir = path.join(os.tmpdir(), "image-processing");
    if (!fs.existsSync(tempDir)) {
      await fs.promises.mkdir(tempDir, { recursive: true });
    }

    // First, prepare all images in parallel
    const preparedImages = await Promise.all(
      batch.map(async (image) => {
        const mimeType = mime.getType(image.originalname);

        // Read the uploaded image
        const imageBuffer = await fs.promises.readFile(image.path);

        // Create a smaller version for Gemini analysis
        const tempResizedPath = path.join(
          tempDir,
          `resized_${Date.now()}_${path.basename(
            image.filename || image.originalname
          )}`
        );
        await sharp(imageBuffer)
          .resize({ width: 768, withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toFile(tempResizedPath);

        // Prepare original image for metadata
        const tempOriginalPath = path.join(
          tempDir,
          `original_${Date.now()}_${path.basename(
            image.filename || image.originalname
          )}`
        );
        await fs.promises.writeFile(tempOriginalPath, imageBuffer);

        // Add to temp files list for cleanup
        tempFiles.push(tempResizedPath, tempOriginalPath);

        return {
          originalImage: image,
          resizedPath: tempResizedPath,
          originalPath: tempOriginalPath,
          mimeType,
          imageBuffer,
        };
      })
    );

    // Now send all images to Gemini in a single request
    const geminiFiles = await Promise.all(
      preparedImages.map(async (item) => {
        return {
          file: await uploadToGemini(item.resizedPath, item.mimeType),
          originalItem: item,
        };
      })
    );

    // Create parts array for Gemini request
    const parts = [];
    geminiFiles.forEach(({ file }) => {
      parts.push({ fileData: { mimeType: file.mimeType, fileUri: file.uri } });
    });

    // Add the text prompt as the last part
    parts.push({ text: BASE_PROMPT });

    // Start chat with all images
    let chatSession = model.startChat({
      generationConfig,
      safetySettings,
      history: [
        {
          role: "user",
          parts: parts,
        },
      ],
    });

    // Send prompt for all images
    const forbiddenKeywordsStr = FORBIDDEN_KEYWORDS.join(", ");
    const promptStr = prompt(
      titleLength || 90,
      descriptionLength || 120,
      keywordCount || 25
    );

    // Add retry logic for Gemini API and JSON parsing with improved error handling
    let metadataArray = null;
    let retryCount = 0;
    const MAX_RETRIES = 2;
    const INITIAL_TIMEOUT = 20000; // 20 seconds

    retry_loop: while (retryCount <= MAX_RETRIES) {
      // Calculate timeout with backoff
      const timeout = INITIAL_TIMEOUT * (1 + retryCount * 0.5);

      try {
        // Make the API call with timeout
        const result = await Promise.race([
          chatSession.sendMessage(`${promptStr}: ${forbiddenKeywordsStr}`),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Gemini API timeout after ${timeout}ms`)),
              timeout
            )
          ),
        ]);

        const jsonResponse = result.response.text();

        // Clean and parse the response - handle any text before or after code blocks
        let cleanedResponse = jsonResponse;

        // Find the first occurrence of ```json or ``` and extract everything between
        const jsonBlockMatch = jsonResponse.match(
          /```(?:json)?\s*([\s\S]*?)```/
        );
        if (jsonBlockMatch) {
          cleanedResponse = jsonBlockMatch[1].trim();
        } else {
          cleanedResponse = jsonResponse
            .replace(/^```json/, "")
            .replace(/```$/, "")
            .trim();
        }

        // Additional cleanup for common issues
        cleanedResponse = cleanedResponse
          .replace(/^[^{[\s]*/, "")
          .replace(/[^}\]]\s*$/, "")
          .trim();

        try {
          // Parse the JSON with repair attempt
          try {
            metadataArray = JSON.parse(cleanedResponse);
          } catch (initialParseError) {
            console.warn(
              `Initial JSON parsing failed: ${initialParseError.message}`
            );
            const repairedJson = repairJson(cleanedResponse);

            if (repairedJson !== cleanedResponse) {
              metadataArray = JSON.parse(repairedJson);
            } else {
              throw initialParseError;
            }
          }

          // Ensure it's an array
          if (!Array.isArray(metadataArray)) {
            metadataArray = [metadataArray];
          }

          // Check for complete metadata (correct number of items)
          if (metadataArray.length < preparedImages.length) {
            console.warn(
              `Attempt ${retryCount + 1}: Incomplete metadata (${
                metadataArray.length
              } items for ${preparedImages.length} images)`
            );

            if (retryCount === MAX_RETRIES) {
              // Generate placeholder items for each missing image
              while (metadataArray.length < preparedImages.length) {
                const missingIdx = metadataArray.length;
                const originalImage = preparedImages[missingIdx].originalImage;
                const baseName = path
                  .basename(
                    originalImage.originalname,
                    path.extname(originalImage.originalname)
                  )
                  .replace(/[-_]/g, " ");

                const placeholder = {
                  title: `Professional image of ${baseName}`,
                  description: `High quality detailed image showing ${baseName} with professional composition and lighting. Perfect for commercial use and design projects.`,
                  keywords: [
                    "professional",
                    "high quality",
                    "detailed",
                    "commercial use",
                    "photography",
                    "digital image",
                    "stock photo",
                    baseName,
                  ],
                  _generated: "placeholder_from_incomplete_response",
                };

                metadataArray.push(placeholder);
              }
            } else {
              throw new Error(
                `Incomplete metadata: expected ${preparedImages.length} items, got ${metadataArray.length}`
              );
            }
          }

          // Validate each metadata item
          for (let idx = 0; idx < metadataArray.length; idx++) {
            const isValid = validateMetadata(
              metadataArray[idx],
              path.basename(
                preparedImages[idx]?.originalImage?.originalname ||
                  `image_${idx}`
              )
            );

            if (!isValid) {
              console.warn(
                `Attempt ${retryCount + 1}: Invalid metadata for image ${idx}`
              );
              throw new Error(`Invalid metadata format for image ${idx}`);
            }
          }

          break retry_loop;
        } catch (parseError) {
          console.warn(
            `Attempt ${retryCount + 1}: Error: ${parseError.message}`
          );
          console.log("Failed to parse Gemini response. Raw response:");
          console.log(jsonResponse);
          metadataArray = null;

          if (retryCount === MAX_RETRIES) {
            throw new Error(
              `Failed to parse or validate Gemini response: ${parseError.message}`
            );
          }
        }
      } catch (apiError) {
        console.warn(
          `Attempt ${retryCount + 1}: Gemini API error: ${apiError.message}`
        );
        if (apiError.response?.text) {
          console.log("Gemini API error response:");
          console.log(apiError.response.text);
        }

        if (!apiError.message.includes("timeout")) {
          chatSession = model.startChat({
            generationConfig,
            safetySettings,
            history: [{ role: "user", parts: parts }],
          });
        }

        if (retryCount === MAX_RETRIES) {
          throw new Error(` ${apiError.message}`);
        }
      }

      retryCount++;
      const baseDelay = 1000 * Math.pow(2, retryCount);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // If we've exhausted all retries and still don't have valid metadata
    if (!metadataArray) {
      throw new Error(`Failed to get valid metadata`);
    }

    // Process each image with metadata in parallel
    const uploadSemaphore = new Semaphore(MAX_CONCURRENT_UPLOAD_REQUESTS);
    const uploadPromises = preparedImages.map(async (item, index) => {
      const release = await uploadSemaphore.acquire();
      try {
        // Get metadata for this image
        let metadata = metadataArray[index];

        // If metadata is missing or invalid, try to process this image individually
        if (
          !metadata ||
          !validateMetadata(metadata, item.originalImage.originalname)
        ) {
          console.log(
            `Retrying individual image: ${item.originalImage.originalname}`
          );

          // Create a new chat session for this single image
          const singleImageParts = [
            {
              fileData: {
                mimeType: item.mimeType,
                fileUri: (await uploadToGemini(item.resizedPath, item.mimeType))
                  .uri,
              },
            },
            { text: BASE_PROMPT },
          ];

          const singleImageChat = model.startChat({
            generationConfig,
            safetySettings,
            history: [{ role: "user", parts: singleImageParts }],
          });

          try {
            const singleImageResult = await singleImageChat.sendMessage(
              `${promptStr}: ${forbiddenKeywordsStr}`
            );

            const singleImageResponse = singleImageResult.response.text();
            let singleImageMetadata = null;

            try {
              // Try to parse the response
              const cleanedResponse = singleImageResponse
                .replace(/^```json/, "")
                .replace(/```$/, "")
                .trim();

              singleImageMetadata = JSON.parse(cleanedResponse);
              if (!Array.isArray(singleImageMetadata)) {
                singleImageMetadata = [singleImageMetadata];
              }
              singleImageMetadata = singleImageMetadata[0];
            } catch (parseError) {
              console.error(
                `Failed to parse single image response: ${parseError.message}`
              );
              throw new Error(`Invalid metadata format for single image`);
            }

            if (
              validateMetadata(
                singleImageMetadata,
                item.originalImage.originalname
              )
            ) {
              metadata = singleImageMetadata;
            } else {
              throw new Error(`Invalid metadata for single image`);
            }
          } catch (singleImageError) {
            console.error(
              `Single image processing failed: ${singleImageError.message}`
            );
            throw singleImageError;
          }
        }

        // Add metadata to the original image
        const metadataResult = await addMetadataToImage(
          item.originalPath,
          metadata
        );
        tempFiles.push(metadataResult.outputPath);

        return {
          filename: item.originalImage.originalname,
          size: item.originalImage.size,
          metadata,
        };
      } finally {
        release();
      }
    });

    // Wait for all uploads to complete
    const uploadResults = await Promise.allSettled(uploadPromises);

    // Process results
    uploadResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          filename: preparedImages[index].originalImage.originalname,
          error: result.reason?.message || "Unknown error",
          status: "failed",
        });
      }
    });

    // Clean up temp files
    cleanupTempFilesAsync(tempFiles);

    return results;
  } catch (error) {
    // Clean up temp files
    cleanupTempFilesAsync(tempFiles);

    // Return error object for all images in the batch
    return batch.map((image) => ({
      filename: image.originalname,
      error: error.message || "Unknown error",
      status: "failed",
    }));
  }
}

module.exports = { processBatch };

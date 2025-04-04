const fs = require("fs");
const path = require("path");
const os = require("os");
const mime = require("mime");
const sharp = require("sharp");
const { uploadToGemini } = require("./uploadGemini");
const { BASE_PROMPT, FORBIDDEN_KEYWORDS } = require("./ai/prompt");
const { repairJson } = require("./repairJson");
const { validateMetadata } = require("./validateMetadata");
const { addMetadataToImage } = require("./addMetadataToImage");
const { cleanupTempFilesAsync } = require("./cleanupTempFilesAsync");
const getGeminiConfig = require("./ai/config");

async function processSingleImage(image, options, apiKey) {
  const { model, generationConfig, safetySettings } = getGeminiConfig(apiKey);

  const { titleLength, descriptionLength, keywordCount } = options;
  const tempFiles = [];

  try {
    // Create temporary directory for processing if it doesn't exist
    const tempDir = path.join(os.tmpdir(), "image-processing");
    if (!fs.existsSync(tempDir)) {
      await fs.promises.mkdir(tempDir, { recursive: true });
    }

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

    // Upload image to Gemini
    const file = await uploadToGemini(tempResizedPath, mimeType, apiKey);

    // Create parts array for Gemini request
    const parts = [
      { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
      { text: BASE_PROMPT },
    ];

    // Start chat with single image
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

    // Send prompt for the image
    const forbiddenKeywordsStr = FORBIDDEN_KEYWORDS.join(", ");
    const promptStr = prompt(
      titleLength || 90,
      descriptionLength || 120,
      keywordCount || 25
    );

    // Add retry logic for Gemini API and JSON parsing with improved error handling
    let metadata = null;
    let retryCount = 0;
    const MAX_RETRIES = 2;
    const INITIAL_TIMEOUT = 20000; // 20 seconds

    // Loop for single image processing retries
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
          // If no code block markers found, try to clean the response directly
          cleanedResponse = jsonResponse
            .replace(/^```json/, "")
            .replace(/```$/, "")
            .trim();
        }

        // Additional cleanup for common issues
        cleanedResponse = cleanedResponse
          .replace(/^[^{[\s]*/, "") // Remove any text before first { or [
          .replace(/[^}\]]\s*$/, "") // Remove any text after last } or ]
          .trim();

        try {
          // Parse the JSON with repair attempt
          try {
            metadata = JSON.parse(cleanedResponse);
          } catch (initialParseError) {
            console.warn(
              `Initial JSON parsing failed: ${initialParseError.message}`
            );
            const repairedJson = repairJson(cleanedResponse);

            if (repairedJson !== cleanedResponse) {
              metadata = JSON.parse(repairedJson);
            } else {
              throw initialParseError;
            }
          }

          // If it's an array, take the first item (we're processing a single image)
          if (Array.isArray(metadata)) {
            metadata = metadata[0];
          }

          // Validate metadata
          const isValid = validateMetadata(
            metadata,
            path.basename(image.originalname || `image`)
          );

          if (!isValid) {
            console.warn(
              `Attempt ${retryCount + 1}: Invalid metadata for image ${
                image.originalname
              }`
            );
            throw new Error(
              `Invalid metadata format for image ${image.originalname}`
            );
          }

          break retry_loop;
        } catch (parseError) {
          // JSON parsing or validation error
          console.warn(
            `Attempt ${retryCount + 1}: Error: ${parseError.message}`
          );
          console.log("Failed to parse Gemini response. Raw response:");
          console.log(jsonResponse);
          metadata = null;

          if (retryCount === MAX_RETRIES) {
            throw new Error(
              `Failed to parse or validate Gemini response: ${parseError.message}`
            );
          }
        }
      } catch (apiError) {
        // API error or timeout
        console.warn(
          `Attempt ${retryCount + 1}: Gemini API error: ${apiError.message}`
        );
        if (apiError.response?.text) {
          console.log("Gemini API error response:");
          console.log(apiError.response.text);
        }

        // Create a new chat session if not a timeout error
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

      // Increment retry counter
      retryCount++;

      // Calculate delay with exponential backoff and jitter
      const baseDelay = 1000 * Math.pow(2, retryCount); // 2s, 4s, 8s, etc.
      const jitter = Math.random() * 1000; // Random jitter up to 1s
      const delay = baseDelay + jitter;

      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // If we still don't have valid metadata, throw an error
    if (!metadata) {
      throw new Error(
        `Failed to get valid metadata after ${MAX_RETRIES + 1} attempts`
      );
    }

    // Add metadata to the image
    const metadataResult = await addMetadataToImage(
      tempOriginalPath,
      metadata,
      image.outputPath
    );

    // Clean up temp files
    cleanupTempFilesAsync(tempFiles);

    return {
      filename: image.originalname,
      size: image.size,
      metadata,
      outputPath: metadataResult.outputPath,
    };
  } catch (error) {
    // Clean up temp files
    cleanupTempFilesAsync(tempFiles);

    // Return error object
    return {
      filename: image.originalname,
      error: error.message || "Unknown error",
      status: "failed",
    };
  }
}

module.exports = { processSingleImage };

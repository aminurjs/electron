const { GoogleGenerativeAI } = require("@google/generative-ai");

function getGeminiConfig(apiKey) {
  if (!apiKey) {
    throw new Error("API key is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const generationConfig = {
    temperature: 0.1,
    topP: 0.7,
    topK: 20,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
    stopSequences: [],
  };

  const safetySettings = [
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "BLOCK_NONE",
    },
  ];

  const modelOptions = {
    apiVersion: "v1",
    timeout: 90000,
  };

  return { model, generationConfig, safetySettings, modelOptions };
}

module.exports = getGeminiConfig;

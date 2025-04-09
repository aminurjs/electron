const path = require("path");
require("dotenv").config({ path: path.join(process.cwd(), ".env") });

// API validation defaults
const API_CONFIG = {
  VALIDATION_HOST: process.env.API_VALIDATION_HOST,
  VALIDATION_PROTOCOL: process.env.API_VALIDATION_PROTOCOL,
};

// Export configuration
module.exports = {
  API_CONFIG,
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  apiValidationUrl: (secretKey) =>
    `${API_CONFIG.VALIDATION_PROTOCOL}//${API_CONFIG.VALIDATION_HOST}${API_CONFIG.VALIDATION_PATH}/${secretKey}`,
};

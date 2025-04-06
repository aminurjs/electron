// index.js - Centralized handler registration
const settingsHandler = require("./settingsHandler");
const pathHandler = require("./pathHandler");
const processingHandler = require("./processingHandler");
const outputHandler = require("./outputHandler");

module.exports = {
  registerSettingsHandlers: settingsHandler.registerSettingsHandlers,
  registerPathHandler: pathHandler.registerPathHandler,
  registerProcessingHandler: processingHandler.registerProcessingHandler,
  registerOutputHandler: outputHandler.registerOutputHandler,
};

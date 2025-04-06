/**
 * Type definitions for the GenMeta application
 * These types provide better developer experience with autocompletion
 */

interface ElectronAPI {
  /**
   * File system related operations
   */
  files: {
    /**
     * Opens a file dialog to select a directory
     * @returns Promise with path and image count information
     */
    selectPath: () => Promise<{ path: string; imageCount: number } | null>;

    /**
     * Opens the output directory in the file explorer
     * @param path - Path to the directory to open
     * @returns Promise with success status
     */
    openOutputDirectory: (
      path: string
    ) => Promise<{ success: boolean; message?: string }>;
  };

  /**
   * Settings management
   */
  settings: {
    /**
     * Save settings to the electron store
     * @param settings - Settings object to save
     * @returns Promise with success status
     */
    save: (settings: Settings) => Promise<boolean>;

    /**
     * Load settings from the electron store
     * @returns Promise with settings object
     */
    load: () => Promise<Settings>;
  };

  /**
   * Processing operations
   */
  processing: {
    /**
     * Submit a configuration for processing
     * @param config - Configuration object with path
     * @returns Promise with success status
     */
    submit: (config: {
      path: string;
    }) => Promise<{ success: boolean; message: string }>;

    /**
     * Register a callback for processing start events
     * @param callback - Function to call when processing starts
     * @returns Function to remove the listener
     */
    onStart: (callback: (data: { total: number }) => void) => () => void;

    /**
     * Register a callback for processing progress events
     * @param callback - Function to call when processing progress updates
     * @returns Function to remove the listener
     */
    onProgress: (
      callback: (data: {
        current: number;
        total: number;
        percent: number;
      }) => void
    ) => () => void;

    /**
     * Register a callback for processing results events
     * @param callback - Function to call when processing completes
     * @returns Function to remove the listener
     */
    onResults: (
      callback: (results: {
        total: number;
        successful: Array<any>;
        failed: Array<any>;
        outputDirectory: string;
        allResults: Array<any>;
      }) => void
    ) => () => void;

    /**
     * Register a callback for processing error events
     * @param callback - Function to call when processing errors
     * @returns Function to remove the listener
     */
    onError: (callback: (errorMessage: string) => void) => () => void;
  };

  /**
   * Application level operations
   */
  app: {
    /**
     * Register a callback for application messages
     * @param callback - Function to call when app sends a message
     * @returns Function to remove the listener
     */
    onMessage: (callback: (message: string) => void) => () => void;
  };

  /**
   * Cleanup helpers
   */
  cleanup: {
    /**
     * Remove all registered event listeners
     * @param channels - Optional channel or array of channels to clean up
     */
    removeListeners: (channels?: string | string[]) => void;
  };
}

/**
 * Settings interface
 */
interface Settings {
  apiKey: string;
  titleLength: number;
  descriptionLength: number;
  keywordCount: number;
  isPremium: boolean;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

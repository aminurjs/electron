# Electron Image Processing App

This Electron-based desktop application provides an interface for batch processing images.

## Features

- **Image Processing**: Batch process images with customizable settings
- **Settings Management**: Configure API keys and processing parameters
- **Window State Persistence**: Application remembers window size, position, and state between sessions
- **Progress Tracking**: Real-time progress updates during image processing
- **Custom Window Controls**: Custom window frame with minimize, maximize, and close controls

## Development

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the application: `npm start`

### Building

To build the application for production:

```
npm run build
```

### Key Components

- **Main Process** (`src/main.js`): Handles Electron application lifecycle, window management, and IPC
- **Renderer Process** (`src/index.html`, `src/resource/js/script.js`): User interface and interaction
- **Preload Script** (`src/preload.js`): Securely exposes main process functionality to the renderer
- **Image Processing** (`src/process/processImages.js`): Core business logic for image processing

## Window State Persistence

The application includes a feature to remember the user's window size, position, and maximized state between sessions. This is implemented through:

1. **Window State Storage**: Window dimensions, position, and maximized state are saved to `window-state.json` in the app's user data directory
2. **Automatic Saving**: Window state is automatically saved when the window is resized, moved, or closed
3. **State Restoration**: On startup, the app restores the previous window state
4. **Display Validation**: The app validates that the saved position is still valid (visible on a connected display)
5. **Minimum Size Enforcement**: Prevents windows from being resized too small

## License

[MIT](LICENSE)

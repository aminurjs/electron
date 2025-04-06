# GenMeta - Image Metadata Generator

An Electron-based desktop application that generates metadata for images using AI.

## Features

- Image processing with AI to generate titles, descriptions, and keywords
- Customizable metadata length settings
- Progress tracking for batch processing
- Professional installer for Windows, macOS, and Linux
- Persistent window state (remembers size and position)

## Installation

### Windows

1. Download the latest installer from the [Releases](https://github.com/aminurjs/genmeta-app/releases) page
2. Run the installer (GenMeta-Setup-x.x.x.exe)
3. Follow the installation wizard

### macOS

1. Download the latest DMG from the [Releases](https://github.com/aminurjs/genmeta-app/releases) page
2. Open the DMG file
3. Drag the application to your Applications folder

### Linux

1. Download the latest AppImage from the [Releases](https://github.com/aminurjs/genmeta-app/releases) page
2. Make the AppImage executable: `chmod +x GenMeta-x.x.x.AppImage`
3. Run the application: `./GenMeta-x.x.x.AppImage`

## Development

### Prerequisites

- Node.js 16+ and npm

### Setup

1. Clone the repository

   ```bash
   git clone https://github.com/aminurjs/genmeta-app.git
   cd genmeta-app
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Start the app
   ```bash
   npm start
   ```

### Building Installers

#### Windows

```bash
# On Windows
npm run build:win
# Or use the batch file
build.bat
```

#### macOS

```bash
npm run build:mac
```

#### Linux

```bash
npm run build:linux
```

The installers will be placed in the `dist` folder.

## Project Structure

- `src/main.js` - Electron main process
- `src/preload.js` - Secure bridge between renderer and main process
- `src/index.html` - Main application UI
- `src/createMainWindow.js` - Window management
- `src/handlers/` - IPC handlers for various features
- `src/process/` - Image processing logic
- `src/assets/` - Application assets like icons
- `src/resource/` - UI resources (CSS, JS, images)

## License

[MIT](LICENSE)

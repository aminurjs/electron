import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { readdir, stat } from 'fs/promises'

const stateFile = join(app.getPath('userData'), 'window-state.json')

// Load window state from file
function loadWindowState() {
  if (existsSync(stateFile)) {
    try {
      return JSON.parse(readFileSync(stateFile, 'utf-8'))
    } catch (error) {
      console.error('Failed to load window state:', error)
    }
  }
  return { width: 900, height: 670 } // Default size
}

// Save window state before closing
function saveWindowState(win) {
  if (!win.isMinimized() && !win.isFullScreen()) {
    const bounds = win.getBounds()
    writeFileSync(stateFile, JSON.stringify(bounds))
  }
}

let mainWindow = null

function createWindow() {
  const windowState = loadWindowState()

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    show: false, // Initially hidden for smoother loading
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      mainWindow.show() // Ensures the window is visible after it's ready
    }, 100)
  })

  mainWindow.on('close', () => saveWindowState(mainWindow))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Electron app lifecycle
app.on('ready', () => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// You already have this from your original code, but I'm enhancing it
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) {
    throw new Error('Main window is not initialized')
  }

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const selectedPath = result.filePaths[0]
    return { path: selectedPath }
  } catch (error) {
    console.error('Error selecting folder:', error)
    return null
  }
})

// IPC: Handle file selection
ipcMain.handle('select-file', async () => {
  if (!mainWindow) {
    throw new Error('Main window is not initialized')
  }

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const selectedPath = result.filePaths[0]
    return { path: selectedPath }
  } catch (error) {
    console.error('Error selecting file:', error)
    return null
  }
})

// IPC: Read directory contents
ipcMain.handle('read-directory', async (_, dirPath) => {
  try {
    const items = await readdir(dirPath, { withFileTypes: true })

    const directories = []
    const files = []

    for (const item of items) {
      if (item.isDirectory()) {
        directories.push(item.name)
      } else if (item.isFile()) {
        files.push(item.name)
      }
    }

    return { directories, files }
  } catch (error) {
    console.error('Error reading directory:', error)
    return { directories: [], files: [] }
  }
})

// In a real application, you might also want file metadata
ipcMain.handle('get-file-details', async (_, filePath) => {
  try {
    const fileStats = await stat(filePath)
    return {
      size: fileStats.size,
      created: fileStats.birthtime,
      modified: fileStats.mtime,
      isDirectory: fileStats.isDirectory()
    }
  } catch (error) {
    console.error('Error getting file details:', error)
    return null
  }
})

import { useState, useEffect } from 'react'
import {
  FolderOpen,
  FolderPlus,
  File,
  Image,
  ChevronRight,
  ChevronDown,
  Settings,
  List,
  Grid
} from 'lucide-react'
import path from 'path'

const FileExplorer = () => {
  const [workspaces, setWorkspaces] = useState([])
  const [selectedWorkspace, setSelectedWorkspace] = useState(null)
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [files, setFiles] = useState([])
  const [subfolders, setSubfolders] = useState([])
  const [expandedFolders, setExpandedFolders] = useState({})
  const [viewMode, setViewMode] = useState('grid')
  const [isLoading, setIsLoading] = useState(false)

  // Load workspaces from localStorage on initial render
  useEffect(() => {
    try {
      const savedWorkspaces = localStorage.getItem('workspaces')
      if (savedWorkspaces) {
        setWorkspaces(JSON.parse(savedWorkspaces))
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error)
    }
  }, [])

  // Save workspaces to localStorage when updated
  useEffect(() => {
    if (workspaces.length > 0) {
      localStorage.setItem('workspaces', JSON.stringify(workspaces))
    }
  }, [workspaces])

  // Load subfolders when a workspace is selected
  useEffect(() => {
    if (selectedWorkspace) {
      loadSubfolders(selectedWorkspace.path)
    }
  }, [selectedWorkspace])

  // Load files when a folder is selected
  useEffect(() => {
    if (selectedFolder) {
      loadFiles(selectedFolder.path)
    }
  }, [selectedFolder])

  const loadSubfolders = async (folderPath) => {
    setIsLoading(true)
    try {
      // Call Electron's API to get directories
      const dirContents = await window.api.readDirectory(folderPath)

      if (dirContents && dirContents.directories) {
        const folders = dirContents.directories.map((dir) => ({
          id: `${folderPath}-${dir}`,
          name: dir,
          path: path.join(folderPath, dir)
        }))
        setSubfolders(folders)
      } else {
        setSubfolders([])
      }
    } catch (error) {
      console.error('Failed to load subfolders:', error)
      setSubfolders([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadFiles = async (folderPath) => {
    setIsLoading(true)
    try {
      // Call Electron's API to get files
      const dirContents = await window.api.readDirectory(folderPath)

      if (dirContents && dirContents.files) {
        const fileList = dirContents.files.map((file) => {
          const extension = path.extname(file).toLowerCase()
          const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'].includes(
            extension
          )

          return {
            name: file,
            type: isImage ? 'image' : 'file',
            path: path.join(folderPath, file),
            extension
          }
        })
        setFiles(fileList)
      } else {
        setFiles([])
      }
    } catch (error) {
      console.error('Failed to load files:', error)
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddWorkspace = async () => {
    try {
      // Call Electron's dialog to select folder
      const result = await window.api.selectFolder()

      if (result) {
        const newWorkspace = {
          id: `workspace-${Date.now()}`,
          name: path.basename(result.path),
          path: result.path
        }

        const updatedWorkspaces = [...workspaces, newWorkspace]
        setWorkspaces(updatedWorkspaces)
        setSelectedWorkspace(newWorkspace)
        setExpandedFolders({ ...expandedFolders, [newWorkspace.id]: true })
      }
    } catch (error) {
      console.error('Failed to add workspace:', error)
    }
  }

  const handleAddFile = async () => {
    try {
      // Call Electron's dialog to select file
      const result = await window.api.selectFile()

      if (result && selectedFolder) {
        // In a real app, you might want to copy the file to the selected folder
        // This would require an additional IPC method
        loadFiles(selectedFolder.path)
      }
    } catch (error) {
      console.error('Failed to add file:', error)
    }
  }

  const handleSelectWorkspace = (workspace) => {
    setSelectedWorkspace(workspace)
    setSelectedFolder(null)
    setFiles([])

    setExpandedFolders({
      ...expandedFolders,
      [workspace.id]: !expandedFolders[workspace.id]
    })
  }

  const handleSelectFolder = (folder) => {
    setSelectedFolder(folder)
  }

  const handleRemoveWorkspace = (e, workspaceId) => {
    e.stopPropagation()
    const updatedWorkspaces = workspaces.filter((w) => w.id !== workspaceId)
    setWorkspaces(updatedWorkspaces)

    if (selectedWorkspace && selectedWorkspace.id === workspaceId) {
      setSelectedWorkspace(null)
      setSelectedFolder(null)
      setFiles([])
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-700">Your workspaces:</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="mb-1">
              <div
                className={`flex items-center p-2 hover:bg-gray-100 cursor-pointer ${selectedWorkspace?.id === workspace.id ? 'bg-blue-50' : ''}`}
                onClick={() => handleSelectWorkspace(workspace)}
              >
                {expandedFolders[workspace.id] ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 mr-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 mr-1" />
                )}
                <FolderOpen className="w-5 h-5 text-yellow-500 mr-2" />
                <span className="text-sm text-gray-700 truncate flex-1">{workspace.name}</span>
                <button
                  className="text-gray-400 hover:text-red-500"
                  onClick={(e) => handleRemoveWorkspace(e, workspace.id)}
                >
                  ×
                </button>
              </div>

              {expandedFolders[workspace.id] && (
                <div className="ml-6">
                  {isLoading && selectedWorkspace?.id === workspace.id ? (
                    <div className="p-2 text-sm text-gray-500">Loading...</div>
                  ) : (
                    subfolders.map((subfolder) => (
                      <div
                        key={subfolder.id}
                        className={`flex items-center p-2 hover:bg-gray-100 cursor-pointer ${selectedFolder?.id === subfolder.id ? 'bg-blue-100' : ''}`}
                        onClick={() => handleSelectFolder(subfolder)}
                      >
                        <FolderOpen className="w-4 h-4 text-yellow-500 mr-2" />
                        <span className="text-sm truncate">{subfolder.name}</span>
                      </div>
                    ))
                  )}

                  {!isLoading && subfolders.length === 0 && (
                    <div className="p-2 text-sm text-gray-500">No subfolders found</div>
                  )}
                </div>
              )}
            </div>
          ))}

          {workspaces.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No workspaces added yet. Click the button below to add one.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleAddWorkspace}
            className="flex items-center justify-center w-full p-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            <FolderPlus className="w-5 h-5 mr-2" />
            Add local folder
          </button>

          <button
            onClick={handleAddFile}
            disabled={!selectedFolder}
            className={`flex items-center justify-center w-full p-2 mt-2 rounded ${
              selectedFolder
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <File className="w-5 h-5 mr-2" />
            Add local file
          </button>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Path navigation */}
        <div className="flex items-center p-4 border-b border-gray-200 bg-white">
          {selectedWorkspace && (
            <>
              <button
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => {
                  setSelectedFolder(null)
                  setFiles([])
                }}
              >
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>
              <FolderOpen className="w-5 h-5 text-yellow-500 mx-2" />
              <span className="font-medium">{selectedWorkspace.name}</span>

              {selectedFolder && (
                <>
                  <span className="mx-2">/</span>
                  <span className="font-medium">{selectedFolder.name}</span>
                </>
              )}

              <div className="ml-auto flex items-center">
                <span className="text-sm text-gray-500 mr-4">Files: {files.length}</span>

                <div className="flex border rounded overflow-hidden">
                  <button
                    className={`p-1 ${viewMode === 'grid' ? 'bg-blue-100' : 'bg-white'}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                  >
                    <Grid className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    className={`p-1 ${viewMode === 'list' ? 'bg-blue-100' : 'bg-white'}`}
                    onClick={() => setViewMode('list')}
                    title="List View"
                  >
                    <List className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Quick search"
                  className="ml-4 px-3 py-1 border border-gray-300 rounded-md"
                />

                <button className="ml-2 p-1 rounded hover:bg-gray-100" title="Settings">
                  <Settings className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Files display */}
        <div
          className={`flex-1 overflow-y-auto p-4 bg-gray-50 ${isLoading ? 'flex items-center justify-center' : ''}`}
        >
          {isLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : selectedFolder ? (
            viewMode === 'grid' ? (
              // Grid view
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-md overflow-hidden shadow-sm hover:shadow-md cursor-pointer border border-gray-200"
                  >
                    <div className="h-32 bg-gray-100 relative flex items-center justify-center">
                      {file.type === 'image' ? (
                        <img
                          src="/api/placeholder/150/150"
                          alt={file.name}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <File className="w-12 h-12 text-gray-400" />
                          <span className="text-xs text-gray-500 mt-1">{file.extension}</span>
                        </div>
                      )}
                      <button className="absolute top-1 right-1 bg-white rounded-full p-1 opacity-70 hover:opacity-100">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-2">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                        <p className="text-xs text-gray-700 truncate">{file.name}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {files.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-8">
                    No files found in this folder
                  </div>
                )}
              </div>
            ) : (
              // List view
              <div className="bg-white rounded border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Name</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Type</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 flex items-center">
                          {file.type === 'image' ? (
                            <Image className="w-5 h-5 text-blue-500 mr-2" />
                          ) : (
                            <File className="w-5 h-5 text-gray-400 mr-2" />
                          )}
                          <span className="text-sm">{file.name}</span>
                        </td>
                        <td className="p-3 text-sm text-gray-600">{file.extension}</td>
                        <td className="p-3 text-sm text-gray-500 truncate max-w-md">{file.path}</td>
                      </tr>
                    ))}

                    {files.length === 0 && (
                      <tr>
                        <td colSpan="3" className="text-center p-6 text-gray-500">
                          No files found in this folder
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {selectedWorkspace
                ? 'Select a folder to view files'
                : 'Select a workspace to get started'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileExplorer

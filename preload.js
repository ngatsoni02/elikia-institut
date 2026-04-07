const { contextBridge, ipcRenderer } = require('electron');

// ═══════════════════════════════════════════════════════════════
//  ISB BIBLIOTHÈQUE - Preload Script (Secure IPC Bridge)
// ═══════════════════════════════════════════════════════════════

contextBridge.exposeInMainWorld('api', {
  // Authentication
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    register: (data) => ipcRenderer.invoke('auth:register', data),
  },

  // Users
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    toggle: (userId, isActive) => ipcRenderer.invoke('users:toggle', userId, isActive),
    delete: (userId) => ipcRenderer.invoke('users:delete', userId),
    resetPassword: (userId, newPassword) => ipcRenderer.invoke('users:resetPassword', userId, newPassword),
  },

  // Book Categories
  bookCategories: {
    list: () => ipcRenderer.invoke('bookCategories:list'),
    create: (data) => ipcRenderer.invoke('bookCategories:create', data),
    update: (id, data) => ipcRenderer.invoke('bookCategories:update', id, data),
    delete: (id) => ipcRenderer.invoke('bookCategories:delete', id),
  },

  // Books
  books: {
    list: (filters) => ipcRenderer.invoke('books:list', filters),
    add: (data) => ipcRenderer.invoke('books:add', data),
    update: (id, data) => ipcRenderer.invoke('books:update', id, data),
    delete: (id) => ipcRenderer.invoke('books:delete', id),
    open: (filePath) => ipcRenderer.invoke('books:open', filePath),
  },

  // Course Categories
  courseCategories: {
    list: () => ipcRenderer.invoke('courseCategories:list'),
    create: (data) => ipcRenderer.invoke('courseCategories:create', data),
    update: (id, data) => ipcRenderer.invoke('courseCategories:update', id, data),
    delete: (id) => ipcRenderer.invoke('courseCategories:delete', id),
  },

  // Videos
  videos: {
    list: (filters) => ipcRenderer.invoke('videos:list', filters),
    add: (data) => ipcRenderer.invoke('videos:add', data),
    update: (id, data) => ipcRenderer.invoke('videos:update', id, data),
    delete: (id) => ipcRenderer.invoke('videos:delete', id),
  },

  // Progress
  progress: {
    getBook: (userId, bookId) => ipcRenderer.invoke('progress:getBook', userId, bookId),
    updateBook: (userId, bookId, data) => ipcRenderer.invoke('progress:updateBook', userId, bookId, data),
    getVideo: (userId, videoId) => ipcRenderer.invoke('progress:getVideo', userId, videoId),
    updateVideo: (userId, videoId, data) => ipcRenderer.invoke('progress:updateVideo', userId, videoId, data),
    getUserStats: (userId) => ipcRenderer.invoke('progress:getUserStats', userId),
    getFinishedVideos: (userId) => ipcRenderer.invoke('progress:getFinishedVideos', userId),
  },

  // Bookmarks
  bookmarks: {
    list: (userId) => ipcRenderer.invoke('bookmarks:list', userId),
    toggle: (userId, itemId, itemType) => ipcRenderer.invoke('bookmarks:toggle', userId, itemId, itemType),
    check: (userId, itemId, itemType) => ipcRenderer.invoke('bookmarks:check', userId, itemId, itemType),
  },

  // Dashboard
  dashboard: {
    stats: () => ipcRenderer.invoke('dashboard:stats'),
  },

  // Applications
  apps: {
    list: (filters) => ipcRenderer.invoke('apps:list', filters),
    install: (data) => ipcRenderer.invoke('apps:install', data),
    update: (id, data) => ipcRenderer.invoke('apps:update', id, data),
    updateIcon: (appId) => ipcRenderer.invoke('apps:updateIcon', appId),
    delete: (id) => ipcRenderer.invoke('apps:delete', id),
    launch: (id) => ipcRenderer.invoke('apps:launch', id),
    categories: () => ipcRenderer.invoke('apps:categories'),
  },

  // Dialogs
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    openVideo: () => ipcRenderer.invoke('dialog:openVideo'),
    openImage: () => ipcRenderer.invoke('dialog:openImage'),
    openApp: () => ipcRenderer.invoke('dialog:openApp'),
  },

  // File utilities
  file: {
    getPath: (relativePath) => ipcRenderer.invoke('file:getPath', relativePath),
    exists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
    toDataUrl: (filePath) => ipcRenderer.invoke('file:toDataUrl', filePath),
    readAsBase64: (filePath) => ipcRenderer.invoke('file:readAsBase64', filePath),
    readAsText: (filePath) => ipcRenderer.invoke('file:readAsText', filePath),
    getVideoUrl: (filePath) => ipcRenderer.invoke('file:getVideoUrl', filePath),
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // Kiosk mode
  kiosk: {
    getState: () => ipcRenderer.invoke('kiosk:getState'),
    enable: () => ipcRenderer.invoke('kiosk:enable'),
    disable: () => ipcRenderer.invoke('kiosk:disable'),
    setAutoStart: (enabled) => ipcRenderer.invoke('kiosk:setAutoStart', enabled),
    getAutoStart: () => ipcRenderer.invoke('kiosk:getAutoStart'),
  },

  // Settings
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    setMultiple: (obj) => ipcRenderer.invoke('settings:setMultiple', obj),
    uploadLogo: () => ipcRenderer.invoke('settings:uploadLogo'),
  },

  // Backup & Restore
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (backupPath) => ipcRenderer.invoke('backup:restore', backupPath),
    delete: (backupPath) => ipcRenderer.invoke('backup:delete', backupPath),
    selectFolder: () => ipcRenderer.invoke('backup:selectFolder'),
  },

  // App
  app: {
    getDataDir: () => ipcRenderer.invoke('app:getDataDir'),
  }
});

const { app, BrowserWindow, ipcMain, dialog, shell, protocol, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { execFile } = require('child_process');

// ═══════════════════════════════════════════════════════════════
//  ISB BIBLIOTHÈQUE NUMÉRIQUE - Main Process
//  Institut Supérieur Biblique
// ═══════════════════════════════════════════════════════════════

let mainWindow;
let db;

// ─── Portable "Bibliothèque" folder in user's Documents ─────
const LIBRARY_ROOT = path.join(app.getPath('documents'), 'Bibliothèque');
const BOOKS_DIR = path.join(LIBRARY_ROOT, 'Livres');
const VIDEOS_DIR = path.join(LIBRARY_ROOT, 'Vidéothèque');
const BACKUP_DIR = path.join(LIBRARY_ROOT, 'Sauvegarde');
const APPS_DIR = path.join(LIBRARY_ROOT, 'Applications');
const THUMBNAILS_DIR = path.join(LIBRARY_ROOT, '.thumbnails');
const DB_PATH = path.join(LIBRARY_ROOT, '.isb-library.db');

function ensureDirectories() {
  [LIBRARY_ROOT, BOOKS_DIR, VIDEOS_DIR, BACKUP_DIR, APPS_DIR, THUMBNAILS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// ─── Path helpers (portable relative paths) ──────────────────
// Store paths relative to LIBRARY_ROOT in DB for portability
function toRelativePath(absolutePath) {
  if (!absolutePath) return absolutePath;
  // Already relative
  if (!path.isAbsolute(absolutePath)) return absolutePath;
  // Inside our library folder?
  const normalized = path.normalize(absolutePath);
  const root = path.normalize(LIBRARY_ROOT);
  if (normalized.startsWith(root)) {
    return path.relative(root, normalized);
  }
  return absolutePath;
}

function toAbsolutePath(relativePath) {
  if (!relativePath) return relativePath;
  // Already absolute and exists? Use it directly (legacy support)
  if (path.isAbsolute(relativePath) && fs.existsSync(relativePath)) {
    return relativePath;
  }
  // If absolute but doesn't exist, try as relative (migrated from another machine)
  if (path.isAbsolute(relativePath)) {
    const basename = path.basename(relativePath);
    // Try to find in books or videos dir
    const tryBooks = path.join(BOOKS_DIR, basename);
    const tryVideos = path.join(VIDEOS_DIR, basename);
    if (fs.existsSync(tryBooks)) return tryBooks;
    if (fs.existsSync(tryVideos)) return tryVideos;
    return relativePath;
  }
  return path.join(LIBRARY_ROOT, relativePath);
}

// Resolve file_path for rows returned from DB
function resolveRows(rows) {
  return rows.map(row => {
    const resolved = { ...row };
    if (resolved.file_path) resolved.file_path = toAbsolutePath(resolved.file_path);
    if (resolved.cover_image) resolved.cover_image = toAbsolutePath(resolved.cover_image);
    if (resolved.thumbnail) resolved.thumbnail = toAbsolutePath(resolved.thumbnail);
    if (resolved.icon_path) resolved.icon_path = toAbsolutePath(resolved.icon_path);
    return resolved;
  });
}

function resolveRow(row) {
  if (!row) return row;
  return resolveRows([row])[0];
}

// Helper: run a query that returns rows
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Helper: run a query that returns one row
function dbGet(sql, params = []) {
  const rows = dbAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run a statement (INSERT/UPDATE/DELETE)
function dbRun(sql, params = []) {
  db.run(sql, params);
}

// Save database to disk
function saveDb() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    ensureDirectories();
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

// Auto-save every 30 seconds
let saveInterval;
function startAutoSave() {
  saveInterval = setInterval(saveDb, 30000);
}

// ─── Database Setup ──────────────────────────────────────────
async function initDatabase() {
  ensureDirectories();

  // Migrate from old location (AppData) if needed
  const oldDataDir = path.join(app.getPath('userData'), 'isb-data');
  const oldDbPath = path.join(oldDataDir, 'isb-library.db');
  if (fs.existsSync(oldDbPath) && !fs.existsSync(DB_PATH)) {
    console.log('Migrating database from old location...');
    fs.copyFileSync(oldDbPath, DB_PATH);
    // Copy old files
    const oldBooks = path.join(oldDataDir, 'books');
    const oldVideos = path.join(oldDataDir, 'videos');
    const oldThumbs = path.join(oldDataDir, 'thumbnails');
    if (fs.existsSync(oldBooks)) copyDirSync(oldBooks, BOOKS_DIR);
    if (fs.existsSync(oldVideos)) copyDirSync(oldVideos, VIDEOS_DIR);
    if (fs.existsSync(oldThumbs)) copyDirSync(oldThumbs, THUMBNAILS_DIR);
  }

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('admin', 'student')),
      year_of_study TEXT,
      profile_photo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_active INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS book_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#3B82F6',
      icon TEXT DEFAULT 'folder',
      parent_id TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES book_categories(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      description TEXT,
      category_id TEXT,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER,
      cover_image TEXT,
      isbn TEXT,
      publisher TEXT,
      year_published TEXT,
      language TEXT DEFAULT 'Français',
      tags TEXT,
      total_pages INTEGER,
      added_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES book_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (added_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS course_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      academic_year TEXT,
      semester TEXT,
      professor TEXT,
      description TEXT,
      color TEXT DEFAULT '#8B5CF6',
      sort_order INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category_id TEXT,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER,
      duration INTEGER,
      thumbnail TEXT,
      episode_number INTEGER,
      academic_year TEXT,
      semester TEXT,
      tags TEXT,
      added_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES course_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (added_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reading_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      current_page INTEGER DEFAULT 1,
      total_pages INTEGER,
      scroll_position REAL DEFAULT 0,
      last_read DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_finished INTEGER DEFAULT 0,
      notes TEXT,
      UNIQUE(user_id, book_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS video_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      current_time REAL DEFAULT 0,
      duration REAL,
      is_finished INTEGER DEFAULT 0,
      last_watched DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      UNIQUE(user_id, video_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL CHECK(item_type IN ('book', 'video')),
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, item_id, item_type),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      item_type TEXT,
      item_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      icon_path TEXT,
      category TEXT DEFAULT 'Utilitaire',
      file_size INTEGER,
      version TEXT,
      added_by TEXT,
      is_visible INTEGER DEFAULT 1,
      launch_count INTEGER DEFAULT 0,
      last_launched DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (added_by) REFERENCES users(id)
    )
  `);

  // Default settings
  const defaultSettings = {
    institute_name: 'Institut Supérieur Biblique',
    institute_acronym: 'ISB',
    institute_logo: '',
    login_message: '"Ta parole est une lampe à mes pieds et une lumière sur mon sentier." — Psaume 119:105',
    academic_years: JSON.stringify(['1ère Année', '2ème Année', '3ème Année', '4ème Année', 'Master']),
    semesters: JSON.stringify(['Semestre 1', 'Semestre 2']),
    study_levels: JSON.stringify(['1ère Année', '2ème Année', '3ème Année', '4ème Année', 'Master']),
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    const exists = dbGet('SELECT key FROM settings WHERE key = ?', [key]);
    if (!exists) {
      dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }

  // Create default admin if not exists
  const adminExists = dbGet('SELECT id FROM users WHERE role = ?', ['admin']);
  if (!adminExists) {
    const hashedPass = bcrypt.hashSync('admin2024', 10);
    dbRun('INSERT INTO users (id, username, password, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), 'admin', hashedPass, 'Administrateur ISB', 'admin']);
  }

  // Create default categories
  const catCount = dbGet('SELECT COUNT(*) as count FROM book_categories');
  if (catCount.count === 0) {
    const defaultBookCats = [
      { name: 'Ancien Testament', color: '#D97706', icon: 'scroll' },
      { name: 'Nouveau Testament', color: '#059669', icon: 'book-open' },
      { name: 'Théologie Systématique', color: '#7C3AED', icon: 'layers' },
      { name: "Histoire de l'Église", color: '#DC2626', icon: 'landmark' },
      { name: 'Langues Bibliques', color: '#2563EB', icon: 'languages' },
      { name: 'Homilétique', color: '#EA580C', icon: 'mic' },
      { name: 'Missiologie', color: '#0891B2', icon: 'globe' },
      { name: 'Éthique Chrétienne', color: '#4F46E5', icon: 'scale' },
      { name: 'Counseling Pastoral', color: '#DB2777', icon: 'heart' },
      { name: 'Commentaires Bibliques', color: '#65A30D', icon: 'message-square' },
    ];
    defaultBookCats.forEach((cat, i) => {
      dbRun('INSERT INTO book_categories (id, name, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), cat.name, cat.color, cat.icon, i]);
    });
  }

  const courseCatCount = dbGet('SELECT COUNT(*) as count FROM course_categories');
  if (courseCatCount.count === 0) {
    const defaultCourseCats = [
      { name: 'Introduction à la Bible', year: '1ère Année', semester: 'Semestre 1' },
      { name: 'Grec Biblique', year: '1ère Année', semester: 'Semestre 1' },
      { name: 'Hébreu Biblique', year: '2ème Année', semester: 'Semestre 1' },
      { name: 'Théologie Pastorale', year: '3ème Année', semester: 'Semestre 2' },
    ];
    defaultCourseCats.forEach((cat, i) => {
      dbRun('INSERT INTO course_categories (id, name, academic_year, semester, professor, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), cat.name, cat.year, cat.semester, '', i]);
    });
  }

  // Migrate old absolute paths to relative
  migratePathsToRelative();

  saveDb();
  startAutoSave();
}

// Migrate any absolute paths in the DB to relative paths
function migratePathsToRelative() {
  const root = path.normalize(LIBRARY_ROOT);
  // Books
  const books = dbAll('SELECT id, file_path, cover_image FROM books');
  books.forEach(b => {
    const relFile = toRelativePath(b.file_path);
    const relCover = b.cover_image ? toRelativePath(b.cover_image) : b.cover_image;
    if (relFile !== b.file_path || relCover !== b.cover_image) {
      dbRun('UPDATE books SET file_path = ?, cover_image = ? WHERE id = ?', [relFile, relCover, b.id]);
    }
  });
  // Videos
  const videos = dbAll('SELECT id, file_path, thumbnail FROM videos');
  videos.forEach(v => {
    const relFile = toRelativePath(v.file_path);
    const relThumb = v.thumbnail ? toRelativePath(v.thumbnail) : v.thumbnail;
    if (relFile !== v.file_path || relThumb !== v.thumbnail) {
      dbRun('UPDATE videos SET file_path = ?, thumbnail = ? WHERE id = ?', [relFile, relThumb, v.id]);
    }
  });
}

// Copy directory recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      if (!fs.existsSync(destPath)) fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ─── Kiosk helpers ──────────────────────────────────────────
let kioskMode = false;

function getSettingFromDb(key) {
  if (!db) return null;
  try {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    stmt.bind([key]);
    if (stmt.step()) {
      const val = stmt.getAsObject().value;
      stmt.free();
      return val;
    }
    stmt.free();
  } catch (_) {}
  return null;
}

// ─── Window Creation ─────────────────────────────────────────
function createWindow() {
  // Check kiosk setting from DB before creating window
  const kioskSetting = getSettingFromDb('kiosk_mode');
  kioskMode = kioskSetting === '1' || kioskSetting === 'true';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'ISB Bibliothèque Numérique',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0F172A',
    kiosk: kioskMode,
    fullscreen: kioskMode,
    alwaysOnTop: kioskMode,
    closable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile('src/index.html');
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());

  // In kiosk mode, block Alt+F4 for non-admin (handled by renderer asking permission)
  mainWindow.on('close', (e) => {
    // If kiosk mode is active, renderer will handle close authorization
    // The close event is allowed through when the renderer calls window:close explicitly
  });

  // Block keyboard shortcuts in kiosk mode
  if (kioskMode) {
    applyKioskRestrictions();
  }
}

function applyKioskRestrictions() {
  // Block common OS escape shortcuts
  const blockedShortcuts = [
    'Alt+Tab', 'Alt+F4', 'Super', 'Meta',
    'CommandOrControl+W', 'CommandOrControl+Q',
    'Alt+Escape', 'Control+Escape',
    'Alt+Space',
  ];
  blockedShortcuts.forEach(shortcut => {
    try {
      globalShortcut.register(shortcut, () => {
        // Blocked — do nothing
      });
    } catch (_) {
      // Some shortcuts may not be registrable on all platforms
    }
  });
}

function removeKioskRestrictions() {
  globalShortcut.unregisterAll();
}

// ─── IPC Handlers ────────────────────────────────────────────

// Auth
ipcMain.handle('auth:login', async (_, username, password) => {
  const user = dbGet('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
  if (!user) return { success: false, error: 'Utilisateur non trouvé' };
  if (!bcrypt.compareSync(password, user.password)) return { success: false, error: 'Mot de passe incorrect' };
  dbRun('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  dbRun('INSERT INTO activity_log (id, user_id, action) VALUES (?, ?, ?)', [uuidv4(), user.id, 'login']);
  saveDb();
  const { password: _pwd, ...safeUser } = user;
  return { success: true, user: safeUser };
});

ipcMain.handle('auth:register', async (_, data) => {
  try {
    const exists = dbGet('SELECT id FROM users WHERE username = ?', [data.username]);
    if (exists) return { success: false, error: "Ce nom d'utilisateur existe déjà" };
    const hashedPass = bcrypt.hashSync(data.password, 10);
    const id = uuidv4();
    dbRun('INSERT INTO users (id, username, password, full_name, role, year_of_study) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.username, hashedPass, data.full_name, data.role || 'student', data.year_of_study || '']);
    saveDb();
    return { success: true, id };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('users:list', async () => {
  return dbAll('SELECT id, username, full_name, role, year_of_study, created_at, last_login, is_active FROM users ORDER BY created_at DESC');
});

ipcMain.handle('users:toggle', async (_, userId, isActive) => {
  dbRun('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, userId]);
  saveDb();
  return { success: true };
});

ipcMain.handle('users:delete', async (_, userId) => {
  dbRun('DELETE FROM users WHERE id = ? AND role != ?', [userId, 'admin']);
  saveDb();
  return { success: true };
});

ipcMain.handle('users:resetPassword', async (_, userId, newPassword) => {
  const hashedPass = bcrypt.hashSync(newPassword, 10);
  dbRun('UPDATE users SET password = ? WHERE id = ?', [hashedPass, userId]);
  saveDb();
  return { success: true };
});

// Book Categories
ipcMain.handle('bookCategories:list', async () => {
  return dbAll('SELECT * FROM book_categories ORDER BY sort_order');
});

ipcMain.handle('bookCategories:create', async (_, data) => {
  const id = uuidv4();
  dbRun('INSERT INTO book_categories (id, name, description, color, icon, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, data.name, data.description || '', data.color || '#3B82F6', data.icon || 'folder', data.parent_id || null, data.sort_order || 0]);
  saveDb();
  return { success: true, id };
});

ipcMain.handle('bookCategories:update', async (_, id, data) => {
  dbRun('UPDATE book_categories SET name = ?, description = ?, color = ?, icon = ? WHERE id = ?',
    [data.name, data.description || '', data.color || '#3B82F6', data.icon || 'folder', id]);
  saveDb();
  return { success: true };
});

ipcMain.handle('bookCategories:delete', async (_, id) => {
  dbRun('DELETE FROM book_categories WHERE id = ?', [id]);
  saveDb();
  return { success: true };
});

// Books
ipcMain.handle('books:list', async (_, filters) => {
  let query = `SELECT b.*, bc.name as category_name, bc.color as category_color
               FROM books b LEFT JOIN book_categories bc ON b.category_id = bc.id`;
  const params = [];
  const conditions = [];

  if (filters?.category_id) {
    conditions.push('b.category_id = ?');
    params.push(filters.category_id);
  }
  if (filters?.search) {
    conditions.push('(b.title LIKE ? OR b.author LIKE ? OR b.tags LIKE ?)');
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY b.created_at DESC';

  return resolveRows(dbAll(query, params));
});

ipcMain.handle('books:add', async (_, data) => {
  const id = uuidv4();
  const ext = path.extname(data.file_path);
  const destFilename = `${id}${ext}`;
  const destPath = path.join(BOOKS_DIR, destFilename);
  fs.copyFileSync(data.file_path, destPath);

  let coverRelPath = null;
  if (data.cover_image) {
    const coverExt = path.extname(data.cover_image);
    const coverFilename = `${id}_cover${coverExt}`;
    fs.copyFileSync(data.cover_image, path.join(THUMBNAILS_DIR, coverFilename));
    coverRelPath = toRelativePath(path.join(THUMBNAILS_DIR, coverFilename));
  }

  const relFilePath = toRelativePath(destPath);

  dbRun(`INSERT INTO books (id, title, author, description, category_id, file_path, file_type, file_size, cover_image, isbn, publisher, year_published, language, tags, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.author || '', data.description || '', data.category_id || null,
      relFilePath, ext.replace('.', '').toLowerCase(), data.file_size || 0, coverRelPath,
      data.isbn || '', data.publisher || '', data.year_published || '', data.language || 'Français',
      data.tags || '', data.added_by || null]);
  saveDb();
  return { success: true, id };
});

ipcMain.handle('books:update', async (_, id, data) => {
  dbRun(`UPDATE books SET title = ?, author = ?, description = ?, category_id = ?,
    isbn = ?, publisher = ?, year_published = ?, language = ?, tags = ? WHERE id = ?`,
    [data.title, data.author, data.description, data.category_id,
      data.isbn, data.publisher, data.year_published, data.language, data.tags, id]);
  saveDb();
  return { success: true };
});

ipcMain.handle('books:delete', async (_, id) => {
  const book = dbGet('SELECT file_path, cover_image FROM books WHERE id = ?', [id]);
  if (book) {
    const absFilePath = toAbsolutePath(book.file_path);
    if (fs.existsSync(absFilePath)) fs.unlinkSync(absFilePath);
    if (book.cover_image) {
      const absCoverPath = toAbsolutePath(book.cover_image);
      if (fs.existsSync(absCoverPath)) fs.unlinkSync(absCoverPath);
    }
  }
  dbRun('DELETE FROM books WHERE id = ?', [id]);
  saveDb();
  return { success: true };
});

ipcMain.handle('books:open', async (_, filePath) => {
  shell.openPath(filePath);
  return { success: true };
});

// Read file as base64 (for PDF rendering - safer than ArrayBuffer over IPC)
ipcMain.handle('file:readAsBase64', async (_, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
  } catch (err) {
    console.error('Error reading file:', err);
    return null;
  }
});

// Read file as text (for TXT, RTF, etc.)
ipcMain.handle('file:readAsText', async (_, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
});

// Get video file URL (file:// protocol for local playback)
ipcMain.handle('file:getVideoUrl', async (_, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  return filePath;
});

// Course Categories
ipcMain.handle('courseCategories:list', async () => {
  return dbAll('SELECT * FROM course_categories ORDER BY academic_year, semester, sort_order');
});

ipcMain.handle('courseCategories:create', async (_, data) => {
  const id = uuidv4();
  dbRun('INSERT INTO course_categories (id, name, academic_year, semester, professor, description, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, data.name, data.academic_year || '', data.semester || '', data.professor || '', data.description || '', data.color || '#8B5CF6', data.sort_order || 0]);
  saveDb();
  return { success: true, id };
});

ipcMain.handle('courseCategories:update', async (_, id, data) => {
  dbRun('UPDATE course_categories SET name = ?, academic_year = ?, semester = ?, professor = ?, description = ?, color = ? WHERE id = ?',
    [data.name, data.academic_year, data.semester, data.professor, data.description, data.color, id]);
  saveDb();
  return { success: true };
});

ipcMain.handle('courseCategories:delete', async (_, id) => {
  dbRun('DELETE FROM course_categories WHERE id = ?', [id]);
  saveDb();
  return { success: true };
});

// Videos
ipcMain.handle('videos:list', async (_, filters) => {
  let query = `SELECT v.*, cc.name as category_name, cc.color as category_color, cc.academic_year as course_year, cc.semester as course_semester
               FROM videos v LEFT JOIN course_categories cc ON v.category_id = cc.id`;
  const params = [];
  const conditions = [];

  if (filters?.category_id) {
    conditions.push('v.category_id = ?');
    params.push(filters.category_id);
  }
  if (filters?.academic_year) {
    conditions.push('(v.academic_year = ? OR cc.academic_year = ?)');
    params.push(filters.academic_year, filters.academic_year);
  }
  if (filters?.semester) {
    conditions.push('(v.semester = ? OR cc.semester = ?)');
    params.push(filters.semester, filters.semester);
  }
  if (filters?.search) {
    conditions.push('(v.title LIKE ? OR v.tags LIKE ? OR cc.name LIKE ?)');
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY v.episode_number ASC, v.created_at DESC';

  return resolveRows(dbAll(query, params));
});

ipcMain.handle('videos:add', async (_, data) => {
  const id = uuidv4();
  const ext = path.extname(data.file_path);
  const destFilename = `${id}${ext}`;
  const destPath = path.join(VIDEOS_DIR, destFilename);
  fs.copyFileSync(data.file_path, destPath);

  let thumbRelPath = null;
  if (data.thumbnail) {
    const thumbExt = path.extname(data.thumbnail);
    const thumbFilename = `${id}_thumb${thumbExt}`;
    fs.copyFileSync(data.thumbnail, path.join(THUMBNAILS_DIR, thumbFilename));
    thumbRelPath = toRelativePath(path.join(THUMBNAILS_DIR, thumbFilename));
  }

  const relFilePath = toRelativePath(destPath);

  dbRun(`INSERT INTO videos (id, title, description, category_id, file_path, file_type, file_size, duration, thumbnail, episode_number, academic_year, semester, tags, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.description || '', data.category_id || null,
      relFilePath, ext.replace('.', '').toLowerCase(), data.file_size || 0, data.duration || 0, thumbRelPath,
      data.episode_number || null, data.academic_year || '', data.semester || '',
      data.tags || '', data.added_by || null]);
  saveDb();
  return { success: true, id };
});

ipcMain.handle('videos:update', async (_, id, data) => {
  dbRun(`UPDATE videos SET title = ?, description = ?, category_id = ?, episode_number = ?,
    academic_year = ?, semester = ?, tags = ? WHERE id = ?`,
    [data.title, data.description, data.category_id, data.episode_number,
      data.academic_year, data.semester, data.tags, id]);
  saveDb();
  return { success: true };
});

ipcMain.handle('videos:delete', async (_, id) => {
  const video = dbGet('SELECT file_path, thumbnail FROM videos WHERE id = ?', [id]);
  if (video) {
    const absFilePath = toAbsolutePath(video.file_path);
    if (fs.existsSync(absFilePath)) fs.unlinkSync(absFilePath);
    if (video.thumbnail) {
      const absThumbPath = toAbsolutePath(video.thumbnail);
      if (fs.existsSync(absThumbPath)) fs.unlinkSync(absThumbPath);
    }
  }
  dbRun('DELETE FROM videos WHERE id = ?', [id]);
  saveDb();
  return { success: true };
});

// Progress
ipcMain.handle('progress:getBook', async (_, userId, bookId) => {
  return dbGet('SELECT * FROM reading_progress WHERE user_id = ? AND book_id = ?', [userId, bookId]);
});

ipcMain.handle('progress:updateBook', async (_, userId, bookId, data) => {
  const existing = dbGet('SELECT id FROM reading_progress WHERE user_id = ? AND book_id = ?', [userId, bookId]);
  if (existing) {
    dbRun('UPDATE reading_progress SET current_page = ?, scroll_position = ?, last_read = CURRENT_TIMESTAMP, is_finished = ? WHERE id = ?',
      [data.current_page || 1, data.scroll_position || 0, data.is_finished ? 1 : 0, existing.id]);
  } else {
    dbRun('INSERT INTO reading_progress (id, user_id, book_id, current_page, scroll_position, total_pages) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, bookId, data.current_page || 1, data.scroll_position || 0, data.total_pages || 0]);
  }
  saveDb();
  return { success: true };
});

ipcMain.handle('progress:getVideo', async (_, userId, videoId) => {
  return dbGet('SELECT * FROM video_progress WHERE user_id = ? AND video_id = ?', [userId, videoId]);
});

ipcMain.handle('progress:updateVideo', async (_, userId, videoId, data) => {
  const existing = dbGet('SELECT id FROM video_progress WHERE user_id = ? AND video_id = ?', [userId, videoId]);
  if (existing) {
    dbRun('UPDATE video_progress SET current_time = ?, duration = ?, last_watched = CURRENT_TIMESTAMP, is_finished = ? WHERE id = ?',
      [data.current_time || 0, data.duration || 0, data.is_finished ? 1 : 0, existing.id]);
  } else {
    dbRun('INSERT INTO video_progress (id, user_id, video_id, current_time, duration) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), userId, videoId, data.current_time || 0, data.duration || 0]);
  }
  saveDb();
  return { success: true };
});

ipcMain.handle('progress:getUserStats', async (_, userId) => {
  const booksRead = dbGet('SELECT COUNT(*) as count FROM reading_progress WHERE user_id = ?', [userId]);
  const booksFinished = dbGet('SELECT COUNT(*) as count FROM reading_progress WHERE user_id = ? AND is_finished = 1', [userId]);
  const videosWatched = dbGet('SELECT COUNT(*) as count FROM video_progress WHERE user_id = ?', [userId]);
  const videosFinished = dbGet('SELECT COUNT(*) as count FROM video_progress WHERE user_id = ? AND is_finished = 1', [userId]);
  const recentBooks = dbAll(`
    SELECT rp.*, b.title, b.author, b.cover_image FROM reading_progress rp
    JOIN books b ON rp.book_id = b.id WHERE rp.user_id = ? ORDER BY rp.last_read DESC LIMIT 5
  `, [userId]);
  const recentVideos = dbAll(`
    SELECT vp.*, v.title, v.thumbnail FROM video_progress vp
    JOIN videos v ON vp.video_id = v.id WHERE vp.user_id = ? ORDER BY vp.last_watched DESC LIMIT 5
  `, [userId]);

  return {
    booksRead: booksRead.count,
    booksFinished: booksFinished.count,
    videosWatched: videosWatched.count,
    videosFinished: videosFinished.count,
    recentBooks,
    recentVideos
  };
});

// Get finished video IDs for a user (used for sequential lock)
ipcMain.handle('progress:getFinishedVideos', async (_, userId) => {
  const rows = dbAll('SELECT video_id FROM video_progress WHERE user_id = ? AND is_finished = 1', [userId]);
  return rows.map(r => r.video_id);
});

// Bookmarks
ipcMain.handle('bookmarks:list', async (_, userId) => {
  const bookBookmarks = dbAll(`
    SELECT bm.*, b.title, b.author, b.cover_image, 'book' as type FROM bookmarks bm
    JOIN books b ON bm.item_id = b.id WHERE bm.user_id = ? AND bm.item_type = 'book'
  `, [userId]);
  const videoBookmarks = dbAll(`
    SELECT bm.*, v.title, v.thumbnail, 'video' as type FROM bookmarks bm
    JOIN videos v ON bm.item_id = v.id WHERE bm.user_id = ? AND bm.item_type = 'video'
  `, [userId]);
  return [...bookBookmarks, ...videoBookmarks];
});

ipcMain.handle('bookmarks:toggle', async (_, userId, itemId, itemType) => {
  const existing = dbGet('SELECT id FROM bookmarks WHERE user_id = ? AND item_id = ? AND item_type = ?', [userId, itemId, itemType]);
  if (existing) {
    dbRun('DELETE FROM bookmarks WHERE id = ?', [existing.id]);
    saveDb();
    return { success: true, bookmarked: false };
  } else {
    dbRun('INSERT INTO bookmarks (id, user_id, item_id, item_type) VALUES (?, ?, ?, ?)',
      [uuidv4(), userId, itemId, itemType]);
    saveDb();
    return { success: true, bookmarked: true };
  }
});

ipcMain.handle('bookmarks:check', async (_, userId, itemId, itemType) => {
  const existing = dbGet('SELECT id FROM bookmarks WHERE user_id = ? AND item_id = ? AND item_type = ?', [userId, itemId, itemType]);
  return !!existing;
});

// Dashboard stats
ipcMain.handle('dashboard:stats', async () => {
  const totalBooks = dbGet('SELECT COUNT(*) as count FROM books');
  const totalVideos = dbGet('SELECT COUNT(*) as count FROM videos');
  const totalUsers = dbGet('SELECT COUNT(*) as count FROM users WHERE role = ?', ['student']);
  const totalCategories = dbGet('SELECT COUNT(*) as count FROM book_categories');
  const recentBooks = dbAll('SELECT * FROM books ORDER BY created_at DESC LIMIT 5');
  const recentVideos = dbAll(`SELECT v.*, cc.name as category_name FROM videos v
    LEFT JOIN course_categories cc ON v.category_id = cc.id ORDER BY v.created_at DESC LIMIT 5`);

  return {
    totalBooks: totalBooks.count,
    totalVideos: totalVideos.count,
    totalUsers: totalUsers.count,
    totalCategories: totalCategories.count,
    recentBooks: resolveRows(recentBooks),
    recentVideos: resolveRows(recentVideos)
  };
});

// File dialogs
ipcMain.handle('dialog:openFile', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [
      { name: 'Documents', extensions: ['pdf', 'epub', 'doc', 'docx', 'txt', 'rtf'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  });
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  const stats = fs.statSync(filePath);
  return { path: filePath, size: stats.size, name: path.basename(filePath) };
});

ipcMain.handle('dialog:openVideo', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Vidéos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  });
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  const stats = fs.statSync(filePath);
  return { path: filePath, size: stats.size, name: path.basename(filePath) };
});

ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }
    ]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// File serving
ipcMain.handle('file:getPath', async (_, relativePath) => {
  return toAbsolutePath(relativePath);
});

ipcMain.handle('file:exists', async (_, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('file:toDataUrl', async (_, filePath) => {
  const fullPath = toAbsolutePath(filePath);
  if (!fs.existsSync(fullPath)) return null;
  const data = fs.readFileSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
  const mime = mimeTypes[ext] || 'image/jpeg';
  return `data:${mime};base64,${data.toString('base64')}`;
});

// Window controls
ipcMain.handle('window:minimize', () => {
  // In kiosk mode, only admin can minimize (renderer checks role before calling)
  mainWindow.minimize();
});
ipcMain.handle('window:maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow.close());

// ─── Kiosk Mode IPC handlers ───────────────────────────────
ipcMain.handle('kiosk:getState', () => {
  return { active: kioskMode };
});

ipcMain.handle('kiosk:enable', () => {
  kioskMode = true;
  mainWindow.setKiosk(true);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setFullScreen(true);
  applyKioskRestrictions();
  return { success: true };
});

ipcMain.handle('kiosk:disable', () => {
  kioskMode = false;
  mainWindow.setKiosk(false);
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setFullScreen(false);
  removeKioskRestrictions();
  return { success: true };
});

// Auto-start at OS boot
ipcMain.handle('kiosk:setAutoStart', (_, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: []
  });
  return { success: true };
});

ipcMain.handle('kiosk:getAutoStart', () => {
  const settings = app.getLoginItemSettings();
  return { enabled: settings.openAtLogin };
});

// App info
ipcMain.handle('app:getDataDir', () => LIBRARY_ROOT);

// ═══════════════════════════════════════════════════════════════
//  BACKUP & RESTORE
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('backup:create', async () => {
  try {
    saveDb(); // Ensure DB is up-to-date

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `ISB-Backup-${timestamp}`;
    const backupDir = path.join(BACKUP_DIR, backupName);

    fs.mkdirSync(backupDir, { recursive: true });

    // 1. Copy database
    fs.copyFileSync(DB_PATH, path.join(backupDir, 'isb-library.db'));

    // 2. Copy all media files (books, videos, thumbnails)
    copyDirSync(BOOKS_DIR, path.join(backupDir, 'Livres'));
    copyDirSync(VIDEOS_DIR, path.join(backupDir, 'Vidéothèque'));
    copyDirSync(THUMBNAILS_DIR, path.join(backupDir, '.thumbnails'));

    // 3. Write manifest
    const manifest = {
      version: '1.0',
      appName: 'ISB Bibliothèque Numérique',
      createdAt: new Date().toISOString(),
      stats: {
        books: dbGet('SELECT COUNT(*) as count FROM books').count,
        videos: dbGet('SELECT COUNT(*) as count FROM videos').count,
        users: dbGet('SELECT COUNT(*) as count FROM users').count,
        bookCategories: dbGet('SELECT COUNT(*) as count FROM book_categories').count,
        courseCategories: dbGet('SELECT COUNT(*) as count FROM course_categories').count,
      }
    };
    fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    return {
      success: true,
      path: backupDir,
      name: backupName,
      stats: manifest.stats
    };
  } catch (err) {
    console.error('Backup error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:list', async () => {
  ensureDirectories();
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });
  const backups = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('ISB-Backup-')) continue;
    const backupPath = path.join(BACKUP_DIR, entry.name);
    const manifestPath = path.join(backupPath, 'manifest.json');

    let manifest = null;
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      } catch { /* ignore */ }
    }

    // Calculate folder size
    let totalSize = 0;
    const calcSize = (dir) => {
      if (!fs.existsSync(dir)) return;
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        if (item.isDirectory()) calcSize(itemPath);
        else totalSize += fs.statSync(itemPath).size;
      }
    };
    calcSize(backupPath);

    backups.push({
      name: entry.name,
      path: backupPath,
      createdAt: manifest?.createdAt || fs.statSync(backupPath).mtime.toISOString(),
      stats: manifest?.stats || {},
      size: totalSize
    });
  }

  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

ipcMain.handle('backup:restore', async (_, backupPath) => {
  try {
    // Validate backup
    const dbBackup = path.join(backupPath, 'isb-library.db');
    if (!fs.existsSync(dbBackup)) {
      return { success: false, error: 'Fichier de base de données introuvable dans la sauvegarde' };
    }

    // Close current DB
    if (db) {
      if (saveInterval) clearInterval(saveInterval);
      db.close();
      db = null;
    }

    // Restore database
    fs.copyFileSync(dbBackup, DB_PATH);

    // Restore media files
    const backupBooks = path.join(backupPath, 'Livres');
    const backupVideos = path.join(backupPath, 'Vidéothèque');
    const backupThumbs = path.join(backupPath, '.thumbnails');

    if (fs.existsSync(backupBooks)) copyDirSync(backupBooks, BOOKS_DIR);
    if (fs.existsSync(backupVideos)) copyDirSync(backupVideos, VIDEOS_DIR);
    if (fs.existsSync(backupThumbs)) copyDirSync(backupThumbs, THUMBNAILS_DIR);

    // Reopen database
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    db.run('PRAGMA foreign_keys = ON');

    // Migrate paths to relative for this machine
    migratePathsToRelative();
    saveDb();
    startAutoSave();

    return { success: true };
  } catch (err) {
    console.error('Restore error:', err);
    // Try to recover
    try {
      const SQL = await initSqlJs();
      if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
      } else {
        db = new SQL.Database();
      }
      db.run('PRAGMA foreign_keys = ON');
      startAutoSave();
    } catch { /* critical failure */ }
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:delete', async (_, backupPath) => {
  try {
    if (!fs.existsSync(backupPath)) return { success: false, error: 'Sauvegarde introuvable' };
    fs.rmSync(backupPath, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Sélectionner un dossier de sauvegarde à restaurer'
  });
  if (result.canceled) return null;
  const selectedPath = result.filePaths[0];
  // Validate that it contains a backup
  if (fs.existsSync(path.join(selectedPath, 'isb-library.db'))) {
    return selectedPath;
  }
  return null;
});

// ═══════════════════════════════════════════════════════════════
//  APPLICATIONS (Install & Launch)
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('apps:list', async (_, filters) => {
  let query = 'SELECT * FROM applications';
  const conditions = [];
  const params = [];
  if (filters?.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters?.search) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    const s = `%${filters.search}%`;
    params.push(s, s);
  }
  if (filters?.visible_only) {
    conditions.push('is_visible = 1');
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY launch_count DESC, name ASC';
  return resolveRows(dbAll(query, params));
});

ipcMain.handle('apps:install', async (_, data) => {
  try {
    const id = uuidv4();
    const ext = path.extname(data.file_path).toLowerCase();
    let storedPath;

    if (data.link_only) {
      // Link mode: store the original absolute path directly (for apps with dependencies)
      storedPath = data.file_path;
    } else {
      // Copy mode: copy file into Applications folder
      const originalName = path.basename(data.file_path);
      const destFilename = `${id}_${originalName}`;
      const destPath = path.join(APPS_DIR, destFilename);
      fs.copyFileSync(data.file_path, destPath);
      storedPath = toRelativePath(destPath);
    }

    // Handle optional icon
    let iconRelPath = null;
    if (data.icon_path) {
      const iconExt = path.extname(data.icon_path);
      const iconFilename = `${id}_icon${iconExt}`;
      fs.copyFileSync(data.icon_path, path.join(THUMBNAILS_DIR, iconFilename));
      iconRelPath = toRelativePath(path.join(THUMBNAILS_DIR, iconFilename));
    }

    dbRun(`INSERT INTO applications (id, name, description, file_path, file_type, icon_path, category, file_size, version, added_by, is_visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.description || '', storedPath,
        ext.replace('.', ''), iconRelPath,
        data.category || 'Utilitaire', data.file_size || 0,
        data.version || '', data.added_by || null,
        data.is_visible !== undefined ? data.is_visible : 1]);
    saveDb();
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('apps:update', async (_, id, data) => {
  dbRun(`UPDATE applications SET name = ?, description = ?, category = ?, version = ?, is_visible = ? WHERE id = ?`,
    [data.name, data.description || '', data.category || 'Utilitaire', data.version || '', data.is_visible !== undefined ? (data.is_visible ? 1 : 0) : 1, id]);
  saveDb();
  return { success: true };
});

ipcMain.handle('apps:updateIcon', async (_, appId) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'ico', 'svg', 'webp'] }]
  });
  if (result.canceled) return null;

  const srcPath = result.filePaths[0];
  const iconExt = path.extname(srcPath);
  const iconFilename = `${appId}_icon${iconExt}`;
  fs.copyFileSync(srcPath, path.join(THUMBNAILS_DIR, iconFilename));
  const iconRelPath = toRelativePath(path.join(THUMBNAILS_DIR, iconFilename));

  dbRun('UPDATE applications SET icon_path = ? WHERE id = ?', [iconRelPath, appId]);
  saveDb();

  const data = fs.readFileSync(path.join(THUMBNAILS_DIR, iconFilename));
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
  const mime = mimeTypes[iconExt.toLowerCase()] || 'image/png';
  return `data:${mime};base64,${data.toString('base64')}`;
});

ipcMain.handle('apps:delete', async (_, id) => {
  try {
    const appRow = dbGet('SELECT file_path, icon_path FROM applications WHERE id = ?', [id]);
    if (appRow) {
      // Only delete files that live inside our LIBRARY_ROOT (copied apps)
      // Never delete linked/external files (e.g. Program Files)
      const absFile = path.isAbsolute(appRow.file_path) ? appRow.file_path : toAbsolutePath(appRow.file_path);
      const isOurFile = absFile.startsWith(LIBRARY_ROOT);
      if (isOurFile && fs.existsSync(absFile)) {
        try { fs.unlinkSync(absFile); } catch (e) { console.warn('Could not delete app file:', e.message); }
      }
      if (appRow.icon_path) {
        const absIcon = path.isAbsolute(appRow.icon_path) ? appRow.icon_path : toAbsolutePath(appRow.icon_path);
        if (absIcon.startsWith(LIBRARY_ROOT) && fs.existsSync(absIcon)) {
          try { fs.unlinkSync(absIcon); } catch (e) { console.warn('Could not delete icon:', e.message); }
        }
      }
    }
    dbRun('DELETE FROM applications WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('apps:launch', async (_, id) => {
  const appRow = dbGet('SELECT * FROM applications WHERE id = ?', [id]);
  if (!appRow) return { success: false, error: 'Application introuvable' };

  // Resolve path: could be relative (copied) or absolute (linked)
  let absPath;
  if (path.isAbsolute(appRow.file_path)) {
    absPath = appRow.file_path;
  } else {
    absPath = toAbsolutePath(appRow.file_path);
  }

  if (!fs.existsSync(absPath)) return { success: false, error: 'Fichier introuvable: ' + absPath };

  const ext = (appRow.file_type || '').toLowerCase();

  try {
    if (ext === 'apk') {
      // Try to find an Android emulator
      const emulatorPaths = [
        'C:\\Program Files\\BlueStacks_nxt\\HD-Player.exe',
        'C:\\Program Files (x86)\\Nox\\bin\\Nox.exe',
        'C:\\Program Files\\Genymobile\\Genymotion\\player.exe',
      ];
      let emulatorFound = false;
      for (const emu of emulatorPaths) {
        if (fs.existsSync(emu)) {
          execFile(emu, [absPath], { detached: true, stdio: 'ignore' }).unref();
          emulatorFound = true;
          break;
        }
      }
      if (!emulatorFound) {
        return { success: false, error: 'Aucun émulateur Android détecté (BlueStacks, Nox, Genymotion). Installez-en un pour lancer les fichiers .apk.' };
      }
    } else {
      // Use shell.openPath for .exe, .msi, and all other types
      // This launches the app in its own directory context with proper associations
      const errMsg = await shell.openPath(absPath);
      if (errMsg) {
        return { success: false, error: errMsg };
      }
    }

    // Update launch count
    dbRun('UPDATE applications SET launch_count = launch_count + 1, last_launched = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('apps:categories', async () => {
  const rows = dbAll('SELECT DISTINCT category FROM applications WHERE category IS NOT NULL AND category != "" ORDER BY category');
  return rows.map(r => r.category);
});

ipcMain.handle('dialog:openApp', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Applications', extensions: ['exe', 'msi', 'apk'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  });
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  const stats = fs.statSync(filePath);
  return { path: filePath, size: stats.size, name: path.basename(filePath) };
});

// ═══════════════════════════════════════════════════════════════
//  SETTINGS (Institute customization)
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('settings:getAll', async () => {
  const rows = dbAll('SELECT * FROM settings');
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
});

ipcMain.handle('settings:get', async (_, key) => {
  const row = dbGet('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
});

ipcMain.handle('settings:set', async (_, key, value) => {
  const exists = dbGet('SELECT key FROM settings WHERE key = ?', [key]);
  if (exists) {
    dbRun('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
  } else {
    dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
  saveDb();
  return { success: true };
});

ipcMain.handle('settings:setMultiple', async (_, settingsObj) => {
  for (const [key, value] of Object.entries(settingsObj)) {
    const exists = dbGet('SELECT key FROM settings WHERE key = ?', [key]);
    if (exists) {
      dbRun('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
    } else {
      dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }
  saveDb();
  return { success: true };
});

ipcMain.handle('settings:uploadLogo', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }]
  });
  if (result.canceled) return null;

  const srcPath = result.filePaths[0];
  const ext = path.extname(srcPath);
  const destName = `institute_logo${ext}`;
  const destPath = path.join(THUMBNAILS_DIR, destName);
  fs.copyFileSync(srcPath, destPath);

  const relPath = toRelativePath(destPath);
  // Save to settings
  const exists = dbGet('SELECT key FROM settings WHERE key = ?', ['institute_logo']);
  if (exists) {
    dbRun('UPDATE settings SET value = ? WHERE key = ?', [relPath, 'institute_logo']);
  } else {
    dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', ['institute_logo', relPath]);
  }
  saveDb();

  // Return data URL for immediate display
  const data = fs.readFileSync(destPath);
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  const mime = mimeTypes[ext.toLowerCase()] || 'image/png';
  return `data:${mime};base64,${data.toString('base64')}`;
});

// ─── App Lifecycle ───────────────────────────────────────────
app.whenReady().then(async () => {
  await initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  removeKioskRestrictions();
  if (saveInterval) clearInterval(saveInterval);
  if (db) {
    saveDb();
    db.close();
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (saveInterval) clearInterval(saveInterval);
  if (db) {
    saveDb();
    db.close();
  }
});

// ═══════════════════════════════════════════════════════════════
//  ELIKIA INSTITUT - Bibliothèque Numérique
//  Créé par ELIKIA MEDIA BY PRINCE NGATSONI
// ═══════════════════════════════════════════════════════════════

// ─── State ──────────────────────────────────────────────────
let appSettings = {};
let currentUser = null;
let currentPage = 'dashboard';
let bookCategories = [];
let courseCategories = [];
let allBooks = [];
let allVideos = [];
let currentBookCategoryFilter = 'all';
let currentVideoCategoryFilter = 'all';
let currentVideoId = null;

// Reader state
let pdfDoc = null;
let pdfCurrentPage = 1;
let pdfTotalPages = 0;
let pdfScale = 1.2;
let pdfContinuousMode = true;
let currentReaderBookId = null;
let currentReaderFilePath = null;
let currentReaderFileType = null;
// pdfjsLib is loaded globally via <script> tag

// Video player state
let videoSavedTime = 0;

// Thumbnail size state
let bookThumbSize = 'medium';
let videoThumbSize = 'medium';

// Kiosk state
let isKioskActive = false;

// ─── Utility Functions ──────────────────────────────────────
function $(id) { return document.getElementById(id); }
function $$(sel) { return document.querySelectorAll(sel); }

function showToast(message, type = 'info') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };
  toast.innerHTML = `${icons[type] || icons.info} ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFileSize(bytes) {
  if (!bytes) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Thumbnail Size ─────────────────────────────────────────
function setThumbnailSize(section, size, btn) {
  const gridId = section === 'books' ? 'books-grid' : 'videos-grid';
  const grid = $(gridId);
  if (!grid) return;

  // Remove all size classes
  grid.classList.remove('size-small', 'size-medium', 'size-large', 'size-xlarge');
  grid.classList.add(`size-${size}`);

  // Update active button
  const selector = btn.closest('.thumb-size-selector');
  selector.querySelectorAll('.thumb-size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Save preference
  if (section === 'books') bookThumbSize = size;
  else videoThumbSize = size;
}

// ─── Authentication ─────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const username = $('login-username').value.trim();
  const password = $('login-password').value;

  if (!username || !password) {
    $('login-error').textContent = 'Veuillez remplir tous les champs';
    $('login-error').style.display = 'block';
    return false;
  }

  const result = await api.auth.login(username, password);
  if (result.success) {
    currentUser = result.user;
    $('login-error').style.display = 'none';
    enterApp();
  } else {
    $('login-error').textContent = result.error;
    $('login-error').style.display = 'block';
  }
  return false;
}

function enterApp() {
  $('login-screen').classList.remove('active');
  $('app-screen').classList.add('active');

  // Set user info
  $('user-display-name').textContent = currentUser.full_name;
  $('user-display-role').textContent = currentUser.role === 'admin' ? 'Administrateur' : 'Étudiant';
  $('user-avatar').textContent = getInitials(currentUser.full_name);
  $('welcome-message').textContent = `Bienvenue, ${currentUser.full_name} !`;

  // Show admin sections
  if (currentUser.role === 'admin') {
    document.body.classList.add('is-admin');
  } else {
    document.body.classList.remove('is-admin');
  }

  // Re-apply kiosk CSS class (depends on role now being set)
  if (isKioskActive) {
    document.body.classList.add('kiosk-active');
  }

  // Load data
  loadDashboard();
  loadBookCategories();
  loadCourseCategories();
  navigateTo('dashboard');
}

function handleLogout() {
  // In kiosk mode, only admin can log out (students stay in the app)
  if (isKioskActive && currentUser && currentUser.role !== 'admin') {
    showToast('Déconnexion non autorisée en mode kiosque', 'warning');
    return;
  }
  currentUser = null;
  document.body.classList.remove('is-admin');
  $('app-screen').classList.remove('active');
  $('login-screen').classList.add('active');
  $('login-username').value = '';
  $('login-password').value = '';
  showToast('Déconnexion réussie', 'info');
}

// ─── Kiosk Mode & Window Controls ──────────────────────────
async function initKioskState() {
  try {
    const state = await api.kiosk.getState();
    isKioskActive = state.active;
    if (isKioskActive) {
      document.body.classList.add('kiosk-active');
    } else {
      document.body.classList.remove('kiosk-active');
    }
  } catch (_) {}
}

// Called on app startup
initKioskState();

function handleWindowMinimize() {
  if (isKioskActive && (!currentUser || currentUser.role !== 'admin')) {
    showToast('Action non autorisée en mode kiosque', 'warning');
    return;
  }
  api.window.minimize();
}

function handleWindowMaximize() {
  if (isKioskActive && (!currentUser || currentUser.role !== 'admin')) {
    showToast('Action non autorisée en mode kiosque', 'warning');
    return;
  }
  api.window.maximize();
}

function handleWindowClose() {
  if (isKioskActive && (!currentUser || currentUser.role !== 'admin')) {
    showToast('Seul l\'administrateur peut fermer l\'application', 'warning');
    return;
  }
  api.window.close();
}

// Settings page: toggle auto-start
async function toggleAutoStart(enabled) {
  try {
    await api.kiosk.setAutoStart(enabled);
    await api.settings.set('auto_start', enabled ? '1' : '0');
    showToast(enabled ? 'Lancement automatique activé' : 'Lancement automatique désactivé', 'success');
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

// Settings page: toggle kiosk mode setting (takes effect on next launch)
async function toggleKioskSetting(enabled) {
  await api.settings.set('kiosk_mode', enabled ? '1' : '0');
  updateKioskWarning();
  showToast(enabled
    ? 'Mode kiosque activé — prendra effet au prochain démarrage'
    : 'Mode kiosque désactivé — prendra effet au prochain démarrage', 'success');
}

// Settings page: toggle OS restriction
async function toggleRestrictOS(enabled) {
  await api.settings.set('restrict_os', enabled ? '1' : '0');
  if (enabled) {
    // If kiosk mode isn't checked, auto-enable it too
    if (!$('setting-kiosk-mode').checked) {
      $('setting-kiosk-mode').checked = true;
      await api.settings.set('kiosk_mode', '1');
    }
    // Apply restrictions immediately if already in kiosk
    if (isKioskActive) {
      await api.kiosk.enable();
    }
  }
  updateKioskWarning();
  showToast(enabled
    ? 'Restriction système activée'
    : 'Restriction système désactivée', 'success');
}

function updateKioskWarning() {
  const kioskChecked = $('setting-kiosk-mode')?.checked;
  const restrictChecked = $('setting-restrict-os')?.checked;
  const warning = $('kiosk-warning');
  if (warning) {
    warning.style.display = (kioskChecked || restrictChecked) ? 'flex' : 'none';
  }
}

// Admin action: exit kiosk mode now (from settings page)
async function exitKioskModeNow() {
  await api.kiosk.disable();
  isKioskActive = false;
  document.body.classList.remove('kiosk-active');
  showToast('Mode kiosque désactivé', 'success');
}

// ─── Navigation ─────────────────────────────────────────────
let pageHistory = []; // Track navigation history for back button

function navigateTo(page) {
  // Save previous page to history (skip if going back)
  if (currentPage && currentPage !== page) {
    // Don't push reader/player into history so back goes to the real page
    if (currentPage !== 'book-reader' && currentPage !== 'video-player') {
      pageHistory.push(currentPage);
      if (pageHistory.length > 20) pageHistory.shift();
    }
  }
  currentPage = page;

  // Hide ALL pages first
  $$('.page').forEach(p => p.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = $(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  // Scroll main content to top when switching pages
  $('main-content').scrollTop = 0;

  // Load page data
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'books': loadBooks(); break;
    case 'videos': loadVideos(); break;
    case 'bookmarks': loadBookmarks(); break;
    case 'my-progress': loadMyProgress(); break;
    case 'manage-books': loadAdminBooks(); break;
    case 'manage-videos': loadAdminVideos(); break;
    case 'manage-users': loadAdminUsers(); break;
    case 'manage-categories': loadCategoriesManagement(); break;
    case 'backup-restore': loadBackupList(); break;
    case 'settings': loadSettingsPage(); break;
    case 'applications': loadApps(); break;
    case 'manage-apps': loadAdminApps(); break;
  }
}

// Navigate back to the previous page
function goBack() {
  const prev = pageHistory.pop();
  if (prev) {
    navigateTo(prev);
  } else {
    navigateTo('dashboard');
  }
}

// Navigation click handlers
document.addEventListener('DOMContentLoaded', async () => {
  // Load settings and apply branding before showing login
  await loadAppSettings();

  $$('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });
});

// ─── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  const stats = await api.dashboard.stats();
  $('stat-books').textContent = stats.totalBooks;
  $('stat-videos').textContent = stats.totalVideos;
  $('stat-users').textContent = stats.totalUsers;
  $('stat-categories').textContent = stats.totalCategories;

  // Recent books
  const recentBooksEl = $('recent-books-list');
  if (stats.recentBooks.length === 0) {
    recentBooksEl.innerHTML = '<p class="empty-state">Aucun livre ajouté</p>';
  } else {
    recentBooksEl.innerHTML = stats.recentBooks.map(book => `
      <div class="item-row" onclick="openBook('${book.id}', '${escapeHtml(book.file_path)}')">
        <div class="item-thumb">${book.file_type ? book.file_type.toUpperCase() : 'PDF'}</div>
        <div class="item-details">
          <div class="item-title">${escapeHtml(book.title)}</div>
          <div class="item-meta">${escapeHtml(book.author || 'Auteur inconnu')} · ${formatDate(book.created_at)}</div>
        </div>
      </div>
    `).join('');
  }

  // Recent videos
  const recentVideosEl = $('recent-videos-list');
  if (stats.recentVideos.length === 0) {
    recentVideosEl.innerHTML = '<p class="empty-state">Aucune vidéo ajoutée</p>';
  } else {
    recentVideosEl.innerHTML = stats.recentVideos.map(video => `
      <div class="item-row" onclick="playVideo('${video.id}')">
        <div class="item-thumb video-thumb">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <div class="item-details">
          <div class="item-title">${escapeHtml(video.title)}</div>
          <div class="item-meta">${escapeHtml(video.category_name || '')} · ${formatDate(video.created_at)}</div>
        </div>
      </div>
    `).join('');
  }
}

// ─── Book Categories ────────────────────────────────────────
async function loadBookCategories() {
  bookCategories = await api.bookCategories.list();
  renderBookCategoryFilter();
}

function renderBookCategoryFilter() {
  const container = $('book-categories-filter');
  container.innerHTML = `
    <h4>Catégories</h4>
    <a href="#" class="filter-item ${currentBookCategoryFilter === 'all' ? 'active' : ''}" onclick="filterBooksByCategory('all', this)">
      <span class="filter-dot" style="background:#64748B"></span> Toutes
    </a>
    ${bookCategories.map(cat => `
      <a href="#" class="filter-item ${currentBookCategoryFilter === cat.id ? 'active' : ''}" onclick="filterBooksByCategory('${cat.id}', this)">
        <span class="filter-dot" style="background:${cat.color}"></span> ${escapeHtml(cat.name)}
      </a>
    `).join('')}
  `;
}

function filterBooksByCategory(catId, el) {
  currentBookCategoryFilter = catId;
  $$('#book-categories-filter .filter-item').forEach(f => f.classList.remove('active'));
  if (el) el.classList.add('active');
  loadBooks();
}

// ─── Books ──────────────────────────────────────────────────
async function loadBooks() {
  const filters = {};
  if (currentBookCategoryFilter !== 'all') filters.category_id = currentBookCategoryFilter;
  const search = $('books-search')?.value;
  if (search) filters.search = search;

  allBooks = await api.books.list(filters);
  renderBooks();
}

function filterBooks() {
  loadBooks();
}

async function renderBooks() {
  const grid = $('books-grid');
  if (allBooks.length === 0) {
    grid.innerHTML = '<p class="empty-state">Aucun livre trouvé</p>';
    return;
  }

  const cards = await Promise.all(allBooks.map(async (book) => {
    let coverHtml = `<div class="book-cover-placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      <span>${book.file_type || 'pdf'}</span>
    </div>`;

    if (book.cover_image) {
      const dataUrl = await api.file.toDataUrl(book.cover_image);
      if (dataUrl) coverHtml = `<img src="${dataUrl}" alt="${escapeHtml(book.title)}">`;
    }

    const catColor = book.category_color || '#64748B';
    const catName = book.category_name || '';

    return `
      <div class="book-card" onclick="openBook('${book.id}', \`${book.file_path.replace(/\\/g, '\\\\')}\`)">
        <div class="book-cover">
          ${coverHtml}
          <span class="book-badge" style="background:${catColor}22;color:${catColor}">${book.file_type ? book.file_type.toUpperCase() : 'PDF'}</span>
        </div>
        <div class="book-card-actions">
          <button onclick="event.stopPropagation(); toggleBookmark('${book.id}', 'book')" title="Favori">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
        <div class="book-info">
          <div class="book-title">${escapeHtml(book.title)}</div>
          <div class="book-author">${escapeHtml(book.author || 'Auteur inconnu')}</div>
          ${catName ? `<span class="book-category-tag" style="background:${catColor}18;color:${catColor}">${escapeHtml(catName)}</span>` : ''}
        </div>
      </div>
    `;
  }));

  grid.innerHTML = cards.join('');
}

async function openBook(bookId, filePath) {
  // Find the book data
  const books = await api.books.list({});
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  currentReaderBookId = bookId;
  currentReaderFilePath = book.file_path;
  currentReaderFileType = (book.file_type || 'pdf').toLowerCase();

  navigateTo('book-reader');
  $('reader-title').textContent = book.title;

  // Determine how to open based on file type
  const pdfTypes = ['pdf'];
  const textTypes = ['txt', 'rtf', 'text', 'md', 'log'];
  const externalTypes = ['doc', 'docx', 'epub', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'];

  // Hide all content areas first
  $('reader-canvas-container').style.display = 'none';
  $('reader-text-content').style.display = 'none';
  $('reader-unsupported').style.display = 'none';
  $('reader-loading').style.display = 'flex';
  $('reader-pdf-controls').style.display = 'none';

  if (pdfTypes.includes(currentReaderFileType)) {
    await openPdfReader(book);
  } else if (textTypes.includes(currentReaderFileType)) {
    await openTextReader(book);
  } else if (externalTypes.includes(currentReaderFileType)) {
    openUnsupportedReader(book);
  } else {
    // Try as text
    try {
      await openTextReader(book);
    } catch {
      openUnsupportedReader(book);
    }
  }
}

// ─── PDF Reader ─────────────────────────────────────────────
async function openPdfReader(book) {
  try {
    // Read PDF as base64 via IPC (safe serialization)
    const base64Data = await api.file.readAsBase64(book.file_path);
    if (!base64Data) {
      showToast('Impossible de lire le fichier', 'error');
      closeReader();
      return;
    }

    // Convert base64 to Uint8Array for pdf.js
    const binaryStr = atob(base64Data);
    const data = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      data[i] = binaryStr.charCodeAt(i);
    }

    // Load the PDF using globally loaded pdfjsLib
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    pdfTotalPages = pdfDoc.numPages;

    // Show PDF controls
    $('reader-pdf-controls').style.display = 'flex';
    $('reader-total-pages').textContent = pdfTotalPages;
    $('reader-canvas-container').style.display = 'flex';
    $('reader-loading').style.display = 'none';

    // Restore progress
    pdfCurrentPage = 1;
    if (currentUser) {
      const progress = await api.progress.getBook(currentUser.id, book.id);
      if (progress && progress.current_page > 1) {
        pdfCurrentPage = Math.min(progress.current_page, pdfTotalPages);
        showToast(`Reprise à la page ${pdfCurrentPage}`, 'info');
      }
    }

    $('reader-current-page').value = pdfCurrentPage;
    $('reader-current-page').max = pdfTotalPages;

    if (pdfContinuousMode) {
      await renderAllPdfPages();
      // Scroll to current page
      setTimeout(() => {
        const targetCanvas = document.getElementById(`pdf-page-${pdfCurrentPage}`);
        if (targetCanvas) targetCanvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } else {
      await renderPdfPage(pdfCurrentPage);
    }

  } catch (err) {
    console.error('PDF Error:', err);
    $('reader-loading').style.display = 'none';
    showToast('Erreur lors du chargement du PDF', 'error');
    openUnsupportedReader(book);
  }
}

// Render a single PDF page with selectable text overlay
async function renderSinglePage(container, pageNum, page) {
  const viewport = page.getViewport({ scale: pdfScale });

  // Wrapper for canvas + text layer
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-page-wrapper';
  wrapper.style.position = 'relative';
  wrapper.style.width = viewport.width + 'px';
  wrapper.style.height = viewport.height + 'px';

  const canvas = document.createElement('canvas');
  canvas.id = `pdf-page-${pageNum}`;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.dataset.page = pageNum;
  wrapper.appendChild(canvas);

  // Render canvas
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Create selectable text layer on top
  const textContent = await page.getTextContent();
  const textLayer = document.createElement('div');
  textLayer.className = 'pdf-text-layer';
  textLayer.style.position = 'absolute';
  textLayer.style.left = '0';
  textLayer.style.top = '0';
  textLayer.style.width = viewport.width + 'px';
  textLayer.style.height = viewport.height + 'px';
  textLayer.style.overflow = 'hidden';
  textLayer.style.lineHeight = '1';

  textContent.items.forEach(item => {
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const span = document.createElement('span');
    span.textContent = item.str;
    span.style.position = 'absolute';
    span.style.left = tx[4] + 'px';
    span.style.top = (viewport.height - tx[5]) + 'px';
    span.style.fontSize = Math.abs(tx[0]) + 'px';
    span.style.fontFamily = item.fontName || 'sans-serif';
    span.style.color = 'transparent';
    span.style.whiteSpace = 'pre';
    span.style.cursor = 'text';
    span.style.userSelect = 'text';
    textLayer.appendChild(span);
  });

  wrapper.appendChild(textLayer);
  container.appendChild(wrapper);
  return canvas;
}

async function renderPdfPage(pageNum) {
  const container = $('reader-canvas-container');
  container.innerHTML = '';

  const page = await pdfDoc.getPage(pageNum);
  await renderSinglePage(container, pageNum, page);
}

async function renderAllPdfPages() {
  const container = $('reader-canvas-container');
  container.innerHTML = '';

  for (let i = 1; i <= pdfTotalPages; i++) {
    const page = await pdfDoc.getPage(i);
    await renderSinglePage(container, i, page);

    if (i < pdfTotalPages) {
      const sep = document.createElement('div');
      sep.className = 'reader-page-separator';
      container.appendChild(sep);
    }
  }

  // Track scroll position to update current page
  $('reader-viewport').addEventListener('scroll', readerHandleScroll);
}

function readerHandleScroll() {
  if (!pdfContinuousMode) return;
  const viewport = $('reader-viewport');
  const scrollTop = viewport.scrollTop + 100;
  const canvases = $('reader-canvas-container').querySelectorAll('canvas');

  for (let i = canvases.length - 1; i >= 0; i--) {
    if (canvases[i].offsetTop <= scrollTop) {
      const pageNum = parseInt(canvases[i].dataset.page);
      if (pageNum !== pdfCurrentPage) {
        pdfCurrentPage = pageNum;
        $('reader-current-page').value = pdfCurrentPage;
        // Save progress
        if (currentUser && currentReaderBookId) {
          api.progress.updateBook(currentUser.id, currentReaderBookId, {
            current_page: pdfCurrentPage,
            total_pages: pdfTotalPages
          });
        }
      }
      break;
    }
  }
}

function readerPrevPage() {
  if (pdfCurrentPage <= 1) return;
  pdfCurrentPage--;
  $('reader-current-page').value = pdfCurrentPage;
  if (pdfContinuousMode) {
    const canvas = document.getElementById(`pdf-page-${pdfCurrentPage}`);
    if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    renderPdfPage(pdfCurrentPage);
  }
  saveReaderProgress();
}

function readerNextPage() {
  if (pdfCurrentPage >= pdfTotalPages) return;
  pdfCurrentPage++;
  $('reader-current-page').value = pdfCurrentPage;
  if (pdfContinuousMode) {
    const canvas = document.getElementById(`pdf-page-${pdfCurrentPage}`);
    if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    renderPdfPage(pdfCurrentPage);
  }
  saveReaderProgress();
}

function readerGoToPage(val) {
  const page = parseInt(val);
  if (isNaN(page) || page < 1 || page > pdfTotalPages) return;
  pdfCurrentPage = page;
  if (pdfContinuousMode) {
    const canvas = document.getElementById(`pdf-page-${pdfCurrentPage}`);
    if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    renderPdfPage(pdfCurrentPage);
  }
  saveReaderProgress();
}

function readerZoomIn() {
  pdfScale = Math.min(3.0, pdfScale + 0.2);
  $('reader-zoom-info').textContent = Math.round(pdfScale * 100) + '%';
  readerRerender();
}

function readerZoomOut() {
  pdfScale = Math.max(0.4, pdfScale - 0.2);
  $('reader-zoom-info').textContent = Math.round(pdfScale * 100) + '%';
  readerRerender();
}

function readerFitWidth() {
  const viewportWidth = $('reader-viewport').clientWidth - 60;
  // Estimate: get first page to determine width
  if (pdfDoc) {
    pdfDoc.getPage(1).then(page => {
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      pdfScale = viewportWidth / unscaledViewport.width;
      $('reader-zoom-info').textContent = Math.round(pdfScale * 100) + '%';
      readerRerender();
    });
  }
}

async function readerRerender() {
  if (!pdfDoc) return;
  if (pdfContinuousMode) {
    await renderAllPdfPages();
    const canvas = document.getElementById(`pdf-page-${pdfCurrentPage}`);
    if (canvas) canvas.scrollIntoView({ block: 'start' });
  } else {
    await renderPdfPage(pdfCurrentPage);
  }
}

function readerToggleMode() {
  pdfContinuousMode = !pdfContinuousMode;
  const btn = $('reader-mode-btn');
  btn.title = pdfContinuousMode ? 'Mode page unique' : 'Mode continu';
  showToast(pdfContinuousMode ? 'Mode continu' : 'Mode page unique', 'info');
  readerRerender();
}

function saveReaderProgress() {
  if (currentUser && currentReaderBookId) {
    api.progress.updateBook(currentUser.id, currentReaderBookId, {
      current_page: pdfCurrentPage,
      total_pages: pdfTotalPages,
      is_finished: pdfCurrentPage >= pdfTotalPages
    });
  }
}

// ─── Text Reader ────────────────────────────────────────────
async function openTextReader(book) {
  const text = await api.file.readAsText(book.file_path);
  if (text === null) {
    showToast('Impossible de lire le fichier', 'error');
    closeReader();
    return;
  }

  $('reader-loading').style.display = 'none';
  $('reader-pdf-controls').style.display = 'none';
  $('reader-text-content').style.display = 'block';
  $('reader-text-content').textContent = text;
  $('reader-text-content').classList.add('reader-theme-dark');

  // Show text reading options (font size, theme)
  const textOpts = $('reader-text-options');
  if (textOpts) textOpts.style.display = 'flex';

  // Mark as read
  if (currentUser) {
    await api.progress.updateBook(currentUser.id, book.id, { current_page: 1, is_finished: true });
  }
}

// ─── Unsupported Format (open externally) ───────────────────
function openUnsupportedReader(book) {
  $('reader-loading').style.display = 'none';
  $('reader-unsupported').style.display = 'flex';

  const formatNames = {
    'doc': 'Microsoft Word (.doc)',
    'docx': 'Microsoft Word (.docx)',
    'epub': 'EPUB eBook (.epub)',
    'odt': 'OpenDocument (.odt)',
    'xls': 'Microsoft Excel (.xls)',
    'xlsx': 'Microsoft Excel (.xlsx)',
    'ppt': 'Microsoft PowerPoint (.ppt)',
    'pptx': 'Microsoft PowerPoint (.pptx)',
  };

  const typeName = formatNames[currentReaderFileType] || currentReaderFileType.toUpperCase();
  $('unsupported-title').textContent = `Format ${typeName}`;
  $('unsupported-message').textContent = `Ce format n'est pas pris en charge dans le lecteur intégré. Utilisez le bouton ci-dessous pour l'ouvrir avec votre application par défaut.`;

  if (currentUser) {
    api.progress.updateBook(currentUser.id, book.id, { current_page: 1 });
  }
}

function readerOpenExternal() {
  if (currentReaderFilePath) {
    api.books.open(currentReaderFilePath);
  }
}

function readerToggleBookmark() {
  if (currentUser && currentReaderBookId) {
    toggleBookmark(currentReaderBookId, 'book');
  }
}

function closeReader() {
  saveReaderProgress();
  pdfDoc = null;
  currentReaderBookId = null;
  currentReaderFilePath = null;
  currentReaderFileType = null;
  $('reader-canvas-container').innerHTML = '';
  $('reader-text-content').textContent = '';
  $('reader-text-content').style.display = 'none';
  $('reader-unsupported').style.display = 'none';
  $('reader-text-content').classList.remove('reader-theme-dark', 'reader-theme-light', 'reader-theme-sepia');
  const textOpts = $('reader-text-options');
  if (textOpts) textOpts.style.display = 'none';
  $('reader-viewport').removeEventListener('scroll', readerHandleScroll);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  goBack();
}

// ─── Reader: Text Options ───────────────────────────────────
function readerChangeFontSize(size) {
  const el = $('reader-text-content');
  if (el) el.style.fontSize = size + 'px';
}

function readerChangeTheme(theme) {
  const el = $('reader-text-content');
  if (!el) return;
  el.classList.remove('reader-theme-dark', 'reader-theme-light', 'reader-theme-sepia');
  el.classList.add('reader-theme-' + theme);
}

function readerToggleFullscreen() {
  const el = $('page-book-reader');
  if (!document.fullscreenElement) {
    el.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// Keyboard shortcuts for reader
document.addEventListener('keydown', (e) => {
  if (currentPage !== 'book-reader' || !pdfDoc) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch(e.key) {
    case 'ArrowLeft': readerPrevPage(); e.preventDefault(); break;
    case 'ArrowRight': readerNextPage(); e.preventDefault(); break;
    case '+': case '=': readerZoomIn(); e.preventDefault(); break;
    case '-': readerZoomOut(); e.preventDefault(); break;
    case 'f': case 'F': if (!e.ctrlKey) readerToggleFullscreen(); break;
    case 'Escape':
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else closeReader();
      e.preventDefault();
      break;
  }
});

// ─── Course Categories ──────────────────────────────────────
async function loadCourseCategories() {
  courseCategories = await api.courseCategories.list();
  renderVideoCategoryFilter();
}

function renderVideoCategoryFilter() {
  const container = $('video-categories-filter');
  container.innerHTML = `
    <h4>Cours</h4>
    <a href="#" class="filter-item ${currentVideoCategoryFilter === 'all' ? 'active' : ''}" onclick="filterVideosByCategory('all', this)">
      <span class="filter-dot" style="background:#64748B"></span> Tous
    </a>
    ${courseCategories.map(cat => `
      <a href="#" class="filter-item ${currentVideoCategoryFilter === cat.id ? 'active' : ''}" onclick="filterVideosByCategory('${cat.id}', this)">
        <span class="filter-dot" style="background:${cat.color || '#8B5CF6'}"></span>
        ${escapeHtml(cat.name)}
        ${cat.academic_year ? `<span class="filter-count">${escapeHtml(cat.academic_year)}</span>` : ''}
      </a>
    `).join('')}
  `;
}

function filterVideosByCategory(catId, el) {
  currentVideoCategoryFilter = catId;
  $$('#video-categories-filter .filter-item').forEach(f => f.classList.remove('active'));
  if (el) el.classList.add('active');
  loadVideos();
}

// ─── Videos ─────────────────────────────────────────────────
async function loadVideos() {
  const filters = {};
  if (currentVideoCategoryFilter !== 'all') filters.category_id = currentVideoCategoryFilter;
  const search = $('videos-search')?.value;
  if (search) filters.search = search;
  const year = $('videos-year-filter')?.value;
  if (year) filters.academic_year = year;
  const semester = $('videos-semester-filter')?.value;
  if (semester) filters.semester = semester;

  allVideos = await api.videos.list(filters);
  renderVideos();
}

function filterVideos() {
  loadVideos();
}

async function renderVideos() {
  const grid = $('videos-grid');
  if (allVideos.length === 0) {
    grid.innerHTML = '<p class="empty-state">Aucune vidéo trouvée</p>';
    return;
  }

  // For students: get finished video IDs to enforce sequential order
  let finishedIds = [];
  const isStudent = currentUser && currentUser.role !== 'admin';
  if (isStudent) {
    finishedIds = await api.progress.getFinishedVideos(currentUser.id);
  }

  // Group videos by category to determine unlock status per course
  const byCat = {};
  allVideos.forEach(v => {
    const cat = v.category_id || '__none__';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(v);
  });

  // Build set of unlocked video IDs for students
  const unlockedIds = new Set();
  if (isStudent) {
    Object.values(byCat).forEach(catVideos => {
      // Videos are already sorted by episode_number ASC from API
      for (let i = 0; i < catVideos.length; i++) {
        unlockedIds.add(catVideos[i].id); // unlock this one
        if (!finishedIds.includes(catVideos[i].id)) break; // stop if not finished
      }
    });
  }

  const cards = await Promise.all(allVideos.map(async (video) => {
    let thumbHtml = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;

    if (video.thumbnail) {
      const dataUrl = await api.file.toDataUrl(video.thumbnail);
      if (dataUrl) thumbHtml = `<img src="${dataUrl}" alt="${escapeHtml(video.title)}">`;
    }

    const catColor = video.category_color || '#8B5CF6';
    const isLocked = isStudent && !unlockedIds.has(video.id);

    return `
      <div class="video-card ${isLocked ? 'video-locked' : ''}" onclick="${isLocked ? `showToast('Terminez d\\'abord la vidéo précédente pour débloquer celle-ci', 'warning')` : `playVideo('${video.id}')`}">
        <div class="video-thumbnail">
          ${thumbHtml}
          ${isLocked ? `<div class="video-lock-overlay">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>` : `<div class="video-play-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>`}
          ${video.duration ? `<span class="video-duration">${formatDuration(video.duration)}</span>` : ''}
          ${video.episode_number ? `<span class="video-episode-badge">Ép. ${video.episode_number}</span>` : ''}
        </div>
        <div class="video-info">
          <div class="video-title">${escapeHtml(video.title)}</div>
          <div class="video-meta">
            ${video.category_name ? `<span class="video-meta-tag" style="background:${catColor}18;color:${catColor}">${escapeHtml(video.category_name)}</span>` : ''}
            ${video.course_year ? `<span>${escapeHtml(video.course_year)}</span>` : ''}
            ${video.course_semester ? `<span>· ${escapeHtml(video.course_semester)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }));

  grid.innerHTML = cards.join('');
}

async function playVideo(videoId) {
  const videos = await api.videos.list({});
  const video = videos.find(v => v.id === videoId);
  if (!video) return;

  // Enforce sequential order for students
  if (currentUser && currentUser.role !== 'admin' && video.category_id) {
    const courseVideos = videos.filter(v => v.category_id === video.category_id);
    const finishedIds = await api.progress.getFinishedVideos(currentUser.id);
    for (const cv of courseVideos) {
      if (cv.id === videoId) break; // reached our video, it's unlocked
      if (!finishedIds.includes(cv.id)) {
        showToast('Terminez d\'abord la vidéo précédente pour débloquer celle-ci', 'warning');
        return;
      }
    }
  }

  currentVideoId = videoId;
  videoSavedTime = 0;
  navigateTo('video-player');
  $('player-title').textContent = video.title;

  // Format badge
  const format = (video.file_type || 'mp4').toUpperCase();
  $('player-format-badge').textContent = format;

  const player = $('video-player');

  // Stop any existing playback
  player.pause();
  player.removeAttribute('src');
  player.load();

  // Set video source - normalize path to file:// URL for Electron
  const normalizedPath = video.file_path.replace(/\\/g, '/');
  player.src = normalizedPath.startsWith('file://') ? normalizedPath : `file:///${normalizedPath.replace(/^\/+/, '')}`;

  // Handle video error (unsupported format)
  player.onerror = () => {
    const unsupportedFormats = ['avi', 'wmv', 'flv', 'rmvb', 'rm', '3gp'];
    const ft = (video.file_type || '').toLowerCase();
    if (unsupportedFormats.includes(ft)) {
      showToast(`Format ${format} non supporté nativement. Ouverture externe...`, 'warning');
      api.books.open(video.file_path);
    } else {
      showToast(`Erreur de lecture vidéo (${format})`, 'error');
    }
  };

  // Check for saved progress and show resume overlay
  $('player-resume-overlay').style.display = 'none';
  if (currentUser) {
    const progress = await api.progress.getVideo(currentUser.id, videoId);
    if (progress && progress.current_time > 5 && !progress.is_finished) {
      videoSavedTime = progress.current_time;
      $('resume-time-display').textContent = formatDuration(videoSavedTime);
      $('player-resume-overlay').style.display = 'flex';
    } else {
      player.play().catch(() => {});
    }
  } else {
    player.play().catch(() => {});
  }

  // Save progress on time update (every 5 seconds)
  let lastSave = 0;
  player.ontimeupdate = async () => {
    if (currentUser && Date.now() - lastSave > 5000) {
      lastSave = Date.now();
      await api.progress.updateVideo(currentUser.id, videoId, {
        current_time: player.currentTime,
        duration: player.duration || 0,
        is_finished: player.duration > 0 && player.currentTime >= player.duration - 2
      });
    }
  };

  // Video info panel
  const infoPanel = $('video-info-panel');
  infoPanel.innerHTML = `
    <h3>${escapeHtml(video.title)}</h3>
    <div class="player-info-meta">
      ${video.category_name ? `<span class="video-meta-tag" style="background:${(video.category_color || '#8B5CF6')}18;color:${video.category_color || '#A78BFA'}">${escapeHtml(video.category_name)}</span>` : ''}
      ${video.course_year ? `<span class="video-meta-tag" style="background:rgba(59,130,246,0.12);color:#60A5FA">${escapeHtml(video.course_year)}</span>` : ''}
      ${video.course_semester ? `<span class="video-meta-tag" style="background:rgba(16,185,129,0.12);color:#34D399">${escapeHtml(video.course_semester)}</span>` : ''}
      ${video.episode_number ? `<span class="video-meta-tag" style="background:rgba(245,158,11,0.12);color:#FBBF24">Épisode ${video.episode_number}</span>` : ''}
    </div>
    ${video.description ? `<p>${escapeHtml(video.description)}</p>` : '<p style="color:var(--text-muted);font-style:italic">Aucune description disponible</p>'}
    <div style="margin-top:16px; display:flex; gap:8px; flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="toggleBookmark('${videoId}', 'video')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        Favori
      </button>
      <button class="btn btn-secondary btn-sm" onclick="api.books.open('${video.file_path.replace(/\\/g, '\\\\')}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Lecteur externe
      </button>
    </div>
  `;

  // Load playlist (other videos from same course)
  await loadVideoPlaylist(video);
}

function resumeVideo() {
  const player = $('video-player');
  player.currentTime = videoSavedTime;
  $('player-resume-overlay').style.display = 'none';
  player.play().catch(() => {});
}

function startVideoFromBeginning() {
  const player = $('video-player');
  player.currentTime = 0;
  $('player-resume-overlay').style.display = 'none';
  player.play().catch(() => {});
}

function toggleVideoBookmark() {
  if (currentUser && currentVideoId) {
    toggleBookmark(currentVideoId, 'video');
  }
}

function closeVideoPlayer() {
  const player = $('video-player');
  // Save final progress
  if (currentUser && currentVideoId && player.currentTime > 0) {
    api.progress.updateVideo(currentUser.id, currentVideoId, {
      current_time: player.currentTime,
      duration: player.duration || 0,
      is_finished: player.duration > 0 && player.currentTime >= player.duration - 2
    });
  }
  player.pause();
  player.removeAttribute('src');
  player.load();
  goBack(); // Return to previous page (videos, dashboard, bookmarks, etc.)
}

async function loadVideoPlaylist(currentVideo) {
  const playlistEl = $('player-playlist');
  const itemsEl = $('playlist-items');

  if (!currentVideo.category_id) {
    playlistEl.style.display = 'none';
    return;
  }

  // Get all videos from same course
  const courseVideos = await api.videos.list({ category_id: currentVideo.category_id });
  if (courseVideos.length <= 1) {
    playlistEl.style.display = 'none';
    return;
  }

  // Determine locks for students
  const isStudent = currentUser && currentUser.role !== 'admin';
  let finishedIds = [];
  const unlockedPlaylist = new Set();
  if (isStudent) {
    finishedIds = await api.progress.getFinishedVideos(currentUser.id);
    for (let i = 0; i < courseVideos.length; i++) {
      unlockedPlaylist.add(courseVideos[i].id);
      if (!finishedIds.includes(courseVideos[i].id)) break;
    }
  }

  playlistEl.style.display = 'block';
  itemsEl.innerHTML = courseVideos.map(v => {
    const locked = isStudent && !unlockedPlaylist.has(v.id);
    const finished = finishedIds.includes(v.id);
    return `
    <div class="playlist-item ${v.id === currentVideo.id ? 'active' : ''} ${locked ? 'playlist-locked' : ''}" onclick="${locked ? `showToast('Terminez d\\'abord la vidéo précédente', 'warning')` : `playVideo('${v.id}')`}">
      <span class="playlist-episode-num">${locked ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' : (finished ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>' : (v.episode_number || '—'))}</span>
      <div class="playlist-item-info">
        <div class="playlist-item-title">${escapeHtml(v.title)}</div>
        ${v.duration ? `<span class="playlist-item-duration">${formatDuration(v.duration)}</span>` : ''}
      </div>
    </div>
  `;}).join('');
}

// ─── Bookmarks ──────────────────────────────────────────────
async function toggleBookmark(itemId, itemType) {
  if (!currentUser) return;
  const result = await api.bookmarks.toggle(currentUser.id, itemId, itemType);
  showToast(result.bookmarked ? 'Ajouté aux favoris' : 'Retiré des favoris', 'success');
}

async function loadBookmarks() {
  if (!currentUser) return;
  const bookmarks = await api.bookmarks.list(currentUser.id);
  const container = $('bookmarks-content');

  if (bookmarks.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucun favori pour le moment. Ajoutez des livres ou vidéos à vos favoris !</p>';
    return;
  }

  container.innerHTML = bookmarks.map(bm => `
    <div class="bookmark-card" onclick="${bm.type === 'book' ? `openBook('${bm.item_id}', '')` : `playVideo('${bm.item_id}')`}">
      <div class="item-thumb ${bm.type === 'video' ? 'video-thumb' : ''}">
        ${bm.type === 'book'
          ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'
          : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
        }
      </div>
      <div class="item-details">
        <div class="item-title">${escapeHtml(bm.title)}</div>
        <div class="item-meta">${bm.type === 'book' ? `${escapeHtml(bm.author || '')}` : 'Vidéo'} · ${formatDate(bm.created_at)}</div>
      </div>
    </div>
  `).join('');
}

// ─── My Progress ────────────────────────────────────────────
async function loadMyProgress() {
  if (!currentUser) return;
  const stats = await api.progress.getUserStats(currentUser.id);

  $('progress-stats').innerHTML = `
    <div class="progress-stat">
      <div class="progress-stat-number">${stats.booksRead}</div>
      <div class="progress-stat-label">Livres lus</div>
    </div>
    <div class="progress-stat">
      <div class="progress-stat-number">${stats.booksFinished}</div>
      <div class="progress-stat-label">Livres terminés</div>
    </div>
    <div class="progress-stat">
      <div class="progress-stat-number">${stats.videosWatched}</div>
      <div class="progress-stat-label">Vidéos visionnées</div>
    </div>
    <div class="progress-stat">
      <div class="progress-stat-number">${stats.videosFinished}</div>
      <div class="progress-stat-label">Vidéos terminées</div>
    </div>
  `;

  const recentBooks = $('my-recent-books');
  if (stats.recentBooks.length === 0) {
    recentBooks.innerHTML = '<p class="empty-state">Aucune lecture récente</p>';
  } else {
    recentBooks.innerHTML = stats.recentBooks.map(rp => `
      <div class="item-row">
        <div class="item-thumb">${rp.current_page || '?'}</div>
        <div class="item-details">
          <div class="item-title">${escapeHtml(rp.title)}</div>
          <div class="item-meta">Page ${rp.current_page || '?'} · ${formatDate(rp.last_read)}</div>
          ${rp.total_pages ? `<div class="progress-bar"><div class="progress-bar-fill" style="width:${Math.min(100, (rp.current_page / rp.total_pages) * 100)}%"></div></div>` : ''}
        </div>
      </div>
    `).join('');
  }

  const recentVideos = $('my-recent-videos');
  if (stats.recentVideos.length === 0) {
    recentVideos.innerHTML = '<p class="empty-state">Aucune vidéo récente</p>';
  } else {
    recentVideos.innerHTML = stats.recentVideos.map(vp => `
      <div class="item-row" onclick="playVideo('${vp.video_id}')">
        <div class="item-thumb video-thumb">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <div class="item-details">
          <div class="item-title">${escapeHtml(vp.title)}</div>
          <div class="item-meta">${formatDuration(vp.current_time)} / ${formatDuration(vp.duration)} · ${formatDate(vp.last_watched)}</div>
          ${vp.duration ? `<div class="progress-bar"><div class="progress-bar-fill" style="width:${Math.min(100, (vp.current_time / vp.duration) * 100)}%"></div></div>` : ''}
        </div>
      </div>
    `).join('');
  }
}

// ─── Admin: Books Management ────────────────────────────────
async function loadAdminBooks() {
  const books = await api.books.list({});
  const tbody = $('admin-books-tbody');

  if (books.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:40px;color:var(--text-muted)">Aucun livre. Cliquez sur "Ajouter un Livre" pour commencer.</td></tr>';
    return;
  }

  tbody.innerHTML = books.map(book => `
    <tr>
      <td><strong style="color:var(--text-primary)">${escapeHtml(book.title)}</strong></td>
      <td>${escapeHtml(book.author || '—')}</td>
      <td>${book.category_name ? `<span class="book-category-tag" style="background:${book.category_color}18;color:${book.category_color}">${escapeHtml(book.category_name)}</span>` : '—'}</td>
      <td><span style="text-transform:uppercase;font-weight:600;font-size:12px">${book.file_type || '?'}</span></td>
      <td>${formatDate(book.created_at)}</td>
      <td>
        <div class="table-actions">
          <button class="btn-icon" onclick="showEditBookModal('${book.id}')" title="Modifier">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteBook('${book.id}', '${escapeHtml(book.title)}')" title="Supprimer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showAddBookModal() {
  const modal = $('modal-content');
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Ajouter un Livre</h3>
      <button class="btn-icon" onclick="closeModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <form id="add-book-form" onsubmit="return submitAddBook(event)">
        <div class="form-group">
          <label>Fichier *</label>
          <div class="file-picker">
            <span class="file-name" id="book-file-name">Aucun fichier sélectionné</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="pickBookFile()">Parcourir</button>
          </div>
          <input type="hidden" id="book-file-path">
          <input type="hidden" id="book-file-size">
        </div>
        <div class="form-group">
          <label>Titre *</label>
          <input type="text" id="book-title" required placeholder="Titre du livre">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Auteur</label>
            <input type="text" id="book-author" placeholder="Nom de l'auteur">
          </div>
          <div class="form-group">
            <label>Catégorie</label>
            <select id="book-category">
              <option value="">— Aucune —</option>
              ${bookCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="book-description" placeholder="Description du livre"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Éditeur</label>
            <input type="text" id="book-publisher" placeholder="Maison d'édition">
          </div>
          <div class="form-group">
            <label>Année de publication</label>
            <input type="text" id="book-year" placeholder="Ex: 2024">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>ISBN</label>
            <input type="text" id="book-isbn" placeholder="ISBN (optionnel)">
          </div>
          <div class="form-group">
            <label>Langue</label>
            <select id="book-language">
              <option value="Français">Français</option>
              <option value="Anglais">Anglais</option>
              <option value="Lingala">Lingala</option>
              <option value="Kikongo">Kikongo</option>
              <option value="Swahili">Swahili</option>
              <option value="Tshiluba">Tshiluba</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Image de couverture</label>
          <div class="file-picker">
            <span class="file-name" id="book-cover-name">Aucune image</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="pickBookCover()">Parcourir</button>
          </div>
          <input type="hidden" id="book-cover-path">
        </div>
        <div class="form-group">
          <label>Tags</label>
          <input type="text" id="book-tags" placeholder="Ex: théologie, bible, ancien testament (séparés par des virgules)">
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="document.getElementById('add-book-form').requestSubmit()">Ajouter le Livre</button>
    </div>
  `;
  $('modal-overlay').classList.add('active');
}

async function pickBookFile() {
  const file = await api.dialog.openFile();
  if (file) {
    $('book-file-path').value = file.path;
    $('book-file-size').value = file.size;
    $('book-file-name').textContent = file.name;
    $('book-file-name').classList.add('has-file');
    if (!$('book-title').value) {
      $('book-title').value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    }
  }
}

async function pickBookCover() {
  const path = await api.dialog.openImage();
  if (path) {
    $('book-cover-path').value = path;
    const name = path.split(/[/\\]/).pop();
    $('book-cover-name').textContent = name;
    $('book-cover-name').classList.add('has-file');
  }
}

async function submitAddBook(e) {
  e.preventDefault();
  const filePath = $('book-file-path').value;
  if (!filePath) { showToast('Veuillez sélectionner un fichier', 'error'); return false; }

  const data = {
    title: $('book-title').value,
    author: $('book-author').value,
    description: $('book-description').value,
    category_id: $('book-category').value || null,
    file_path: filePath,
    file_size: parseInt($('book-file-size').value) || 0,
    cover_image: $('book-cover-path').value || null,
    isbn: $('book-isbn').value,
    publisher: $('book-publisher').value,
    year_published: $('book-year').value,
    language: $('book-language').value,
    tags: $('book-tags').value,
    added_by: currentUser?.id
  };

  const result = await api.books.add(data);
  if (result.success) {
    closeModal();
    showToast('Livre ajouté avec succès !', 'success');
    loadAdminBooks();
    loadBooks();
  } else {
    showToast('Erreur lors de l\'ajout', 'error');
  }
  return false;
}

async function showEditBookModal(bookId) {
  const books = await api.books.list({});
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  const modal = $('modal-content');
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Modifier le Livre</h3>
      <button class="btn-icon" onclick="closeModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <form id="edit-book-form" onsubmit="return submitEditBook(event, '${bookId}')">
        <div class="form-group">
          <label>Titre *</label>
          <input type="text" id="edit-book-title" value="${escapeHtml(book.title)}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Auteur</label>
            <input type="text" id="edit-book-author" value="${escapeHtml(book.author || '')}">
          </div>
          <div class="form-group">
            <label>Catégorie</label>
            <select id="edit-book-category">
              <option value="">— Aucune —</option>
              ${bookCategories.map(c => `<option value="${c.id}" ${c.id === book.category_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="edit-book-description">${escapeHtml(book.description || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Éditeur</label>
            <input type="text" id="edit-book-publisher" value="${escapeHtml(book.publisher || '')}">
          </div>
          <div class="form-group">
            <label>Année</label>
            <input type="text" id="edit-book-year" value="${escapeHtml(book.year_published || '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>ISBN</label>
            <input type="text" id="edit-book-isbn" value="${escapeHtml(book.isbn || '')}">
          </div>
          <div class="form-group">
            <label>Langue</label>
            <select id="edit-book-language">
              ${['Français','Anglais','Lingala','Kikongo','Swahili','Tshiluba','Autre'].map(l => `<option value="${l}" ${l === book.language ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Tags</label>
          <input type="text" id="edit-book-tags" value="${escapeHtml(book.tags || '')}">
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="document.getElementById('edit-book-form').requestSubmit()">Enregistrer</button>
    </div>
  `;
  $('modal-overlay').classList.add('active');
}

async function submitEditBook(e, bookId) {
  e.preventDefault();
  const data = {
    title: $('edit-book-title').value,
    author: $('edit-book-author').value,
    description: $('edit-book-description').value,
    category_id: $('edit-book-category').value || null,
    isbn: $('edit-book-isbn').value,
    publisher: $('edit-book-publisher').value,
    year_published: $('edit-book-year').value,
    language: $('edit-book-language').value,
    tags: $('edit-book-tags').value
  };

  await api.books.update(bookId, data);
  closeModal();
  showToast('Livre modifié avec succès', 'success');
  loadAdminBooks();
  return false;
}

async function deleteBook(bookId, title) {
  if (!confirm(`Supprimer le livre "${title}" ?\nCette action est irréversible.`)) return;
  await api.books.delete(bookId);
  showToast('Livre supprimé', 'success');
  loadAdminBooks();
}

// ─── Admin: Videos Management ───────────────────────────────
async function loadAdminVideos() {
  const videos = await api.videos.list({});
  const tbody = $('admin-videos-tbody');

  if (videos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:40px;color:var(--text-muted)">Aucune vidéo. Cliquez sur "Ajouter une Vidéo" pour commencer.</td></tr>';
    return;
  }

  tbody.innerHTML = videos.map(video => `
    <tr>
      <td><strong style="color:var(--text-primary)">${escapeHtml(video.title)}</strong></td>
      <td>${video.category_name ? `<span class="video-meta-tag">${escapeHtml(video.category_name)}</span>` : '—'}</td>
      <td>${escapeHtml(video.course_year || video.academic_year || '—')}</td>
      <td>${escapeHtml(video.course_semester || video.semester || '—')}</td>
      <td>${video.episode_number || '—'}</td>
      <td>
        <div class="table-actions">
          <button class="btn-icon" onclick="showEditVideoModal('${video.id}')" title="Modifier">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteVideo('${video.id}', '${escapeHtml(video.title)}')" title="Supprimer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showAddVideoModal() {
  const modal = $('modal-content');
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Ajouter une Vidéo</h3>
      <button class="btn-icon" onclick="closeModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <form id="add-video-form" onsubmit="return submitAddVideo(event)">
        <div class="form-group">
          <label>Fichier vidéo *</label>
          <div class="file-picker">
            <span class="file-name" id="video-file-name">Aucun fichier sélectionné</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="pickVideoFile()">Parcourir</button>
          </div>
          <input type="hidden" id="video-file-path">
          <input type="hidden" id="video-file-size">
        </div>
        <div class="form-group">
          <label>Titre *</label>
          <input type="text" id="video-title" required placeholder="Titre de la vidéo">
        </div>
        <div class="form-group">
          <label>Cours</label>
          <select id="video-category">
            <option value="">— Aucun —</option>
            ${courseCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)} ${c.academic_year ? `(${c.academic_year})` : ''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="video-description" placeholder="Description de la vidéo"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Numéro d'épisode</label>
            <input type="number" id="video-episode" placeholder="Ex: 1" min="1">
          </div>
          <div class="form-group">
            <label>Durée (secondes)</label>
            <input type="number" id="video-duration" placeholder="Ex: 3600">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Année académique</label>
            <select id="video-year">
              <option value="">— Aucune —</option>
              ${yearOptionsHtml('')}
            </select>
          </div>
          <div class="form-group">
            <label>Semestre</label>
            <select id="video-semester">
              <option value="">— Aucun —</option>
              ${semesterOptionsHtml('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Miniature</label>
          <div class="file-picker">
            <span class="file-name" id="video-thumb-name">Aucune image</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="pickVideoThumb()">Parcourir</button>
          </div>
          <input type="hidden" id="video-thumb-path">
        </div>
        <div class="form-group">
          <label>Tags</label>
          <input type="text" id="video-tags" placeholder="Tags séparés par des virgules">
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="document.getElementById('add-video-form').requestSubmit()">Ajouter la Vidéo</button>
    </div>
  `;
  $('modal-overlay').classList.add('active');
}

async function pickVideoFile() {
  const file = await api.dialog.openVideo();
  if (file) {
    $('video-file-path').value = file.path;
    $('video-file-size').value = file.size;
    $('video-file-name').textContent = file.name;
    $('video-file-name').classList.add('has-file');
    if (!$('video-title').value) {
      $('video-title').value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    }
  }
}

async function pickVideoThumb() {
  const path = await api.dialog.openImage();
  if (path) {
    $('video-thumb-path').value = path;
    $('video-thumb-name').textContent = path.split(/[/\\]/).pop();
    $('video-thumb-name').classList.add('has-file');
  }
}

async function submitAddVideo(e) {
  e.preventDefault();
  const filePath = $('video-file-path').value;
  if (!filePath) { showToast('Veuillez sélectionner un fichier vidéo', 'error'); return false; }

  const data = {
    title: $('video-title').value,
    description: $('video-description').value,
    category_id: $('video-category').value || null,
    file_path: filePath,
    file_size: parseInt($('video-file-size').value) || 0,
    duration: parseInt($('video-duration').value) || 0,
    thumbnail: $('video-thumb-path').value || null,
    episode_number: parseInt($('video-episode').value) || null,
    academic_year: $('video-year').value,
    semester: $('video-semester').value,
    tags: $('video-tags').value,
    added_by: currentUser?.id
  };

  const result = await api.videos.add(data);
  if (result.success) {
    closeModal();
    showToast('Vidéo ajoutée avec succès !', 'success');
    loadAdminVideos();
    loadVideos();
  }
  return false;
}

async function showEditVideoModal(videoId) {
  const videos = await api.videos.list({});
  const video = videos.find(v => v.id === videoId);
  if (!video) return;

  const modal = $('modal-content');
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Modifier la Vidéo</h3>
      <button class="btn-icon" onclick="closeModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <form id="edit-video-form" onsubmit="return submitEditVideo(event, '${videoId}')">
        <div class="form-group">
          <label>Titre *</label>
          <input type="text" id="edit-video-title" value="${escapeHtml(video.title)}" required>
        </div>
        <div class="form-group">
          <label>Cours</label>
          <select id="edit-video-category">
            <option value="">— Aucun —</option>
            ${courseCategories.map(c => `<option value="${c.id}" ${c.id === video.category_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="edit-video-description">${escapeHtml(video.description || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Épisode</label>
            <input type="number" id="edit-video-episode" value="${video.episode_number || ''}" min="1">
          </div>
          <div class="form-group">
            <label>Année</label>
            <select id="edit-video-year">
              <option value="">—</option>
              ${yearOptionsHtml(video.academic_year)}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Semestre</label>
            <select id="edit-video-semester">
              <option value="">—</option>
              ${semesterOptionsHtml(video.semester)}
            </select>
          </div>
          <div class="form-group">
            <label>Tags</label>
            <input type="text" id="edit-video-tags" value="${escapeHtml(video.tags || '')}">
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="document.getElementById('edit-video-form').requestSubmit()">Enregistrer</button>
    </div>
  `;
  $('modal-overlay').classList.add('active');
}

async function submitEditVideo(e, videoId) {
  e.preventDefault();
  const data = {
    title: $('edit-video-title').value,
    description: $('edit-video-description').value,
    category_id: $('edit-video-category').value || null,
    episode_number: parseInt($('edit-video-episode').value) || null,
    academic_year: $('edit-video-year').value,
    semester: $('edit-video-semester').value,
    tags: $('edit-video-tags').value
  };

  await api.videos.update(videoId, data);
  closeModal();
  showToast('Vidéo modifiée avec succès', 'success');
  loadAdminVideos();
  return false;
}

async function deleteVideo(videoId, title) {
  if (!confirm(`Supprimer la vidéo "${title}" ?\nCette action est irréversible.`)) return;
  await api.videos.delete(videoId);
  showToast('Vidéo supprimée', 'success');
  loadAdminVideos();
}

// ─── Admin: Users Management ────────────────────────────────
async function loadAdminUsers() {
  const users = await api.users.list();
  const tbody = $('admin-users-tbody');

  tbody.innerHTML = users.map(user => `
    <tr>
      <td><strong style="color:var(--text-primary)">${escapeHtml(user.full_name)}</strong></td>
      <td>${escapeHtml(user.username)}</td>
      <td><span class="role-badge role-${user.role}">${user.role === 'admin' ? 'Admin' : 'Étudiant'}</span></td>
      <td>${escapeHtml(user.year_of_study || '—')}</td>
      <td>${formatDate(user.last_login)}</td>
      <td><span class="status-badge ${user.is_active ? 'status-active' : 'status-inactive'}">${user.is_active ? 'Actif' : 'Inactif'}</span></td>
      <td>
        <div class="table-actions">
          ${user.role !== 'admin' ? `
            <button class="btn-icon" onclick="toggleUserStatus('${user.id}', ${user.is_active})" title="${user.is_active ? 'Désactiver' : 'Activer'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${user.is_active
                ? '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="13" x2="17" y2="13"/>'
                : '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>'
              }</svg>
            </button>
            <button class="btn-icon" onclick="showResetPasswordModal('${user.id}', '${escapeHtml(user.full_name)}')" title="Réinitialiser le mot de passe">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </button>
            <button class="btn-icon danger" onclick="deleteUser('${user.id}', '${escapeHtml(user.full_name)}')" title="Supprimer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          ` : '<span style="color:var(--text-muted);font-size:12px">Compte protégé</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

function showAddUserModal() {
  const modal = $('modal-content');
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Nouvel Utilisateur</h3>
      <button class="btn-icon" onclick="closeModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <form id="add-user-form" onsubmit="return submitAddUser(event)">
        <div class="form-group">
          <label>Nom complet *</label>
          <input type="text" id="new-user-fullname" required placeholder="Nom et prénom">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Identifiant *</label>
            <input type="text" id="new-user-username" required placeholder="Identifiant de connexion">
          </div>
          <div class="form-group">
            <label>Mot de passe *</label>
            <div class="password-wrapper">
              <input type="password" id="new-user-password" required placeholder="Mot de passe">
              <button type="button" class="password-toggle" onclick="togglePasswordVisibility('new-user-password', this)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Rôle</label>
            <select id="new-user-role">
              <option value="student">Étudiant</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>
          <div class="form-group">
            <label>Année d'étude</label>
            <select id="new-user-year">
              <option value="">—</option>
              ${studyLevelOptionsHtml('')}
            </select>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="document.getElementById('add-user-form').requestSubmit()">Créer l'Utilisateur</button>
    </div>
  `;
  $('modal-overlay').classList.add('active');
}

async function submitAddUser(e) {
  e.preventDefault();
  const result = await api.auth.register({
    full_name: $('new-user-fullname').value,
    username: $('new-user-username').value,
    password: $('new-user-password').value,
    role: $('new-user-role').value,
    year_of_study: $('new-user-year').value
  });
  if (result.success) {
    closeModal();
    showToast('Utilisateur créé avec succès', 'success');
    loadAdminUsers();
  } else {
    showToast(result.error || 'Erreur lors de la création', 'error');
  }
  return false;
}

async function toggleUserStatus(userId, currentStatus) {
  await api.users.toggle(userId, !currentStatus);
  showToast(currentStatus ? 'Utilisateur désactivé' : 'Utilisateur activé', 'success');
  loadAdminUsers();
}

function showResetPasswordModal(userId, name) {
  const modal = $('modal-content');
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Réinitialiser le mot de passe</h3>
      <button class="btn-icon" onclick="closeModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <p style="margin-bottom:16px;color:var(--text-secondary)">Nouveau mot de passe pour <strong>${name}</strong></p>
      <div class="form-group">
        <label>Nouveau mot de passe</label>
        <div class="password-wrapper">
          <input type="password" id="reset-password" required placeholder="Entrez le nouveau mot de passe">
          <button type="button" class="password-toggle" onclick="togglePasswordVisibility('reset-password', this)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitResetPassword('${userId}')">Réinitialiser</button>
    </div>
  `;
  $('modal-overlay').classList.add('active');
}

async function submitResetPassword(userId) {
  const newPass = $('reset-password').value;
  if (!newPass) return;
  await api.users.resetPassword(userId, newPass);
  closeModal();
  showToast('Mot de passe réinitialisé', 'success');
}

async function deleteUser(userId, name) {
  if (!confirm(`Supprimer l'utilisateur "${name}" ?\nToute sa progression sera perdue.`)) return;
  await api.users.delete(userId);
  showToast('Utilisateur supprimé', 'success');
  loadAdminUsers();
}

// ─── Admin: Categories Management ───────────────────────────
async function loadCategoriesManagement() {
  await loadBookCategories();
  await loadCourseCategories();

  // Count books per category
  const allBooksForCount = await api.books.list({});
  const bookCounts = {};
  allBooksForCount.forEach(b => {
    if (b.category_id) bookCounts[b.category_id] = (bookCounts[b.category_id] || 0) + 1;
  });

  // Count videos per course category
  const allVideosForCount = await api.videos.list({});
  const videoCounts = {};
  allVideosForCount.forEach(v => {
    if (v.category_id) videoCounts[v.category_id] = (videoCounts[v.category_id] || 0) + 1;
  });

  const bookList = $('book-categories-list');
  bookList.innerHTML = bookCategories.map(cat => `
    <div class="category-item" data-id="${cat.id}">
      <input type="color" value="${cat.color}" class="category-color-picker"
        onchange="quickUpdateBookCatColor('${cat.id}', this.value)" title="Changer la couleur">
      <span class="category-name">
        <span class="category-name-text" ondblclick="startInlineRename(this, '${cat.id}', 'book')" title="Double-cliquez pour renommer">${escapeHtml(cat.name)}</span>
      </span>
      <span class="category-item-count">${bookCounts[cat.id] || 0} livre${(bookCounts[cat.id] || 0) > 1 ? 's' : ''}</span>
      <div class="table-actions">
        <button class="btn-icon" onclick="showEditBookCategoryModal('${cat.id}', '${escapeHtml(cat.name)}', '${cat.color}', '${escapeHtml(cat.description || '')}')" title="Modifier les détails">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteBookCategory('${cat.id}', '${escapeHtml(cat.name)}')" title="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('') || '<p class="empty-state">Aucune catégorie — ajoutez-en une !</p>';

  const courseList = $('course-categories-list');
  courseList.innerHTML = courseCategories.map(cat => `
    <div class="category-item" data-id="${cat.id}">
      <input type="color" value="${cat.color || '#8B5CF6'}" class="category-color-picker"
        onchange="quickUpdateCourseCatColor('${cat.id}', this.value)" title="Changer la couleur">
      <span class="category-name">
        <span class="category-name-text" ondblclick="startInlineRename(this, '${cat.id}', 'course')" title="Double-cliquez pour renommer">${escapeHtml(cat.name)}</span>
      </span>
      <span class="category-meta">${escapeHtml(cat.academic_year || '')} ${cat.semester ? '· ' + escapeHtml(cat.semester) : ''} ${cat.professor ? '· ' + escapeHtml(cat.professor) : ''}</span>
      <span class="category-item-count">${videoCounts[cat.id] || 0} vidéo${(videoCounts[cat.id] || 0) > 1 ? 's' : ''}</span>
      <div class="table-actions">
        <button class="btn-icon" onclick="showEditCourseCategoryModal('${cat.id}')" title="Modifier les détails">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteCourseCategory('${cat.id}', '${escapeHtml(cat.name)}')" title="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('') || '<p class="empty-state">Aucune catégorie de cours — ajoutez-en une !</p>';
}

// ─── Inline Rename ──────────────────────────────────────────
function startInlineRename(span, catId, catType) {
  const currentName = span.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.className = 'category-rename-input';
  span.replaceWith(input);
  input.focus();
  input.select();

  async function finishRename() {
    const newName = input.value.trim();
    if (newName && newName !== currentName) {
      if (catType === 'book') {
        const cat = bookCategories.find(c => c.id === catId);
        await api.bookCategories.update(catId, {
          name: newName,
          description: cat?.description || '',
          color: cat?.color || '#3B82F6',
          icon: cat?.icon || 'folder'
        });
      } else {
        const cat = courseCategories.find(c => c.id === catId);
        await api.courseCategories.update(catId, {
          name: newName,
          academic_year: cat?.academic_year || '',
          semester: cat?.semester || '',
          professor: cat?.professor || '',
          description: cat?.description || '',
          color: cat?.color || '#8B5CF6'
        });
      }
      showToast(`Catégorie renommée : "${newName}"`, 'success');
    }
    loadCategoriesManagement();
    loadBookCategories();
    loadCourseCategories();
  }

  input.addEventListener('blur', finishRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = currentName; input.blur(); }
  });
}

// Quick color change
async function quickUpdateBookCatColor(catId, color) {
  const cat = bookCategories.find(c => c.id === catId);
  if (!cat) return;
  await api.bookCategories.update(catId, {
    name: cat.name, description: cat.description || '', color: color, icon: cat.icon || 'folder'
  });
  showToast('Couleur modifiée', 'success');
  loadBookCategories();
}

async function quickUpdateCourseCatColor(catId, color) {
  const cat = courseCategories.find(c => c.id === catId);
  if (!cat) return;
  await api.courseCategories.update(catId, {
    name: cat.name, academic_year: cat.academic_year || '', semester: cat.semester || '',
    professor: cat.professor || '', description: cat.description || '', color: color
  });
  showToast('Couleur modifiée', 'success');
  loadCourseCategories();
}

function showAddBookCategoryModal() {
  const modal = $('modal-content');
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Nouvelle Catégorie de Livres</h3>
      <button class="btn-icon" onclick="closeModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Nom *</label>
        <input type="text" id="new-bookcat-name" required placeholder="Nom de la catégorie">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="new-bookcat-desc" placeholder="Description"></textarea>
      </div>
      <div class="form-group">
        <label>Couleur</label>
        <input type="color" id="new-bookcat-color" value="#3B82F6" style="width:60px;height:36px;padding:2px;cursor:pointer">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitAddBookCategory()">Créer</button>
    </div>
  `;
  $('modal-overlay').classList.add('active');
}

async function submitAddBookCategory() {
  const name = $('new-bookcat-name').value;
  if (!name) return;
  await api.bookCategories.create({
    name, description: $('new-bookcat-desc').value, color: $('new-bookcat-color').value
  });
  closeModal();
  showToast('Catégorie créée', 'success');
  loadCategoriesManagement();
  loadBookCategories();
}

function showEditBookCategoryModal(id, name, color, description) {
  const modal = $('modal-content');
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Modifier la Catégorie</h3>
      <button class="btn-icon" onclick="closeModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Nom</label>
        <input type="text" id="edit-bookcat-name" value="${name}">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="edit-bookcat-desc">${description}</textarea>
      </div>
      <div class="form-group">
        <label>Couleur</label>
        <input type="color" id="edit-bookcat-color" value="${color}" style="width:60px;height:36px;padding:2px;cursor:pointer">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitEditBookCategory('${id}')">Enregistrer</button>
    </div>
  `;
  $('modal-overlay').classList.add('active');
}

async function submitEditBookCategory(id) {
  await api.bookCategories.update(id, {
    name: $('edit-bookcat-name').value,
    description: $('edit-bookcat-desc').value,
    color: $('edit-bookcat-color').value
  });
  closeModal();
  showToast('Catégorie modifiée', 'success');
  loadCategoriesManagement();
  loadBookCategories();
}

async function deleteBookCategory(id, name) {
  if (!confirm(`Supprimer la catégorie "${name}" ?`)) return;
  await api.bookCategories.delete(id);
  showToast('Catégorie supprimée', 'success');
  loadCategoriesManagement();
  loadBookCategories();
}

function showAddCourseCategoryModal() {
  const modal = $('modal-content');
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Nouveau Cours</h3>
      <button class="btn-icon" onclick="closeModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Nom du cours *</label>
        <input type="text" id="new-coursecat-name" required placeholder="Ex: Introduction à la Bible">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Année académique</label>
          <select id="new-coursecat-year">
            <option value="">—</option>
            ${yearOptionsHtml('')}
          </select>
        </div>
        <div class="form-group">
          <label>Semestre</label>
          <select id="new-coursecat-semester">
            <option value="">—</option>
            ${semesterOptionsHtml('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Professeur</label>
        <input type="text" id="new-coursecat-prof" placeholder="Nom du professeur">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="new-coursecat-desc" placeholder="Description du cours"></textarea>
      </div>
      <div class="form-group">
        <label>Couleur</label>
        <input type="color" id="new-coursecat-color" value="#8B5CF6" style="width:60px;height:36px;padding:2px;cursor:pointer">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitAddCourseCategory()">Créer</button>
    </div>
  `;
  $('modal-overlay').classList.add('active');
}

async function submitAddCourseCategory() {
  const name = $('new-coursecat-name').value;
  if (!name) return;
  await api.courseCategories.create({
    name,
    academic_year: $('new-coursecat-year').value,
    semester: $('new-coursecat-semester').value,
    professor: $('new-coursecat-prof').value,
    description: $('new-coursecat-desc').value,
    color: $('new-coursecat-color').value
  });
  closeModal();
  showToast('Cours créé', 'success');
  loadCategoriesManagement();
  loadCourseCategories();
}

async function showEditCourseCategoryModal(id) {
  const cat = courseCategories.find(c => c.id === id);
  if (!cat) return;
  const modal = $('modal-content');
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Modifier le Cours</h3>
      <button class="btn-icon" onclick="closeModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Nom</label>
        <input type="text" id="edit-coursecat-name" value="${escapeHtml(cat.name)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Année</label>
          <select id="edit-coursecat-year">
            <option value="">—</option>
            ${yearOptionsHtml(cat.academic_year)}
          </select>
        </div>
        <div class="form-group">
          <label>Semestre</label>
          <select id="edit-coursecat-semester">
            <option value="">—</option>
            ${semesterOptionsHtml(cat.semester)}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Professeur</label>
        <input type="text" id="edit-coursecat-prof" value="${escapeHtml(cat.professor || '')}">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="edit-coursecat-desc">${escapeHtml(cat.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Couleur</label>
        <input type="color" id="edit-coursecat-color" value="${cat.color || '#8B5CF6'}" style="width:60px;height:36px;padding:2px;cursor:pointer">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitEditCourseCategory('${id}')">Enregistrer</button>
    </div>
  `;
  $('modal-overlay').classList.add('active');
}

async function submitEditCourseCategory(id) {
  await api.courseCategories.update(id, {
    name: $('edit-coursecat-name').value,
    academic_year: $('edit-coursecat-year').value,
    semester: $('edit-coursecat-semester').value,
    professor: $('edit-coursecat-prof').value,
    description: $('edit-coursecat-desc').value,
    color: $('edit-coursecat-color').value
  });
  closeModal();
  showToast('Cours modifié', 'success');
  loadCategoriesManagement();
  loadCourseCategories();
}

async function deleteCourseCategory(id, name) {
  if (!confirm(`Supprimer le cours "${name}" ?`)) return;
  await api.courseCategories.delete(id);
  showToast('Cours supprimé', 'success');
  loadCategoriesManagement();
  loadCourseCategories();
}

// ─── Modal Management ───────────────────────────────────────
function closeModal(e) {
  if (e && e.target !== $('modal-overlay')) return;
  $('modal-overlay').classList.remove('active');
}

// Close modal with Escape key + video player escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Close modal first if open
    if ($('modal-overlay').classList.contains('active')) {
      $('modal-overlay').classList.remove('active');
      return;
    }
    // Close video player
    if (currentPage === 'video-player') {
      closeVideoPlayer();
      return;
    }
  }
  // Space bar to pause/play video
  if (e.key === ' ' && currentPage === 'video-player' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    const player = $('video-player');
    if (player.paused) player.play(); else player.pause();
  }
});

// ─── Password Visibility Toggle ────────────────────────────
function togglePasswordVisibility(inputId, btn) {
  const input = $(inputId);
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.innerHTML = isPassword
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

// ─── Backup & Restore ──────────────────────────────────────
async function loadBackupList() {
  const listEl = $('backup-list');
  if (!listEl) return;

  listEl.innerHTML = '<p class="empty-state">Chargement...</p>';

  const backups = await api.backup.list();
  if (!backups || backups.length === 0) {
    listEl.innerHTML = '<p class="empty-state">Aucune sauvegarde trouvée. Créez votre première sauvegarde !</p>';
    return;
  }

  listEl.innerHTML = backups.map(b => {
    const date = new Date(b.createdAt);
    const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const sizeStr = formatFileSize(b.size);
    const stats = b.stats || {};
    return `
      <div class="backup-item">
        <div class="backup-item-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        </div>
        <div class="backup-item-info">
          <h4>${escapeHtml(b.name)}</h4>
          <div class="backup-item-meta">
            <span>${dateStr}</span>
            <span>${sizeStr}</span>
            ${stats.books !== undefined ? `<span>${stats.books} livres</span>` : ''}
            ${stats.videos !== undefined ? `<span>${stats.videos} vidéos</span>` : ''}
            ${stats.users !== undefined ? `<span>${stats.users} utilisateurs</span>` : ''}
          </div>
        </div>
        <div class="backup-item-actions">
          <button class="btn btn-sm btn-primary" onclick="restoreBackup('${escapeHtml(b.path.replace(/\\/g, '\\\\'))}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Restaurer
          </button>
          <button class="btn btn-sm btn-secondary danger" onclick="deleteBackup('${escapeHtml(b.path.replace(/\\/g, '\\\\'))}', '${escapeHtml(b.name)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function createBackup() {
  const btn = $('btn-create-backup');
  btn.disabled = true;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Sauvegarde en cours...';

  const result = await api.backup.create();
  if (result.success) {
    showToast(`Sauvegarde créée : ${result.name}`, 'success');
    loadBackupList();
  } else {
    showToast(`Erreur : ${result.error}`, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Sauvegarder maintenant';
}

async function restoreBackup(backupPath) {
  if (!confirm('Restaurer cette sauvegarde ?\n\nLes données actuelles seront remplacées par celles de la sauvegarde. Cette action est irréversible.')) return;

  showToast('Restauration en cours...', 'info');
  const result = await api.backup.restore(backupPath);
  if (result.success) {
    showToast('Restauration terminée ! Rechargement...', 'success');
    setTimeout(() => location.reload(), 1500);
  } else {
    showToast(`Erreur : ${result.error}`, 'error');
  }
}

async function restoreFromFolder() {
  const folderPath = await api.backup.selectFolder();
  if (!folderPath) {
    showToast('Dossier invalide — aucun fichier de base de données trouvé', 'warning');
    return;
  }
  await restoreBackup(folderPath);
}

async function deleteBackup(backupPath, name) {
  if (!confirm(`Supprimer la sauvegarde "${name}" ?\n\nCette action est irréversible.`)) return;
  const result = await api.backup.delete(backupPath);
  if (result.success) {
    showToast('Sauvegarde supprimée', 'success');
    loadBackupList();
  } else {
    showToast(`Erreur : ${result.error}`, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS & INSTITUTE CUSTOMIZATION
// ═══════════════════════════════════════════════════════════════

async function loadAppSettings() {
  try {
    appSettings = await api.settings.getAll();
  } catch { appSettings = {}; }
  applyBranding();
}

function populateFilterDropdowns() {
  // Videos page year filter
  const yearFilter = $('videos-year-filter');
  if (yearFilter) {
    const currentVal = yearFilter.value;
    yearFilter.innerHTML = `<option value="">Toutes les années</option>` + yearOptionsHtml(currentVal);
  }
  // Videos page semester filter
  const semFilter = $('videos-semester-filter');
  if (semFilter) {
    const currentVal = semFilter.value;
    semFilter.innerHTML = `<option value="">Tous les semestres</option>` + semesterOptionsHtml(currentVal);
  }
}

function applyBranding() {
  // Login page: institute name
  const nameEl = $('login-institute-name');
  if (nameEl && appSettings.institute_name) {
    nameEl.textContent = appSettings.institute_name;
  }

  // Login page: custom message
  const msgEl = $('login-custom-message');
  if (msgEl && appSettings.login_message) {
    msgEl.innerHTML = `<em>${escapeHtml(appSettings.login_message)}</em>`;
  }

  // Login page: logo
  if (appSettings.institute_logo) {
    loadLogoDataUrl(appSettings.institute_logo).then(dataUrl => {
      if (dataUrl) {
        const container = $('login-logo-container');
        if (container) container.innerHTML = `<img src="${dataUrl}" alt="Logo">`;
      }
    });
  }

  // Titlebar: show acronym + name
  const titleEl = $('titlebar-app-name');
  if (titleEl) {
    const acronym = appSettings.institute_acronym || '';
    titleEl.textContent = acronym ? `ELIKIA INSTITUT — ${acronym} Bibliothèque` : 'ELIKIA INSTITUT';
  }

  // Populate filter dropdowns with dynamic values
  populateFilterDropdowns();
}

async function loadLogoDataUrl(logoPath) {
  if (!logoPath) return null;
  try { return await api.file.toDataUrl(logoPath); } catch { return null; }
}

// Helper: get academic years from settings
function getAcademicYears() {
  try { return JSON.parse(appSettings.academic_years || '[]'); }
  catch { return ['1ère Année', '2ème Année', '3ème Année', '4ème Année', 'Master']; }
}

function getSemesters() {
  try { return JSON.parse(appSettings.semesters || '[]'); }
  catch { return ['Semestre 1', 'Semestre 2']; }
}

function getStudyLevels() {
  try { return JSON.parse(appSettings.study_levels || '[]'); }
  catch { return ['1ère Année', '2ème Année', '3ème Année', '4ème Année', 'Master']; }
}

// Generate <option> HTML for academic years
function yearOptionsHtml(selected) {
  return getAcademicYears().map(y =>
    `<option value="${escapeHtml(y)}" ${y === selected ? 'selected' : ''}>${escapeHtml(y)}</option>`
  ).join('');
}

function semesterOptionsHtml(selected) {
  return getSemesters().map(s =>
    `<option value="${escapeHtml(s)}" ${s === selected ? 'selected' : ''}>${escapeHtml(s)}</option>`
  ).join('');
}

function studyLevelOptionsHtml(selected) {
  return getStudyLevels().map(l =>
    `<option value="${escapeHtml(l)}" ${l === selected ? 'selected' : ''}>${escapeHtml(l)}</option>`
  ).join('');
}

// ─── Settings Page ─────────────────────────────────────────
async function loadSettingsPage() {
  await loadAppSettings();
  $('setting-institute-name').value = appSettings.institute_name || '';
  $('setting-institute-acronym').value = appSettings.institute_acronym || '';
  $('setting-login-message').value = appSettings.login_message || '';

  const years = getAcademicYears();
  $('setting-academic-years').value = years.join('\n');

  const semesters = getSemesters();
  $('setting-semesters').value = semesters.join('\n');

  const levels = getStudyLevels();
  $('setting-study-levels').value = levels.join('\n');

  // Logo preview
  const preview = $('settings-logo-preview');
  if (appSettings.institute_logo) {
    const dataUrl = await loadLogoDataUrl(appSettings.institute_logo);
    if (dataUrl) {
      preview.innerHTML = `<img src="${dataUrl}" alt="Logo">`;
    }
  } else {
    preview.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Aucun logo</span>`;
  }

  // Kiosk settings
  $('setting-kiosk-mode').checked = appSettings.kiosk_mode === '1';
  $('setting-restrict-os').checked = appSettings.restrict_os === '1';
  // Auto-start: read from OS
  try {
    const autoStartState = await api.kiosk.getAutoStart();
    $('setting-auto-start').checked = autoStartState.enabled;
  } catch (_) {
    $('setting-auto-start').checked = appSettings.auto_start === '1';
  }
  updateKioskWarning();
}

async function saveAllSettings() {
  const yearsText = $('setting-academic-years').value.trim();
  const semText = $('setting-semesters').value.trim();
  const levelsText = $('setting-study-levels').value.trim();

  const settings = {
    institute_name: $('setting-institute-name').value.trim(),
    institute_acronym: $('setting-institute-acronym').value.trim(),
    login_message: $('setting-login-message').value.trim(),
    academic_years: JSON.stringify(yearsText ? yearsText.split('\n').map(s => s.trim()).filter(Boolean) : []),
    semesters: JSON.stringify(semText ? semText.split('\n').map(s => s.trim()).filter(Boolean) : []),
    study_levels: JSON.stringify(levelsText ? levelsText.split('\n').map(s => s.trim()).filter(Boolean) : []),
  };

  const result = await api.settings.setMultiple(settings);
  if (result.success) {
    showToast('Paramètres enregistrés avec succès', 'success');
    await loadAppSettings(); // Reload and re-apply branding
  } else {
    showToast('Erreur lors de l\'enregistrement', 'error');
  }
}

async function uploadInstituteLogo() {
  const dataUrl = await api.settings.uploadLogo();
  if (dataUrl) {
    $('settings-logo-preview').innerHTML = `<img src="${dataUrl}" alt="Logo">`;
    await loadAppSettings();
    showToast('Logo importé avec succès', 'success');
  }
}

async function removeInstituteLogo() {
  await api.settings.set('institute_logo', '');
  $('settings-logo-preview').innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Aucun logo</span>`;
  await loadAppSettings();
  showToast('Logo supprimé', 'info');
}

/* ═══════════════════════════════════════════════════════════════
   APPLICATIONS MODULE
   ═══════════════════════════════════════════════════════════════ */

let allApps = [];
let installAppData = { filePath: null, fileName: null, fileType: null, iconData: null };

async function loadApps() {
  try {
    allApps = await api.apps.list({ visible_only: 1 });
    const cats = await api.apps.categories();
    const filterEl = $('apps-category-filter');
    if (filterEl) {
      filterEl.innerHTML = '<option value="">Toutes les catégories</option>' +
        cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    renderApps(allApps);
  } catch (e) {
    console.error('loadApps error:', e);
    $('apps-grid').innerHTML = '<p class="empty-state">Erreur de chargement des applications</p>';
  }
}

function filterApps() {
  const search = ($('apps-search')?.value || '').toLowerCase();
  const cat = $('apps-category-filter')?.value || '';
  let filtered = allApps;
  if (search) filtered = filtered.filter(a => a.name.toLowerCase().includes(search) || (a.description || '').toLowerCase().includes(search));
  if (cat) filtered = filtered.filter(a => a.category === cat);
  renderApps(filtered);
}

function appIconUrl(filePath) {
  if (!filePath) return '';
  return 'file:///' + filePath.replace(/\\/g, '/');
}

function renderApps(apps) {
  const grid = $('apps-grid');
  if (!apps.length) {
    grid.innerHTML = '<p class="empty-state">Aucune application disponible</p>';
    return;
  }
  grid.innerHTML = apps.map(app => {
    const ext = (app.file_type || '').toLowerCase();
    const iconHtml = app.icon_path
      ? `<img src="${appIconUrl(app.icon_path)}" alt="${app.name}">`
      : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
    return `
      <div class="app-card" ondblclick="launchApp('${app.id}')">
        <span class="app-card-type ${ext}">${ext}</span>
        <div class="app-card-icon">${iconHtml}</div>
        <div class="app-card-name" title="${app.name}">${app.name}</div>
        <div class="app-card-category">${app.category || 'Utilitaire'}</div>
        <button class="app-launch-btn" onclick="event.stopPropagation(); launchApp('${app.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Lancer
        </button>
      </div>`;
  }).join('');
}

async function launchApp(id) {
  try {
    showToast('Lancement en cours...', 'info');
    const result = await api.apps.launch(id);
    if (result.success) {
      showToast('Application lancée', 'success');
    } else {
      showToast(result.error || 'Impossible de lancer l\'application', 'error');
    }
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

/* ─── Admin: Manage Applications ──────────────────────────── */

async function loadAdminApps() {
  try {
    const apps = await api.apps.list({});
    renderAdminApps(apps);
  } catch (e) {
    console.error('loadAdminApps error:', e);
  }
}

function renderAdminApps(apps) {
  const tbody = $('admin-apps-tbody');
  if (!apps.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Aucune application installée</td></tr>';
    return;
  }
  tbody.innerHTML = apps.map(app => {
    const ext = (app.file_type || '').toLowerCase();
    const iconHtml = app.icon_path
      ? `<img src="${appIconUrl(app.icon_path)}" alt="">`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
    const visBadge = app.is_visible
      ? '<span class="app-visibility-badge visible">Visible</span>'
      : '<span class="app-visibility-badge hidden">Masquée</span>';
    return `<tr>
      <td><div class="app-table-name"><div class="app-table-icon">${iconHtml}</div><span>${app.name}</span></div></td>
      <td><span class="app-card-type ${ext}" style="position:static">${ext}</span></td>
      <td>${app.category || 'Utilitaire'}</td>
      <td>${app.launch_count || 0}</td>
      <td>${visBadge}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-sm btn-ghost" onclick="showEditAppModal('${app.id}')" title="Modifier">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-sm btn-ghost" onclick="changeAppIcon('${app.id}')" title="Changer l'icône">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          <button class="btn btn-sm btn-ghost btn-danger" onclick="confirmDeleteApp('${app.id}', '${app.name.replace(/'/g, "\\'")}')" title="Supprimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function showInstallAppModal() {
  installAppData = { filePath: null, fileName: null, fileType: null, iconData: null };
  const html = `
    <h3>Installer une application</h3>
    <form class="install-app-form" onsubmit="return submitInstallApp(event)">
      <div class="form-group">
        <label>Fichier de l'application</label>
        <div class="file-select-area" onclick="selectAppFile()">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p style="margin:6px 0 0;color:var(--text-muted);font-size:13px">Cliquez pour sélectionner un fichier .exe, .msi ou .apk</p>
          <div class="file-name" id="install-file-name"></div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nom de l'application *</label>
          <input type="text" id="install-app-name" required placeholder="Ex: VLC Media Player">
        </div>
        <div class="form-group">
          <label>Catégorie</label>
          <input type="text" id="install-app-category" placeholder="Ex: Multimédia" value="Utilitaire">
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="install-app-description" rows="2" placeholder="Brève description de l'application..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Version</label>
          <input type="text" id="install-app-version" placeholder="Ex: 1.0">
        </div>
        <div class="form-group" style="display:flex;flex-direction:column;justify-content:end;gap:8px">
          <label class="checkbox-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="install-app-visible" checked>
            Visible pour les étudiants
          </label>
          <label class="checkbox-label" style="display:flex;align-items:center;gap:8px;cursor:pointer" title="Ne pas copier le fichier, garder un raccourci vers l'emplacement d'origine. Recommandé pour les applications déjà installées.">
            <input type="checkbox" id="install-app-link-only">
            Raccourci uniquement (ne pas copier)
          </label>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn btn-primary" id="btn-submit-install">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Installer
        </button>
      </div>
    </form>`;
  $('modal-content').innerHTML = html;
  $('modal-overlay').classList.add('active');
}

async function selectAppFile() {
  try {
    const result = await api.dialog.openApp();
    if (result) {
      installAppData.filePath = result.path;
      installAppData.fileName = result.name;
      installAppData.fileSize = result.size;
      // Extract extension as file type
      const ext = result.name.split('.').pop().toLowerCase();
      installAppData.fileType = ext;
      $('install-file-name').textContent = result.name;
      if (!$('install-app-name').value) {
        $('install-app-name').value = result.name.replace(/\.(exe|msi|apk)$/i, '');
      }
    }
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

async function submitInstallApp(e) {
  e.preventDefault();
  if (!installAppData.filePath) {
    showToast('Veuillez sélectionner un fichier d\'application', 'error');
    return false;
  }
  const name = $('install-app-name').value.trim();
  if (!name) { showToast('Le nom est requis', 'error'); return false; }

  const btn = $('btn-submit-install');
  btn.disabled = true;
  btn.textContent = 'Installation...';

  try {
    const result = await api.apps.install({
      name,
      description: $('install-app-description').value.trim(),
      file_path: installAppData.filePath,
      file_size: installAppData.fileSize || 0,
      category: $('install-app-category').value.trim() || 'Utilitaire',
      version: $('install-app-version').value.trim(),
      is_visible: $('install-app-visible').checked ? 1 : 0,
      link_only: $('install-app-link-only').checked,
    });
    if (result.success) {
      showToast(`"${name}" installée avec succès`, 'success');
      closeModal();
      loadAdminApps();
    } else {
      showToast('Erreur: ' + (result.error || 'Installation échouée'), 'error');
      btn.disabled = false;
      btn.textContent = 'Installer';
    }
  } catch (e) {
    showToast('Erreur d\'installation: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Installer';
  }
  return false;
}

async function showEditAppModal(id) {
  try {
    const apps = await api.apps.list({});
    const app = apps.find(a => a.id === id);
    if (!app) return;
    const html = `
      <h3>Modifier l'application</h3>
      <form onsubmit="return submitEditApp(event, '${id}')">
        <div class="form-row">
          <div class="form-group">
            <label>Nom *</label>
            <input type="text" id="edit-app-name" value="${app.name}" required>
          </div>
          <div class="form-group">
            <label>Catégorie</label>
            <input type="text" id="edit-app-category" value="${app.category || 'Utilitaire'}">
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="edit-app-description" rows="2">${app.description || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Version</label>
            <input type="text" id="edit-app-version" value="${app.version || ''}">
          </div>
          <div class="form-group" style="display:flex;align-items:end">
            <label class="checkbox-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="edit-app-visible" ${app.is_visible ? 'checked' : ''}>
              Visible pour les étudiants
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>`;
    $('modal-content').innerHTML = html;
    $('modal-overlay').classList.add('active');
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

async function submitEditApp(e, id) {
  e.preventDefault();
  try {
    await api.apps.update(id, {
      name: $('edit-app-name').value.trim(),
      description: $('edit-app-description').value.trim(),
      category: $('edit-app-category').value.trim() || 'Utilitaire',
      version: $('edit-app-version').value.trim(),
      is_visible: $('edit-app-visible').checked ? 1 : 0,
    });
    showToast('Application mise à jour', 'success');
    closeModal();
    loadAdminApps();
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
  return false;
}

async function changeAppIcon(id) {
  try {
    const result = await api.apps.updateIcon(id);
    if (result && result.success) {
      showToast('Icône mise à jour', 'success');
      loadAdminApps();
    }
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

function confirmDeleteApp(id, name) {
  const html = `
    <h3>Supprimer l'application</h3>
    <p>Êtes-vous sûr de vouloir supprimer <strong>${name}</strong> ?</p>
    <p style="color:var(--text-muted);font-size:13px">Le fichier sera supprimé du dossier Applications.</p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-danger" onclick="deleteApp('${id}')">Supprimer</button>
    </div>`;
  $('modal-content').innerHTML = html;
  $('modal-overlay').classList.add('active');
}

async function deleteApp(id) {
  try {
    await api.apps.delete(id);
    showToast('Application supprimée', 'success');
    closeModal();
    loadAdminApps();
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

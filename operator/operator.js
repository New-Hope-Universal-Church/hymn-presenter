// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let allHymns            = [];
let allBooks            = [];
let currentHymn         = null;
let currentBlocks       = [];
let selectedBlockIndex  = -1;
let projectedBlockIndex = -1;
let isProjecting        = false;
let searchTimeout       = null;
let activeBookId        = null;
let currentFontSize     = 100;
let editorUnlocked      = false;
let updateReady         = false;

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadBooks();
  await loadHymns('');
  setupKeyboard();
  setupProjectionListener();
  setupUpdateListeners();
  setupSyncListeners();
  document.body.setAttribute('tabindex', '0');
  document.body.focus();
});

// ═════════════════════════════════════════════
// BOOKS
// ═════════════════════════════════════════════
async function loadBooks() {
  allBooks = await window.hymnAPI.getBooks();
  renderBookFilter();
}

function renderBookFilter() {
  const select = document.getElementById('bookFilter');
  const current = select.value;
  select.innerHTML = `<option value="">All Hymn Books</option>` +
    allBooks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  if (current) select.value = current;
}

async function selectBook(value) {
  activeBookId = value ? parseInt(value) : null;
  currentHymn = null;
  selectedBlockIndex  = -1;
  projectedBlockIndex = -1;

  document.getElementById('selectedHymnHeader').innerHTML = `
    <div class="selected-hymn-empty">
      <span class="empty-icon">♪</span>
      <p>Select a hymn to view its verses</p>
    </div>`;
  document.getElementById('blockList').innerHTML = '';
  document.getElementById('blockNav').textContent = '';

  await loadHymns(document.getElementById('searchInput').value);
}

// ═════════════════════════════════════════════
// HYMNS
// ═════════════════════════════════════════════
async function loadHymns(query) {
  try {
    const hymns = await window.hymnAPI.searchHymns(query, activeBookId);
    allHymns = hymns;
    renderHymnList(hymns);
  } catch (err) {
    console.error('Failed to load hymns:', err);
    setStatus('Error loading hymns.');
  }
}

function renderHymnList(hymns) {
  const list  = document.getElementById('hymnList');
  const badge = document.getElementById('hymnCount');
  badge.textContent = hymns.length;

  if (!hymns.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">♪</div>
        <div class="empty-state-text">No hymns found.<br>Try a different search.</div>
      </div>`;
    return;
  }

  list.innerHTML = hymns.map((hymn, i) => `
    <li class="hymn-item ${currentHymn && currentHymn.id === hymn.id ? 'active' : ''}"
        onclick="selectHymn(${i})" data-index="${i}">
      <span class="hymn-number">${hymn.number}</span>
      <div class="hymn-info">
        <div class="hymn-title">${hymn.title}</div>
        ${hymn.author ? `<div class="hymn-author">${hymn.author}</div>` : ''}
      </div>
    </li>
  `).join('');
}

async function selectHymn(index) {
  const hymn = allHymns[index];
  if (!hymn) return;

  currentHymn = hymn;
  selectedBlockIndex  = -1;
  projectedBlockIndex = -1;

  document.querySelectorAll('.hymn-item').forEach(el => el.classList.remove('active'));
  const item = document.querySelector(`.hymn-item[data-index="${index}"]`);
  if (item) item.classList.add('active');

  renderHymnHeader(hymn);

  try {
    currentBlocks = await window.hymnAPI.getHymnBlocks(hymn.id);
    renderBlockList(currentBlocks);
    const book = allBooks.find(b => b.id === hymn.book_id);
    const bookLabel = book ? ` · ${book.name}` : '';
    setStatus(`Hymn ${hymn.number} — ${hymn.title}${bookLabel} — ${currentBlocks.length} blocks`);
  } catch (err) {
    console.error('Failed to load blocks:', err);
    setStatus('Error loading hymn verses.');
  }

  returnFocus();
}

function renderHymnHeader(hymn) {
  const book = allBooks.find(b => b.id === hymn.book_id);
  document.getElementById('selectedHymnHeader').innerHTML = `
    <div class="selected-hymn-info">
      <div class="selected-number">${book ? book.name + ' · ' : ''}No. ${hymn.number}</div>
      <div class="selected-title">${hymn.title}</div>
      ${hymn.author ? `<div class="selected-author">${hymn.author}</div>` : ''}
    </div>
  `;
}

// ═════════════════════════════════════════════
// BLOCKS
// ═════════════════════════════════════════════
function renderBlockList(blocks) {
  const list = document.getElementById('blockList');
  const nav  = document.getElementById('blockNav');
  nav.textContent = `${blocks.length} blocks`;

  if (!blocks.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">♪</div>
        <div class="empty-state-text">No verses found for this hymn.</div>
      </div>`;
    return;
  }

  list.innerHTML = blocks.map((block, i) => `
    <li class="block-item type-${block.type}
               ${i === selectedBlockIndex  ? 'active'    : ''}
               ${i === projectedBlockIndex ? 'projected' : ''}"
        onclick="selectAndProject(${i})" data-index="${i}">
      <div class="block-label">${block.label}</div>
      <div class="block-preview">${formatPreview(block.text)}</div>
      <span class="projected-badge">● LIVE</span>
    </li>
  `).join('');
}

function formatPreview(text) {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.slice(0, 3).join('\n') + (lines.length > 3 ? '\n...' : '');
}

async function selectAndProject(index) {
  if (!currentHymn || !currentBlocks[index]) return;

  selectedBlockIndex  = index;
  projectedBlockIndex = index;
  const block = currentBlocks[index];

  renderBlockList(currentBlocks);

  const el = document.querySelector(`.block-item[data-index="${index}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    await window.hymnAPI.projectBlock({
      hymnNumber: currentHymn.number,
      hymnTitle:  currentHymn.title,
      label:    block.label,
      type:     block.type,
      text:     block.text,
      position: index + 1,
      total:    currentBlocks.length,
    });
    isProjecting = true;
    updateProjectionIndicator(true);
    setStatus(`Projecting: ${block.label} — ${currentHymn.title}`);
  } catch (err) {
    console.error('Failed to project:', err);
    setStatus('Failed to send to projection window.');
  }

  returnFocus();
}

// ═════════════════════════════════════════════
// EDITOR AUTH
// ═════════════════════════════════════════════
async function handleEditorClick() {
  if (editorUnlocked) {
    await window.hymnAPI.openEditor();
    return;
  }
  // Show password modal
  document.getElementById('passwordOverlay').style.display = 'flex';
  document.getElementById('passwordInput').value = '';
  document.getElementById('passwordError').style.display = 'none';
  document.getElementById('passwordInput').classList.remove('shake');
  setTimeout(() => document.getElementById('passwordInput').focus(), 100);
}

function closePasswordModal() {
  document.getElementById('passwordOverlay').style.display = 'none';
  returnFocus();
}

async function submitPassword() {
  const pwd = document.getElementById('passwordInput').value;
  if (!pwd) return;

  const result = await window.hymnAPI.verifyEditorPassword(pwd);

  if (result.success) {
    editorUnlocked = true;

    // Update button to green unlocked state
    const btn  = document.getElementById('btnEditor');
    const icon = document.getElementById('editorLockIcon');
    btn.classList.add('unlocked');
    icon.textContent = '🔓';

    closePasswordModal();
    await window.hymnAPI.openEditor();
  } else {
    const input = document.getElementById('passwordInput');
    input.classList.remove('shake');
    void input.offsetHeight; // restart animation
    input.classList.add('shake');
    input.value = '';
    document.getElementById('passwordError').style.display = 'block';
    setTimeout(() => input.focus(), 50);
  }
}

// Menu shortcut for editor also goes through auth
window.hymnAPI.onMenuOpenEditor(() => handleEditorClick());

// ═════════════════════════════════════════════
// DB SYNC MODAL
// ═════════════════════════════════════════════
function setupSyncListeners() {
  // Triggered by Help → Check for Database Updates
  window.hymnAPI.onManualDbSync(async () => {
    openSyncModal('Checking for Updates', 'Connecting to server...', '');
    await window.hymnAPI.triggerDbSync();
  });

  window.hymnAPI.onDbSyncProgress((pct) => {
    document.getElementById('syncProgressBar').style.display = 'block';
    document.getElementById('syncProgressFill').style.width  = pct + '%';
    document.getElementById('syncModalMessage').textContent  = `Downloading... ${pct}%`;
  });

  window.hymnAPI.onDbSyncDone((result) => {
    if (result.status === 'updated') {
      openSyncModal(
        'Database Updated',
        `Successfully updated to v${result.version}.\nRestart the app to load the latest hymns.`,
        'done'
      );
    } else if (result.status === 'up-to-date') {
      openSyncModal('Already Up to Date', 'Your hymn database is the latest version.', 'done');
    } else if (result.status === 'offline') {
      openSyncModal('No Connection', 'Could not reach the server.\nCheck your internet and try again.', 'offline');
    } else {
      openSyncModal('Update Failed', 'An error occurred. Please try again.', 'error');
    }
  });
}

function openSyncModal(title, message, state) {
  const icon    = document.getElementById('syncModalIcon');
  const titleEl = document.getElementById('syncModalTitle');
  const msgEl   = document.getElementById('syncModalMessage');
  const closeBtn = document.getElementById('syncModalClose');
  const progressBar = document.getElementById('syncProgressBar');

  const icons = { done: '✓', offline: '!', error: '✕' };
  icon.className   = `sync-modal-icon${state ? ' ' + state : ''}`;
  icon.textContent = icons[state] || '↓';
  titleEl.textContent = title;
  msgEl.textContent   = message;
  progressBar.style.display = 'none';
  document.getElementById('syncProgressFill').style.width = '0%';
  closeBtn.style.display = (state === 'done' || state === 'offline' || state === 'error') ? 'flex' : 'none';

  document.getElementById('syncOverlay').style.display = 'flex';
}

function closeSyncModal() {
  document.getElementById('syncOverlay').style.display = 'none';
  returnFocus();
}

// ═════════════════════════════════════════════
// APP UPDATE BAR
// ═════════════════════════════════════════════
function setupUpdateListeners() {
  window.hymnAPI.onUpdateAvailable((info) => {
    const bar = document.getElementById('updateBar');
    document.getElementById('updateMessage').textContent = `App version ${info.version} is available.`;
    bar.style.display = 'flex';
  });

  window.hymnAPI.onUpdateProgress((pct) => {
    const btn = document.getElementById('updateBtn');
    btn.textContent = `Downloading... ${pct}%`;
    btn.disabled = true;
  });

  window.hymnAPI.onUpdateDownloaded(() => {
    document.getElementById('updateMessage').textContent = 'Update ready. Restart to install.';
    const btn = document.getElementById('updateBtn');
    btn.textContent = 'Restart & Install';
    btn.disabled = false;
    updateReady = true;
  });
}

async function handleUpdateAction() {
  if (updateReady) {
    await window.hymnAPI.installUpdate();
  } else {
    await window.hymnAPI.downloadUpdate();
  }
}

function dismissUpdate() {
  document.getElementById('updateBar').style.display = 'none';
}

// ═════════════════════════════════════════════
// PROJECTION
// ═════════════════════════════════════════════
async function toggleProjection() {
  const btn = document.getElementById('btnProjection');
  const currentlyProjecting = await window.hymnAPI.isProjecting();

  if (currentlyProjecting) {
    await window.hymnAPI.closeProjection();
    btn.querySelector('.btn-label').textContent = 'Open Projection';
    btn.classList.remove('active');
    updateProjectionIndicator(false);
    setStatus('Projection closed.');
  } else {
    await window.hymnAPI.openProjection();
    btn.querySelector('.btn-label').textContent = 'Close Projection';
    btn.classList.add('active');
    updateProjectionIndicator(true);
    setStatus('Projection opened — select a verse to project.');
  }
  returnFocus();
}

async function blankScreen() {
  await window.hymnAPI.blankScreen();
  projectedBlockIndex = -1;
  renderBlockList(currentBlocks);
  setStatus('Screen blanked.');
  returnFocus();
}

function setupProjectionListener() {
  window.hymnAPI.onProjectionClosed(() => {
    const btn = document.getElementById('btnProjection');
    btn.querySelector('.btn-label').textContent = 'Open Projection';
    btn.classList.remove('active');
    updateProjectionIndicator(false);
    isProjecting = false;
    setStatus('Projection window closed.');
  });
}

// ═════════════════════════════════════════════
// FONT SIZE
// ═════════════════════════════════════════════
async function adjustFontSize(direction) {
  currentFontSize = Math.min(200, Math.max(50, currentFontSize + direction * 10));
  document.getElementById('fontSizeValue').textContent = currentFontSize + '%';
  await window.hymnAPI.setFontSize(currentFontSize);
}

// ═════════════════════════════════════════════
// SEARCH
// ═════════════════════════════════════════════
function onSearch(value) {
  const clearBtn = document.getElementById('searchClear');
  clearBtn.classList.toggle('visible', value.length > 0);
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadHymns(value.trim()), 250);
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  document.getElementById('searchClear').classList.remove('visible');
  loadHymns('');
  input.focus();
}

// ═════════════════════════════════════════════
// KEYBOARD
// ═════════════════════════════════════════════
function setupKeyboard() {
  document.addEventListener('keydown', async (e) => {
    const searchInput = document.getElementById('searchInput');
    const pwdOverlay  = document.getElementById('passwordOverlay');
    const syncOverlay = document.getElementById('syncOverlay');

    // If password modal is open
    if (pwdOverlay.style.display !== 'none') {
      if (e.key === 'Escape') { closePasswordModal(); }
      return;
    }

    // If sync modal is open
    if (syncOverlay.style.display !== 'none') {
      if (e.key === 'Escape') { closeSyncModal(); }
      return;
    }

    if (document.activeElement === searchInput) {
      if (e.key === 'Escape') { clearSearch(); searchInput.blur(); returnFocus(); }
      return;
    }

    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown':  e.preventDefault(); navigateBlock(1);  break;
      case 'ArrowLeft':  case 'ArrowUp':    e.preventDefault(); navigateBlock(-1); break;
      case 'b': case 'B':  e.preventDefault(); blankScreen(); break;
      case 'Escape':       e.preventDefault(); blankScreen(); break;
      case '/':            e.preventDefault(); searchInput.focus(); break;
    }
  });
}

function navigateBlock(direction) {
  if (!currentBlocks.length) return;
  let newIndex = selectedBlockIndex + direction;
  if (newIndex < 0) newIndex = 0;
  if (newIndex >= currentBlocks.length) newIndex = currentBlocks.length - 1;
  if (newIndex !== selectedBlockIndex) selectAndProject(newIndex);
}

function returnFocus() {
  setTimeout(() => {
    if (document.activeElement !== document.getElementById('searchInput')) {
      document.body.focus();
    }
  }, 50);
}

// ═════════════════════════════════════════════
// UI HELPERS
// ═════════════════════════════════════════════
function updateProjectionIndicator(live) {
  const indicator = document.getElementById('projectionIndicator');
  indicator.classList.toggle('live', live);
  indicator.querySelector('.indicator-label').textContent = live ? 'Projecting' : 'No Projection';
}

function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}
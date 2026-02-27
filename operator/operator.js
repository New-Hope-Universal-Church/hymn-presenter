// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let allHymns           = [];
let allBooks           = [];
let currentHymn        = null;
let currentBlocks      = [];
let selectedBlockIndex = -1;
let projectedBlockIndex = -1;
let isProjecting       = false;
let searchTimeout      = null;
let activeBookId       = null; // null = All Books

// Font size
let currentFontSize = 200;

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadBooks();
  await loadHymns('');
  setupKeyboard();
  setupProjectionListener();
  document.body.setAttribute('tabindex', '0');
  document.body.focus();
});

// ─────────────────────────────────────────────
// Books
// ─────────────────────────────────────────────
async function loadBooks() {
  allBooks = await window.hymnAPI.getBooks();
  renderBookTabs();
}

function renderBookTabs() {
  const select = document.getElementById('bookFilter');
  if (!select) return;

  const current = select.value;

  select.innerHTML = `<option value="">All Hymn Books</option>` +
    allBooks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

  select.value = current || '';
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

// ─────────────────────────────────────────────
// Load Hymns
// ─────────────────────────────────────────────
async function loadHymns(query) {
  try {
    const hymns = await window.hymnAPI.searchHymns(query, activeBookId);
    allHymns = hymns;
    renderHymnList(hymns);
  } catch (err) {
    console.error('Failed to load hymns:', err);
    setStatus('Error loading hymns. Check database connection.');
  }
}

// ─────────────────────────────────────────────
// Render Hymn List
// ─────────────────────────────────────────────
function renderHymnList(hymns) {
  const list       = document.getElementById('hymnList');
  const countBadge = document.getElementById('hymnCount');
  countBadge.textContent = hymns.length;

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

// ─────────────────────────────────────────────
// Select Hymn
// ─────────────────────────────────────────────
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

    // Show book name in status if available
    const book = allBooks.find(b => b.id === hymn.book_id);
    const bookLabel = book ? ` · ${book.name}` : '';
    setStatus(`Hymn ${hymn.number} — ${hymn.title}${bookLabel} — ${currentBlocks.length} blocks`);
  } catch (err) {
    console.error('Failed to load blocks:', err);
    setStatus('Error loading hymn verses.');
  }

  returnFocus();
}

// ─────────────────────────────────────────────
// Render Hymn Header
// ─────────────────────────────────────────────
function renderHymnHeader(hymn) {
  const book = allBooks.find(b => b.id === hymn.book_id);
  const header = document.getElementById('selectedHymnHeader');
  header.innerHTML = `
    <div class="selected-hymn-info">
      <div class="selected-number">${book ? book.name + ' · ' : ''}No. ${hymn.number}</div>
      <div class="selected-title">${hymn.title}</div>
      ${hymn.author ? `<div class="selected-author">${hymn.author}</div>` : ''}
    </div>
  `;
}

// ─────────────────────────────────────────────
// Render Block List
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Select and Project
// ─────────────────────────────────────────────
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
      label:  block.label,
      type:   block.type,
      text:   block.text,
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

// ─────────────────────────────────────────────
// Projection Controls
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Font Size
// ─────────────────────────────────────────────
async function adjustFontSize(direction) {
  currentFontSize = Math.min(400, Math.max(50, currentFontSize + direction * 20));
  document.getElementById('fontSizeValue').textContent = currentFontSize + '%';
  await window.hymnAPI.setFontSize(currentFontSize);
}

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Keyboard
// ─────────────────────────────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', async (e) => {
    const searchInput = document.getElementById('searchInput');
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

// ─────────────────────────────────────────────
// Projection Listener
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────
function updateProjectionIndicator(live) {
  const indicator = document.getElementById('projectionIndicator');
  indicator.classList.toggle('live', live);
  indicator.querySelector('.indicator-label').textContent = live ? 'Projecting' : 'No Projection';
}

function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}
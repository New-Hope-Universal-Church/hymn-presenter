// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let allHymns = [];
let currentHymn = null;
let currentBlocks = [];
let selectedBlockIndex = -1;
let projectedBlockIndex = -1;
let isProjecting = false;
let searchTimeout = null;

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadHymns('');
  setupKeyboard();
  setupProjectionListener();

  // Keep focus on body so keyboard shortcuts always work
  document.body.setAttribute('tabindex', '0');
  document.body.focus();
});

// ─────────────────────────────────────────────
// Load Hymns
// ─────────────────────────────────────────────
async function loadHymns(query) {
  try {
    const hymns = await window.hymnAPI.searchHymns(query);
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
  const list = document.getElementById('hymnList');
  const countBadge = document.getElementById('hymnCount');

  countBadge.textContent = hymns.length;

  if (hymns.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">♪</div>
        <div class="empty-state-text">No hymns found.<br>Try a different search.</div>
      </div>`;
    return;
  }

  list.innerHTML = hymns.map((hymn, i) => `
    <li class="hymn-item ${currentHymn && currentHymn.id === hymn.id ? 'active' : ''}"
        onclick="selectHymn(${i})"
        data-index="${i}">
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
  selectedBlockIndex = -1;
  projectedBlockIndex = -1;

  // Highlight in list
  document.querySelectorAll('.hymn-item').forEach(el => el.classList.remove('active'));
  const item = document.querySelector(`.hymn-item[data-index="${index}"]`);
  if (item) item.classList.add('active');

  // Update header
  renderHymnHeader(hymn);

  // Load blocks
  try {
    currentBlocks = await window.hymnAPI.getHymnBlocks(hymn.id);
    renderBlockList(currentBlocks);
    setStatus(`MHB ${hymn.number} — ${hymn.title} — ${currentBlocks.length} blocks`);
  } catch (err) {
    console.error('Failed to load blocks:', err);
    setStatus('Error loading hymn verses.');
  }

  // Return focus to body so keyboard shortcuts keep working
  returnFocus();
}

// ─────────────────────────────────────────────
// Render Hymn Header
// ─────────────────────────────────────────────
function renderHymnHeader(hymn) {
  const header = document.getElementById('selectedHymnHeader');
  header.innerHTML = `
    <div class="selected-hymn-info">
      <div class="selected-number">MHB ${hymn.number}</div>
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
  const nav = document.getElementById('blockNav');

  nav.textContent = `${blocks.length} blocks`;

  if (blocks.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">♪</div>
        <div class="empty-state-text">No verses found for this hymn.</div>
      </div>`;
    return;
  }

  list.innerHTML = blocks.map((block, i) => `
    <li class="block-item type-${block.type}
               ${i === selectedBlockIndex ? 'active' : ''}
               ${i === projectedBlockIndex ? 'projected' : ''}"
        onclick="selectAndProject(${i})"
        data-index="${i}">
      <div class="block-label">${block.label}</div>
      <div class="block-preview">${formatPreview(block.text)}</div>
      <span class="projected-badge">● LIVE</span>
    </li>
  `).join('');
}

// ─────────────────────────────────────────────
// Format preview text (show first 3 lines)
// ─────────────────────────────────────────────
function formatPreview(text) {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.slice(0, 3).join('\n') + (lines.length > 3 ? '\n...' : '');
}

// ─────────────────────────────────────────────
// Select and Project a Block
// ─────────────────────────────────────────────
async function selectAndProject(index) {
  if (!currentHymn || !currentBlocks[index]) return;

  selectedBlockIndex = index;
  projectedBlockIndex = index;
  const block = currentBlocks[index];

  // Re-render to update active/projected states
  renderBlockList(currentBlocks);

  // Scroll block into view
  const el = document.querySelector(`.block-item[data-index="${index}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Send to projection window
  try {
    await window.hymnAPI.projectBlock({
      hymnNumber: currentHymn.number,
      hymnTitle: currentHymn.title,
      label: block.label,
      type: block.type,
      text: block.text,
      position: index + 1,
      total: currentBlocks.length,
    });

    isProjecting = true;
    updateProjectionIndicator(true);
    setStatus(`Projecting: ${block.label} — ${currentHymn.title}`);
  } catch (err) {
    console.error('Failed to project:', err);
    setStatus('Failed to send to projection window.');
  }

  // CRITICAL — return focus to body after click so keyboard shortcuts work
  returnFocus();
}

// ─────────────────────────────────────────────
// Toggle Projection Window
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

// ─────────────────────────────────────────────
// Blank Screen
// ─────────────────────────────────────────────
async function blankScreen() {
  await window.hymnAPI.blankScreen();
  projectedBlockIndex = -1;
  renderBlockList(currentBlocks);
  setStatus('Screen blanked.');
  returnFocus();
}

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────
function onSearch(value) {
  const clearBtn = document.getElementById('searchClear');
  clearBtn.classList.toggle('visible', value.length > 0);

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadHymns(value.trim());
  }, 250);
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  document.getElementById('searchClear').classList.remove('visible');
  loadHymns('');
  input.focus();
}

// ─────────────────────────────────────────────
// Keyboard Navigation
// ─────────────────────────────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', async (e) => {
    const searchInput = document.getElementById('searchInput');

    // If user is typing in search box
    if (document.activeElement === searchInput) {
      if (e.key === 'Escape') {
        clearSearch();
        searchInput.blur();
        returnFocus();
      }
      return; // let all other keys type normally in search
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        navigateBlock(1);
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        navigateBlock(-1);
        break;

      case 'b':
      case 'B':
        e.preventDefault();
        blankScreen();
        break;

      case 'Escape':
        e.preventDefault();
        blankScreen();
        break;

      case '/':
        e.preventDefault();
        searchInput.focus();
        break;
    }
  });
}

function navigateBlock(direction) {
  if (!currentBlocks.length) return;

  let newIndex = selectedBlockIndex + direction;
  if (newIndex < 0) newIndex = 0;
  if (newIndex >= currentBlocks.length) newIndex = currentBlocks.length - 1;

  if (newIndex !== selectedBlockIndex) {
    selectAndProject(newIndex);
  }
}

// ─────────────────────────────────────────────
// Return focus to body (keeps keyboard shortcuts alive)
// ─────────────────────────────────────────────
function returnFocus() {
  // Small timeout to let click events finish first
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
  const label = indicator.querySelector('.indicator-label');
  indicator.classList.toggle('live', live);
  label.textContent = live ? 'Projecting' : 'No Projection';
}

function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}

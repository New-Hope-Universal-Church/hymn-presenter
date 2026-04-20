// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let allBooks      = [];
let allHymns      = [];
let activeBookId  = null; // null = all books
let currentHymn   = null;
let currentBlocks = [];
let editingIndex  = -1;
let addType       = 'verse';
let searchTimeout = null;

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadBooks();
  await loadHymns('');
});

// ═════════════════════════════════════════════
// BOOKS
// ═════════════════════════════════════════════

async function loadBooks() {
  allBooks = await window.hymnAPI.getBooks();
  renderBookList();
  populateBookDropdowns();
}

function renderBookList() {
  const list = document.getElementById('bookList');

  if (!allBooks.length) {
    list.innerHTML = `<li style="padding:8px 12px;font-size:12px;color:var(--text-muted);">No books yet</li>`;
    return;
  }

  const allItem = `
    <li class="book-list-item ${activeBookId === null ? 'active' : ''}" onclick="selectBook(null)">
      <span class="book-list-name">All Hymns</span>
      <span class="book-list-count">${allHymns.length}</span>
    </li>
  `;

  list.innerHTML = allItem + allBooks.map(b => `
    <li class="book-list-item ${activeBookId === b.id ? 'active' : ''}" onclick="selectBook(${b.id})">
      <span class="book-list-name">${b.name}</span>
      <button class="book-delete-btn" onclick="confirmDeleteBook(event, ${b.id}, '${b.name.replace(/'/g, "\\'")}')">✕</button>
    </li>
  `).join('');
}

function populateBookDropdowns() {
  ['addHymnBook', 'editHymnBook'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = allBooks.map(b =>
      `<option value="${b.id}">${b.name}</option>`
    ).join('');
    if (current) sel.value = current;
  });
}

async function selectBook(bookId) {
  activeBookId = bookId;
  renderBookList();

  // Show/hide Add Hymn button
  document.getElementById('btnAddHymn').style.display =
    bookId !== null ? 'inline-flex' : 'none';

  currentHymn = null;
  cancelEdit(); cancelAdd(); cancelAddHymn(); cancelEditHymn();
  document.getElementById('hymnHeader').innerHTML = `<div class="hymn-header-empty">Select a hymn to edit its verses</div>`;
  document.getElementById('blockList').innerHTML = '';
  document.getElementById('blockCount').textContent = '0';
  document.getElementById('btnAddBlock').style.display = 'none';

  await loadHymns(document.getElementById('searchInput').value);
}

function openAddBook() {
  document.getElementById('addBookForm').style.display = 'block';
  document.getElementById('newBookName').value = '';
  document.getElementById('newBookName').focus();
}

function cancelAddBook() {
  document.getElementById('addBookForm').style.display = 'none';
}

async function saveNewBook() {
  const name = document.getElementById('newBookName').value.trim();
  if (!name) { alert('Please enter a book name.'); return; }

  const book = await window.hymnAPI.addBook(name);
  if (!book || !book.id) {
    alert('Could not add book. It may already exist, or the server is unreachable.');
    return;
  }

  cancelAddBook();
  await loadBooks();
  await selectBook(book.id);
  showSaveStatus('✓ Book added');
}

async function confirmDeleteBook(event, id, name) {
  event.stopPropagation();
  if (!confirm(`Delete "${name}"?\n\nAll hymns in this book will be unassigned (not deleted).`)) return;
  await window.hymnAPI.deleteBook(id);
  if (activeBookId === id) activeBookId = null;
  await loadBooks();
  await loadHymns('');
  showSaveStatus('✓ Book deleted');
}

// ═════════════════════════════════════════════
// HYMNS
// ═════════════════════════════════════════════

async function loadHymns(query) {
  const hymns = await window.hymnAPI.searchHymns(query, activeBookId);
  allHymns = hymns;
  renderHymnList(hymns);
  renderBookList(); // update counts
}

function renderHymnList(hymns) {
  const list  = document.getElementById('hymnList');
  const badge = document.getElementById('hymnCount');
  badge.textContent = hymns.length;

  if (!hymns.length) {
    list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No hymns found</div>`;
    return;
  }

  list.innerHTML = hymns.map((h, i) => {
    const book = allBooks.find(b => b.id === h.book_id);
    return `
      <li class="hymn-item ${currentHymn && currentHymn.id === h.id ? 'active' : ''}"
          onclick="selectHymn(${i})" data-index="${i}">
        <span class="hymn-number">${h.number}</span>
        <div class="hymn-info">
          <div class="hymn-title">${h.title}</div>
          <div class="hymn-author">${book ? book.name : ''}${h.author ? ' · ' + h.author : ''}</div>
        </div>
      </li>
    `;
  }).join('');
}

async function selectHymn(index) {
  currentHymn  = allHymns[index];
  editingIndex = -1;
  cancelEdit(); cancelAdd(); cancelAddHymn();

  document.querySelectorAll('.hymn-item').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`.hymn-item[data-index="${index}"]`);
  if (el) el.classList.add('active');

  // Show hymn header with edit button
  document.getElementById('hymnHeader').innerHTML = `
    <div class="hymn-header-info">
      <div class="hymn-header-number">No. ${currentHymn.number}</div>
      <div class="hymn-header-title">${currentHymn.title}</div>
      ${currentHymn.author ? `<div class="hymn-header-author">${currentHymn.author}</div>` : ''}
    </div>
    <button class="btn btn-xs btn-secondary" onclick="openEditHymn()" style="margin-left:auto;flex-shrink:0;">Edit Info</button>
  `;

  document.getElementById('btnAddBlock').style.display = 'inline-flex';

  currentBlocks = await window.hymnAPI.getHymnBlocks(currentHymn.id);
  renderBlockList();
}

// ── Add Hymn ──
async function openAddHymn() {
  if (!activeBookId) { alert('Please select a hymn book first.'); return; }
  cancelEdit(); cancelAdd(); cancelEditHymn();

  document.getElementById('editEmpty').style.display   = 'none';
  document.getElementById('addHymnForm').style.display = 'block';
  document.getElementById('addHymnNumber').value = '';
  document.getElementById('addHymnTitle').value  = '';
  document.getElementById('addHymnAuthor').value = '';

  // Make sure the active book is present in the dropdown. If allBooks
  // is stale (e.g. a background sync wiped it between the book being
  // created and this form opening), refresh it before populating.
  if (!allBooks.some(b => b.id === activeBookId)) {
    await loadBooks();
  }

  // Pre-select active book
  const sel = document.getElementById('addHymnBook');
  populateBookDropdowns();
  sel.value = activeBookId;

  document.getElementById('addHymnNumber').focus();
}

function cancelAddHymn() {
  document.getElementById('addHymnForm').style.display = 'none';
  document.getElementById('editEmpty').style.display   = 'flex';
}

async function saveNewHymn() {
  const number = parseInt(document.getElementById('addHymnNumber').value);
  const title  = document.getElementById('addHymnTitle').value.trim();
  const author = document.getElementById('addHymnAuthor').value.trim();
  const bookId = parseInt(document.getElementById('addHymnBook').value);

  if (!number) { alert('Please enter a hymn number.'); return; }
  if (!title)  { alert('Please enter a hymn title.');  return; }
  if (!bookId || Number.isNaN(bookId)) {
    alert('Please choose a hymn book. If the book you just created is missing, close and reopen the editor.');
    return;
  }

  const hymn = await window.hymnAPI.addHymn({ number, title, author, bookId });
  if (!hymn || !hymn.id) {
    alert('Could not add hymn. Check your internet connection and try again.');
    return;
  }

  cancelAddHymn();
  await loadHymns('');

  // Select the new hymn
  const idx = allHymns.findIndex(h => h.id === hymn.id);
  if (idx >= 0) selectHymn(idx);
  showSaveStatus('✓ Hymn added');
}

// ── Edit Hymn ──
function openEditHymn() {
  cancelEdit(); cancelAdd();
  populateBookDropdowns();

  document.getElementById('editEmpty').style.display    = 'none';
  document.getElementById('editHymnForm').style.display = 'block';

  document.getElementById('editHymnId').value     = currentHymn.id;
  document.getElementById('editHymnNumber').value = currentHymn.number;
  document.getElementById('editHymnTitle').value  = currentHymn.title;
  document.getElementById('editHymnAuthor').value = currentHymn.author || '';
  document.getElementById('editHymnBook').value   = currentHymn.book_id || '';
}

function cancelEditHymn() {
  document.getElementById('editHymnForm').style.display = 'none';
  document.getElementById('editEmpty').style.display    = 'flex';
}

async function saveHymn() {
  const id     = parseInt(document.getElementById('editHymnId').value);
  const number = parseInt(document.getElementById('editHymnNumber').value);
  const title  = document.getElementById('editHymnTitle').value.trim();
  const author = document.getElementById('editHymnAuthor').value.trim();
  const bookId = parseInt(document.getElementById('editHymnBook').value);

  if (!number) { alert('Please enter a hymn number.'); return; }
  if (!title)  { alert('Please enter a hymn title.');  return; }

  await window.hymnAPI.updateHymn({ id, number, title, author, bookId });

  // Update local state
  currentHymn = { ...currentHymn, number, title, author, book_id: bookId };
  cancelEditHymn();
  await loadHymns(document.getElementById('searchInput').value);

  // Re-select hymn to refresh header
  const idx = allHymns.findIndex(h => h.id === id);
  if (idx >= 0) selectHymn(idx);
  showSaveStatus('✓ Hymn saved');
}

async function deleteHymn() {
  if (!confirm(`Delete "${currentHymn.title}" and ALL its verses?\n\nThis cannot be undone.`)) return;
  await window.hymnAPI.deleteHymn(currentHymn.id);
  currentHymn = null;
  currentBlocks = [];
  cancelEditHymn();
  document.getElementById('hymnHeader').innerHTML = `<div class="hymn-header-empty">Select a hymn to edit its verses</div>`;
  document.getElementById('blockList').innerHTML = '';
  document.getElementById('blockCount').textContent = '0';
  document.getElementById('btnAddBlock').style.display = 'none';
  await loadHymns('');
  showSaveStatus('✓ Hymn deleted');
}

// ═════════════════════════════════════════════
// BLOCKS
// ═════════════════════════════════════════════

function renderBlockList() {
  const list  = document.getElementById('blockList');
  const badge = document.getElementById('blockCount');
  badge.textContent = currentBlocks.length;

  if (!currentBlocks.length) {
    list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No verses yet — click Add Verse</div>`;
    return;
  }

  list.innerHTML = currentBlocks.map((b, i) => `
    <li class="block-item type-${b.type} ${i === editingIndex ? 'active' : ''}"
        onclick="openEditBlock(${i})" data-index="${i}">
      <div class="block-item-label">${b.label}</div>
      <div class="block-item-preview">${firstLine(b.text)}</div>
    </li>
  `).join('');
}

function firstLine(text) {
  return (text || '').split('\n')[0].trim();
}

function openEditBlock(index) {
  editingIndex = index;
  const block  = currentBlocks[index];
  cancelAdd(); cancelAddHymn(); cancelEditHymn();
  renderBlockList();

  document.getElementById('editEmpty').style.display = 'none';
  document.getElementById('addForm').style.display   = 'none';
  document.getElementById('editForm').style.display  = 'block';

  document.getElementById('fieldBlockId').value = block.id;
  document.getElementById('fieldLabel').value   = block.label;
  document.getElementById('fieldText').value    = block.text;
  document.getElementById('positionDisplay').textContent = `${index + 1} of ${currentBlocks.length}`;
  selectType(block.type);
}

function selectType(type) {
  document.querySelectorAll('.type-btn:not([data-form])').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

function getSelectedType() {
  const active = document.querySelector('.type-btn:not([data-form]).active');
  return active ? active.dataset.type : 'verse';
}

async function saveBlock() {
  const id    = document.getElementById('fieldBlockId').value;
  const label = document.getElementById('fieldLabel').value.trim();
  const text  = document.getElementById('fieldText').value;
  const type  = getSelectedType();

  if (!label)       { alert('Please enter a label (e.g. Verse 1)'); return; }
  if (!text.trim()) { alert('Please enter the verse text');          return; }

  await window.hymnAPI.updateBlock({ id, label, text, type });
  currentBlocks[editingIndex] = { ...currentBlocks[editingIndex], label, text, type };
  renderBlockList();
  showSaveStatus('✓ Saved');
}

async function deleteBlock() {
  const block = currentBlocks[editingIndex];
  if (!confirm(`Delete "${block.label}"? This cannot be undone.`)) return;
  await window.hymnAPI.deleteBlock(block.id);
  currentBlocks.splice(editingIndex, 1);
  editingIndex = -1;
  cancelEdit();
  renderBlockList();
  showSaveStatus('✓ Deleted');
}

async function moveBlock(direction) {
  const newIndex = editingIndex + direction;
  if (newIndex < 0 || newIndex >= currentBlocks.length) return;

  const temp = currentBlocks[editingIndex];
  currentBlocks[editingIndex] = currentBlocks[newIndex];
  currentBlocks[newIndex] = temp;

  await window.hymnAPI.reorderBlocks(
    currentBlocks.map((b, i) => ({ id: b.id, position: i + 1 }))
  );

  editingIndex = newIndex;
  renderBlockList();
  document.getElementById('positionDisplay').textContent = `${newIndex + 1} of ${currentBlocks.length}`;

  const el = document.querySelector(`.block-item[data-index="${newIndex}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showSaveStatus('✓ Reordered');
}

function cancelEdit() {
  editingIndex = -1;
  document.getElementById('editForm').style.display  = 'none';
  document.getElementById('editEmpty').style.display = 'flex';
  renderBlockList();
}

function openAddBlock() {
  if (!currentHymn) return;
  cancelEdit(); cancelAddHymn(); cancelEditHymn();

  document.getElementById('editEmpty').style.display = 'none';
  document.getElementById('editForm').style.display  = 'none';
  document.getElementById('addForm').style.display   = 'block';

  document.getElementById('addFieldLabel').value = '';
  document.getElementById('addFieldText').value  = '';
  selectTypeAdd('verse');
  document.getElementById('addFieldLabel').focus();
}

function selectTypeAdd(type) {
  addType = type;
  document.querySelectorAll('.type-btn[data-form="add"]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  const labelInput = document.getElementById('addFieldLabel');
  if (!labelInput.value.trim()) {
    if (type === 'verse') {
      const count = currentBlocks.filter(b => b.type === 'verse').length;
      labelInput.value = `Verse ${count + 1}`;
    } else if (type === 'refrain') {
      labelInput.value = 'Refrain';
    } else if (type === 'chorus') {
      labelInput.value = 'Chorus';
    }
  }
}

async function saveNewBlock() {
  const label = document.getElementById('addFieldLabel').value.trim();
  const text  = document.getElementById('addFieldText').value;

  if (!label)       { alert('Please enter a label (e.g. Verse 1)'); return; }
  if (!text.trim()) { alert('Please enter the verse text');          return; }

  const newBlock = await window.hymnAPI.addBlock({
    hymnId: currentHymn.id,
    type:   addType,
    label,
    text,
    position: currentBlocks.length + 1,
  });

  currentBlocks.push(newBlock);
  cancelAdd();
  renderBlockList();
  showSaveStatus('✓ Added');
  openEditBlock(currentBlocks.length - 1);
}

function cancelAdd() {
  document.getElementById('addForm').style.display   = 'none';
  document.getElementById('editEmpty').style.display = 'flex';
}

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────
function onSearch(value) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadHymns(value.trim()), 250);
}

// ─────────────────────────────────────────────
// Save status flash
// ─────────────────────────────────────────────
function showSaveStatus(msg) {
  const el = document.getElementById('saveStatus');
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2000);
}
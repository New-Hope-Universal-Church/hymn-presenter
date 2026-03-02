// ─────────────────────────────────────────────
// Projection Window Script
// ─────────────────────────────────────────────

const idleState    = document.getElementById('idleState');
const contentState = document.getElementById('contentState');
const blankState   = document.getElementById('blankState');

const elHymnNumber   = document.getElementById('hymnNumber');
const elHymnTitle    = document.getElementById('hymnTitle');
const elBlockLabel   = document.getElementById('blockLabel');
const elVerseText    = document.getElementById('verseText');
const elBlockCounter = document.getElementById('blockCounter');

// ─────────────────────────────────────────────
// Display a block
// ─────────────────────────────────────────────
function displayBlock(data) {
  elHymnNumber.textContent   = `MHB ${data.hymnNumber}`;
  elHymnTitle.textContent    = data.hymnTitle;
  elBlockLabel.textContent   = data.label;
  elVerseText.textContent    = data.text;
  elBlockCounter.textContent = `${data.position} / ${data.total}`;

  contentState.className = `content-state type-${data.type}`;

  [elHymnNumber, elHymnTitle, elBlockLabel, elVerseText, elBlockCounter,
   contentState.querySelector('.hymn-meta')]
    .forEach(el => {
      if (!el) return;
      el.style.animation = 'none';
      void el.offsetHeight;
      el.style.animation = '';
    });

  idleState.style.display    = 'none';
  blankState.style.display   = 'none';
  contentState.style.display = 'flex';
}

// ─────────────────────────────────────────────
// Blank / idle
// ─────────────────────────────────────────────
function blankScreen() {
  idleState.style.display    = 'none';
  contentState.style.display = 'none';
  blankState.style.display   = 'flex';
}

function showIdle() {
  contentState.style.display = 'none';
  blankState.style.display   = 'none';
  idleState.style.display    = 'flex';
}

// ─────────────────────────────────────────────
// Font size
// Operator sends a number 50–200.
// 100 = default (matches the CSS clamp base).
// We scale the clamp proportionally around that base.
// ─────────────────────────────────────────────
const BASE_MIN_PX = 28;
const BASE_VW     = 4.5;
const BASE_MAX_PX = 62;

function applyFontSize(size) {
  const scale  = size / 100;
  const minPx  = (BASE_MIN_PX * scale).toFixed(0);
  const vw     = (BASE_VW     * scale).toFixed(2);
  const maxPx  = (BASE_MAX_PX * scale).toFixed(0);
  elVerseText.style.fontSize = `clamp(${minPx}px, ${vw}vw, ${maxPx}px)`;
}

// ─────────────────────────────────────────────
// Event listeners
// ─────────────────────────────────────────────
window.hymnAPI.onDisplayBlock((data) => displayBlock(data));
window.hymnAPI.onBlankScreen(()      => blankScreen());
window.hymnAPI.onSetFontSize((size)  => applyFontSize(size));

// Start at default size and idle state
applyFontSize(100);
showIdle();
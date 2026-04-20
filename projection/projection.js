// ─────────────────────────────────────────────
// Projection Window Script
// ─────────────────────────────────────────────

const idleState    = document.getElementById('idleState');
const contentState = document.getElementById('contentState');
const blankState   = document.getElementById('blankState');
const screen       = document.getElementById('screen');

const elHymnNumber   = document.getElementById('hymnNumber');
const elHymnTitle    = document.getElementById('hymnTitle');
const elBlockLabel   = document.getElementById('blockLabel');
const elVerseText    = document.getElementById('verseText');
const elBlockCounter = document.getElementById('blockCounter');

// ─────────────────────────────────────────────
// Display a block
// ─────────────────────────────────────────────
function displayBlock(data) {
  elHymnNumber.textContent   = `${data.hymnAlias || ''} ${data.hymnNumber}`.trim();
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
// ─────────────────────────────────────────────
const BASE_MIN_PX = 28;
const BASE_VW     = 4.5;
const BASE_MAX_PX = 62;

function applyFontSize(size) {
  const scale = size / 100;
  const minPx = (BASE_MIN_PX * scale).toFixed(0);
  const vw    = (BASE_VW     * scale).toFixed(2);
  const maxPx = (BASE_MAX_PX * scale).toFixed(0);
  elVerseText.style.fontSize = `clamp(${minPx}px, ${vw}vw, ${maxPx}px)`;
}

// ─────────────────────────────────────────────
// Theme
//
// theme object shape:
// {
//   vars: { '--bg': '#...', '--text-verse': '#...', ... },
//   background: null | 'path/to/video.mp4' | 'path/to/image.jpg'
// }
//
// To add live backgrounds in the future:
//   1. Add a <video> or <img> element with id="bgMedia" to projection.html
//   2. Set background to a file path or URL
//   3. The code below already handles it — just uncomment the media section
// ─────────────────────────────────────────────
function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;

  // Apply CSS variable overrides
  if (theme.vars) {
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }

  // Apply background colour (always sync --bg to actual background)
  const bg = theme.vars && theme.vars['--bg'];
  if (bg) {
    screen.style.background    = bg;
    document.body.style.background = bg;
    blankState.style.background = bg;
  }

  // ── Future: live background (video or image) ──────────
  // Uncomment this block when you're ready to add live backgrounds.
  // You'll also need to add <video id="bgMedia" ...> to projection.html.
  //
  // const bgMedia = document.getElementById('bgMedia');
  // if (bgMedia) {
  //   if (theme.background) {
  //     bgMedia.src   = theme.background;
  //     bgMedia.style.display = 'block';
  //     if (bgMedia.tagName === 'VIDEO') bgMedia.play();
  //     screen.style.background = 'transparent';
  //   } else {
  //     bgMedia.style.display = 'none';
  //     bgMedia.src = '';
  //   }
  // }
}

// ─────────────────────────────────────────────
// Event listeners
// ─────────────────────────────────────────────
window.hymnAPI.onDisplayBlock((data) => displayBlock(data));
window.hymnAPI.onBlankScreen(()      => blankScreen());
window.hymnAPI.onSetFontSize((size)  => applyFontSize(size));
window.hymnAPI.onApplyTheme((theme)  => applyTheme(theme));

// Start at default size and idle state
applyFontSize(100);
showIdle();
// ─────────────────────────────────────────────
// Projection Window Script
// ─────────────────────────────────────────────

const idleState    = document.getElementById('idleState');
const contentState = document.getElementById('contentState');
const blankState   = document.getElementById('blankState');
const screen       = document.getElementById('screen');

const elPageFrame    = document.getElementById('pageFrame');
const elIntroPage    = document.getElementById('introPage');
const elIntroNumber  = document.getElementById('introNumber');
const elIntroTitle   = document.getElementById('introTitle');
const elVersePage    = document.getElementById('versePage');
const elVerseMarker  = document.getElementById('verseMarker');
const elVerseText    = document.getElementById('verseText');
const elBlockCounter = document.getElementById('blockCounter');

// Non-verse blocks have no number, so they get a letter marker instead.
const MARKER_LETTERS = { refrain: 'R', chorus: 'C', bridge: 'B' };

function verseMarker(data) {
  if (MARKER_LETTERS[data.type]) return MARKER_LETTERS[data.type];
  const number = /\d+/.exec(data.label || '');
  return number ? number[0] : '';
}

// ─────────────────────────────────────────────
// Display a block
// ─────────────────────────────────────────────
function displayBlock(data) {
  if (data.type === 'intro') {
    elIntroNumber.textContent = `${data.hymnAlias || ''} ${data.hymnNumber}`.trim();
    elIntroTitle.textContent  = data.hymnTitle;
  } else {
    elVerseMarker.textContent = verseMarker(data);
    elVerseText.textContent   = data.text;
  }
  elBlockCounter.textContent = `${data.position} / ${data.total}`;

  contentState.className = `content-state type-${data.type}`;

  [elIntroNumber, elIntroTitle, elVerseMarker, elVerseText, elBlockCounter]
    .forEach(el => {
      el.style.animation = 'none';
      void el.offsetHeight;
      el.style.animation = '';
    });

  idleState.style.display    = 'none';
  blankState.style.display   = 'none';
  contentState.style.display = 'flex';

  fitPage();
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

const MIN_FIT_PX  = 12;   // never shrink below this, however much text there is

let fontScale = 1;

function applyFontSize(size) {
  fontScale = size / 100;
  fitPage();
}

// The size the operator's font setting asks for at the current window width.
function requestedFontPx() {
  const vwPx = BASE_VW * fontScale * window.innerWidth / 100;
  return Math.min(BASE_MAX_PX * fontScale, Math.max(BASE_MIN_PX * fontScale, vwPx));
}

function pageFits(page) {
  return page.offsetHeight <= elPageFrame.clientHeight
      && page.scrollWidth  <= page.clientWidth;
}

// The requested size is a ceiling: use it if the page fits the frame, otherwise
// the largest size that does. Runs on every page change, font change and resize.
function fitPage() {
  if (contentState.style.display === 'none') return;

  const page    = contentState.classList.contains('type-intro') ? elIntroPage : elVersePage;
  const setSize = px => contentState.style.setProperty('--page-font', `${px}px`);

  const requested = Math.round(requestedFontPx());
  setSize(requested);
  if (pageFits(page)) return;

  let lo = Math.min(MIN_FIT_PX, requested);
  let hi = Math.max(lo, requested - 1);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    setSize(mid);
    if (pageFits(page)) lo = mid; else hi = mid - 1;
  }
  setSize(lo);
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
window.addEventListener('resize', fitPage);

// Start at default size and idle state
applyFontSize(100);
showIdle();
// ─────────────────────────────────────────────
// Projection Window Script
// ─────────────────────────────────────────────

const idleState    = document.getElementById('idleState');
const contentState = document.getElementById('contentState');
const blankState   = document.getElementById('blankState');

const elHymnNumber  = document.getElementById('hymnNumber');
const elHymnTitle   = document.getElementById('hymnTitle');
const elBlockLabel  = document.getElementById('blockLabel');
const elVerseText   = document.getElementById('verseText');
const elBlockCounter = document.getElementById('blockCounter');

// ─────────────────────────────────────────────
// Display a block — NO cloning, just CSS animation restart
// ─────────────────────────────────────────────
function displayBlock(data) {
  // Update text content
  elHymnNumber.textContent   = `MHB ${data.hymnNumber}`;
  elHymnTitle.textContent    = data.hymnTitle;
  elBlockLabel.textContent   = data.label;
  elVerseText.textContent    = data.text;
  elBlockCounter.textContent = `${data.position} / ${data.total}`;

  // Update type class for colour (verse=white, refrain=blue, chorus=purple)
  contentState.className = `content-state type-${data.type}`;

  // Restart CSS animations without cloning
  // Remove then re-add the class that triggers animation
  [elHymnNumber, elHymnTitle, elBlockLabel, elVerseText, elBlockCounter,
   contentState.querySelector('.hymn-meta')]
    .forEach(el => {
      if (!el) return;
      el.style.animation = 'none';
      // Force reflow so the browser registers the change
      void el.offsetHeight;
      el.style.animation = '';
    });

  // Show content, hide others
  idleState.style.display    = 'none';
  blankState.style.display   = 'none';
  contentState.style.display = 'flex';
}

// ─────────────────────────────────────────────
// Blank screen
// ─────────────────────────────────────────────
function blankScreen() {
  idleState.style.display    = 'none';
  contentState.style.display = 'none';
  blankState.style.display   = 'flex';
}

// ─────────────────────────────────────────────
// Show idle state
// ─────────────────────────────────────────────
function showIdle() {
  contentState.style.display = 'none';
  blankState.style.display   = 'none';
  idleState.style.display    = 'flex';
}

// ─────────────────────────────────────────────
// Listen for events from main process
// ─────────────────────────────────────────────
window.hymnAPI.onDisplayBlock((data) => {
  displayBlock(data);
});

window.hymnAPI.onBlankScreen(() => {
  blankScreen();
});

// Start in idle state
showIdle();

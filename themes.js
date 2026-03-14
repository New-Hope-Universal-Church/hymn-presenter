/**
 * NHUC Hymn Projector — Theme Definitions
 *
 * Each theme defines CSS variable overrides applied to the projection screen.
 * To add a new theme, add an entry to THEMES and it will automatically appear
 * in the Help → Theme menu.
 *
 * Future: set `background` to a video/image URL for live backgrounds.
 * The projection.js applyTheme() function checks for this and handles it.
 */

const THEMES = {

  // ── Default — NHUC Church Colours ───────────────────
  default: {
    label:       'Default (NHUC)',
    description: 'Church colours — forest green on white',
    season:      'Ordinary Time',
    vars: {
      '--bg':           '#ffffff',
      '--text-verse':   '#08631c',   // forest green
      '--text-refrain': '#08631c',
      '--text-chorus':  '#08631c',
      '--text-meta':    '#8b0000',   // blood red
      '--text-label':   '#8b0000',
      '--accent':       '#c9a84c',   // desert gold
      '--badge-border': 'rgba(139,0,0,0.4)',
      '--title-border': 'rgba(139,0,0,0.6)',
      '--label-border': 'rgba(8,99,28,0.4)',
    },
    background: null,  // null = solid --bg colour
  },

  // ── Lent ────────────────────────────────────────────
  lent: {
    label:       'Lent',
    description: 'Purple — Ash Wednesday to Holy Saturday',
    season:      'Lent',
    vars: {
      '--bg':           '#2d0a4e',   // deep purple
      '--text-verse':   '#f0e6ff',
      '--text-refrain': '#d4b8ff',
      '--text-chorus':  '#d4b8ff',
      '--text-meta':    '#c9a84c',
      '--text-label':   '#c9a84c',
      '--accent':       '#c9a84c',
      '--badge-border': 'rgba(201,168,76,0.5)',
      '--title-border': 'rgba(201,168,76,0.5)',
      '--label-border': 'rgba(212,184,255,0.4)',
    },
    background: null,
  },

  // ── Advent ──────────────────────────────────────────
  advent: {
    label:       'Advent',
    description: 'Deep navy — four Sundays before Christmas',
    season:      'Advent',
    vars: {
      '--bg':           '#0a1628',   // deep navy
      '--text-verse':   '#e8eaf6',
      '--text-refrain': '#9fa8da',
      '--text-chorus':  '#9fa8da',
      '--text-meta':    '#7986cb',
      '--text-label':   '#7986cb',
      '--accent':       '#7986cb',   // violet
      '--badge-border': 'rgba(121,134,203,0.5)',
      '--title-border': 'rgba(121,134,203,0.5)',
      '--label-border': 'rgba(159,168,218,0.4)',
    },
    background: null,
  },

  // ── Christmas ───────────────────────────────────────
  christmas: {
    label:       'Christmas',
    description: 'Deep red & gold — Christmas Day to Epiphany',
    season:      'Christmas',
    vars: {
      '--bg':           '#5c0a0a',   // deep red
      '--text-verse':   '#fff8e7',
      '--text-refrain': '#ffd54f',
      '--text-chorus':  '#ffd54f',
      '--text-meta':    '#ffd54f',
      '--text-label':   '#ffd54f',
      '--accent':       '#ffd54f',   // bright gold
      '--badge-border': 'rgba(255,213,79,0.6)',
      '--title-border': 'rgba(255,213,79,0.6)',
      '--label-border': 'rgba(255,213,79,0.4)',
    },
    background: null,
  },

  // ── Easter ──────────────────────────────────────────
  easter: {
    label:       'Easter',
    description: 'White & gold — Easter Sunday to Pentecost',
    season:      'Easter',
    vars: {
      '--bg':           '#fffdf0',   // warm bright white
      '--text-verse':   '#5c4a00',   // deep gold-brown
      '--text-refrain': '#8b6914',
      '--text-chorus':  '#8b6914',
      '--text-meta':    '#c9a84c',
      '--text-label':   '#c9a84c',
      '--accent':       '#c9a84c',
      '--badge-border': 'rgba(201,168,76,0.6)',
      '--title-border': 'rgba(201,168,76,0.6)',
      '--label-border': 'rgba(139,105,20,0.4)',
    },
    background: null,
  },

  // ── Pentecost ───────────────────────────────────────
  pentecost: {
    label:       'Pentecost',
    description: 'Fire red — Pentecost Sunday',
    season:      'Pentecost',
    vars: {
      '--bg':           '#7a1a00',   // deep flame red
      '--text-verse':   '#fff3e0',
      '--text-refrain': '#ffcc80',
      '--text-chorus':  '#ffcc80',
      '--text-meta':    '#ffb74d',
      '--text-label':   '#ffb74d',
      '--accent':       '#ffb74d',   // flame orange
      '--badge-border': 'rgba(255,183,77,0.6)',
      '--title-border': 'rgba(255,183,77,0.6)',
      '--label-border': 'rgba(255,204,128,0.4)',
    },
    background: null,
  },

  // ── Good Friday ─────────────────────────────────────
  good_friday: {
    label:       'Good Friday',
    description: 'Black — Good Friday',
    season:      'Good Friday',
    vars: {
      '--bg':           '#000000',
      '--text-verse':   '#e0e0e0',
      '--text-refrain': '#bdbdbd',
      '--text-chorus':  '#bdbdbd',
      '--text-meta':    '#757575',
      '--text-label':   '#757575',
      '--accent':       '#616161',
      '--badge-border': 'rgba(97,97,97,0.5)',
      '--title-border': 'rgba(97,97,97,0.5)',
      '--label-border': 'rgba(97,97,97,0.4)',
    },
    background: null,
  },

};

const DEFAULT_THEME = 'default';

module.exports = { THEMES, DEFAULT_THEME };
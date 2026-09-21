const test   = require('node:test');
const assert = require('node:assert/strict');
const { importPageUrl } = require('../data/api');

function withUrl(value, fn) {
  const before = process.env.LYRICS_API_URL;
  if (value === undefined) delete process.env.LYRICS_API_URL; else process.env.LYRICS_API_URL = value;
  try { fn(); } finally {
    if (before === undefined) delete process.env.LYRICS_API_URL; else process.env.LYRICS_API_URL = before;
  }
}

test('the import page is the API root', () => {
  withUrl('https://lyrics.example.org', () => assert.equal(importPageUrl(), 'https://lyrics.example.org/'));
  withUrl('https://lyrics.example.org/', () => assert.equal(importPageUrl(), 'https://lyrics.example.org/'));
  withUrl('http://127.0.0.1:8000', () => assert.equal(importPageUrl(), 'http://127.0.0.1:8000/'));
});

test('anything that is not an http address is refused', () => {
  withUrl('file:///C:/Windows/System32/calc.exe', () => assert.equal(importPageUrl(), null));
  withUrl('javascript:alert(1)', () => assert.equal(importPageUrl(), null));
  withUrl('not a url', () => assert.equal(importPageUrl(), null));
});

test('an unconfigured app has no import page address', () => {
  withUrl(undefined, () => assert.equal(importPageUrl(), null));
});

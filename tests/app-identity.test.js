const test   = require('node:test');
const assert = require('node:assert/strict');
const pkg    = require('../package.json');

// The app id and package name are how Windows and the auto-updater recognise an installed copy.
// Changing them makes existing installs stop updating in place, so this fails loudly if someone does.
test('the display name is HopeSongs and the installed identity is unchanged', () => {
  assert.equal(pkg.build.productName, 'HopeSongs');
  assert.equal(pkg.build.nsis.shortcutName, 'HopeSongs');
  assert.equal(pkg.build.appId, 'com.nhuc.hymnprojector');
  assert.equal(pkg.name, 'hymn-presenter');
  assert.deepEqual(pkg.build.publish, {
    provider: 'github', owner: 'New-Hope-Universal-Church', repo: 'hymn-presenter',
  });
});

test('development files are kept out of the installer', () => {
  for (const pattern of ['!.claude/**', '!tests/**', '!dist/**']) {
    assert.ok(pkg.build.files.includes(pattern), `${pattern} should be excluded`);
  }
});

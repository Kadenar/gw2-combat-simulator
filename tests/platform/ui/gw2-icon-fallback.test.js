import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GW2_ICON_PLACEHOLDER,
  gw2BackupIconUrl,
  nextGw2IconFallback
} from '../../../js/platform/ui/gw2-icon-fallback.js';

const RENDER_ICON = 'https://render.guildwars2.com/file/617705CDC4E6D5CA0EB9F492B94B4D060F354980/1012459.png';
const BACKUP_ICON = 'https://www.qjv.dev.br/armory/data/icons/1012459.webp';

test('GW2 render icons map to the backup host by file id', () => {
  assert.equal(gw2BackupIconUrl(RENDER_ICON), BACKUP_ICON);
  assert.equal(gw2BackupIconUrl(`${RENDER_ICON}?cache=1`), BACKUP_ICON);
  assert.equal(gw2BackupIconUrl('https://wiki.guildwars2.com/images/example.png'), '');
  assert.equal(gw2BackupIconUrl('not a URL'), '');
});

test('failed GW2 icons try the backup and then the placeholder', () => {
  assert.deepEqual(nextGw2IconFallback(RENDER_ICON), {
    source: BACKUP_ICON,
    stage: 'backup'
  });
  assert.deepEqual(nextGw2IconFallback(BACKUP_ICON, 'backup'), {
    source: GW2_ICON_PLACEHOLDER,
    stage: 'placeholder'
  });
  assert.equal(nextGw2IconFallback(GW2_ICON_PLACEHOLDER, 'placeholder'), null);
});

test('non-render images do not enter the fallback chain', () => {
  assert.equal(nextGw2IconFallback('https://wiki.guildwars2.com/images/example.png'), null);
});

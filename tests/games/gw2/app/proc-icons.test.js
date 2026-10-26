import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogSkillIcon, resolveProcIcon, resolveRelicIcon } from '#gw2/app/shared/icons.js';

// Cached artwork keeps catalog order and follows the selected catalog when a patch or profession changes.
test('skill artwork preserves first matches and remains isolated between catalogs', () => {
  const original = {
    skills: [
      { name: 'Shared', icon: 'first.png' },
      { name: 'Shared', icon: 'second.png' },
      { name: 'Empty' },
      { name: 'Empty', icon: 'later.png' }
    ]
  };
  const patched = { skills: [{ name: 'Shared', icon: 'patched.png' }] };
  assert.equal(catalogSkillIcon(original, 'Shared'), 'first.png');
  assert.equal(catalogSkillIcon(original, 'Empty'), '');
  assert.equal(catalogSkillIcon(original, 'Missing'), '');
  assert.equal(catalogSkillIcon(patched, 'Shared'), 'patched.png');
  assert.equal(catalogSkillIcon(original, 'Shared'), 'first.png');
});

// Short-circuiting must retain refresh, explicit, trait, relic, proc-skill, and source-skill precedence.
test('proc artwork retains precedence through catalog lookup', () => {
  const app = {
    attributeData: { activeTraits: [{ name: 'Proc', icon: 'trait.png' }] },
    activeCatalog: {
      skills: [
        { name: 'Proc', icon: 'proc.png' },
        { name: 'Source', icon: 'source.png' }
      ]
    }
  };
  const proc = { type: 'trait_proc', skill: 'Proc', sourceSkill: 'Source', icon: 'explicit.png' };
  assert.match(resolveProcIcon(app, { ...proc, cooldownReduction: 1 }), /^data:image\/svg\+xml/);
  assert.equal(resolveProcIcon(app, proc), 'explicit.png');
  assert.equal(resolveProcIcon(app, { ...proc, icon: '' }), 'trait.png');
  assert.equal(resolveProcIcon(app, { ...proc, icon: '', type: 'skill' }), 'proc.png');
  assert.equal(resolveProcIcon(app, { ...proc, icon: '', skill: 'Missing' }), 'source.png');
  assert.equal(resolveProcIcon(app, { ...proc, icon: '', skill: 'Missing', sourceSkill: 'Missing' }), '');
  const relic = 'Relic of the Thief';
  assert.ok(resolveRelicIcon(relic));
  assert.equal(resolveProcIcon(app, { ...proc, icon: '', type: 'relic_proc', skill: relic }), resolveRelicIcon(relic));
});

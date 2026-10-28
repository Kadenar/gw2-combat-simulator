import assert from 'node:assert/strict';
import test from 'node:test';

import { resultSkillIcon } from '#gw2/app/results/skill-icons.js';
import { catalogSkillIcon, resolveProcIcon, resolveRelicIcon } from '#gw2/app/shared/icons.js';
import { patchSelectionFixture } from '#tests/helpers/patch-selection.js';

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

test('damage result rows reuse the icons shown for generated procs', () => {
  const earthIcon = 'earth.png';
  const lightningRodIcon = 'lightning-rod.png';
  const nourishmentIcon = 'nourishment.png';
  const phantasmalBladesIcon = 'phantasmal-blades.png';
  const meltdownIcon = 'meltdown.png';
  const explicitIcon = 'soul-shards.png';
  const app = {
    patch: patchSelectionFixture({
      skillsById: new Map([[123, { icon: 'gust.png' }]]),
      skills: []
    }),
    attributeData: {
      activeTraits: [
        {
          name: 'Phantasmal Blades',
          icon: phantasmalBladesIcon
        },
        {
          name: 'Lightning Rod',
          icon: lightningRodIcon
        }
      ]
    },
    results: {
      procSteps: [
        {
          type: 'sigil_proc',
          skill: 'Sigil of Earth',
          sourceSkill: 'Bladecall',
          icon: earthIcon
        },
        {
          type: 'food_proc',
          skill: 'Nourishment',
          sourceSkill: 'Bladecall',
          icon: nourishmentIcon
        },
        {
          type: 'trait_proc',
          skill: 'Phantasmal Blades',
          sourceSkill: 'Phantasmal Lancer'
        },
        {
          type: 'trait_proc',
          skill: 'Meltdown',
          sourceSkill: 'Devouring Cut',
          icon: meltdownIcon
        },
        {
          type: 'trait_proc',
          skill: 'Lightning Rod',
          sourceSkill: 'Gust'
        }
      ]
    },
    activeCatalog: { skillsById: new Map([[123, { icon: 'gust.png' }]]), skills: [] }
  };

  assert.equal(resultSkillIcon(app, { name: 'Sigil of Earth' }), earthIcon);
  assert.equal(resultSkillIcon(app, { name: 'Nourishment' }), nourishmentIcon);
  assert.equal(resultSkillIcon(app, { name: 'Phantasmal Blade' }), phantasmalBladesIcon);
  assert.equal(resultSkillIcon(app, { name: 'Cascading Corruption' }), meltdownIcon);
  assert.equal(resultSkillIcon(app, { name: 'Lightning Rod', skillId: 123, sourceId: 123 }), lightningRodIcon);
  assert.equal(resultSkillIcon(app, { name: 'Soul Shards', icon: explicitIcon }), explicitIcon);
});

test('clone attack damage rows use their weapon skill icons', () => {
  const windsIcon = 'winds-of-chaos.png';
  const etherBoltIcon = 'ether-bolt.png';
  const app = {
    patch: patchSelectionFixture({
      skills: [
        { name: 'Winds of Chaos', ...{ icon: windsIcon } },
        { name: 'Ether Bolt', ...{ icon: etherBoltIcon } }
      ]
    }),
    attributeData: { activeTraits: [] },
    results: { procSteps: [] },
    activeCatalog: {
      skills: [
        { name: 'Winds of Chaos', ...{ icon: windsIcon } },
        { name: 'Ether Bolt', ...{ icon: etherBoltIcon } }
      ]
    }
  };

  assert.equal(resultSkillIcon(app, { name: 'Clone: Winds of Chaos' }), windsIcon);
  assert.equal(resultSkillIcon(app, { name: 'Clone: Ether Bolt' }), etherBoltIcon);
});

import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { inertContainer } from '#tests/helpers/dom.js';
import { runNative } from '#tests/helpers/elementalist-simulation.js';

import { paletteView } from '#gw2/app/rotation/palette/model.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_WEAVER_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';

function weaverBuild(traits) {
  return elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Weaver', traits }
    ]
  });
}

test('Elements of Rage exposes Unravel as Weaver F5', () => {
  const build = weaverBuild('1-1-1');
  const context = {
    specialization: 'Weaver',
    build,
    catalog: elementalistProfession.catalog
  };
  const paletteGroup = paletteView(elementalistProfession, context).find(
    (group) => group.id === 'elementalist-weaver-unravel'
  );
  const skill = elementalistProfession.catalog.skillsById.get(ELEMENTALIST_WEAVER_SKILL_IDS.Unravel);

  assert.ok(paletteGroup);
  assert.equal(paletteGroup.label, 'F5');
  assert.deepEqual(paletteGroup.skillIds, [80231]);
  assert.equal(skill.name, 'Unravel');
  assert.equal(skill.type, 'Profession');
  assert.equal(skill.slot, 'Profession_5');
  assert.equal(skill.cooldown, 25);
});

test('Weaver hides Unravel without Elements of Rage', () => {
  const build = weaverBuild('1-1-2');
  const context = {
    specialization: 'Weaver',
    build,
    catalog: elementalistProfession.catalog
  };

  assert.equal(
    paletteView(elementalistProfession, context).some((group) => group.id === 'elementalist-weaver-unravel'),
    false
  );
});

test('Weaver exposes primary and secondary starting attunements', () => {
  const build = {
    ...weaverBuild('1-1-1'),
    startAttunement: 'Water',
    secondaryAttunement: 'Earth'
  };
  const controls = elementalistProfession.ui.startControls({
    specialization: 'Weaver',
    build,
    professionState: {
      [STATE.PRIMARY_ATTUNEMENT]: 'Air',
      [STATE.SECONDARY_ATTUNEMENT]: 'Fire'
    },
    catalog: elementalistProfession.catalog
  });

  assert.deepEqual(
    controls.map(({ label, buildKey, value }) => ({ label, buildKey, value })),
    [
      {
        label: 'Primary attunement',
        buildKey: 'startAttunement',
        value: 'Water'
      },
      {
        label: 'Secondary attunement',
        buildKey: 'secondaryAttunement',
        value: 'Earth'
      }
    ]
  );
  assert.deepEqual(
    controls.map((control) => control.options.map((option) => option.value)),
    [
      ['Fire', 'Water', 'Air', 'Earth'],
      ['Fire', 'Water', 'Air', 'Earth']
    ]
  );
});

test('Weaver current bar exposes a carried autoattack from the previous primary attunement', () => {
  const build = {
    ...weaverBuild('1-1-1'),
    weapons: ['Sword', 'Dagger'],
    startAttunement: 'Air',
    secondaryAttunement: 'Fire'
  };
  const airRoot = elementalistCatalog.skillsById.get(44681).id;
  const airFollowup = elementalistCatalog.skillsById.get(45259);
  const app = {
    patch: elementalistAppAdapter.profession.resolvePatch(),
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    activeCatalog: elementalistCatalog,
    weaponData: elementalistAppAdapter.weaponData,
    results: {
      planningState: {
        availability: Object.fromEntries(elementalistCatalog.skills.map((skill) => [skill.id, { ready: true }])),
        activeWeaponSet: 1,
        atSeconds: 1,
        cooldowns: {},
        // Carryover changes the active chain without changing the ammo projection.
        ammoBySkillId: {},
        profession: {
          [STATE.PRIMARY_ATTUNEMENT]: 'Fire',
          [STATE.SECONDARY_ATTUNEMENT]: 'Air',
          [STATE.AUTOATTACK_CHAINS]: { [airRoot]: airFollowup.id },
          [STATE.AUTOATTACK_CARRYOVER]: { root: airRoot, attunement: 'Air' }
        }
      }
    }
  };
  const palette = inertContainer();
  const previousDocument = globalThis.document;

  globalThis.document = {
    querySelector: () => null,
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  const currentStart = palette.innerHTML.indexOf('data-role="weaver-current-bar"');
  const currentEnd = palette.innerHTML.indexOf('utility-palette-group', currentStart);
  const currentHtml = palette.innerHTML.slice(currentStart, currentEnd);

  assert.match(currentHtml, /data-skill="Polaric Slash"/);
  assert.match(currentHtml, /data-skill="Fire Strike"/);
  assert.ok(currentHtml.indexOf('data-skill="Polaric Slash"') < currentHtml.indexOf('data-skill="Fire Strike"'));
  assert.match(currentHtml, /data-skill="Polaric Slash"[^>]*draggable="true"/);
  assert.match(currentHtml, /data-skill="Fire Strike"[^>]*draggable="true"/);
});

test('Weaver active state reads Elements of Rage at the inspected rotation point', () => {
  // Inspecting an earlier cursor must show its live buff even when the completed rotation has expired it.
  const run = (rotation) =>
    runNative({
      lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
      startAttunement: 'Air',
      secondaryAttunement: 'Fire',
      rotation
    });
  const before = run([]);
  const active = run(['Air Attunement', 3000]);
  const expired = run(['Air Attunement', 8000]);
  const snapshot = (result) =>
    elementalistProfession.ui
      .rotationStateSnapshot({
        specialization: 'Weaver',
        professionState: result.planningState.profession,
        planningState: result.planningState,
        atSeconds: result.planningState.atSeconds,
        result: expired
      })
      .filter(({ id }) => id === 'elements-of-rage');

  assert.deepEqual(snapshot(before), []);
  assert.deepEqual(snapshot(active), [
    {
      id: 'elements-of-rage',
      label: 'Elements of Rage',
      value: '5.0s',
      title: 'Time remaining in Elements of Rage'
    }
  ]);
  assert.deepEqual(snapshot(expired), []);
});

test('Weaver active state shows remaining Weave Self and Perfect Weave time', () => {
  const snapshot = elementalistProfession.ui.rotationStateSnapshot({
    specialization: 'Weaver',
    professionState: {
      [STATE.PRIMARY_ATTUNEMENT]: 'Fire',
      [STATE.SECONDARY_ATTUNEMENT]: 'Air',
      [STATE.WEAVE_SELF_UNTIL]: 12.34,
      [STATE.PERFECT_WEAVE_UNTIL]: 8.26
    },
    atSeconds: 3
  });

  assert.deepEqual(
    snapshot.filter(({ id }) => id === 'weave-self' || id === 'perfect-weave'),
    [
      {
        id: 'weave-self',
        label: 'Weave Self',
        value: '9.3s',
        title: 'Time remaining in Weave Self'
      },
      {
        id: 'perfect-weave',
        label: 'Perfect Weave',
        value: '5.3s',
        title: 'Time remaining in Perfect Weave'
      }
    ]
  );

  const expired = elementalistProfession.ui.rotationStateSnapshot({
    specialization: 'Weaver',
    professionState: { [STATE.WEAVE_SELF_UNTIL]: 3, [STATE.PERFECT_WEAVE_UNTIL]: 3 },
    atSeconds: 3
  });
  assert.equal(
    expired.some(({ id }) => id === 'weave-self' || id === 'perfect-weave'),
    false
  );
});

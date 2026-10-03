import assert from 'node:assert/strict';
import test from 'node:test';
import { createProfessionFamilyUi } from '#gw2/platform/profession-presentation/compose.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { MESMER_SKILL_IDS as MESMER } from '#gw2/professions/mesmer/data/ids.js';
import { professionTimelineMarkers } from '#gw2/app/rotation/timeline/model.js';

// New projections use the same active-module selection as the existing profession UI.
test('presentation lists include Core, the selected elite, and family contributions only', () => {
  const callbacks = ['chartApplications', 'timelineMarkers', 'timelineOverlays'];
  const slice = (id) => Object.fromEntries(callbacks.map((name) => [name, () => [{ id }]]));
  const ui = createProfessionFamilyUi({
    catalog: {
      specializations: [
        { name: 'First', elite: true },
        { name: 'Second', elite: true }
      ]
    },
    core: slice('core'),
    specializations: { First: slice('first'), Second: slice('second') },
    family: slice('family')
  });
  for (const name of callbacks) {
    assert.deepEqual(
      ui[name]({ specialization: 'First' }).map(({ id }) => id),
      ['core', 'first', 'family']
    );
    assert.deepEqual(
      ui[name]({ specialization: 'Second' }).map(({ id }) => id),
      ['core', 'second', 'family']
    );
    assert.deepEqual(
      ui[name]({ specialization: 'Core' }).map(({ id }) => id),
      ['core', 'family']
    );
  }

  assert.throws(() => normalizeProfessionUi('fixture', { timelineMarkers: [] }), /must be a function/);
});

// An elite may deliberately keep a single unlabelled bar even when Core would split variants.
test('Weaver single dual group is authoritative and utility variants follow live attunement', () => {
  const ui = elementalistProfession.ui;
  const duals = [
    { id: 1, attunement: 'Fire+Air' },
    { id: 2, attunement: 'Fire+Water' }
  ];
  assert.equal(ui.paletteWeaponGroups({ specialization: 'Weaver' }, duals), null);
  const fire = { id: 3, name: 'Utility (Fire)', attunement: 'Fire' };
  const water = { id: 4, name: 'Utility (Water)', attunement: 'Water' };
  const build = { startAttunement: 'Fire' };
  const catalog = {
    skillsByName: new Map([
      [fire.name, fire],
      [water.name, water]
    ])
  };
  assert.deepEqual(
    ui.paletteSelectedSlotSkills(
      { specialization: 'Weaver', build, catalog, professionState: { primaryAttunement: 'Water' } },
      [fire]
    ),
    [water]
  );
  assert.deepEqual(ui.paletteSelectedSlotSkills({ specialization: 'Core', build, catalog }, [water]), [fire]);
  assert.equal(build.startAttunement, 'Fire');
});

// Event placement uses executed step boundaries, including exact ties and events after the last command.
test('profession markers ignore invalid steps and append after the final valid step', () => {
  const markers = [0.5, 1, 2].map((at) => ({ at, badge: 'AUTO', title: (time) => time }));
  const result = {
    steps: [
      { ri: 0, start: 500, invalid: true },
      { ri: 1, start: 1000 }
    ]
  };
  assert.deepEqual(
    professionTimelineMarkers(result, 3, markers).map(({ insertionIndex }) => insertionIndex),
    [1, 1, 3]
  );
});

// Mechanic annotations describe recorded outcomes and remain isolated to their owning profession.
test('Mesmer spend phases and Bladesworn outcomes come from the active presentation', () => {
  for (const [specialization, resource, short, phase] of [
    ['Core', 'clones', 'C', 'cast start'],
    ['Virtuoso', 'blades', 'B', 'cast end'],
    ['Troubadour', 'notes', 'N', 'cast end']
  ]) {
    const annotation = mesmerProfession.ui.timelineAnnotation({
      specialization,
      formattedTime: '',
      spend: { resource, count: 2, sourceSkill: 'Mechanic' }
    });
    assert.equal(annotation.resourceShortLabel, `2${short}`);
    assert.equal(annotation.resourceLabel, `2 ${resource} consumed at ${phase}`);
  }

  const context = {
    specialization: 'Bladesworn',
    skill: { dragonSlash: true },
    entry: { type: 'cast', skillId: 1, releaseAtCharges: 5, releaseDelayMs: 100 },
    formattedTime: '1.000s',
    spend: { resource: 'dragon charges', count: 3, maximumCharges: 10, chargingSeconds: 0.75, flowSpent: 12 }
  };
  const annotation = warriorProfession.ui.timelineAnnotation(context);
  assert.equal(annotation.outcomeMismatch, true);
  assert.equal(annotation.releaseBadge.label, '⚡5\n1.000s');
  assert.ok(annotation.details.includes('Time in Dragon Trigger: 0.750s'));
  assert.ok(annotation.details.includes('Flow spent: 12.00'));
  assert.equal(warriorProfession.ui.timelineAnnotation({ ...context, specialization: 'Core' }), null);
});

// Overlay identities retain browser storage keys while elite selection controls availability.
test('trait overlay declarations are scoped to Luminary and Berserker', () => {
  for (const [profession, specialization, id, name] of [
    [guardianProfession, 'Luminary', 'sovereign-of-light', 'Sovereign of Light'],
    [warriorProfession, 'Berserker', 'king-of-fires', 'King of Fires']
  ]) {
    const [overlay] = profession.ui.timelineOverlays({ specialization });
    assert.equal(overlay.id, id);
    assert.equal(overlay.storageKey, `gw2-rotation-overlay-${id}-procs`);
    assert.equal(overlay.matchesProc({ type: 'trait_proc', skill: name }), true);
    assert.equal(overlay.matchesProc({ type: 'skill_proc', skill: name }), false);
    assert.deepEqual(profession.ui.timelineOverlays({ specialization: 'Core' }), []);
  }
});

// Action order follows skill identity and does not depend on translated or renamed display labels.
test('Mirage orders its dodge and mirror without reordering unrelated actions', () => {
  const other = { id: 123, name: 'Other' };
  const mirror = { id: MESMER.PICK_UP_MIRAGE_MIRROR, name: 'Renamed mirror' };
  const dodge = { id: MESMER.DODGE_MIRAGE_CLOAK, name: 'Renamed dodge' };
  const skills = [other, mirror, dodge];
  assert.deepEqual(mesmerProfession.ui.paletteActionSkills({ specialization: 'Mirage' }, skills), [
    dodge,
    mirror,
    other
  ]);
  assert.deepEqual(mesmerProfession.ui.paletteActionSkills({ specialization: 'Core' }, skills), skills);
});

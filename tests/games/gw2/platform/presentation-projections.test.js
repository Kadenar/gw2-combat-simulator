import assert from 'node:assert/strict';
import test from 'node:test';

import { professionTimelineMarkers } from '#gw2/app/rotation/timeline/model.js';
import { createProfessionFamilyUi, uiSpecialization } from '#gw2/platform/profession-presentation/compose.js';
import { elementalistAttunementResourceAnchor } from '#gw2/professions/elementalist/family-presentation.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { bindGuardianCoreUi } from '#gw2/professions/guardian/core/presentation.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { mesmerCoreUi } from '#gw2/professions/mesmer/core/presentation.js';
import { MESMER_SKILL_IDS as MESMER } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { bindNecromancerCoreUi } from '#gw2/professions/necromancer/core/presentation.js';
import { bindRangerCoreUi } from '#gw2/professions/ranger/core/presentation.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { warriorCoreUi } from '#gw2/professions/warrior/core/presentation.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { professionUiFixture } from '#tests/helpers/presentation.js';

// These fixtures exercise owner selection through the complete public composer, including authoritative empty results.
test('first-match projections preserve callback-specific null and undefined decisions', () => {
  for (const decision of [null, undefined]) {
    const coreGroup = [{ id: 'core', skillIds: [1] }];
    const coreAnnotation = { badge: 'core' };
    const command = { type: 'cast', skillId: 1 };
    const ui = professionUiFixture(
      {
        paletteWeaponGroups: () => coreGroup,
        timelineAnnotation: () => coreAnnotation,
        resolvePaletteAction: () => command,
        timelineWeaponLineTransition: () => 'core',
        timelineSkillIcon: () => 'core-icon',
        eventLogRow: () => null
      },
      {
        catalog: { specializations: [{ name: 'Elite', elite: true }] },
        specializations: {
          Elite: {
            paletteWeaponGroups: () => decision,
            timelineAnnotation: () => decision,
            resolvePaletteAction: () => decision,
            timelineWeaponLineTransition: () => decision,
            timelineSkillIcon: () => '',
            eventLogRow: () => ({ label: 'elite' })
          }
        }
      }
    );
    const context = { specialization: 'Elite' };
    assert.equal(ui.paletteWeaponGroups(context, []), decision === null ? null : coreGroup);
    assert.equal(ui.timelineAnnotation(context), coreAnnotation);
    assert.equal(ui.resolvePaletteAction(context, {}), decision === null ? null : command);
    assert.equal(ui.timelineWeaponLineTransition(context), decision === null ? null : 'core');
    assert.equal(ui.timelineSkillIcon(context), 'core-icon');
    assert.equal(ui.eventLogRow(context, {}), null);
  }
});

// Scalar queries can infer an elite from the skill, while an explicit unknown selection must use Core.
test('scalar callbacks preserve inferred selection and normalize explicit Core fallbacks', () => {
  const calls = [];
  const slice = (name) => ({
    paletteOverride(context) {
      calls.push([name, context.specialization, context.config?.specialization]);
      return { message: name };
    }
  });
  const ui = professionUiFixture(slice('core'), {
    catalog: {
      specializations: [
        { name: 'Elite', elite: true },
        { name: 'Sibling', elite: true }
      ]
    },
    specializations: { Elite: slice('elite'), Sibling: slice('sibling') },
    family: slice('family')
  });
  for (const [context, skill, owners] of [
    [{}, { specialization: 'Elite' }, ['core', 'elite', 'family']],
    [{}, {}, ['core', 'elite', 'sibling', 'family']],
    [{ specialization: 'Unknown', config: { specialization: 'Elite' } }, {}, ['core', 'family']]
  ]) {
    calls.length = 0;
    assert.deepEqual(ui.paletteOverride(context, skill), { message: 'family' });
    assert.deepEqual(
      calls.map(([name]) => name),
      owners
    );

    if (context.specialization === 'Unknown') {
      assert.ok(
        calls.every(([, specialization, configSelection]) => specialization === 'Core' && configSelection === 'Core')
      );
    }
  }
});

// Each transform consumes the preceding owner's result, and unowned transforms still copy caller input.
test('palette transformations compose in Core, elite, family order without mutating input', () => {
  const callbacks = ['paletteActionSkills', 'paletteWeaponSkills', 'paletteSelectedSlotSkills'];
  const slice = (id) => Object.fromEntries(callbacks.map((name) => [name, (_context, skills) => [...skills, { id }]]));
  const ui = professionUiFixture(slice(2), {
    catalog: { specializations: [{ name: 'Elite', elite: true }] },
    specializations: { Elite: slice(3) },
    family: slice(4)
  });
  const skills = Object.freeze([{ id: 1 }]);
  const empty = professionUiFixture();
  for (const name of callbacks) {
    assert.deepEqual(
      ui[name]({ specialization: 'Elite' }, skills).map(({ id }) => id),
      [1, 2, 3, 4]
    );
    const unchanged = empty[name]({}, skills);
    assert.deepEqual(unchanged, skills);
    assert.notEqual(unchanged, skills);
  }
});

// Loadout ownership spans inactive elites too, because it describes saved build selections for the whole family.
test('complete presentation keeps one loadout owner and freezes its contract', () => {
  const loadout = { id: 'loadout' };
  const ui = professionUiFixture({}, { specializations: { Elite: { slotLoadout: loadout } } });
  assert.equal(ui.slotLoadout, loadout);
  assert.equal(Object.isFrozen(ui), true);
  assert.equal(Object.isFrozen(ui.assumptionControls), true);
  assert.equal(professionUiFixture().slotLoadout, null);
  assert.throws(
    () => professionUiFixture({ slotLoadout: loadout }, { family: { slotLoadout: loadout } }),
    /ui\.slotLoadout has multiple application owners/
  );
});

// Presentation owners share the composer's precedence, including its fallback after trimming the selected name.
test('presentation selection resolves direct and config inputs consistently', () => {
  for (const [context, expected] of [
    [undefined, 'Core'],
    [null, 'Core'],
    [{}, 'Core'],
    [{ specialization: ' Core ', config: { specialization: 'First' } }, 'Core'],
    [{ specialization: ' First ', config: { specialization: 'Second' } }, 'First'],
    [{ config: { specialization: ' First ' } }, 'First'],
    [{ specialization: '', config: { specialization: '' } }, 'Core'],
    [{ specialization: ' ', config: { specialization: 'First' } }, 'Core'],
    [{ config: { specialization: ' ' } }, 'Core']
  ]) {
    assert.equal(uiSpecialization(context), expected);
  }
});

// Derived elite selections must not expose Core's profession controls alongside the elite's own bar.
test('profession presentation slices honor normalized elite selection from every supported source', () => {
  const catalog = { skills: [], skillsById: new Map() };
  for (const [ui, elite] of [
    [warriorCoreUi, 'Berserker'],
    [mesmerCoreUi, 'Mirage'],
    [bindGuardianCoreUi(catalog), 'Firebrand'],
    [bindNecromancerCoreUi(catalog), 'Reaper'],
    [bindRangerCoreUi(catalog), 'Soulbeast']
  ]) {
    for (const context of [{ specialization: ` ${elite} ` }, { config: { specialization: ` ${elite} ` } }])
      assert.deepEqual(ui.paletteGroups(context), [], elite);
  }

  for (const context of [{ specialization: ' Catalyst ' }, { config: { specialization: ' Catalyst ' } }])
    assert.equal(elementalistAttunementResourceAnchor(context), false);
});

// New projections use the same active-module selection as the existing profession UI.
test('presentation lists include Core, the selected elite, and family contributions only', () => {
  const callbacks = ['chartApplications', 'timelineMarkers', 'timelineOverlays'];
  const slice = (id) => Object.fromEntries(callbacks.map((name) => [name, () => [{ id }]]));
  const ui = createProfessionFamilyUi({
    professionId: 'fixture',
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
});

// An elite may deliberately keep a single unlabelled bar even when Core would split variants.
test('Weaver single dual group is authoritative and utility variants follow live attunement', () => {
  const ui = elementalistProfession.ui;
  const duals = [
    { id: 1, attunement: 'Fire+Air' },
    { id: 2, attunement: 'Fire+Water' }
  ];
  assert.equal(ui.paletteWeaponGroups({ specialization: 'Weaver' }, duals), null);
  // Equipped selector roots keep input identity while their concrete choices follow the live attunement.
  const root = { id: 3, name: 'Renamed utility', selector: { Fire: 34736, Water: 34772 } };
  const fire = { id: 34736, loadoutSkillId: root.id, name: 'Renamed fire utility', attunement: 'Fire' };
  const water = { id: 34772, loadoutSkillId: root.id, name: 'Renamed water utility', attunement: 'Water' };
  const build = { startAttunement: 'Fire' };
  const catalog = {
    skills: [root, fire, water],
    skillsById: new Map([root, fire, water].map((skill) => [skill.id, skill]))
  };
  assert.deepEqual(
    ui.paletteSelectedSlotSkills(
      { specialization: 'Weaver', build, catalog, professionState: { [STATE.PRIMARY_ATTUNEMENT]: 'Water' } },
      [root]
    ),
    [{ ...water, inputSkillId: root.id }]
  );
  assert.deepEqual(ui.paletteSelectedSlotSkills({ specialization: 'Core', build, catalog }, [root]), [
    { ...fire, inputSkillId: root.id }
  ]);
  assert.equal(build.startAttunement, 'Fire');
});

// Event placement uses executed step boundaries, including exact ties and events after the last command.
test('profession markers ignore invalid steps and append after the final valid step', () => {
  const markers = [0.5, 1, 2].map((at) => ({ at, badge: 'AUTO', title: (time) => time }));
  const result = {
    steps: [
      { rotationCommandIndex: 0, start: 500, invalid: true },
      { rotationCommandIndex: 1, start: 1000 }
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
      spend: { resource, count: 2 }
    });
    assert.equal(annotation.resourceShortLabel, `2${short}`);
    assert.equal(annotation.resourceLabel, `2 ${resource} consumed at ${phase}`);
  }

  const context = {
    specialization: 'Bladesworn',
    skill: { dragonSlash: true },
    entry: { type: 'cast', skillId: 1, releaseAtCharges: 5, releaseDelayMs: 100 },
    formattedTime: '1.000s',
    spend: { resource: 'dragon charges', count: 3, event: { maximumCharges: 10, chargingSeconds: 0.75, flowSpent: 12 } }
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

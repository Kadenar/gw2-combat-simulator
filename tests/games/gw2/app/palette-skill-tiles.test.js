import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import {
  displayedSkillTiles,
  paletteAvailability,
  paletteSkillView,
  projectPalette
} from '#gw2/app/rotation/palette/model.js';
import { paletteHtml, paletteSkillHtml } from '#gw2/app/rotation/palette/view.js';
import { armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { loadProfession, professionOptions } from '#gw2/profession-registry.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { observedRuntime, observeGw2Runtime, planningFixture } from '#tests/helpers/observed-runtime.js';
import { paletteInputFixture } from '#tests/helpers/palette.js';
import { professionUiFixture } from '#tests/helpers/presentation.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

/** Build presentation facts independently of the application lifecycle. */
function projectionInput(
  profession,
  {
    specialization = 'Core',
    professionState = {},
    flips = {},
    time = 0,
    cooldownsBySkillId = {},
    ammoBySkillId = {},
    useProfessionUi = true
  } = {}
) {
  return paletteInputFixture({
    build: profession.createBuildDefaults?.() || {},
    specialization,
    ui: useProfessionUi && profession.ui ? profession.ui : { ...professionUiFixture() },
    projectActions: profession.ui?.paletteActionSkills,
    catalog: profession.catalog,
    planning: {
      availability: {},
      atSeconds: time,
      activeWeaponSet: 1,
      cooldownsBySkillId,
      ammoBySkillId,
      profession: { ...professionState, [STATE.AVAILABLE_FLIPS]: flips }
    }
  });
}

// The dodge tile renders the projected fractional pool as endurance, without inventing ammunition.
test('Mirage dodge markup exposes projected endurance instead of ammo', async () => {
  const profession = await loadProfession('mesmer');
  const input = projectionInput(profession, {
    specialization: 'Mirage',
    professionState: { [STATE.ENDURANCE]: { value: 7.5, maximum: 100, updatedAt: 0, unitsPerSecond: 0 } }
  });
  const skill = profession.catalog.skillsById.get(-1);
  const markup = paletteSkillHtml(paletteSkillView(input, skill));
  assert.match(markup, /class="pal-skill-resource" data-resource-id="endurance"/);
  assert.match(markup, /aria-valuenow="7\.5"/);
  assert.doesNotMatch(markup, /pal-ammo-pip|Ammunition:|Count recharge/);
});

// The palette consumes projected deadlines while recharge storage remains in base seconds.
test('a used 20-second skill displays 16 seconds under Alacrity', () => {
  const profession = defineTestProfession({
    id: 'palette-recharge',
    name: 'Palette Recharge',
    catalog: createCanonicalCatalog({
      skills: [{ id: 990020, name: 'Recharge', type: 'Utility', castTimeMs: 0, cooldown: 20, effects: [] }]
    })
  });
  const skill = profession.catalog.skillsById.get(990020);
  for (const [alacrity, label] of [
    [false, '16.000s'],
    [true, '16.000s']
  ]) {
    const config = { boons: { alacrity } };
    const result = observeGw2Runtime({ profession: profession.runtimeFor(config), rotation: [skill.name], config });
    const input = projectionInput(profession, {
      time: result.planningState.atSeconds,
      cooldownsBySkillId: result.planningState.cooldownsBySkillId
    });
    const view = paletteSkillView(input, skill, true);
    assert.equal(view.cooldownLabel, label);
    assert.equal(view.disabled, true);
    assert.equal(observedRuntime(result).cooldownController.rechargeFor(skill.id).work, 20);
  }
});

// Tiny catalogs keep family expectations independent of the production grouping algorithm.
function catalogInput(skills, { professionState = {}, flips = {} } = {}) {
  const catalog = {
    skills,
    skillsById: new Map(skills.map((skill) => [skill.id, skill]))
  };
  return projectionInput({ catalog }, { professionState, flips, useProfessionUi: false });
}

// Display labels do not couple independent variants' countdowns, disabled states, or charge counts.
test('same-name palette skills use their own cooldown and ammo identities', () => {
  const skills = [990101, 990102].map((id) => ({ id, name: 'Shared Name', type: 'Utility', effects: [] }));
  const input = catalogInput(skills);
  input.ui.resourceViews = () => [];
  input.planning.cooldownsBySkillId = { 990101: { remainingMs: 4000, readyAtMs: 4000 } };
  input.planning.ammoBySkillId = {
    990101: { charges: 0, maximum: 2, nextRechargeAt: null },
    990102: { charges: 2, maximum: 2, nextRechargeAt: null }
  };
  const [cooling, ready] = skills.map((skill) => paletteSkillView(input, skill));
  assert.equal(cooling.cooldownLabel, '4.000s');
  assert.equal(cooling.disabled, true);
  assert.equal(cooling.ammo.current, 0);
  assert.equal(ready.cooldownLabel, '');
  assert.equal(ready.disabled, false);
  assert.equal(ready.ammo.current, 2);
});

// Startup is unknown; once observed, a missing candidate is a contract failure rather than permission to insert.
test('palette distinguishes startup, missing verdicts, and runtime retry boundaries', () => {
  const skill = { id: 990001, name: 'Candidate', type: 'Utility', effects: [] };
  const input = catalogInput([skill]);
  input.ui.resourceViews = () => [];
  const context = { specialization: 'Core' };
  const observation = input.planning;
  input.planning = null;
  assert.deepEqual(paletteAvailability(input, context, skill), {
    available: true,
    message: 'Runtime availability has not been evaluated yet.'
  });
  input.planning = observation;
  assert.equal(paletteAvailability(input, context, skill).available, false);
  input.planning.availability[skill.id] = {
    ready: false,
    code: 'fixture.wait',
    reason: 'Await a tick.',
    retryAt: 2
  };
  const availability = paletteAvailability(input, context, skill);
  const view = paletteSkillView(input, skill, availability.available, availability.message, availability.retryAt);
  assert.equal(view.contextDisabled, false);
  assert.equal(view.cooldownLabel, '2.000s');
  assert.match(view.castDetails, /Availability rechecked in: 2\.000s/);
  assert.equal(paletteAvailability(input, context, { ...skill, specialization: 'Bladesworn' }).available, false);
});

// Completed projection retains retries across surfaces, while weapon placement and loadout vetoes still block insertion.
test('weapon, action, loadout, and custom weapon tiles preserve runtime retries', async () => {
  for (const [id, name, config, rotation] of [
    ['thief', 'Heartseeker', { initialInitiative: 0, primaryWeapon: 'Dagger', secondaryWeapon: 'Dagger' }, []],
    ['thief', 'Dodge', {}, ['Dodge', 'Dodge']],
    [
      'revenant',
      'Phase Traversal',
      {
        initialEnergy: 0,
        selectedLegends: ['LegendaryAssassin', 'LegendaryDwarf'],
        startingLegend: 'LegendaryAssassin'
      },
      ['__combat_start']
    ],
    [
      'elementalist',
      'Dual Orbits: Fire and Water',
      { specialization: 'Weaver', primaryWeapon: 'Hammer', startAttunement: 'Fire', secondaryAttunement: 'Fire' },
      ['Flame Wheel', 'Water Attunement']
    ]
  ]) {
    const adapter = await loadProfessionAppAdapter(id);
    const profession = adapter.profession;
    const specialization = config.specialization || 'Core';
    const input = paletteInputFixture({
      ...projectionInput(profession, { specialization }),
      isSkillAvailable: adapter.isSkillAvailable,
      weaponSkillMatchesSet: adapter.weaponSkillMatchesSet,
      slotLoadout: adapter.slotLoadout,
      weaponData: adapter.weaponData,
      build: {
        ...createDefaultBuild(adapter),
        ...config,
        specializations: specialization === 'Core' ? [] : [{ name: specialization, traits: '1-1-1' }],
        weapons: [config.primaryWeapon || 'Dagger', config.secondaryWeapon || ''],
        alternateWeapons: ['Dagger', 'Dagger'],
        rotation: []
      },
      planning: simulateGw2({ profession, config: { specialization, ...config }, rotation }).planningState
    });
    const skill = input.catalog.skills.find((candidate) => candidate.name === name);
    const verdict = input.planning.availability[skill.id];
    assert.equal(verdict.ready, false, name);
    assert.ok(verdict.retryAt > input.planning.atSeconds, name);
    const projectedTiles = () => {
      const projection = projectPalette(input);
      const groups = [
        ...projection.weaponGroups,
        ...projection.renderedProfessionGroups,
        ...projection.renderedLoadoutGroups,
        projection.actionGroup,
        projection.utilityGroup
      ];
      return [...groups.flatMap((group) => group.skills), ...(projection.customWeaponPalette?.skills || [])].filter(
        (tile) => tile.skillId === skill.id
      );
    };

    const tiles = projectedTiles();
    assert.ok(tiles.length, name);
    assert.equal(tiles[0].contextDisabled, false, name);
    assert.match(tiles[0].castDetails, /Availability rechecked in:/, name);

    if (name === 'Heartseeker') {
      assert.equal(tiles[1].contextDisabled, true);
      assert.doesNotMatch(tiles[1].castDetails, /Availability rechecked in:/);
    }

    if (id === 'revenant') {
      input.slotLoadout = { ...adapter.slotLoadout, unavailableReason: () => 'Requires another loadout' };
      const denied = projectedTiles()[0];
      assert.equal(denied.contextDisabled, true);
      assert.doesNotMatch(denied.castDetails, /Availability rechecked in:/);
    }

    if (id === 'elementalist') {
      const current = tiles.find((tile) => tile.hotkeyAction);
      const reference = tiles.find((tile) => !tile.hotkeyAction);
      assert.ok(current, 'Weaver current bar retains its input');
      assert.ok(reference, 'The same skill also has a cooldown reference');
      assert.equal(reference.draggable, false);
      assert.equal(reference.contextDisabled, false);
      assert.doesNotMatch(reference.castDetails, /Availability rechecked in:/);
    }

    // The completed projection can render after its source state and hooks are no longer accessible.
    const projection = projectPalette(input);
    const expectedMarkup = paletteHtml(projection);
    for (const key of ['build', 'ui', 'tooltip', 'planning', 'catalog']) {
      Object.defineProperty(input, key, {
        get() {
          throw new Error(`Renderer read ${key}`);
        }
      });
    }

    assert.equal(paletteHtml(projection), expectedMarkup);
  }
});

// A transformed-away active row must leave swap accessible; virtual control state follows authored commands.
test('projection places weapon swap once and derives timeline controls from the rotation', async () => {
  const adapter = await loadProfessionAppAdapter('guardian');
  const input = {
    ...projectionInput(adapter.profession),
    isSkillAvailable: adapter.isSkillAvailable,
    weaponSkillMatchesSet: adapter.weaponSkillMatchesSet,
    slotLoadout: adapter.slotLoadout,
    weaponData: adapter.weaponData,
    build: {
      ...createDefaultBuild(adapter),
      weapons: ['Sword', 'Focus'],
      alternateWeapons: ['Greatsword', ''],
      rotation: []
    }
  };
  const projection = projectPalette(input);
  const swaps = (group) => group.skills.filter((tile) => tile.name === 'Swap Weapons');
  assert.equal(projection.weaponGroups.flatMap(swaps).length, 1);
  assert.equal(swaps(projection.actionGroup).length, 0);
  assert.equal(projection.timelineControls[0].skills[0].contextDisabled, false);
  assert.equal(projection.timelineControls[2].skills[0].draggable, true);

  input.ui = { ...input.ui, paletteWeaponSkills: (context, skills) => (context.weaponSet === 1 ? [] : skills) };
  input.build.rotation = [{ type: 'combat-start' }];
  const withoutActiveRow = projectPalette(input);
  assert.equal(withoutActiveRow.weaponGroups.flatMap(swaps).length, 0);
  assert.equal(swaps(withoutActiveRow.actionGroup).length, 1);
  assert.equal(withoutActiveRow.timelineControls[0].skills[0].contextDisabled, true);
});

// An active flip keeps its identity even when a resource gate denies its default command.
test('a denied follow-up stays in the shared palette slot', () => {
  const root = { id: 990010, name: 'Root', type: 'Weapon', flipSkillId: 990011 };
  const followup = { id: 990011, name: 'Follow-up', type: 'Weapon', flipParentId: 990010 };
  const input = catalogInput([root, followup], { flips: { [followup.id]: armSkillFlip({}, 0, 0, 10) } });
  input.planning.availability[followup.id] = {
    ready: false,
    code: 'fixture.cost',
    reason: 'Resource depleted.',
    retryAt: null
  };
  assert.deepEqual(
    displayedSkillTiles(input, [root, followup]).map((skill) => skill.id),
    [followup.id]
  );
});

// The synthetic button checks the same two skills its existing resolver inserts, including the current chain step.
test('Dodge + Auto derives availability from its unchanged command expansion', async () => {
  const profession = await loadProfession('revenant');
  const input = projectionInput(profession, { specialization: 'Vindicator' });
  const opener = profession.catalog.skillsById.get(29057);
  const followup = profession.catalog.skillsById.get(29256);
  const context = { specialization: 'Vindicator', activeAutoattack: followup };
  const skill = profession.ui.paletteActionSkills(context, []).find((entry) => entry.id === '__vindicator_dodge_auto');
  const availability = input.planning.availability;
  availability[SHARED_SKILL_IDS.DODGE] = { ready: true };
  availability[opener.id] = { ready: true };
  availability[followup.id] = { ready: true };
  const commands = profession.ui.resolvePaletteAction(context, { name: skill.name });
  assert.deepEqual(commands, [
    { type: 'cast', skillId: SHARED_SKILL_IDS.DODGE },
    { type: 'cast', skillId: followup.id, concurrentOffsetMs: 0 }
  ]);
  assert.deepEqual(paletteAvailability(input, context, skill), { available: true, message: '' });

  availability[SHARED_SKILL_IDS.DODGE] = {
    ready: false,
    reason: 'Recover endurance.',
    code: 'fixture.endurance',
    retryAt: 5
  };
  const retry = paletteAvailability(input, context, skill);
  assert.equal(retry.retryAt, 5);
  assert.equal(paletteSkillView(input, skill, retry.available, retry.message, retry.retryAt).contextDisabled, false);
  availability[followup.id] = { ready: false, reason: 'Weapon unavailable.', code: 'fixture.weapon', retryAt: null };
  assert.deepEqual(paletteAvailability(input, context, skill), {
    available: false,
    message: 'Weapon unavailable.',
    retryAt: null
  });
  availability[followup.id] = { ready: false, reason: 'Recharge.', code: 'fixture.cooldown', retryAt: 8 };
  assert.equal(paletteAvailability(input, context, skill).retryAt, 8);
  // Neither a ready opener nor a retryable dodge may excuse a missing verdict for the selected chain step.
  delete availability[followup.id];
  assert.equal(paletteAvailability(input, context, skill).available, false);
  availability[followup.id] = { ready: true };
  delete availability[SHARED_SKILL_IDS.DODGE];
  assert.equal(paletteAvailability(input, context, skill).available, false);
  assert.deepEqual(profession.ui.resolvePaletteAction(context, { name: skill.name }), commands);
});

// Composite admission must not turn unknown entries, empty actions, or missing ordinary verdicts into permission.
test('composite palette availability only admits owned cast actions with observed components', () => {
  const component = { id: 990001, name: 'Component', type: 'Weapon' };
  const ordinary = { id: 990002, name: 'Ordinary', type: 'Weapon' };
  const action = { id: '__fixture', name: '__fixture', type: 'Action' };
  const input = catalogInput([component, ordinary]);
  input.planning.availability[component.id] = { ready: true };
  const context = { specialization: 'Core' };
  for (const expansion of [
    undefined,
    null,
    [],
    [{ type: 'wait', durationMs: 100 }],
    [{ type: 'cast', skillId: 999 }]
  ]) {
    input.ui.resolvePaletteAction = () => expansion;
    assert.equal(paletteAvailability(input, context, action).available, false);
  }

  input.ui.resolvePaletteAction = () => [{ type: 'cast', skillId: component.id }];
  assert.equal(paletteAvailability(input, context, ordinary).available, false);
  assert.equal(paletteAvailability(input, context, action).available, true);
});

// Command editors can expose valid lower-charge releases while the default maximum-charge command is denied.
test('Dragon Slash editor access is separate from its default verdict and requires an observed candidate', async () => {
  const profession = await loadProfession('warrior');
  const input = projectionInput(profession, { specialization: 'Bladesworn' });
  input.planning = planningFixture(profession, { specialization: 'Bladesworn' }, (runtime) => {
    Object.assign(runtime.profession.specialization.state, {
      gunsaberActive: true,
      dragonTriggerActive: true,
      dragonCharges: { value: 1, maximum: 10, unitsPerSecond: 0, updatedAt: 0 },
      nextDragonChargeAt: 0
    });
  });
  const skill = profession.catalog.skills.find((skill) => skill.dragonSlash);
  const availability = paletteAvailability(
    input,
    { specialization: 'Bladesworn', professionState: input.planning.profession },
    skill
  );
  assert.equal(availability.available, false);
  assert.equal(paletteSkillView(input, skill, false, availability.message).contextDisabled, false);
  // Editor access cannot bypass a denied command unless a descriptor actually exists; lookup stays lazy.
  input.ui = { ...profession.ui, castEditor: () => null };
  assert.equal(paletteSkillView(input, skill, false).contextDisabled, true);
  input.ui.castEditor = () => ({
    prepare() {
      throw new Error('Eligibility must not prepare choices');
    }
  });
  assert.equal(paletteSkillView(input, skill, false).contextDisabled, false);
  delete input.planning.availability[skill.id];
  assert.equal(paletteSkillView(input, skill, false).contextDisabled, true);
});

for (const [label, skills, states] of [
  [
    'flip pair with imported next-chain evidence',
    [
      { id: 1, name: 'Root', flipSkillId: 2, nextChainId: 2 },
      { id: 2, name: 'Flip', flipParentId: 1 }
    ],
    [
      [{}, [1]],
      [{ 2: armSkillFlip({}, 0, 0) }, [2]]
    ]
  ],
  [
    'branching family',
    [
      { id: 1, name: 'Root', flipSkillId: 2 },
      { id: 2, name: 'Left', flipParentId: 1 },
      { id: 3, name: 'Right', flipParentId: 1 }
    ],
    [
      [{}, [1]],
      [{ 2: armSkillFlip({}, 0, 0) }, [2]],
      [{ 3: armSkillFlip({}, 0, 0) }, [3]]
    ]
  ]
]) {
  test(`shared ${label} selects one live tile from the full family or its root alone`, () => {
    for (const [availableFlips, expected] of states) {
      const input = catalogInput(skills, { flips: availableFlips });
      for (const candidates of [skills, [skills[0]]]) {
        assert.deepEqual(
          displayedSkillTiles(input, candidates).map((skill) => skill.id),
          expected
        );
      }
    }
  });
}

test('autoattack links, replacements, and excluded flips never expand a root-only tile', () => {
  for (const [label, parent, child] of [
    ['autoattack chain', { chainRoot: 1 }, { chainRoot: 1 }],
    ['weapon bar chain', { weaponBarChainRootId: 1 }, { weaponBarChainRootId: 1 }],
    ['ambush', {}, { ambush: true }],
    ['stealth attack', {}, { stealthAttack: true, slot: 'Weapon_1' }],
    ['unleashed ambush', {}, { unleashedAmbushSkill: true }],
    ['parent opt-out', { paletteFlip: false }, {}],
    ['child opt-out', {}, { paletteFlip: false }],
    ['excluded weapon', {}, { rotationInputExcluded: true, type: 'Weapon' }]
  ]) {
    const skills = [
      { id: 1, name: 'Root', flipSkillId: 2, ...parent },
      { id: 2, name: 'Excluded', flipParentId: 1, ...child }
    ];
    const input = catalogInput(skills, {
      flips: { 2: armSkillFlip({}, 0, 0, Infinity) },
      professionState: { [STATE.AUTOATTACK_CHAINS]: { 1: 2 } }
    });
    assert.deepEqual(
      displayedSkillTiles(input, [skills[0]]).map((skill) => skill.id),
      [1],
      label
    );
  }
});

test('every profession catalog projects tiles and active autoattack stages', async () => {
  let autoattackFamilyCount = 0;

  for (const option of professionOptions) {
    const profession = await loadProfession(option.id);
    const baseInput = projectionInput(profession, { useProfessionUi: false });
    assert.ok(displayedSkillTiles(baseInput, profession.catalog.skills).length > 0, option.id);

    for (const chain of profession.catalog.autoattackChains) {
      const skills = chain.map((skillId) => profession.catalog.skillsById.get(skillId));
      assert.equal(displayedSkillTiles(baseInput, skills)[0].id, chain[0], `${option.id}: ${skills[0].name}`);
      for (const skill of skills) {
        const input = projectionInput(profession, {
          professionState: { [STATE.AUTOATTACK_CHAINS]: { [chain[0]]: skill.id } },
          useProfessionUi: false
        });
        assert.deepEqual(
          displayedSkillTiles(input, skills).map((candidate) => candidate.id),
          [skill.id],
          `${option.id}: ${skills[0].name} -> ${skill.name}`
        );
      }

      autoattackFamilyCount += 1;
    }
  }

  assert.ok(autoattackFamilyCount > 0);
});

test('UI-only tile declarations collapse through the same profession-neutral hook', async () => {
  let declaredFamilyCount = 0;

  for (const option of professionOptions) {
    const profession = await loadProfession(option.id);
    const families = new Map();
    for (const skill of profession.catalog.skills.filter((candidate) => candidate.paletteTileId != null)) {
      const tileId = String(skill.paletteTileId);
      families.set(tileId, [...(families.get(tileId) || []), skill]);
    }

    for (const [tileId, family] of families) {
      assert.ok(family.length > 1, `${option.id}: ${tileId}`);
      assert.equal(
        displayedSkillTiles(projectionInput(profession, { useProfessionUi: false }), family).length,
        1,
        `${option.id}: ${tileId}`
      );
      declaredFamilyCount += 1;
    }
  }

  assert.ok(declaredFamilyCount > 0);
});

test('stateful transforms select one live tile across professions', async () => {
  const professions = new Map(
    await Promise.all(professionOptions.map(async (option) => [option.id, await loadProfession(option.id)]))
  );
  const cases = [
    ['necromancer', 'Core', { [STATE.ACTIVE_SHROUD]: '' }, ['Death Shroud', 'End Death Shroud'], 'Death Shroud'],
    [
      'necromancer',
      'Core',
      { [STATE.ACTIVE_SHROUD]: 'death' },
      ['Death Shroud', 'End Death Shroud'],
      'End Death Shroud'
    ],
    [
      'warrior',
      'Bladesworn',
      { [STATE.GUNSABER_ACTIVE]: false },
      ['Unsheathe Gunsaber', 'Sheathe Gunsaber'],
      'Unsheathe Gunsaber'
    ],
    [
      'warrior',
      'Bladesworn',
      { [STATE.GUNSABER_ACTIVE]: true },
      ['Unsheathe Gunsaber', 'Sheathe Gunsaber'],
      'Sheathe Gunsaber'
    ],
    [
      'engineer',
      'Holosmith',
      { [STATE.PHOTON_FORGE_ACTIVE]: false },
      ['Engage Photon Forge', 'Deactivate Photon Forge'],
      'Engage Photon Forge'
    ],
    [
      'engineer',
      'Holosmith',
      { [STATE.PHOTON_FORGE_ACTIVE]: true },
      ['Engage Photon Forge', 'Deactivate Photon Forge'],
      'Deactivate Photon Forge'
    ],
    [
      'thief',
      'Specter',
      {
        [STATE.SHADOW_CLOCK]: { value: 100, maximum: 100, updatedAt: 0, unitsPerSecond: 0 },
        [STATE.SHADOW_SHROUD_ACTIVE]: false
      },
      ['Enter Shadow Shroud'],
      'Enter Shadow Shroud'
    ],
    [
      'thief',
      'Specter',
      {
        [STATE.SHADOW_CLOCK]: { value: 100, maximum: 100, updatedAt: 0, unitsPerSecond: 0 },
        [STATE.SHADOW_SHROUD_ACTIVE]: true
      },
      ['Enter Shadow Shroud'],
      'Exit Shadow Shroud'
    ],
    [
      'ranger',
      'Druid',
      {
        [STATE.ASTRAL_CLOCK]: { value: 100, maximum: 100, updatedAt: 0, unitsPerSecond: 0 },
        [STATE.CELESTIAL_AVATAR_ENDS_AT]: null
      },
      ['Celestial Avatar'],
      'Celestial Avatar'
    ],
    [
      'ranger',
      'Druid',
      {
        [STATE.ASTRAL_CLOCK]: { value: 100, maximum: 100, updatedAt: 0, unitsPerSecond: 0 },
        [STATE.CELESTIAL_AVATAR_ENDS_AT]: 15
      },
      ['Celestial Avatar'],
      'Release Celestial Avatar'
    ],
    ['ranger', 'Untamed', { [STATE.RANGER_UNLEASHED]: false }, ['Unleash Ranger'], 'Unleash Ranger'],
    ['ranger', 'Untamed', { [STATE.RANGER_UNLEASHED]: true }, ['Unleash Ranger'], 'Unleash Pet'],
    ['ranger', 'Soulbeast', { [STATE.BEASTMODE_ACTIVE]: false }, ['Beastmode'], 'Beastmode'],
    ['ranger', 'Soulbeast', { [STATE.BEASTMODE_ACTIVE]: true }, ['Beastmode'], 'Leave Beastmode'],
    ['ranger', 'Galeshot', { [STATE.CYCLONE_BOW_ACTIVE]: false }, ['Summon Cyclone Bow'], 'Summon Cyclone Bow'],
    ['ranger', 'Galeshot', { [STATE.CYCLONE_BOW_ACTIVE]: true }, ['Summon Cyclone Bow'], 'Dismiss Cyclone Bow'],
    [
      'ranger',
      'Galeshot',
      {
        [STATE.CYCLONE_BOW_ACTIVE]: true,
        [STATE.WIND_FORCE]: { value: 0, maximum: 5, unitsPerSecond: 0, updatedAt: 0 }
      },
      ['Keen Shot'],
      'Keen Shot'
    ],
    [
      'ranger',
      'Galeshot',
      {
        [STATE.CYCLONE_BOW_ACTIVE]: true,
        [STATE.WIND_FORCE]: { value: 5, maximum: 5, unitsPerSecond: 0, updatedAt: 0 }
      },
      ['Keen Shot'],
      'Hawkeye'
    ],
    ['elementalist', 'Core', { [STATE.PRIMARY_ATTUNEMENT]: 'Earth' }, ['Rock Barrier'], 'Rock Barrier'],
    [
      'elementalist',
      'Core',
      { [STATE.PRIMARY_ATTUNEMENT]: 'Earth' },
      ['Rock Barrier'],
      'Hurl',
      { 5780: armSkillFlip({}, 0, 0, 30) }
    ],
    [
      'elementalist',
      'Core',
      { [STATE.PRIMARY_ATTUNEMENT]: 'Earth', [STATE.ACTIVE_AURAS]: [] },
      ['Magnetic Aura'],
      'Magnetic Aura'
    ],
    [
      'elementalist',
      'Core',
      { [STATE.PRIMARY_ATTUNEMENT]: 'Earth', [STATE.ACTIVE_AURAS]: [{ type: 'Magnetic Aura', expiresAt: 30 }] },
      ['Magnetic Aura'],
      'Transmute Earth'
    ],
    ['elementalist', 'Weaver', { [STATE.PERFECT_WEAVE_UNTIL]: 0 }, ['Weave Self'], 'Weave Self'],
    ['elementalist', 'Weaver', { [STATE.PERFECT_WEAVE_UNTIL]: 30 }, ['Weave Self'], 'Tailored Victory'],
    ['guardian', 'Luminary', { [STATE.RADIANT_FORGE]: false }, ['Enter Radiant Forge'], 'Enter Radiant Forge'],
    ['guardian', 'Luminary', { [STATE.RADIANT_FORGE]: true }, ['Enter Radiant Forge'], 'Exit Radiant Forge']
  ];

  for (const [professionId, specialization, state, names, expected, flips = {}] of cases) {
    const profession = professions.get(professionId);
    // Renamed labels must not change which skill ID occupies a stateful tile.
    const input = projectionInput(profession, { specialization, professionState: state, flips });
    const renamedSkills = input.catalog.skills.map((skill) => ({ ...skill, name: `Renamed ${skill.name}` }));
    // Keep every lookup consistent while isolating renamed labels from the shared profession catalog.
    input.catalog = {
      ...input.catalog,
      skills: renamedSkills,
      skillsById: new Map(renamedSkills.map((skill) => [skill.id, skill]))
    };
    const skills = names.map((name) =>
      input.catalog.skills.find(
        (skill) => skill.id === profession.catalog.skills.find((candidate) => candidate.name === name).id
      )
    );
    assert.deepEqual(
      displayedSkillTiles(input, skills).map((skill) => skill.id),
      [profession.catalog.skills.find((candidate) => candidate.name === expected).id],
      `${professionId}: ${expected}`
    );
  }
});

test('Untamed ambush tiles glow only while their window is open and recharge is ready', async () => {
  const profession = await loadProfession('ranger');
  for (const name of ['Relentless Whirl', 'Deft Strike']) {
    const skill = profession.catalog.skills.find((candidate) => candidate.name === name);
    for (const [time, rangerUnleashed, remainingMs, expected] of [
      [3.999, true, 0, true],
      [4, true, 0, false],
      [3, false, 0, false],
      [3, true, 1000, false]
    ]) {
      const context = {
        specialization: 'Untamed',
        time,
        professionState: { [STATE.RANGER_UNLEASHED]: rangerUnleashed, [STATE.AMBUSH_READY_UNTIL]: 4 }
      };
      const input = projectionInput(profession, {
        ...context,
        cooldownsBySkillId: { [skill.id]: { remainingMs, readyAtMs: 4000 } }
      });
      const planning = planningFixture(profession, { specialization: 'Untamed' }, (runtime) => {
        Object.assign(runtime.profession.specialization.state, { rangerUnleashed, ambushReadyUntil: time < 4 ? 4 : 0 });
      });
      const availability = planning.availability[skill.id];
      assert.equal(paletteSkillView(input, skill, availability.ready).highlighted, expected, name);
    }
  }
});

test('Gunsaber tile shows the shared cooldown after direct or Dragon Trigger entry from sword', async () => {
  const profession = await loadProfession('warrior');
  // Use real simulation state so the visible flip and its cooldown cannot drift apart.
  for (const entry of ['Unsheathe Gunsaber', 'Dragon Trigger']) {
    const result = simulateGw2({
      profession,
      rotation: ['__combat_start', entry],
      config: { specialization: 'Bladesworn', initialResource: 100, primaryWeapon: 'Sword' }
    });
    const input = projectionInput(profession, { specialization: 'Bladesworn' });
    input.planning = result.planningState;
    const [skill] = displayedSkillTiles(input, [profession.catalog.skillsById.get(62745)]);
    const view = paletteSkillView(input, skill);

    assert.deepEqual(result.warnings, []);
    assert.equal(skill.name, 'Sheathe Gunsaber');
    assert.equal(view.cooldownLabel, '4.000s');
    assert.equal(view.disabled, true);
  }
});

test('Rock Barrier tile shows the root cooldown after Hurl consumes the flip', async () => {
  const profession = await loadProfession('elementalist');
  const input = projectionInput(profession, {
    specialization: 'Core',
    professionState: {},
    flips: {},
    time: 1,
    cooldownsBySkillId: {
      [profession.catalog.skillsById.get(5695).id]: { remainingMs: 8000, readyAtMs: 9000 }
    }
  });
  const [skill] = displayedSkillTiles(input, [profession.catalog.skillsById.get(5695)]);
  const view = paletteSkillView(input, skill, true);

  assert.equal(skill.name, 'Rock Barrier');
  assert.equal(view.cooldownLabel, '8.000s');
  assert.match(view.castDetails, /Ready in: 8\.000s/);
  assert.equal(view.disabled, true);
});

test('cooldown tooltip reports availability relative to combat start', async () => {
  const profession = await loadProfession('necromancer');
  const skill = profession.catalog.skillsById.get(76961);
  const input = projectionInput(profession, {
    time: 14.84,
    cooldownsBySkillId: {
      [skill.id]: { remainingMs: 8160, readyAtMs: 23000 }
    }
  });
  input.combatReferenceMs = 10000;

  assert.match(paletteSkillView(input, skill).castDetails, /Ready in: 8\.160s\nAvailable at: 13\.000s/);
});

test('Holosmith Photon Forge autos are catalog autoattack chains', async () => {
  const profession = await loadProfession('engineer');
  const names = profession.catalog.autoattackChains.map((chain) =>
    chain.map((skillId) => profession.catalog.skillsById.get(skillId).name)
  );

  assert.ok(names.some((chain) => chain.join('|') === 'Light Strike|Bright Slash|Flash Cutter'));
  assert.ok(names.some((chain) => chain.join('|') === 'Light Strike-Storm|Bright Slash-Storm|Flash Cutter-Storm'));
});

test('Holosmith Forge tiles follow weapon slots for normal and Storm autos', async () => {
  const profession = await loadProfession('engineer');
  // Trait variants must preserve the same five-slot Forge layout after chain projection.
  for (const storm of [false, true]) {
    const input = projectionInput(profession, {
      specialization: 'Holosmith',
      professionState: { [STATE.PHOTON_FORGE_ACTIVE]: true }
    });
    input.build.specializations = [{ name: 'Holosmith', traits: storm ? '1-1-1' : '1-2-1' }];
    const group = profession.ui
      .paletteGroups({ specialization: 'Holosmith', build: input.build, catalog: input.catalog })
      .find((candidate) => candidate.id === 'engineer-forge');
    const tiles = displayedSkillTiles(
      input,
      group.skillIds.map((skillId) => profession.catalog.skillsById.get(skillId))
    );

    assert.deepEqual(
      tiles.map((skill) => skill.slot),
      ['Weapon_1', 'Weapon_2', 'Weapon_3', 'Weapon_4', 'Weapon_5']
    );
    assert.equal(tiles[0].name, storm ? 'Light Strike-Storm' : 'Light Strike');
  }
});

test('Herald legend-dependent True Nature variants use one shared Facet tile', async () => {
  const profession = await loadProfession('revenant');
  const project = (availableFlips) => {
    const professionState = {
      [STATE.ACTIVE_LEGEND_ID]: 'LegendaryAssassin'
    };
    const input = projectionInput(profession, {
      specialization: 'Herald',
      flips: availableFlips,
      professionState
    });
    const group = profession.ui
      .paletteGroups({
        specialization: 'Herald',
        professionState,
        build: input.build,
        catalog: profession.catalog
      })
      .find((candidate) => candidate.id === 'revenant-profession');

    return displayedSkillTiles(
      input,
      group.skillIds.map((skillId) => profession.catalog.skillsById.get(skillId))
    ).map((skill) => skill.name);
  };

  assert.deepEqual(project({}), ['Facet of Nature']);
  assert.deepEqual(project({ 51667: armSkillFlip({}, 0, 0) }), ['True Nature']);
});

// Reciprocal API references are evidence only; the catalog requires a declaration before grouping a flip tile.
test('undeclared reciprocal links never become palette flips', () => {
  const catalog = createCanonicalCatalog({
    skills: [
      { id: 990201, name: 'Parent', nextChainId: 990202, flipSkillId: 990202 },
      { id: 990202, name: 'Child', nextChainId: 990201 }
    ]
  });
  const input = projectionInput(
    { catalog },
    {
      useProfessionUi: false,
      professionState: {},
      flips: { 990202: armSkillFlip({}, 0, 0) }
    }
  );
  assert.deepEqual(
    displayedSkillTiles(input, catalog.skills).map((skill) => skill.id),
    [990201, 990202]
  );
});

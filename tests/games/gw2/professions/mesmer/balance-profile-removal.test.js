import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { mesmerTooltips } from '#gw2/professions/mesmer/app/tooltips.js';
import { mesmerCoreUi } from '#gw2/professions/mesmer/core/presentation.js';
import { mesmerProfiledShatter } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { methodOfMadnessDamage } from '#gw2/professions/mesmer/core/traits/chaos.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { createDefaultConfig, runMesmer } from '#tests/helpers/mesmer-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Minimal scenarios keep removal, patch isolation, and resource contracts independent of benchmark rotations.
function run(balanceProfiles, specialization, rotation, config = {}) {
  const profession = withPatchPreview(mesmerProfession, {
    id: 'mesmer-removal',
    label: 'Mesmer removal',
    professions: { mesmer: { balanceProfiles } }
  });
  const result = runMesmer(
    rotation,
    { ...createDefaultConfig(), specialization, initialResource: 0, patchId: 'mesmer-removal', ...config },
    { profession }
  );
  assert.deepEqual(result.warnings, []);
  return result;
}

test('shatter removal keeps surviving tier edits and the current catalog isolated', () => {
  const id = MESMER_CORE_SHATTERS[ID.MIND_WRACK].balanceProfileId;
  const catalog = applyBalanceProfilePatch(mesmerCatalog, {
    balanceProfiles: {
      [id]: {
        removeEffects: [{ type: 'strike', name: '1 resources' }],
        effects: [{ type: 'strike', name: '2 resources', coefficient: { from: 2.42, to: 7 } }]
      }
    }
  });
  const compiled = mesmerProfiledShatter({ catalog }, MESMER_CORE_SHATTERS[ID.MIND_WRACK]);
  assert.equal(compiled.strikes[1], undefined);
  assert.equal(compiled.strikes[2].coefficient, 7);
  assert.equal(mesmerCatalog.balanceProfilesById.get(id).effects[2].coefficient, 2.42);
  const result = run({ [id]: { removeEffects: [{ type: 'strike', name: '1 resources' }] } }, 'Core', ['Mind Wrack'], {
    initialResource: 1,
    selectedTraitIds: [TRAIT.MAIM_THE_DISILLUSIONED]
  });
  assert.equal(
    result.events.some((event) => event.type === 'damage' && event.skillId === ID.MIND_WRACK),
    false
  );
  assert.equal(
    result.events.some((event) => event.type === 'condition' && event.condition === 'Torment'),
    false
  );
  assert.equal(result.planningState.profession.resource, 0);
});

test('removed Virtuoso tier preserves Confusion and blade spending without hit-triggered Maim', () => {
  const result = run(
    { 'mesmer.virtuoso.bladesong-sorrow': { removeEffects: [{ type: 'strike', name: '5 resources' }] } },
    'Virtuoso',
    ['Bladesong Sorrow', { type: 'wait', durationMs: 1000 }],
    { initialResource: 5, selectedTraitIds: [TRAIT.MAIM_THE_DISILLUSIONED] }
  );
  assert.equal(
    result.events.some((event) => event.type === 'damage' && event.skillId === ID.BLADESONG_SORROW),
    false
  );
  assert.ok(result.events.some((event) => event.type === 'condition' && event.condition === 'Confusion'));
  assert.equal(
    result.events.some((event) => event.type === 'condition' && event.condition === 'Torment'),
    false
  );
  assert.equal(result.planningState.profession.resource, 0);
});

test('removed condition wrapper output leaves its shatter strike intact', () => {
  const result = run(
    { 'mesmer.core.cry-of-frustration': { removeEffects: [{ type: 'condition', name: 'Confusion' }] } },
    'Core',
    ['Cry of Frustration']
  );
  assert.ok(result.events.some((event) => event.type === 'damage' && event.skillId === ID.CRY_OF_FRUSTRATION));
  assert.equal(
    result.events.some((event) => event.type === 'condition' && event.condition === 'Confusion'),
    false
  );
});

for (const [specialization, trait, skill, attack] of [
  ['Core', TRAIT.METHOD_OF_MADNESS, 'Ether Feast', 'Lesser Chaos Storm'],
  ['Chronomancer', TRAIT.TIME_BOMB, 'Time Sink', 'Time Bomb'],
  ['Virtuoso', TRAIT.PHANTASMAL_BLADES, 'Phantasmal Swordsman', 'Phantasmal Blade']
])
  test(`${attack} removal produces neither an attack nor its proc`, () => {
    const result = run(
      { [trait]: { removeEffects: [{ type: 'strike', name: 'Strike' }] } },
      specialization,
      [skill, { type: 'wait', durationMs: 7000 }],
      { selectedTraitIds: [trait] }
    );
    assert.equal(
      result.events.some((event) => event.type === 'damage' && event.skillName === attack),
      false
    );
    assert.equal(
      result.events.some(
        (event) =>
          event.type === 'proc' &&
          event.name ===
            (attack === 'Phantasmal Blade'
              ? 'Phantasmal Blades'
              : attack === 'Lesser Chaos Storm'
                ? 'Method of Madness'
                : attack)
      ),
      false
    );
  });

// The selected trait profile owns the explosion formula and the armed window without a runtime damage copy.
test('Time Bomb trait profile edits control its explosion and delay without mutating base data', () => {
  const result = run(
    {
      [TRAIT.TIME_BOMB]: {
        fields: { durationMultiplier: { from: 5, to: 2 } },
        effects: [{ type: 'strike', name: 'Strike', coefficient: { from: 3, to: 4 } }]
      }
    },
    'Chronomancer',
    ['Time Sink', { type: 'wait', durationMs: 3000 }],
    { selectedTraitIds: [TRAIT.TIME_BOMB] }
  );
  const armed = result.events.find((event) => event.type === 'buff' && event.kind === 'time-bomb');
  const explosion = result.events.find((event) => event.type === 'damage' && event.name === 'Time Bomb');
  assert.equal(armed.duration, 2);
  assert.equal(explosion.at, armed.at + 2);
  assert.equal(explosion.coefficient, 4);
  assert.equal(explosion.balanceProfileId, TRAIT.TIME_BOMB);
  const base = mesmerCatalog.balanceProfilesById.get(TRAIT.TIME_BOMB);
  assert.equal(base.durationMultiplier, 5);
  assert.equal(base.effects.find((effect) => effect.name === 'Strike').coefficient, 3);
});

test('Mirage player and clone strikes are removed independently of their conditions', () => {
  for (const source of ['Player', 'Clone']) {
    const result = run(
      { 'mesmer.mirage.chaos-vortex': { removeEffects: [{ type: 'strike', name: `${source} attack` }] } },
      'Mirage',
      ['Dodge / Mirage Cloak', 'Chaos Vortex', { type: 'wait', durationMs: 1000 }],
      {
        primaryWeapon: 'Staff',
        secondaryWeapon: '',
        initialResource: 1,
        selectedTraitIds: [TRAIT.INFINITE_HORIZON]
      }
    );
    const ambush = result.events.filter((event) => event.skillId === ID.CHAOS_VORTEX);
    assert.equal(
      ambush.some((event) => event.type === 'damage' && event.source === source),
      false
    );
    assert.ok(ambush.some((event) => event.type === 'damage' && event.source !== source));
    assert.ok(result.events.some((event) => event.type === 'condition' && event.source === source));
  }
});

test('removed Split Surge strike preserves independent repeated boon and Vulnerability timing', () => {
  const simulate = (balanceProfiles) =>
    run(balanceProfiles, 'Mirage', ['Dodge / Mirage Cloak', 'Split Surge'], {
      primaryWeapon: 'Greatsword',
      secondaryWeapon: ''
    });
  const baseline = simulate({});
  const removed = simulate({
    'mesmer.mirage.split-surge': { removeEffects: [{ type: 'strike', name: 'Player attack' }] }
  });
  const statuses = (result) =>
    result.events
      .filter((event) => event.kind === 'might' || event.condition === 'Vulnerability')
      .map(({ at, kind, condition, stacks }) => ({ at, kind, condition, stacks }));
  assert.ok(statuses(baseline).length > 0);
  assert.deepEqual(statuses(removed), statuses(baseline));
  const catalog = applyBalanceProfilePatch(mesmerCatalog, {
    balanceProfiles: {
      'mesmer.mirage.split-surge': { removeEffects: [{ type: 'strike', name: 'Player attack' }] }
    }
  });
  const statusFacts = (catalog) =>
    mesmerTooltips.skills[ID.SPLIT_SURGE]({ catalog }, catalog.skillsById.get(ID.SPLIT_SURGE)).facts.filter(
      ({ name }) => name === 'Might' || name === 'Vulnerability'
    );
  assert.ok(statusFacts(catalog).length > 0);
  assert.deepEqual(statusFacts(catalog), statusFacts(mesmerCatalog));
  assert.equal(
    removed.events.some((event) => event.type === 'damage' && event.skillId === ID.SPLIT_SURGE),
    false
  );
});

test('removing unscoped Mirage Vulnerability does not restore it', () => {
  const result = run(
    { 'mesmer.mirage.split-surge': { removeEffects: [{ type: 'condition', name: 'Vulnerability' }] } },
    'Mirage',
    ['Dodge / Mirage Cloak', 'Split Surge'],
    { primaryWeapon: 'Greatsword', secondaryWeapon: '' }
  );
  assert.ok(result.events.some((event) => event.type === 'damage' && event.skillId === ID.SPLIT_SURGE));
  assert.equal(
    result.events.some((event) => event.type === 'condition' && event.condition === 'Vulnerability'),
    false
  );
});

test('removed Flute strike keeps conditions, note spending, and playing state', () => {
  const result = run(
    { 'mesmer.troubadour.flustering-flute': { removeEffects: [{ type: 'strike', name: 'Strike' }] } },
    'Troubadour',
    ['Flustering Flute'],
    { initialResource: 3 }
  );
  assert.equal(
    result.events.some((event) => event.type === 'damage' && event.skillId === ID.FLUSTERING_FLUTE),
    false
  );
  assert.ok(result.events.some((event) => event.type === 'condition'));
  assert.equal(result.planningState.profession.resource, 0);
  assert.ok(result.planningState.profession.activeInstruments.some(({ name }) => name === 'Flute'));
});

test('removing immediate Syncopate preserves the edited delayed wave', () => {
  const result = run(
    {
      [TRAIT.SYNCOPATE]: {
        removeEffects: [{ type: 'strike', name: 'Immediate wave' }],
        effects: [{ type: 'strike', name: 'Delayed wave', coefficient: { from: 1, to: 2 } }]
      }
    },
    'Troubadour',
    ['Deafening Drum', { type: 'wait', durationMs: 4000 }],
    { selectedTraitIds: [TRAIT.SYNCOPATE] }
  );
  const hits = result.events.filter((event) => event.type === 'damage' && event.sourceId === TRAIT.SYNCOPATE);
  assert.ok(hits.length > 0);
  assert.ok(hits.every((event) => event.damageBreakdownName === 'Syncopate (Delay Wave)' && event.coefficient === 2));
});

test('removing Chronomancer boon preserves its sibling and clone refund', () => {
  const result = run(
    { [TRAIT.STRETCHED_TIME]: { removeEffects: [{ type: 'boon', name: 'alacrity' }] } },
    'Chronomancer',
    ['Split Second'],
    {
      initialResource: 3,
      selectedTraitIds: [TRAIT.STRETCHED_TIME, TRAIT.SEIZE_THE_MOMENT, TRAIT.ILLUSIONARY_REVERSION]
    }
  );
  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.kind === 'alacrity'),
    false
  );
  assert.ok(result.events.some((event) => event.type === 'buff' && event.kind === 'quickness'));
  assert.equal(result.planningState.profession.resource, 1);
});

test('required profiles and scalars reject malformed input while optional trait fields stay absent', () => {
  const id = TRAIT.METHOD_OF_MADNESS;
  const compile = (profile) => methodOfMadnessDamage({ balanceProfile: () => profile });
  assert.throws(() => compile(undefined), /missing required profile/);
  for (const internalCooldown of [undefined, null, '', '10', NaN, Infinity]) {
    assert.throws(
      () => compile({ ...mesmerCatalog.balanceProfilesById.get(id), internalCooldown }),
      /field=internalCooldown/
    );
  }

  const compiled = compile(mesmerCatalog.balanceProfilesById.get(id));
  assert.equal(compiled.duration, undefined);
});

test('selected resource capacity is shared by simulation and presentation', () => {
  const balanceProfiles = { 'mesmer.core.resources': { fields: { maximumStacks: { from: 3, to: 0 } } } };
  const result = run(balanceProfiles, 'Core', ['Ether Bolt'], { primaryWeapon: 'Scepter', initialResource: 2 });
  assert.equal(result.planningState.profession.resource, 0);
  const catalog = applyBalanceProfilePatch(mesmerCatalog, { balanceProfiles });
  assert.equal(mesmerCoreUi.resourceViews({ catalog })[0].maximum, 0);
});

test('removing the first Fury packet keeps the edited allied packet bound to allies', () => {
  const result = run(
    {
      [TRAIT.MASTER_FENCER]: {
        removeEffects: [{ type: 'boon', name: 'Self Fury' }],
        effects: [{ type: 'boon', name: 'Allied Fury', duration: { from: 4, to: 12 } }]
      }
    },
    'Core',
    ['Ether Bolt'],
    {
      primaryWeapon: 'Scepter',
      selectedTraitIds: [TRAIT.MASTER_FENCER],
      stats: { ...createDefaultConfig().stats, precision: 4000 }
    }
  );
  const boons = result.events.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.MASTER_FENCER);
  assert.ok(boons.length > 0);
  assert.ok(boons.every((event) => event.audience.recipients === 'party' && event.duration === 12));
});

test('empty Syncopate output creates no trait damage, disable, or proc', () => {
  const result = run(
    { [TRAIT.SYNCOPATE]: { removeEffects: [{ type: 'strike', all: true }, { type: 'control' }] } },
    'Troubadour',
    ['Deafening Drum', { type: 'wait', durationMs: 4000 }],
    { selectedTraitIds: [TRAIT.SYNCOPATE] }
  );
  assert.equal(
    result.events.some((event) => event.sourceId === TRAIT.SYNCOPATE || event.name === 'Syncopate'),
    false
  );
});

test('a surviving Shredding note is independent of the removed Lute attack', () => {
  const result = run(
    { 'mesmer.troubadour.lively-lute': { removeEffects: [{ type: 'strike', name: 'Strike' }] } },
    'Troubadour',
    ['Lively Lute', { type: 'wait', durationMs: 1000 }],
    { selectedTraitIds: [TRAIT.SHREDDING] }
  );
  assert.ok(result.events.some((event) => event.type === 'damage' && event.skillId === ID.LIVELY_LUTE));
  assert.ok(result.events.some((event) => event.type === 'mesmer.instrument' && event.instrument === 'Lute'));
});

test('removed mirror window never creates pickup state and zero forge interval disables recurrence', () => {
  const mirage = run(
    { 'mesmer.mirage.mechanics': { removeEffects: [{ type: 'buff', name: 'mirage-mirror' }] } },
    'Mirage',
    ['Sand through Glass', { type: 'wait', durationMs: 1000 }]
  );
  assert.equal(observedRuntime(mirage).profession.specialization.state.mirrors.length, 0);
  const virtuoso = run(
    { [TRAIT.INFINITE_FORGE]: { fields: { pulseInterval: 0 } } },
    'Virtuoso',
    [{ type: 'wait', durationMs: 4000 }],
    { selectedTraitIds: [TRAIT.INFINITE_FORGE] }
  );
  assert.equal(virtuoso.planningState.profession.resource, 0);
});

test('tick edits survive deletion of a lower Virtuoso resource tier', () => {
  const result = run(
    {
      'mesmer.virtuoso.bladesong-harmony': {
        removeEffects: [{ type: 'strike', name: '1 resources' }],
        effects: [{ type: 'strike', name: '5 resources', tickIndex: 0, coefficient: { from: 0.7, to: 7 } }]
      }
    },
    'Virtuoso',
    ['Bladesong Harmony', { type: 'wait', durationMs: 1000 }],
    { initialResource: 5 }
  );
  const firstHit = result.events.find((event) => event.type === 'damage' && event.skillId === ID.BLADESONG_HARMONY);
  assert.equal(firstHit.coefficient, 7);
});

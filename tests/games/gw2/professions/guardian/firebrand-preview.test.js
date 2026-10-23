import assert from 'node:assert/strict';
import test from 'node:test';
import { profession, createBuildContext, toApplicationBuild } from '#gw2/professions/guardian/build/context.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { guardianTooltips } from '#gw2/professions/guardian/app/tooltips.js';
import { guardianAppAdapter } from '#gw2/professions/guardian/app/app-definition.js';
import { selectSpecialization, toggleMajorTrait } from '#gw2/app/build/panels/traits.js';
import { missingPatchTraits, selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { GUARDIAN_SKILL_IDS as SKILL, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { FIREBRAND_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/guardian/specializations/firebrand/ids.js';
import { firebrandControlAccepted } from '#gw2/professions/guardian/specializations/firebrand/mechanics/trigger-points.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';

const patchId = profession.preview.id;
const config = { specialization: 'Firebrand', patchId };
const wait = (durationMs) => ({ type: 'wait', durationMs });
const cycle = [SKILL.TOME_OF_JUSTICE, SKILL.SEARING_SPELL, SKILL.IGNITING_BURST, SKILL.HEATED_REBUKE];
const run = (rotation, overrides = {}, options = {}) =>
  runGuardian(rotation, { ...config, ...overrides }, { profession, ...options });

// Validate real composition, including traits absent from the current ruleset, before any browser starts.
test('Firebrand preview uses selected page tuning and removes old resource trait bonuses', () => {
  const previewPages = profession
    .resolvePatch({ id: patchId })
    .catalog.balanceProfilesById.get('guardian.firebrand.tome-pages');
  const livePages = profession
    .resolvePatch({ id: 'current' })
    .catalog.balanceProfilesById.get('guardian.firebrand.tome-pages');
  for (const selectedTraitIds of [[], [REWORK.BASTION], [REWORK.DELIVERANCE]]) {
    const result = run([wait(1)], { selectedTraitIds });
    assert.deepEqual(result.warnings, []);
    const pages = result.planningState.profession.tomePages;
    assert.equal(pages.maximum, previewPages.maximumStacks);
    assert.equal(pages.value, previewPages.maximumStacks);
    assert.equal(pages.interval, previewPages.pulseInterval);
  }

  assert.equal(run([wait(1)], { initialTomePages: 3 }).planningState.profession.tomePages.value, 3);
  const live = runGuardian([wait(1)], { specialization: 'Firebrand' });
  assert.equal(live.planningState.profession.tomePages.maximum, livePages.maximumStacks);
  assert.equal(
    profession.catalog.balanceProfilesById.get('guardian.firebrand.tome-pages').maximumStacks,
    livePages.maximumStacks
  );
});

test('starting page limits follow current build traits and patch without requiring simulation state', () => {
  // Saved trait positions must resolve against the selected patch before the editor clamps starting pages.
  for (const [id, traits, expectedMaximum] of [
    ['current', '3-0-0', 8],
    ['current', '0-0-0', 5],
    [patchId, '3-0-0', 8],
    [patchId, '0-0-0', 8]
  ]) {
    const patch = profession.resolvePatch({ id });
    const build = toApplicationBuild(profession.createBuildDefaults());
    build.specializations = [
      { name: 'Radiance', traits: '0-0-0' },
      { name: 'Virtues', traits: '0-0-0' },
      { name: 'Firebrand', traits }
    ];
    build.initialTomePages = 7;
    const resourceDefinitions = (specialization, professionState) =>
      profession.ui.resourceViews({ specialization, catalog: patch.catalog, build, professionState });
    const pages = resourceDefinitions('Firebrand').find(({ id }) => id === 'pages');
    assert.equal(pages.maximum, expectedMaximum);
    assert.equal(pages.startMaximum, expectedMaximum);

    const staleMaximum = expectedMaximum === 8 ? 5 : 8;
    const projectedPages = resourceDefinitions('Firebrand', {
      tomePages: { maximum: staleMaximum, value: 2 }
    }).find(({ id }) => id === 'pages');
    assert.equal(projectedPages.maximum, staleMaximum);
    assert.equal(projectedPages.value, 2);
    assert.equal(projectedPages.startMaximum, expectedMaximum);

    selectSpecialization(
      {
        adapter: guardianAppAdapter,
        activeCatalog: patch.catalog,
        build,
        resourceDefinitions,
        changed() {}
      },
      0,
      'Honor'
    );
    assert.equal(build.specializations[0].name, 'Honor');
    assert.equal(build.initialTomePages, Math.min(7, expectedMaximum));
  }
});

test('patch-specific trait positions, attributes, tooltips and authoring metadata agree', () => {
  const build = toApplicationBuild(profession.createBuildDefaults());
  build.specializations = [{ name: 'Firebrand', traits: '2-1-1', patchTraits: { [patchId]: '2-1-1' } }];
  build.assumptions.quickness = true;
  const context = (patch) =>
    createBuildContext({
      build,
      transitionDelays: normalizeTransitionDelays(),
      patch: profession.resolvePatch({ id: patch })
    });
  const preview = context(patchId);
  const live = context('current');
  const ids = preview.simulationConfig().selectedTraitIds;
  assert.ok(ids.includes(REWORK.REVELATION));
  assert.ok(ids.includes(REWORK.FERVID_CONVICTION));
  assert.ok(ids.includes(REWORK.RIGHTEOUS_FLAMES));
  assert.ok(!ids.includes(TRAIT.LIBERATORS_VOW));
  assert.ok(live.simulationConfig().selectedTraitIds.includes(TRAIT.LIBERATORS_VOW));
  assert.equal(
    live.attributes(1).attributes['Condition Damage'].final -
      preview.attributes(1).attributes['Condition Damage'].final,
    profession.resolvePatch({ id: 'current' }).catalog.balanceProfilesById.get(TRAIT.IMBUED_HASTE).attributeBonus
  );
  const balance = profession.resolvePatch({ id: patchId }).balanceContext;
  for (const trait of balance.catalog.traits.filter((entry) => entry.specialization === 'Firebrand')) {
    const tooltip = describeSimulationTrait(balance, trait, guardianTooltips, 'Firebrand');
    assert.ok(tooltip.description);
  }

  const metadata = profession.patchAuthoring.modules.find((module) => module.id === 'Firebrand');
  assert.ok(metadata.traits.some((trait) => trait.name === 'Fervid Conviction'));
  assert.ok(!metadata.traits.some((trait) => trait.name === "Liberator's Vow"));
  assert.ok(
    profession.patchOverviewFor(preview.simulationConfig(), []).some((entry) => /Provisional/.test(entry.text))
  );
});

// Saved builds are Live-based: a relaid preview line reads only its own positions and never misreads Live slots.
test('relaid preview lines read and edit their own positions while unchanged lines share Live positions', () => {
  const live = profession.resolvePatch({ id: 'current' }).catalog;
  const preview = profession.resolvePatch({ id: patchId }).catalog;
  assert.equal(live.balanceDataContext?.relaidSpecializations, undefined);
  assert.deepEqual(preview.balanceDataContext.relaidSpecializations, ['Firebrand']);

  const majors = (catalog, selection) => {
    const line = catalog.specializations.find(({ name }) => name === selection.name);
    const ids = new Set(line.majorTraits.flat().map(({ id }) => id));
    return selectedTraits(catalog, [selection])
      .map(({ id }) => id)
      .filter((id) => ids.has(id));
  };

  const firebrand = { name: 'Firebrand', traits: '1-1-2', patchTraits: { [patchId]: '2-1-1' } };
  assert.deepEqual(majors(live, firebrand), [TRAIT.UNRELENTING_CRITICISM, TRAIT.WEIGHTY_TERMS, TRAIT.QUICKFIRE]);
  assert.deepEqual(majors(preview, firebrand), [REWORK.REVELATION, REWORK.FERVID_CONVICTION, REWORK.RIGHTEOUS_FLAMES]);
  assert.deepEqual(missingPatchTraits(preview, [firebrand]), []);

  // Without its own choices the relaid line keeps its minors, selects no majors, and asks for a choice.
  const liveOnly = { name: 'Firebrand', traits: '1-1-2' };
  assert.deepEqual(majors(preview, liveOnly), []);
  assert.ok(selectedTraits(preview, [liveOnly]).some(({ id }) => id === TRAIT.SWIFT_SCHOLAR));
  assert.deepEqual(missingPatchTraits(preview, [liveOnly]), ['Firebrand']);
  assert.deepEqual(missingPatchTraits(live, [liveOnly]), []);

  const radiance = { name: 'Radiance', traits: '2-2-1' };
  assert.deepEqual(majors(preview, radiance), majors(live, radiance));

  // Preview edits on the relaid line leave Live positions intact; unchanged lines edit the shared positions.
  toggleMajorTrait(preview, liveOnly, 0, '2');
  assert.deepEqual(liveOnly, { name: 'Firebrand', traits: '1-1-2', patchTraits: { [patchId]: '2-0-0' } });
  toggleMajorTrait(live, liveOnly, 0, '2');
  assert.deepEqual(liveOnly, { name: 'Firebrand', traits: '2-1-2', patchTraits: { [patchId]: '2-0-0' } });
  toggleMajorTrait(preview, radiance, 2, '1');
  assert.deepEqual(radiance, { name: 'Radiance', traits: '2-2-0' });

  // A relaid line chosen while Preview is shown starts with default choices in both layouts.
  const build = toApplicationBuild(profession.createBuildDefaults());
  build.specializations = [
    { name: 'Radiance', traits: '0-0-0' },
    { name: 'Virtues', traits: '0-0-0' },
    { name: 'Dragonhunter', traits: '0-0-0' }
  ];
  selectSpecialization(
    {
      adapter: guardianAppAdapter,
      activeCatalog: preview,
      build,
      resourceDefinitions: (specialization) => profession.ui.resourceViews({ specialization, catalog: preview, build }),
      changed() {}
    },
    2,
    'Firebrand'
  );
  assert.deepEqual(build.specializations[2], {
    name: 'Firebrand',
    traits: '1-1-1',
    patchTraits: { [patchId]: '1-1-1' }
  });
});

test('provisional damage modifiers respect conditions, Ashes ownership, selection and Quickness expiry', () => {
  const native = profession.resolveProfession(config);
  const catalog = profession.resolvePatch({ id: patchId }).catalog;
  const context = {
    catalog,
    time: 0,
    actorType: 'player',
    config: { ...config, selectedTraitIds: [TRAIT.UNRELENTING_CRITICISM, TRAIT.IMBUED_HASTE, REWORK.RIGHTEOUS_FLAMES] },
    runtime: { boons: new Map(), buffs: new Map() }
  };
  const multiplier = (id) => 1 + catalog.balanceProfilesById.get(id).conditionDamageIncrease;
  const bleeding = 100 * multiplier(TRAIT.UNRELENTING_CRITICISM);
  const damage = (condition, sourceId = 'ordinary') =>
    native.modifyConditionDamage({ ...context, condition, sourceId }, 100);
  assert.ok(Math.abs(damage('Bleeding') - bleeding) < 1e-9);
  assert.equal(damage('Burning'), 100);
  assert.equal(damage('Burning', 'guardian.ashes-of-the-just'), 100);
  recordBuffApplication(context.runtime.boons, {
    kind: 'quickness',
    at: 0,
    duration: 2,
    stacks: 1,
    resolvedAudience: { includesSelf: true }
  });
  assert.ok(Math.abs(damage('Bleeding') - bleeding * multiplier(TRAIT.IMBUED_HASTE)) < 1e-9);
  context.time = 2;
  assert.ok(Math.abs(damage('Bleeding') - bleeding) < 1e-9);
  context.config.selectedTraitIds = [];
  assert.equal(damage('Burning', 'guardian.ashes-of-the-just'), 100);
});

// Righteous Flames changes the payload per charge for either recipient, while ordinary duration bonuses still apply.
test('Righteous Flames tunes self and allied Burning per charge only when selected', () => {
  for (const [selected, previewValues, duration, stacks] of [
    [true, {}, 3, 1],
    [true, { ashesDuration: 4, ashesStacks: 2 }, 4, 2],
    [false, { ashesDuration: 4, ashesStacks: 2 }, 2, 1]
  ]) {
    const result = run(
      [
        'Tome of Justice',
        'Epilogue: Ashes of the Just',
        'Chapter 1: Searing Spell',
        'Stow Tome',
        'True Strike',
        wait(3000)
      ],
      {
        primaryWeapon: 'Mace',
        selectedTraitIds: [TRAIT.RADIANT_FIRE, ...(selected ? [REWORK.RIGHTEOUS_FLAMES] : [])],
        previewValues,
        allies: { count: 1, strikesPerSecond: 1 }
      }
    );
    assert.deepEqual(result.warnings, []);
    const burns = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just'
    );
    assert.ok(burns.some((event) => event.metadata?.triggeredByAlly));
    assert.ok(burns.some((event) => !event.metadata?.triggeredByAlly));
    const applications = result.events.filter(
      (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just'
    );
    assert.ok(applications.length > 0);
    assert.ok(applications.every((event) => event.stacks === stacks));
    for (const burn of burns) {
      assert.equal(burn.duration, duration);
      assert.ok(Math.abs(burn.effectiveDuration - duration * 1.2) < 1e-9);
      assert.equal(burn.actorType, 'player');
    }

    const ordinary = result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillId === SKILL.SEARING_SPELL
    );
    const base = profession
      .resolvePatch({ id: patchId })
      .catalog.skillsById.get(SKILL.SEARING_SPELL)
      .effects.find((effect) => effect.type === 'condition');
    assert.equal(ordinary.duration, base.duration);
    assert.equal(ordinary.stacks, base.stacks);
    const grant = result.events.find((event) => event.kind === 'ashes-of-the-just');
    assert.equal(grant.stacks, 2);
  }
});

test('Unrelenting Criticism replaces axe procs and contributes capped bleeding duration through attributes', () => {
  const result = run(['Symbol of Vengeance', wait(1000)], {
    primaryWeapon: 'Axe',
    selectedTraitIds: [TRAIT.UNRELENTING_CRITICISM]
  });
  assert.deepEqual(result.warnings, []);
  assert.ok(!result.events.some((event) => event.triggeredBy === 'Unrelenting Criticism'));
  const build = toApplicationBuild(profession.createBuildDefaults());
  build.specializations = [{ name: 'Firebrand', traits: '0-0-0', patchTraits: { [patchId]: '1-0-0' } }];
  const attributes = createBuildContext({
    build,
    transitionDelays: normalizeTransitionDelays(),
    patch: profession.resolvePatch({ id: patchId })
  }).attributes(1);
  assert.equal(
    attributes.attributes['Bleeding Duration'].traits,
    100 *
      profession.resolvePatch({ id: patchId }).catalog.balanceProfilesById.get(TRAIT.UNRELENTING_CRITICISM)
        .conditionDurationBonus
  );
});

test('Swift Scholar refunds grant selected Ashes or Quickness while other page gains do not', () => {
  for (const trait of [REWORK.FERVID_CONVICTION, TRAIT.STALWART_SPEED]) {
    const result = run([...cycle, wait(100)], { selectedTraitIds: [trait], allies: { count: 2, strikesPerSecond: 1 } });
    assert.deepEqual(result.warnings, []);
    const awarded =
      trait === REWORK.FERVID_CONVICTION
        ? result.procSteps.some((step) => step.skill === 'Fervid Conviction')
        : result.events.some(
            (event) =>
              event.type === 'buff' &&
              event.traitId === TRAIT.STALWART_SPEED &&
              event.resolvedAudience?.alliedPlayerCount === 2
          );
    assert.ok(awarded);
    const other = run([SKILL.FLAME_RUSH, SKILL.FLAME_RUSH, SKILL.FLAME_SURGE, wait(9000)], {
      selectedTraitIds: [trait, REWORK.REVELATION],
      selectedSkillIds: [SKILL.MANTRA_OF_FLAME],
      initialTomePages: 0
    });
    assert.deepEqual(other.warnings, []);
    assert.ok(other.planningState.profession.tomePages.value > 0);
    assert.ok(!other.procSteps.some((step) => step.skill === 'Fervid Conviction'));
    assert.ok(!other.events.some((event) => event.traitId === TRAIT.STALWART_SPEED));
    assert.ok(!other.events.some((event) => event.condition === 'Slow'));
  }
});

test('Swift Scholar rewards respect trait isolation and allied Ashes retains player damage ownership', () => {
  for (const traitTriggers of [true, false]) {
    const result = run(
      [...cycle, wait(3000)],
      { selectedTraitIds: [REWORK.FERVID_CONVICTION], allies: { count: 2, strikesPerSecond: 1 } },
      { profession: { runtimeFor: (config) => profession.runtimeFor(config, { traitTriggers }) } }
    );
    assert.deepEqual(result.warnings, []);
    const alliedBurn = result.events.filter(
      (event) => event.sourceId === 'guardian.ashes-of-the-just' && event.metadata?.triggeredByAlly
    );
    assert.equal(alliedBurn.length > 0, traitTriggers);
    assert.ok(alliedBurn.every((event) => event.actorType === 'player'));
  }
});

test('Stoic Demeanor reduces only Unbroken Lines on eligible controls using selected tuning', () => {
  const tuned = withPatchPreview(guardianProfession, {
    id: 'stoic-preview',
    label: 'Stoic experiment',
    professions: {
      guardian: {
        reworks: ['firebrand-rework'],
        balanceProfiles: { [TRAIT.STOIC_DEMEANOR]: { fields: { rechargeReduction: 3 } } }
      }
    }
  });
  const reductions = [];
  const result = runGuardian(
    [SKILL.TOME_OF_COURAGE, SKILL.UNBROKEN_LINES, wait(4000)],
    {
      specialization: 'Firebrand',
      patchId: 'stoic-preview',
      selectedTraitIds: [TRAIT.STOIC_DEMEANOR],
      boons: { alacrity: false }
    },
    {
      profession: tuned,
      timeline: [
        {
          at: 3,
          run(runtime) {
            for (const [actorType, condition] of [
              ['player', 'Slow'],
              ['summon', 'Immobilized'],
              ['player', 'Immobilized'],
              ['player', undefined]
            ]) {
              const before = runtime.cooldownController.readyAt(SKILL.UNBROKEN_LINES);
              runtime.fireTrigger(firebrandControlAccepted, {
                cause: { type: condition ? 'condition' : 'control', at: runtime.time, actorType, condition }
              });
              reductions.push(
                (before - runtime.cooldownController.readyAt(SKILL.UNBROKEN_LINES)) *
                  runtime.cooldownController.rate(runtime.helpers.skillsById.get(SKILL.UNBROKEN_LINES))
              );
            }
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(reductions.slice(0, 2), [0, 0]);
  assert.ok(Math.abs(reductions[2] - 3) < 1e-9);
  // A proc claim prevents duplicate controls at the same timestamp from rewarding twice.
  assert.equal(reductions[3], 0);
  assert.ok(observedRuntime(result).profession.core.virtueReadyAt.courage > 0);
});

test('module reworks reject unknown or duplicate choices and validate edits against the selected definitions', () => {
  assert.throws(() => profession.validatePatch({ reworks: ['unknown'] }), /Unknown module rework/);
  assert.throws(() => profession.validatePatch({ reworks: ['firebrand-rework', 'firebrand-rework'] }), /unique/);
  assert.throws(
    () =>
      profession.validatePatch({
        reworks: ['firebrand-rework'],
        balanceProfiles: { [TRAIT.IMBUED_HASTE]: { fields: { attributeBonus: 300 } } }
      }),
    /does not expose/
  );
  assert.equal(
    profession.validatePatch({ balanceProfiles: { [TRAIT.IMBUED_HASTE]: { fields: { attributeBonus: 300 } } } }),
    true
  );
});

// Session experiments must survive serialization to workers without mutating defaults, other tabs or saved builds.
test('experimental values select independent catalogs, attributes and worker-safe simulation configs', () => {
  const build = toApplicationBuild(profession.createBuildDefaults());
  build.specializations = [{ name: 'Firebrand', traits: '1-1-1', patchTraits: { [patchId]: '1-1-1' } }];
  const original = structuredClone(build);
  const defaultAshes = profession.resolvePatch({ id: patchId }).catalog.balanceProfilesById.get(REWORK.RIGHTEOUS_FLAMES)
    .effects[0].duration;
  const values = { bleedingDuration: 0.25, ashesDuration: 4, ashesStacks: 2, fervidCharges: 2, stalwartQuickness: 4 };
  const input = {
    build,
    patch: profession.resolvePatch({ id: patchId, values: values }),
    transitionDelays: normalizeTransitionDelays()
  };
  const context = createBuildContext(input);
  assert.equal(context.attributes(1).attributes['Bleeding Duration'].traits, 25);
  const serialized = JSON.parse(JSON.stringify(context.simulationConfig()));
  assert.deepEqual(serialized.previewValues, values);
  const selected = profession.runtimeFor(serialized).catalog;
  assert.equal(selected.balanceProfilesById.get(REWORK.RIGHTEOUS_FLAMES).effects[0].duration, 4);
  assert.equal(selected.balanceProfilesById.get(REWORK.RIGHTEOUS_FLAMES).effects[0].stacks, 2);
  assert.equal(selected.balanceProfilesById.get(REWORK.FERVID_CONVICTION).effects[0].stacks, 2);
  assert.equal(
    profession.resolvePatch({ id: patchId }).catalog.balanceProfilesById.get(REWORK.RIGHTEOUS_FLAMES).effects[0]
      .duration,
    defaultAshes
  );
  assert.deepEqual(build, original);
  values.bleedingDuration = 0.5;
  assert.equal(context.attributes(1).attributes['Bleeding Duration'].traits, 25);
  assert.equal(serialized.previewValues.bleedingDuration, 0.25);
  assert.equal(context.simulationConfig().previewValues.bleedingDuration, 0.25);
  const tooltip = describeSimulationTrait(
    profession.resolvePatch({ id: patchId, values: serialized.previewValues }).balanceContext,
    selected.traits.find((trait) => trait.id === REWORK.RIGHTEOUS_FLAMES),
    guardianTooltips,
    'Firebrand'
  );
  assert.ok(tooltip.facts.some((fact) => fact.name === 'Burning' && fact.stacks === 2 && /4s/.test(fact.detail)));
  assert.equal(
    createBuildContext({ ...input, patch: profession.resolvePatch({ id: 'current' }) }).simulationConfig()
      .previewValues,
    undefined
  );
  for (const invalid of [
    { ashesDuration: NaN },
    { ashesDuration: -1 },
    { ashesDuration: 11 },
    { ashesStacks: 0 },
    { ashesStacks: 1.5 },
    { ashesStacks: 11 },
    { fervidCharges: 0 },
    { fervidCharges: 1.5 },
    { unknown: 1 }
  ])
    assert.throws(() => profession.resolvePatch({ id: patchId, values: invalid }).catalog, /Invalid provisional value/);
});

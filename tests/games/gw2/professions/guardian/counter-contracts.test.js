import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { reactToJusticeHitWithOptions } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { createGuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { dragonhunterVirtueLifecycle } from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/virtue-effects.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { tomeStowed } from '#gw2/professions/guardian/specializations/firebrand/mechanics/trigger-points.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import { swiftScholar } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { willbenderHooks } from '#gw2/professions/guardian/specializations/willbender/hooks.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';

const hit = { at: 1, actorType: 'player', coefficient: 1, skillName: 'Strike' };
const details = { hitContext: { damage: 1 } };

test('passive Justice resets before Burning while active entitlement and cooldown preserve partial progress', () => {
  // A patched fractional threshold exposes reset semantics at the immediate reaction boundary.
  const core = createGuardianCoreState();
  core.justiceHitCount = 2;
  core.justiceActiveArmed = true;
  core.virtueReadyAt.justice = 2;
  const observations = [];
  const context = {
    helpers: applyBalanceProfilePatch(guardianCatalog, {
      balanceProfiles: { [CORE_PROFILE.justice]: { fields: { threshold: { from: 5, to: 2.5 } } } }
    }),
    traits: new Set(),
    profession: { core },
    effects: captureEffectEmissions({
      submit(event) {
        observations.push([event.sourceId, core.justiceHitCount]);
        return event;
      }
    }).effects
  };
  assert.equal(reactToJusticeHitWithOptions(context, hit, details), 'active');
  assert.equal(core.justiceActiveArmed, false);
  assert.equal(core.justiceHitCount, 2);
  assert.equal(reactToJusticeHitWithOptions(context, hit, details), null);
  assert.equal(core.justiceHitCount, 2);
  assert.equal(
    reactToJusticeHitWithOptions(
      context,
      { ...hit, at: 2, actorType: 'effect', source: 'sigil', ownerActorType: 'player' },
      details
    ),
    null
  );
  assert.equal(core.justiceHitCount, 2);
  assert.equal(reactToJusticeHitWithOptions(context, { ...hit, at: 2 }, details), 'passive');
  assert.deepEqual(observations, [
    ['guardian.justice-active', 2],
    ['guardian.justice-passive', 0]
  ]);
  assert.equal(core.justiceHitCount, 0);
  assert.equal(reactToJusticeHitWithOptions(context, { ...hit, at: 2 }, details), null);
  assert.equal(core.justiceHitCount, 1);
  assert.equal(observations.length, 2);
});

test('removed Justice effects cannot grant an outcome or consume passive progress', () => {
  // Removing an active payload still consumes its entitlement, while a removed passive payload disables its cycle.
  for (const active of [false, true]) {
    const core = createGuardianCoreState();
    core.justiceHitCount = 4;
    core.justiceActiveArmed = active;
    const emissions = captureEffectEmissions();
    const context = {
      helpers: applyBalanceProfilePatch(guardianCatalog, {
        balanceProfiles: {
          [CORE_PROFILE.justice]: {
            removeEffects: [{ type: 'condition', name: `Burning (${active ? 'active' : 'passive'})` }]
          }
        }
      }),
      traits: new Set(),
      profession: { core },
      effects: emissions.effects
    };
    assert.equal(reactToJusticeHitWithOptions(context, hit, details), null);
    assert.equal(core.justiceActiveArmed, false);
    assert.equal(core.justiceHitCount, 4);
    assert.deepEqual(emissions.events, []);
    assert.deepEqual(emissions.announcements, []);
    // A later hit can complete the surviving passive cycle; the removed active hit must not fall through to it.
    assert.equal(reactToJusticeHitWithOptions(context, hit, details), active ? 'passive' : null);
    assert.deepEqual(
      emissions.events.map((event) => event.sourceId),
      active ? ['guardian.justice-passive'] : []
    );
    assert.equal(core.justiceHitCount, active ? 0 : 4);
  }
});

test('Dragonhunter settles passive Burning and its announcement before the attributed Crippled follow-up', () => {
  // Capture submission boundaries so sorted result events cannot hide a change in immediate reaction order.
  for (const mode of ['passive', 'active', 'partial', 'cooldown', 'miss']) {
    const core = createGuardianCoreState();
    core.justiceHitCount = mode === 'partial' ? 3 : 4;
    core.justiceActiveArmed = mode === 'active';
    const order = [];
    const emissions = captureEffectEmissions({
      submit(event, delivery) {
        order.push([event.condition, core.justiceHitCount, delivery.settlement]);
        return event;
      },
      announce(request) {
        order.push([request.announcement.name, core.justiceHitCount]);
      }
    });
    const context = {
      helpers: guardianCatalog,
      time: 1,
      traits: new Set(),
      profession: { core, specialization: { kind: 'Dragonhunter' } },
      cooldownController: {
        refresh() {},
        readyAt: (id) => (mode === 'cooldown' && id === ID.SPEAR_OF_JUSTICE ? 10 : 0)
      },
      effects: emissions.effects
    };
    dragonhunterVirtueLifecycle.reactions['damage.resolved'](
      context,
      { ...hit, activationId: 'accepted-hit', causalOrder: 17 },
      { hitContext: { damage: mode === 'miss' ? 0 : 1 } }
    );
    assert.deepEqual(
      order,
      mode === 'passive'
        ? [
            ['Burning', 0, 'reaction'],
            ['Justice Passive', 0],
            ['Crippled', 0, 'reaction']
          ]
        : mode === 'active'
          ? [
              ['Burning', 4, 'reaction'],
              ['Justice Active', 4]
            ]
          : []
    );
    assert.ok(
      emissions.events.every(
        (event) =>
          event.skillId === ID.SPEAR_OF_JUSTICE &&
          event.activationId === 'accepted-hit' &&
          event.causalOrder === 17 &&
          event.at === hit.at
      )
    );
    assert.equal(core.justiceHitCount, mode === 'passive' ? 0 : 4);
    assert.equal(core.justiceActiveArmed, false);
  }
});

test('Willbender resets independent open virtues before rewards while expired virtues retain progress', () => {
  // A single accepted strike can complete multiple virtues in order without touching an expired window.
  const state = willbenderState.create();
  state.justiceUntil = 1;
  state.resolveUntil = 0.5;
  state.courageUntil = 2;
  state.virtueHitCounts = { justice: 2, resolve: 2, courage: 2 };
  const observations = [];
  const context = {
    helpers: applyBalanceProfilePatch(guardianCatalog, {
      balanceProfiles: { [TRAIT.WILLBENDER_TRAINING]: { fields: { threshold: { from: 5, to: 2.5 } } } }
    }),
    time: 1,
    traits: new Set(),
    profession: { core: createGuardianCoreState(), specialization: { kind: 'Willbender', state } },
    effects: captureEffectEmissions({
      submit(event) {
        if (event.kind === 'lethal-tempo') observations.push({ ...state.virtueHitCounts });

        return event;
      }
    }).effects
  };
  bindTriggerPoints(context, guardianProfession, { specialization: 'Willbender' });
  const react = willbenderHooks.reactions['damage.resolved'];
  react(context, { ...hit, actorType: 'effect', ownerActorType: 'player' }, details);
  assert.deepEqual(state.virtueHitCounts, { justice: 2, resolve: 2, courage: 2 });
  react(context, hit, details);
  assert.deepEqual(observations, [
    { justice: 0, resolve: 2, courage: 2 },
    { justice: 0, resolve: 2, courage: 0 }
  ]);
  assert.deepEqual(state.virtueHitCounts, { justice: 0, resolve: 2, courage: 0 });
});

test('Swift Scholar resets the page cycle on acceptance and retains the earned cast refund across stow', () => {
  // Progress belongs to a tome session; a completed cycle reserves a separate entitlement for its accepted cast.
  const helpers = applyBalanceProfilePatch(guardianCatalog, {
    balanceProfiles: { [TRAIT.SWIFT_SCHOLAR]: { fields: { minimumStacks: { from: 3, to: 2.5 } } } }
  });
  const state = firebrandState.create({ config: {}, balanceProfile: (id) => helpers.balanceProfilesById.get(id) });
  state.swiftScholarTome = 'justice';
  state.swiftScholarCount = 2;
  const grants = [];
  const context = {
    helpers,
    time: 1,
    profession: { specialization: { kind: 'Firebrand', state } },
    resourceController: { grant: (resource, amount) => grants.push([resource, amount]) },
    effects: captureEffectEmissions().effects
  };
  bindTriggerPoints(context, guardianProfession, { specialization: 'Firebrand' });
  const cast = { skill: { tome: 'justice', name: 'Page' } };
  // Exercise the compiled admission stage separately from the retained refund completion handler.
  const { onCastStart } = compileProfessionRules({
    traitTriggers: swiftScholar.triggers.map((rule) => ({ ...rule, trait: swiftScholar.id }))
  });
  onCastStart(context, { ...cast, cancelled: true });
  assert.equal(state.swiftScholarCount, 2);
  onCastStart(context, cast);
  assert.equal(state.swiftScholarCount, 0);
  assert.deepEqual(grants, []);
  context.fireTrigger(tomeStowed);
  const otherCast = { skill: { tome: 'resolve', name: 'Other page' } };
  onCastStart(context, otherCast);
  swiftScholar.lifetime.onCastCommit(context, otherCast);
  assert.deepEqual(grants, []);
  swiftScholar.lifetime.onCastCommit(context, cast);
  assert.deepEqual(grants, [['tomePages', 1]]);
  assert.equal(state.swiftScholarTome, 'resolve');
  assert.equal(state.swiftScholarCount, 1);
  onCastStart(context, { skill: { tome: 'justice', name: 'New session' } });
  assert.equal(state.swiftScholarCount, 1);
});

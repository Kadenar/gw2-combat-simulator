import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { reactToJusticeHitWithOptions } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { createGuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { resetSwiftScholar } from '#gw2/professions/guardian/specializations/firebrand/traits/behavior.js';
import { swiftScholar } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import { willbenderHooks } from '#gw2/professions/guardian/specializations/willbender/hooks.js';
import { WILLBENDER_BALANCE_PROFILE_IDS as WB_PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
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
  reactToJusticeHitWithOptions(context, hit, details);
  assert.equal(core.justiceActiveArmed, false);
  assert.equal(core.justiceHitCount, 2);
  reactToJusticeHitWithOptions(context, hit, details);
  assert.equal(core.justiceHitCount, 2);
  reactToJusticeHitWithOptions(
    context,
    { ...hit, at: 2, actorType: 'effect', source: 'sigil', ownerActorType: 'player' },
    details
  );
  assert.equal(core.justiceHitCount, 2);
  reactToJusticeHitWithOptions(context, { ...hit, at: 2 }, details);
  assert.deepEqual(observations, [
    ['guardian.justice-active', 2],
    ['guardian.justice-passive', 0]
  ]);
  assert.equal(core.justicePassiveBurns, 1);
  assert.equal(core.justiceHitCount, 0);
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
      balanceProfiles: { [WB_PROFILE.virtueWindows]: { fields: { threshold: { from: 5, to: 2.5 } } } }
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
  const react = willbenderHooks.reactions['damage.resolved'];
  react(context, { ...hit, actorType: 'effect', ownerActorType: 'player' }, details);
  assert.deepEqual(state.virtueHitCounts, { justice: 2, resolve: 2, courage: 2 });
  react(context, hit, details);
  assert.deepEqual(observations, [
    { justice: 0, resolve: 2, courage: 2 },
    { justice: 0, resolve: 2, courage: 0 }
  ]);
  assert.equal(state.triggeredVirtueEffects, 2);
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
  const cast = { skill: { tome: 'justice', name: 'Page' } };
  swiftScholar.hooks.onCastStart(context, { ...cast, cancelled: true });
  assert.equal(state.swiftScholarCount, 2);
  swiftScholar.hooks.onCastStart(context, cast);
  assert.equal(state.swiftScholarCount, 0);
  assert.deepEqual(grants, []);
  resetSwiftScholar(context);
  const otherCast = { skill: { tome: 'resolve', name: 'Other page' } };
  swiftScholar.hooks.onCastStart(context, otherCast);
  swiftScholar.hooks.onCastCommit(context, otherCast);
  assert.deepEqual(grants, []);
  swiftScholar.hooks.onCastCommit(context, cast);
  assert.deepEqual(grants, [['tomePages', 1]]);
  assert.equal(state.swiftScholarTome, 'resolve');
  assert.equal(state.swiftScholarCount, 1);
  swiftScholar.hooks.onCastStart(context, { skill: { tome: 'justice', name: 'New session' } });
  assert.equal(state.swiftScholarCount, 1);
});

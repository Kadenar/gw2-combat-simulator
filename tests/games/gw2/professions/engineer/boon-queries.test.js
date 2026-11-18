import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2ComboController } from '#gw2/platform/combos/resolution.js';
import { createMechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { resolverBoonStacks } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { createTestConditionResolution } from '#tests/helpers/condition-resolution.js';
import { createTestLiveEffects, grantTestEffect } from '#tests/helpers/live-effects.js';

// No Scope must keep its ferocity bonus through the whole live Fury pool.
test('Engineer No Scope survives overlapping Fury packet expiries', () => {
  const boons = new Map([
    ['fury', [0, 1].map((at) => ({ at, expiresAt: at + 5, stacks: 1, resolvedAudience: { includesSelf: true } }))]
  ]);
  const context = {
    config: {},
    traits: new Set([TRAIT.NO_SCOPE]),
    runtime: { liveEffects: createTestLiveEffects(boons) },
    time: 7
  };
  const combatRuntime = { config: {}, liveEffects: createTestLiveEffects(boons) };
  assert.equal(
    resolverBoonStacks(
      {
        combat: createMechanicCombatServices(combatRuntime, createTestConditionResolution(), {
          liveEffects: combatRuntime.liveEffects,
          combo: createGw2ComboController()
        })
      },
      'fury',
      1,
      7
    ),
    1
  );
  assert.equal(
    engineerProfession
      .resolveProfession({})
      .calculations.modifyAttributes({ catalog: engineerCatalog, ...context }, { ferocity: 0 }).ferocity,
    150
  );
  assert.equal(
    engineerProfession
      .resolveProfession({})
      .calculations.modifyAttributes(
        { catalog: engineerProfession.resolveProfession({}).catalog, ...context, time: 10.000001 },
        { ferocity: 0 }
      ).ferocity,
    0
  );
});

// Resolver queries use the requested event time and count only player applications.
test('Engineer boon stacks preserve permanent stacks, caps, and live visibility', () => {
  const applications = [
    { at: 0, expiresAt: 4.96, stacks: 20, resolvedAudience: { includesSelf: true } },
    { at: 5, expiresAt: 10, stacks: 3, resolvedAudience: { includesSelf: true } },
    { at: 5, expiresAt: 10, stacks: 2, resolvedAudience: { includesSelf: false, includesSummons: true } }
  ];
  const context = {
    config: { boons: { might: 4, stability: true } },
    liveEffects: createTestLiveEffects([['might', applications]])
  };
  context.combat = createMechanicCombatServices(context, createTestConditionResolution(), {
    liveEffects: context.liveEffects,
    combo: createGw2ComboController()
  });
  assert.equal(resolverBoonStacks(context, 'might', 25, 5), 7);
  assert.equal(resolverBoonStacks(context, 'might', 6, 5), 6);
  assert.equal(resolverBoonStacks(context, 'stability', 1, 5), 1);

  // An application becomes visible only after insertion, even when it shares the queried timestamp.
  grantTestEffect(context.liveEffects, {
    kind: 'might',
    at: 5,
    expiresAt: 10,
    stacks: 1,
    resolvedAudience: { includesSelf: true }
  });
  assert.equal(resolverBoonStacks(context, 'might', 25, 5), 8);
  // Accepted runtime grants arrive chronologically; later grants must not change historical queries.
  grantTestEffect(context.liveEffects, {
    kind: 'might',
    at: 6,
    expiresAt: 10,
    stacks: 10,
    resolvedAudience: { includesSelf: true }
  });
  assert.equal(resolverBoonStacks(context, 'might', 25, 5), 8);
  assert.equal(resolverBoonStacks(context, 'might', 25, 6), 18);
  assert.equal(resolverBoonStacks(context, 'might', 25, 10.000001), 4);
  const combatRuntime2 = { config: {}, liveEffects: createTestLiveEffects() };
  assert.equal(
    resolverBoonStacks(
      {
        combat: createMechanicCombatServices(combatRuntime2, createTestConditionResolution(), {
          liveEffects: combatRuntime2.liveEffects,
          combo: createGw2ComboController()
        })
      },
      'might',
      25,
      5
    ),
    0
  );
});

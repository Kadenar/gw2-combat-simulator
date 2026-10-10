import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { serratedSteel, noScope, incendiaryPowder } from '#gw2/professions/engineer/core/traits/firearms/index.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { mechanistHooks } from '#gw2/professions/engineer/specializations/mechanist/hooks.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const critical = { hitContext: { critical: { chance: 1, didCrit: true } } };
// Player procs run through their compiled strike triggers; mech procs through the Mechanist mech strike point.
const playerReaction = compileProfessionRules({
  traitTriggers: [serratedSteel, noScope, incendiaryPowder].flatMap((trait) =>
    trait.triggers.filter((rule) => rule.on === 'damage.resolved').map((rule) => ({ ...rule, trait: trait.id }))
  )
}).reactions['damage.resolved'];
const reactions = [playerReaction, mechanistHooks.reactions['damage.resolved']];

/** Exercise the real proc gates with selected profiles and isolated emission observation. */
function fixture(traits, catalog = engineerCatalog, mode = 'stochastic') {
  const order = [];
  const capture = captureEffectEmissions({
    submit: (event) => {
      order.push('packet');
      return event;
    },
    announce: () => {
      order.push('announcement');
    }
  });
  const context = {
    helpers: catalog,
    traits: new Set(traits),
    random: createSimulationRandom({ mode, seed: 37 }),
    effects: capture.effects
  };
  context.procs = createProcRegistry(() => context);
  bindTriggerPoints(context, engineerProfession, { specialization: 'Mechanist' });
  const hit = (actor, at, overrides = {}, details = critical) => {
    const before = capture.events.length;
    const event = {
      type: 'damage',
      at,
      source: 'engineer',
      sourceId: 'fixture',
      skillName: 'Trigger',
      coefficient: 1,
      actorType: actor === 'mech' ? 'summon' : actor,
      ...(actor === 'mech'
        ? {
            metadata: { engineerMech: true },
            summonOwner: 'engineer.mech',
            independentConditionOwner: true
          }
        : {}),
      ...overrides
    };
    for (const react of reactions) react(context, event, details);
    return capture.events.slice(before);
  };

  return { ...capture, context, hit, order };
}

// Interleaved companion opportunities must not advance the player's seeded stream, or vice versa.
test('Serrated Steel retains independent player and mech random progress in both modes', () => {
  for (const mode of ['deterministic', 'stochastic']) {
    for (const actor of ['player', 'mech']) {
      const isolated = fixture([TRAIT.SERRATED_STEEL], engineerCatalog, mode);
      const mixed = fixture([TRAIT.SERRATED_STEEL], engineerCatalog, mode);
      const outcomes = [];
      for (let at = 0; at < 32; at++) {
        mixed.hit(actor === 'player' ? 'mech' : 'player', at);
        const expected = isolated.hit(actor, at).length > 0;
        outcomes.push(expected);
        assert.equal(mixed.hit(actor, at).length > 0, expected);
      }

      assert.ok(outcomes.includes(true));
      assert.ok(outcomes.includes(false));
    }
  }
});

// Each actor claims only its own selected cooldown, including the exclusive ready-at boundary.
test('Incendiary Powder cooldowns remain independent and follow the selected profile', () => {
  const catalog = withProfile(engineerCatalog, TRAIT.INCENDIARY_POWDER, { internalCooldown: 4 });
  const { hit, context } = fixture([TRAIT.INCENDIARY_POWDER], catalog);
  assert.equal(hit('player', 0).length, 1);
  assert.equal(hit('mech', 1).length, 1);
  assert.equal(context.procs.deadline('incendiaryPowder.player'), 4);
  assert.equal(context.procs.deadline('incendiaryPowder.mech'), 5);
  assert.equal(hit('player', 4).length, 0);
  assert.equal(hit('mech', 4).length, 0);
  assert.equal(hit('player', 4.1).length, 1);
  assert.equal(hit('mech', 5).length, 0);
  assert.equal(hit('mech', 5.1).length, 1);
});

// Shared emissions retain profile values and actor ownership without inheriting hit annotations.
test('Firearms emissions retain player and concrete mech ownership and announcement order', () => {
  for (const [trait, name, condition] of [
    [TRAIT.SERRATED_STEEL, 'Serrated Steel', 'Bleeding'],
    [TRAIT.INCENDIARY_POWDER, 'Incendiary Powder', 'Burning']
  ]) {
    const catalog = withProfile(engineerCatalog, trait, {
      ...(trait === TRAIT.SERRATED_STEEL ? { procChance: 1 } : {}),
      effects: [{ type: 'condition', name: condition, condition, stacks: 2, duration: 7 }]
    });
    const { hit, order, announcements } = fixture([trait], catalog);
    for (const actor of ['player', 'mech']) {
      const [packet] = hit(actor, 1);
      assert.equal(packet.sourceId, trait);
      assert.equal(packet.skillName, name);
      assert.equal(packet.stacks, 2);
      assert.equal(packet.duration, 7);
      assert.equal(packet.actorType, actor === 'player' ? 'effect' : 'summon');
      assert.equal(packet.ownerActorType, actor === 'player' ? 'player' : undefined);
      assert.equal(packet.summonOwner, actor === 'mech' ? 'engineer.mech' : undefined);
      assert.equal(packet.independentConditionOwner, actor === 'mech' ? true : undefined);
      assert.equal(packet.metadata?.engineerMech, actor === 'mech' ? true : undefined);
      assert.equal(packet.coefficient, undefined);
    }

    assert.deepEqual(order, ['packet', 'announcement', 'packet', 'announcement']);
    assert.ok(announcements.every((entry) => entry.attribution.sourceId === trait));
  }
});

// Rejected actors and noncritical/zero-coefficient hits cannot claim cooldowns or consume random opportunities.
test('Firearms rejects ineligible hits and keeps effect-hit eligibility trait specific', () => {
  const catalog = withProfile(engineerCatalog, TRAIT.SERRATED_STEEL, { procChance: 1 });
  const { hit, context } = fixture([TRAIT.SERRATED_STEEL, TRAIT.INCENDIARY_POWDER], catalog);
  for (const actor of ['player', 'mech']) {
    assert.deepEqual(hit(actor, 1, { coefficient: 0 }), []);
    assert.deepEqual(hit(actor, 1, {}, { hitContext: { critical: { chance: 1, didCrit: false } } }), []);
  }

  assert.deepEqual(hit('summon', 1), []);
  assert.equal(context.procs.deadline('incendiaryPowder.player'), 0);
  assert.equal(context.procs.deadline('incendiaryPowder.mech'), 0);
  assert.deepEqual(
    hit('effect', 1).map((packet) => packet.sourceId),
    [TRAIT.SERRATED_STEEL]
  );
});

// Explicitly removed conditions produce neither a packet nor a misleading announcement for either actor.
test('Firearms respects selected profile effect removal and Serrated proc quantities', () => {
  const patched = applyBalanceProfilePatch(engineerCatalog, {
    balanceProfiles: Object.fromEntries(
      [TRAIT.SERRATED_STEEL, TRAIT.INCENDIARY_POWDER].map((id) => [
        id,
        {
          removeEffects: [{ type: 'condition', all: true }]
        }
      ])
    )
  });
  const removed = fixture(
    [TRAIT.SERRATED_STEEL, TRAIT.INCENDIARY_POWDER],
    withProfile(patched, TRAIT.SERRATED_STEEL, { procChance: 1 })
  );
  assert.deepEqual(removed.hit('player', 1), []);
  assert.deepEqual(removed.hit('mech', 1), []);
  assert.deepEqual(removed.announcements, []);
  const selected = withProfile(engineerCatalog, TRAIT.SERRATED_STEEL, {
    procChance: 1,
    effects: [{ type: 'condition', name: 'Bleeding', condition: 'Bleeding', stacks: 2, duration: 7 }]
  });
  const { hit, events } = fixture([TRAIT.SERRATED_STEEL], selected);
  hit('player', 1);
  assert.equal(events[0].stacks, 2);
  assert.equal(events[0].metadata.procCount, 1);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { damageOccurrences } from '#gw2/platform/skill-damage/list-occurrences.js';
import { executeDamageOccurrence } from '#gw2/platform/skill-damage/run-occurrence.js';
import {
  attunementChanged,
  attunementInvoked,
  attunementReentered
} from '#gw2/professions/elementalist/core/mechanics/attunement-triggers.js';
import { emitElectricDischarge } from '#gw2/professions/elementalist/core/traits/air/attunement-entry.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

const config = { specialization: 'Core', selectedTraitIds: [TRAIT.ELECTRIC_DISCHARGE] };
const native = elementalistProfession.runtimeFor(config);
const skill = native.catalog.skillsByName.get('Air Attunement');
const occurrence = damageOccurrences(native, config).find(
  (entry) => entry.id === 'profession:elementalist.ElectricDischarge'
);

/** Exercise native trigger admission and shared materialization without unrelated combat reactions. */
function fixture(catalog = native.catalog) {
  const order = [];
  const deliveries = [];
  const capture = captureEffectEmissions({
    submit(event, delivery) {
      order.push(event.type);
      deliveries.push(delivery);
      return event;
    },
    announce(request) {
      order.push('proc');
      return { ...request.announcement, type: 'proc' };
    }
  });
  let activation = 0;
  const context = {
    time: 2,
    helpers: catalog,
    traits: new Set(config.selectedTraitIds),
    combatActive: true,
    effects: capture.effects,
    combat: { allocateEffectActivation: (prefix) => `${prefix}${activation++}` }
  };
  bindTriggerPoints(context, elementalistProfession, config);
  return { ...capture, context, order, deliveries };
}

/** Each accepted entry shares payload ownership but keeps its mechanic's admission policy. */
function enter(context, point = attunementChanged, emissionCast) {
  context.fireTrigger(point, {
    at: context.time,
    skill,
    target: 'Air',
    previous: 'Fire',
    dualAttunement: false,
    claimTrait: () => true,
    emissionCast
  });
}

test('Electric Discharge respects authored critical eligibility in all entry paths and isolated execution', () => {
  for (const canCrit of [false, true]) {
    // canCrit is an authored profile field, not an exposed balance-patch edit.
    const catalog = withProfile(native.catalog, TRAIT.ELECTRIC_DISCHARGE, {
      effects: native.catalog.balanceProfilesById
        .get(TRAIT.ELECTRIC_DISCHARGE)
        .effects.map((effect) => (effect.type === 'strike' ? { ...effect, canCrit } : effect))
    });
    for (const point of [attunementChanged, attunementInvoked, attunementReentered]) {
      const { context, events } = fixture(catalog);
      enter(context, point);
      assert.equal(events.find((event) => event.type === 'damage').canCrit, canCrit);
    }

    const source = {
      ...elementalistProfession,
      runtimeFor(config, options) {
        assert.equal(options.traitTriggers, false);
        return { ...elementalistProfession.runtimeFor(config, options), catalog };
      }
    };
    const preview = executeDamageOccurrence(source, config, occurrence);
    assert.equal(preview.events.find((event) => event.type === 'damage').canCrit, canCrit);
  }
});

test('Electric Discharge shares supported patch edits and removed effects between combat and preview', () => {
  for (const removed of [[], ['strike'], ['condition'], ['strike', 'condition']]) {
    const catalog = applyBalanceProfilePatch(native.catalog, {
      balanceProfiles: {
        [TRAIT.ELECTRIC_DISCHARGE]: {
          effects: [
            { type: 'strike', name: 'Electric Discharge', coefficient: 1.25 },
            { type: 'condition', name: 'Electric Discharge', stacks: 3, duration: 7 }
          ],
          removeEffects: removed.map((type) => ({ type, name: 'Electric Discharge' }))
        }
      }
    });
    const combat = fixture(catalog);
    enter(combat.context);
    const preview = fixture(catalog);
    native.damageEffects.find((entry) => entry.id === occurrence.effect.id).emit(preview.context, {});
    const payload = (events) =>
      events.map(({ type, coefficient, canCrit, condition, stacks, duration }) => ({
        type,
        coefficient,
        canCrit,
        condition,
        stacks,
        duration
      }));
    assert.deepEqual(payload(combat.events), payload(preview.events));
    const strike = combat.events.find((event) => event.type === 'damage');
    const condition = combat.events.find((event) => event.type === 'condition');
    assert.equal(!!strike, !removed.includes('strike'));
    assert.equal(!!condition, !removed.includes('condition'));
    if (strike) assert.equal(strike.coefficient, 1.25);
    if (condition) {
      assert.equal(condition.condition, 'Vulnerability');
      assert.equal(condition.stacks, 3);
      assert.equal(condition.duration, 7);
    }

    const expectedOrder = [
      ...(strike ? ['damage'] : []),
      ...(condition ? ['condition'] : []),
      ...(strike || condition ? ['proc'] : [])
    ];
    assert.deepEqual(combat.order, expectedOrder);
    assert.deepEqual(preview.order, expectedOrder);
    for (const event of preview.events) assert.equal(event.sourceId, TRAIT.ELECTRIC_DISCHARGE);
  }
});

test('Electric Discharge retains proc identity, actor ownership and accepted cast targeting', () => {
  const { context, events, announcements, deliveries } = fixture();
  const cast = { activationId: 'cast:air', skillId: skill.id, offTarget: true };
  enter(context, attunementChanged, cast);
  const [strike, condition] = events;
  assert.equal(strike.activationId, 'elementalist.effect:0');
  assert.notEqual(strike.activationId, cast.activationId);
  assert.equal(strike.actorType, 'effect');
  assert.equal(strike.ownerActorType, 'player');
  assert.equal(strike.skillWeapon, 'Unequipped');
  assert.equal(condition.actorType, 'player');
  assert.equal(condition.activationId, cast.activationId);
  for (const event of events) {
    assert.equal(event.sourceId, skill.id);
    assert.equal(event.skillId, skill.id);
    assert.equal(event.skillName, 'Electric Discharge');
  }

  // Targeting is carried to the runtime submission boundary separately from the materialized payload.
  for (const delivery of deliveries) assert.deepEqual(delivery.cast, cast);
  assert.equal(strike.name, 'Electric Discharge');
  assert.equal(condition.name, 'Electric Discharge — Vulnerability');
  assert.equal(announcements[0].announcement.sourceSkill, skill.name);
  emitElectricDischarge(context, context.time, skill.id, cast);
  assert.equal(events[2].activationId, 'elementalist.effect:1');
});

test('Electric Discharge admission remains selected and combat-only', () => {
  for (const selected of [false, true]) {
    for (const inCombat of [false, true]) {
      const { context, events, announcements } = fixture();
      context.traits = new Set(selected ? config.selectedTraitIds : []);
      context.combatActive = inCombat;
      enter(context);
      assert.equal(events.length > 0, selected && inCombat);
      assert.equal(announcements.length > 0, selected && inCombat);
    }
  }
});

import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { boonApplicationsAt, normalizeBoonDuration } from '#gw2/platform/combat/boons.js';
import { gw2BuffApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { timedBuffAt } from '#gw2/platform/results/query.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import {
  advanceSpearIlluminationState,
  updateSpearIlluminationState
} from '#gw2/professions/guardian/core/mechanics/spear-illumination.js';
import { handleRadiantWeaponEquipped } from '#gw2/professions/guardian/specializations/luminary/traits/index.js';
import {
  handleEffulgentActivated,
  handleEffulgentDetonate,
  processLuminaryStances,
  reactToEffulgentStrike,
  replayInitialLuminaryState
} from '#gw2/professions/guardian/specializations/luminary/mechanics/stances.js';
import {
  handleLightAuraDetonate,
  handleLightAuraGrant
} from '#gw2/professions/guardian/specializations/luminary/mechanics/light-fields.js';
import {
  advanceRadiantForgeState,
  guardianRadiantForgeSkillHandlers
} from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import { luminaryModifierRules } from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge-rules.js';
import { bindLuminaryUi } from '#gw2/professions/guardian/specializations/luminary/presentation.js';
import { LUMINARY_INITIAL_STATE_SKILL_IDS } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';

const luminaryUi = bindLuminaryUi(guardianCatalog);

// Exercise lifetime owners with real profiles and prepared buff histories, independent of cast speed and cooldowns.
function contextFor(selectedTraitIds = []) {
  const config = { specialization: 'Luminary', selectedTraitIds };
  const profession = guardianProfession.resolveRuntime(config);
  const events = [];
  const emit = (event) => {
    const prepared =
      event.type === 'buff'
        ? normalizeBoonDuration({ ...event, resolvedAudience: gw2BuffApplicationRecipients(config, event) })
        : event;
    events.push(prepared);
    return prepared;
  };

  const context = {
    config,
    profession,
    catalog: profession.catalog,
    events,
    state: {
      profession: profession.createProfessionState(config),
      time: 0,
      cooldowns: new Map(),
      rechargeProgress: new Map(),
      ammo: new Map()
    },
    action: {},
    command: {},
    start: 0,
    fullEnd: 0,
    effectiveEnd: 0,
    emit,
    emitDerived: (_cause, event) => emit(event),
    queue: { enqueue: emit },
    recordProc() {},
    helpers: { skillsById: profession.catalog.skillsById },
    rechargeDurationFor: (skill) => skill.cooldown
  };
  context.cooldownController = createCooldownController({
    state: context.state,
    rechargeDuration: context.rechargeDurationFor,
    skillFor: (id) => context.catalog.skillsById.get(id)
  });
  return context;
}

test('Empowered Armaments refreshes its live remainder and shares the displayed capped deadline', () => {
  for (const at of [6.039999, 6.04, 6.040001]) {
    const context = contextFor([TRAIT.EMPOWERED_ARMAMENTS]);
    const state = context.state.profession.specialization.state;
    const skill = context.catalog.skillsById.get(ID.DAZZLING_HAMMER);
    handleRadiantWeaponEquipped(context, skill);
    assert.equal(state.empoweredArmamentsUntil, 6.04);
    context.effectiveEnd = at - 0.001;
    handleRadiantWeaponEquipped(context, skill);
    assert.equal(
      context.events.filter((event) => event.name === 'Empowered Armaments').at(-1).detail,
      at < 6.04 ? 'refreshed' : 'triggered'
    );
    assert.equal(
      state.empoweredArmamentsUntil,
      boonApplicationsAt(context.events, 'guardian-empowered-armaments', at).at(-1).expiresAt
    );
    for (let index = 0; index < 5; index += 1) handleRadiantWeaponEquipped(context, skill);
    const buff = context.events.filter((event) => event.kind === 'guardian-empowered-armaments').at(-1);
    assert.equal(buff.duration, 20);
    assert.equal(state.empoweredArmamentsUntil, boonApplicationsAt(context.events, buff.kind, at).at(-1).expiresAt);
  }
});

test('Piercing Stance extends live duration and initial armaments retain their authored replay duration', () => {
  const context = contextFor();
  const state = context.state.profession.specialization.state;
  const skill = context.catalog.skillsById.get(ID.PIERCING_STANCE);
  context.start = 0.001;
  context.fullEnd = context.effectiveEnd = 0.201;
  processLuminaryStances(context, skill);
  const first = context.events.find((event) => event.kind === 'guardian-piercing-stance');
  const firstExpiry = boonApplicationsAt(context.events, first.kind, first.at)[0].expiresAt;
  assert.equal(state.piercingStanceUntil, firstExpiry);
  context.start += 1;
  context.fullEnd += 1;
  context.effectiveEnd += 1;
  processLuminaryStances(context, skill);
  assert.equal(state.piercingStanceUntil, firstExpiry + 8);
  assert.equal(
    state.piercingStanceUntil,
    boonApplicationsAt(context.events, first.kind, context.effectiveEnd).at(-1).expiresAt
  );

  context.command.initialStateDurationMs = 14514;
  replayInitialLuminaryState(
    context,
    context.catalog.skillsById.get(LUMINARY_INITIAL_STATE_SKILL_IDS.empoweredArmaments)
  );
  const replay = context.events.find((event) => event.kind === 'guardian-empowered-armaments');
  assert.equal(replay.duration, 14.514);
  assert.equal(
    state.empoweredArmamentsUntil,
    boonApplicationsAt(context.events, replay.kind, context.start)[0].expiresAt
  );
});

test('Radiant Armaments damage and display agree through the final live microsecond and weapon replacement', () => {
  const context = contextFor([TRAIT.RADIANT_ARMAMENTS]);
  context.start = 0.001;
  handleRadiantWeaponEquipped(context, context.catalog.skillsById.get(ID.DAZZLING_HAMMER));
  const rule = luminaryModifierRules.find((entry) => entry.id === 'guardian.radiant-armaments');
  for (const time of [10.039999, 10.04, 10.040001]) {
    assert.equal(rule.when({ events: context.events, time }), time < 10.04);
    assert.equal(
      Boolean(timedBuffAt({ resolvedEvents: context.events }, 'guardian-radiant-armaments', time)),
      time < 10.04
    );
  }

  context.start = 1;
  handleRadiantWeaponEquipped(context, context.catalog.skillsById.get(ID.LUMINOUS_STAFF));
  assert.equal(rule.when({ events: context.events, time: 1 }), false);
});

test('Light Aura refreshes on the effect clock and can be consumed once only before expiry', () => {
  for (const at of [5.039999, 5.04, 5.040001]) {
    const context = contextFor();
    const state = context.state.profession.specialization.state;
    handleLightAuraGrant(context, { at: 0.001 });
    assert.equal(state.lightAuraUntil, 4.04);
    handleLightAuraGrant(context, { at: 1.001, duration: 4 });
    assert.equal(state.lightAuraUntil, 5.04);
    const snapshot = luminaryUi.rotationStateSnapshot({ state: context.state, atSeconds: at });
    assert.equal(
      snapshot.some((item) => item.id === 'luminary-light-aura'),
      at < 5.04
    );
    handleLightAuraDetonate(context, { at });
    handleLightAuraDetonate(context, { at });
    assert.equal(
      context.events.filter((event) => event.skillId === ID.SOVEREIGN_OF_LIGHT_DAMAGE).length,
      at < 5.04 ? 1 : 0
    );
  }
});

test('Effulgent counts the final live microsecond but excludes its exact detonation timestamp', () => {
  const context = contextFor();
  context.start = 0.001;
  processLuminaryStances(context, context.catalog.skillsById.get(ID.EFFULGENT_STANCE));
  const activation = context.events.find((event) => event.type === 'guardian.effulgent-activated');
  const detonation = context.events.find((event) => event.type === 'guardian.effulgent-detonate');
  handleEffulgentActivated(context, activation);
  const state = context.state.profession.specialization.state;
  assert.equal(state.effulgentActiveUntil, 4.001);
  assert.equal(state.effulgentActiveUntil, detonation.at);
  for (const at of [4.000999, 4.001, 4.001001]) {
    reactToEffulgentStrike(context, { at, coefficient: 1, actorType: 'player' });
    assert.equal(state.effulgentStacks, 1);
  }

  handleEffulgentDetonate(context, detonation);
  assert.equal(state.effulgentActiveUntil, 0);
  assert.equal(state.effulgentStacks, 0);
});

test('Radiant Forge exits exactly once at its canonical form deadline', () => {
  const context = contextFor();
  context.effectiveEnd = 0.001;
  guardianRadiantForgeSkillHandlers['guardian.radiant-forge'](
    context,
    context.catalog.skillsById.get(ID.ENTER_RADIANT_FORGE)
  );
  const state = context.state.profession.specialization.state;
  assert.equal(state.radiantForgeEndsAt, 20.001);
  advanceRadiantForgeState(context, 20.001 - 0.000001);
  assert.equal(state.radiantForge, true);
  advanceRadiantForgeState(context, 20.001);
  assert.equal(state.radiantForge, false);
  advanceRadiantForgeState(context, 20.001001);
  const exits = context.events.filter((event) => event.type === 'guardian.radiant-forge-exited');
  assert.equal(exits.length, 1);
  assert.equal(exits[0].at, 20.001);
  assert.equal(context.state.cooldowns.get(ID.ENTER_RADIANT_FORGE), 25.001);
});

test('spear illumination grants rounded windows and expires before casts at the deadline', () => {
  for (const source of ['armed', 'symbol']) {
    for (const at of [5.039999, 5.04, 5.040001]) {
      const context = contextFor();
      const state = context.state.profession.core;
      context.start = context.fullEnd = context.effectiveEnd = 0.001;
      // Empty strike effects make the grant use completion, isolating the lifetime from authored hit timing.
      const armer = { ...context.catalog.skillsById.get(ID.HELIO_RUSH), effects: [] };
      updateSpearIlluminationState(
        context,
        source === 'armed' ? armer : context.catalog.skillsById.get(ID.SYMBOL_OF_LUMINANCE)
      );
      assert.equal(source === 'armed' ? state.spearIlluminatedUntil : state.spearLuminanceUntil, 5.04);
      advanceSpearIlluminationState(context, at);
      if (source === 'armed') assert.equal(state.spearIlluminatedArmed, at < 5.04);
      context.start = context.fullEnd = context.effectiveEnd = at;
      updateSpearIlluminationState(context, context.catalog.skillsById.get(ID.SOLAR_STORM));
      assert.equal(
        context.events.some((event) => event.name === 'Illuminated'),
        at < 5.04
      );
      assert.ok(state.spearIlluminatedUntil > at, 'a committed armer opens the next charge window');
    }
  }
});

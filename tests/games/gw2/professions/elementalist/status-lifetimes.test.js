import assert from 'node:assert/strict';
import test from 'node:test';
import { createTaskQueue } from '#gw2/platform/execution/tasks.js';
import { createScheduledEvents } from '#gw2/platform/execution/scheduled-events.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import { elementalistRockBarrierMechanicHandlers } from '#gw2/professions/elementalist/core/mechanics/rock-barrier.js';
import { advanceElementalistState } from '#gw2/professions/elementalist/core/mechanics/scheduler-state.js';
import { elementalistCoreSchedulerHooks } from '#gw2/professions/elementalist/core/execution/hooks.js';
import {
  armElementalistElementalLightningJolt,
  completeElementalistGlyphCast,
  completeElementalistElementalCommand,
  elementalistElementalTaskHandlers,
  observeElementalistElementalEvent
} from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

// Exercise lifecycle handlers with real catalog/state owners and inspect only their queued work.
function lifetimeContext(element = 'Fire') {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    startAttunement: 'Earth',
    autoSummonElemental: false,
    selectedSkills: { Elite: element === 'Fire' ? 'Glyph of Elementals' : 'Glyph of Elementals (Earth)' }
  };
  const profession = elementalistProfession.resolveRuntime(config);
  // Use canonical event replacement and boon indexes while keeping task execution under the test's control.
  const scheduled = createScheduledEvents({ prepareEvent: (event) => event, observeEvent() {} });
  const queued = [];
  const queue = createTaskQueue({ handlers: elementalistElementalTaskHandlers });
  let sequence = 0;
  return {
    ...scheduled,
    config,
    profession,
    catalog: profession.catalog,
    state: { time: 0, profession: profession.createProfessionState(config), cooldowns: new Map() },
    queued,
    start: 0,
    effectiveEnd: 0.1 + 0.201,
    hasExplicitCombatStart: true,
    combatStartTime: null,
    createActivationId: () => `action-${++sequence}`,
    rechargeDurationFor: () => 8,
    tasks: {
      ...queue,
      schedule: (task) => {
        const id = queue.schedule(task);
        queued.push({ ...task, id });
        return id;
      }
    }
  };
}

const openBarrier = elementalistRockBarrierMechanicHandlers['elementalist.core.open-rock-barrier'];
const releaseBarrier = elementalistRockBarrierMechanicHandlers['elementalist.core.release-rock-barrier'];
const impact = elementalistElementalTaskHandlers['elementalist.elemental-impact'];

test('Rock Barrier availability, palette, and natural recharge share an exact deadline', () => {
  const context = lifetimeContext();
  const core = context.state.profession.core;
  const root = context.catalog.skillsById.get(ID.ROCK_BARRIER);
  const hurl = context.catalog.skillsById.get(ID.HURL);
  openBarrier({ context, at: context.effectiveEnd });
  assert.equal(core.availableFlips[ID.HURL]?.expiresAt ?? 0, 30.301);
  for (const at of [30.300999, 30.301, 30.301001]) {
    context.start = at;
    const active = at < 30.301;
    assert.equal(elementalistCoreAvailability(context, hurl).ready, active);
    assert.equal(elementalistCoreAvailability(context, root).ready, !active);
    const ui = { time: at, professionState: core, build: { startAttunement: 'Earth' } };
    assert.equal(elementalistProfession.ui.paletteSkillAvailability(ui, hurl).available, active);
    assert.equal(elementalistProfession.ui.paletteSkillAvailability(ui, root).available, !active);
  }

  advanceElementalistState(context, 30.300999);
  assert.equal(core.availableFlips[ID.HURL]?.expiresAt ?? 0, 30.301);
  advanceElementalistState(context, 30.301);
  assert.equal(core.availableFlips[ID.HURL]?.expiresAt ?? 0, 0);
  assert.equal(context.state.cooldowns.get(root.id), 38.301);
  advanceElementalistState(context, 40);
  assert.equal(context.state.cooldowns.get(root.id), 38.301);

  openBarrier({ context, at: 41 });
  releaseBarrier({ context, at: 42 });
  advanceElementalistState(context, 71);
  assert.equal(core.availableFlips[ID.HURL]?.expiresAt ?? 0, 0);
  assert.equal(context.state.cooldowns.get(root.id), 50, 'consumption prevents a second recharge at natural expiry');
});

test('elemental commands and Lightning Jolt retain the final live microsecond without early auto-replacement', () => {
  for (const element of ['Fire', 'Earth']) {
    const context = lifetimeContext(element);
    const glyph = context.catalog.skillsByName.get(context.config.selectedSkills.Elite);
    const command = context.catalog.skillsByName.get(element === 'Fire' ? 'Flame Barrage' : 'Stomp');
    completeElementalistGlyphCast(context, glyph);
    const core = context.state.profession.core;
    const elemental = core.summonedElemental;
    assert.equal(elemental.activeUntil, 120.301);
    assert.equal(core.availableFlips[command.id]?.expiresAt, elemental.activeUntil);
    assert.equal(context.queued[0].at, elemental.activeUntil);
    assert.equal(context.events[0].at, elemental.activeUntil);
    for (const at of [120.300999, 120.301, 120.301001]) {
      context.start = context.effectiveEnd = at;
      elemental.pendingLightningJolt = null;
      assert.equal(elementalistCoreAvailability(context, command).ready, at < elemental.activeUntil);
      assert.equal(elementalistCoreAvailability(context, glyph).ready, at >= elemental.activeUntil);
      armElementalistElementalLightningJolt(context, 1, 0.5);
      assert.equal(elemental.pendingLightningJolt !== null, at < elemental.activeUntil);
    }

    context.config.autoSummonElemental = true;
    observeElementalistElementalEvent(context, { type: 'action', actorType: 'player', at: 120.300999 });
    assert.equal(core.summonedElemental.summonGeneration, 1);
    observeElementalistElementalEvent(context, { type: 'action', actorType: 'player', at: 120.301 });
    assert.equal(core.summonedElemental.summonGeneration, 2);
  }
});

test('queued elemental impacts include exact expiry, but autonomous attacks cannot start there', () => {
  for (const element of ['Fire', 'Earth']) {
    const context = lifetimeContext(element);
    const glyph = context.catalog.skillsByName.get(context.config.selectedSkills.Elite);
    completeElementalistGlyphCast(context, glyph);
    const elemental = context.state.profession.core.summonedElemental;
    const deadline = elemental.activeUntil;
    const payload = { summonGeneration: 1, actionGeneration: 0, impact: element === 'Fire' ? 'fireball' : 'punch' };
    for (const at of [deadline - 0.000001, deadline, deadline + 0.000001]) {
      const before = context.events.length;
      impact(context, { at, payload });
      assert.equal(context.events.length - before, at <= deadline ? 1 : 0);
    }

    const before = context.events.length;
    // Place target acquisition on expiry and let real priority ordering deliver teardown.
    observeElementalistElementalEvent(context, { type: 'combat_start', at: deadline - 0.16 });
    context.tasks.drainThrough(deadline, context);
    assert.equal(context.events.length, before, 'expiry cannot create a zero-length attack');
    assert.equal(elemental.element, null);
    assert.equal(elemental.pendingLightningJolt, null);
    assert.deepEqual(context.state.profession.core.availableFlips, {});
    assert.equal(context.state.cooldowns.get(glyph.id), 160.301);
    impact(context, { at: deadline, payload });
    assert.equal(context.events.length, before, 'teardown invalidates remaining work');
  }
});

test('replacing an elemental interrupts its action, removes its flip, and rejects stale tasks', () => {
  const context = lifetimeContext();
  completeElementalistGlyphCast(context, context.catalog.skillsByName.get('Glyph of Elementals'));
  completeElementalistElementalCommand(context, context.catalog.skillsByName.get('Flame Barrage'));
  const action = context.events.find((event) => event.type === 'action');
  const oldTasks = [...context.queued];
  context.effectiveEnd = 0.5;
  completeElementalistGlyphCast(context, context.catalog.skillsByName.get('Glyph of Elementals (Earth)'));
  assert.equal(context.eventByOrder(action.eventOrder).interruptedAt, 0.5);
  assert.equal(context.eventByOrder(action.eventOrder).endsAt, 0.5);
  assert.deepEqual(Object.keys(context.state.profession.core.availableFlips), [
    String(elementalistCatalog.skillsByName.get('Stomp').id)
  ]);
  assert.equal(
    context.state.profession.core.availableFlips[elementalistCatalog.skillsByName.get('Stomp').id].expiresAt,
    120.5
  );
  const before = context.events.length;
  context.tasks.drainThrough(120.301, context);
  assert.ok(oldTasks.every((task) => !context.tasks.has(task.id)));
  assert.equal(context.events.length, before);
  assert.equal(context.state.profession.core.summonedElemental.element, 'Earth');
  assert.equal(context.state.cooldowns.size, 0);
});

test('elemental boon candidacy includes the final impact timestamp without an epsilon grace period', () => {
  const context = lifetimeContext();
  completeElementalistGlyphCast(context, context.catalog.skillsByName.get('Glyph of Elementals'));
  const prepare = elementalistCoreSchedulerHooks.prepareEvent.find(
    (hook) => hook.id === 'elementalist.boon-companion-candidates'
  ).handler;
  for (const at of [120.300999, 120.301, 120.301001]) {
    const event = prepare(context, {
      type: 'buff',
      at,
      kind: 'might',
      stacks: 1,
      duration: 1,
      audience: { recipients: 'party', maximumRecipients: 5 }
    });
    assert.deepEqual(event.audience.eligibleCompanionIds, at <= 120.301 ? ['elementalist-elemental:1'] : []);
  }
});

test('Hurl consumes the barrier before expiry while its released projectiles finish afterward', () => {
  const result = simulateGw2({
    profession: elementalistProfession,
    config: { specialization: 'Core', primaryWeapon: 'Scepter', startAttunement: 'Earth', autoSummonElemental: false },
    rotation: [ID.ROCK_BARRIER, { type: 'wait', durationMs: 29999 }, ID.HURL],
    observationPolicy: { kind: 'tail', durationMs: 2000 }
  });
  assert.deepEqual(result.warnings, []);
  const barrier = result.events.find((event) => event.type === 'action' && event.skillId === ID.ROCK_BARRIER);
  const hurl = result.events.find((event) => event.type === 'action' && event.skillId === ID.HURL);
  assert.ok(hurl.at < barrier.endsAt + 30);
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillId === ID.HURL && event.at > barrier.endsAt + 30
    )
  );
  assert.equal(result.planningState.profession.availableFlips[ID.HURL]?.expiresAt ?? 0, 0);
});

test('the scheduler resolves a final elemental command hit before same-time teardown', () => {
  // Shorten only the lifetime to put expiry on either side of an already queued explosion.
  for (const lifetime of [1.519999, 1.52, 1.520001]) {
    const profession = withPatchPreview(elementalistProfession, {
      id: 'short-elemental',
      label: 'Short elemental lifetime',
      professions: {
        elementalist: { balanceProfiles: { [PROFILE.summonedElemental]: { fields: { durationMultiplier: lifetime } } } }
      }
    });
    const result = simulateGw2({
      profession,
      config: {
        patchId: 'short-elemental',
        specialization: 'Core',
        autoSummonElemental: false,
        selectedSkills: { Elite: 'Glyph of Elementals' },
        boons: { quickness: false }
      },
      rotation: [ID.GLYPH_OF_ELEMENTALS, ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, { type: 'wait', durationMs: 3000 }]
    });
    assert.deepEqual(result.warnings, []);
    const explosion = result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillId === ID.FLAME_BARRAGE_ELEMENTAL_COMMAND && event.hitIndex === 4
    );
    assert.equal(Boolean(explosion), lifetime >= 1.52);
    assert.equal(result.planningState.profession.summonedElemental.element, null);
    assert.deepEqual(result.planningState.profession.availableFlips, {});
  }
});

// Commands invalidate the interrupted action's impacts and replace only its pending autonomous decision.
test('elemental command preemption resumes exactly at command recovery without stale impacts', () => {
  for (const element of ['Fire', 'Earth']) {
    const context = lifetimeContext(element);
    context.combatStartTime = 0;
    completeElementalistGlyphCast(context, context.catalog.skillsByName.get(context.config.selectedSkills.Elite));
    context.tasks.drainThrough(0.5, context);
    const interrupted = context.events.find((event) => event.type === 'action');
    assert.ok(interrupted);
    context.effectiveEnd = 0.6;
    completeElementalistElementalCommand(
      context,
      context.catalog.skillsByName.get(element === 'Fire' ? 'Flame Barrage' : 'Stomp')
    );
    const recovery = context.state.profession.core.summonedElemental.busyUntil;
    context.tasks.drainThrough(recovery - 0.000001, context);
    assert.equal(context.eventByOrder(interrupted.eventOrder).interruptedAt, 0.6);
    assert.ok(
      !context.events.some((event) => event.type === 'damage' && event.activationId === interrupted.activationId)
    );
    assert.ok(
      !context.events.some((event) => event.type === 'action' && event.autonomousElementalSkill && event.at > 0.6)
    );
    context.tasks.drainThrough(recovery, context);
    const resumed = context.events.findLast((event) => event.type === 'action');
    assert.equal(resumed.at, recovery);
    assert.equal(resumed.autonomousElementalSkill, true);
  }
});

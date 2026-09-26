import assert from 'node:assert/strict';
import test from 'node:test';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import { elementalistRockBarrierTasks } from '#gw2/professions/elementalist/core/mechanics/rock-barrier.js';
import { elementalistCoreHooks } from '#gw2/professions/elementalist/core/hooks.js';
import {
  armElementalistElementalLightningJolt,
  completeElementalistGlyphCast,
  completeElementalistElementalCommand,
  ensureElementalistElemental
} from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

const config = {
  specialization: 'Core',
  primaryWeapon: 'Scepter',
  startAttunement: 'Earth',
  autoSummonElemental: false
};
const glyphFor = (element) =>
  elementalistCatalog.skillsByName.get(element === 'Fire' ? 'Glyph of Elementals' : 'Glyph of Elementals (Earth)');
const commandFor = (element) => elementalistCatalog.skillsByName.get(element === 'Fire' ? 'Flame Barrage' : 'Stomp');
const complete = (r, skill, handler) => handler(r, { skill, effectiveEnd: r.time }, skill);

// Advance the native clock through each boundary; expiry and release must share one recharge owner.
test('Rock Barrier availability, palette, and natural recharge share an exact deadline', () => {
  const root = elementalistCatalog.skillsById.get(ID.ROCK_BARRIER),
    hurl = elementalistCatalog.skillsById.get(ID.HURL);
  const result = runElementalist({
    config,
    rotation: [{ type: 'wait', durationMs: 72000 }],
    timeline: [
      { at: 0.301, run: elementalistRockBarrierTasks['elementalist.core.open-rock-barrier'] },
      ...[30.300999, 30.301, 30.301001].map((at) => ({
        at,
        run: (r) => {
          const active = at < 30.301,
            core = r.profession.core;
          assert.equal(elementalistCoreAvailability(r, hurl).ready, active);
          assert.equal(elementalistCoreAvailability(r, root).ready, !active);
          assert.equal(
            elementalistProfession.ui.paletteSkillAvailability(
              { time: at, professionState: core, build: { startAttunement: 'Earth' } },
              hurl
            ).available,
            active
          );
        }
      })),
      { at: 40, run: (r) => assert.equal(r.cooldowns.get(root.id), 36.701) },
      { at: 41, run: elementalistRockBarrierTasks['elementalist.core.open-rock-barrier'] },
      { at: 42, run: elementalistRockBarrierTasks['elementalist.core.release-rock-barrier'] }
    ]
  });
  assert.equal(observedRuntime(result).cooldowns.get(root.id), 48.4);
  assert.equal(result.planningState.profession.availableFlips[ID.HURL], undefined);
});

test('elemental commands and Lightning Jolt retain the final live microsecond without early auto-replacement', () => {
  for (const element of ['Fire', 'Earth']) {
    const glyph = glyphFor(element),
      command = commandFor(element);
    const result = runElementalist({
      config: { ...config, selectedSkills: { Elite: glyph.name } },
      rotation: [{ type: 'wait', durationMs: 121000 }],
      timeline: [
        { at: 0.301, run: (r) => complete(r, glyph, completeElementalistGlyphCast) },
        ...[120.300999, 120.301].map((at) => ({
          at,
          priority: 40,
          run: (r) => {
            const elemental = r.profession.core.summonedElemental;
            elemental.pendingLightningJolt = null;
            r.config.autoSummonElemental = false;
            assert.equal(elementalistCoreAvailability(r, command).ready, at < 120.301);
            assert.equal(elementalistCoreAvailability(r, glyph).ready, at >= 120.301);
            armElementalistElementalLightningJolt(r, { effectiveEnd: at }, 1, 0.5);
            assert.equal(elemental.pendingLightningJolt !== null, at < 120.301);
            r.config.autoSummonElemental = true;
            ensureElementalistElemental(r);
            assert.equal(r.profession.core.summonedElemental.summonGeneration, at < 120.301 ? 1 : 2);
          }
        }))
      ]
    });
    assert.equal(result.planningState.profession.summonedElemental.element, element);
  }
});

test('elemental teardown clears the command and starts the glyph recharge once', () => {
  for (const element of ['Fire', 'Earth']) {
    const glyph = glyphFor(element);
    const result = runElementalist({
      config,
      rotation: [{ type: 'wait', durationMs: 122000 }],
      timeline: [{ at: 0.301, run: (r) => complete(r, glyph, completeElementalistGlyphCast) }]
    });
    const r = observedRuntime(result);
    assert.equal(r.profession.core.summonedElemental.element, null);
    assert.deepEqual(r.profession.core.availableFlips, {});
    assert.equal(r.cooldowns.get(glyph.id), 152.301);
    assert.ok(!result.events.some((e) => e.type === 'action' && e.actorType === 'summon' && e.at >= 120.301));
  }
});

test('replacing an elemental interrupts its action, removes its flip, and rejects stale tasks', () => {
  const result = runElementalist({
    config,
    rotation: [{ type: 'wait', durationMs: 121000 }],
    timeline: [
      {
        at: 0.301,
        run: (r) => {
          complete(r, glyphFor('Fire'), completeElementalistGlyphCast);
          complete(r, commandFor('Fire'), completeElementalistElementalCommand);
        }
      },
      { at: 0.5, run: (r) => complete(r, glyphFor('Earth'), completeElementalistGlyphCast) },
      {
        at: 1,
        run: (r) => assert.deepEqual(Object.keys(r.profession.core.availableFlips), [String(commandFor('Earth').id)])
      }
    ]
  });
  const action = result.events.find((e) => e.type === 'action' && e.actorType === 'summon');
  assert.equal(action.interruptedAt, 0.5);
  assert.equal(action.endsAt, 0.5);
  assert.ok(
    !result.resolvedEvents.some((e) => e.type === 'damage' && e.activationId === action.activationId && e.at >= 0.5)
  );
});

test('elemental boon candidacy includes the final impact timestamp without an epsilon grace period', () => {
  runElementalist({
    config,
    rotation: [{ type: 'wait', durationMs: 1000 }],
    timeline: [
      {
        at: 0.301,
        run: (r) => {
          complete(r, glyphFor('Fire'), completeElementalistGlyphCast);
          for (const at of [120.300999, 120.301, 120.301001]) {
            const event = elementalistCoreHooks.prepareEvent(r, {
              type: 'buff',
              at,
              kind: 'might',
              stacks: 1,
              duration: 1,
              audience: { recipients: 'party', maximumRecipients: 5 }
            });
            assert.deepEqual(event.audience.eligibleCompanionIds, at <= 120.301 ? ['elementalist-elemental:1'] : []);
          }
        }
      }
    ]
  });
});

test('Hurl consumes the barrier before expiry while its released projectiles finish afterward', () => {
  const result = runElementalist({
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

test('the live queue resolves a final elemental command hit before same-time teardown', () => {
  // Shorten only the lifetime to put expiry on either side of an already queued explosion.
  for (const lifetime of [1.519999, 1.52, 1.520001]) {
    const profession = withPatchPreview(elementalistProfession, {
      id: 'short-elemental',
      label: 'Short elemental lifetime',
      professions: {
        elementalist: { balanceProfiles: { [PROFILE.summonedElemental]: { fields: { durationMultiplier: lifetime } } } }
      }
    });
    const result = runElementalist({
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

// A command retires the interrupted action's impacts and resumes the AI at its recovery boundary.
test('elemental command preemption resumes exactly at command recovery without stale impacts', () => {
  for (const element of ['Fire', 'Earth']) {
    let interrupted, recovery;
    const result = runElementalist({
      config,
      rotation: ['__combat_start', { type: 'wait', durationMs: 6000 }],
      timeline: [
        { at: 0.301, run: (r) => complete(r, glyphFor(element), completeElementalistGlyphCast) },
        {
          at: 0.6,
          run: (r) => {
            interrupted = r.history.find((e) => e.type === 'action' && e.actorType === 'summon');
            complete(r, commandFor(element), completeElementalistElementalCommand);
            recovery = r.profession.core.summonedElemental.busyUntil;
          }
        }
      ]
    });
    assert.equal(interrupted.interruptedAt, 0.6);
    assert.ok(
      !result.resolvedEvents.some(
        (e) => e.type === 'damage' && e.activationId === interrupted.activationId && e.at > 0.6
      )
    );
    const resumed = result.events.find((e) => e.type === 'action' && e.autonomousElementalSkill && e.at > 0.6);
    assert.equal(resumed.at, recovery);
  }
});

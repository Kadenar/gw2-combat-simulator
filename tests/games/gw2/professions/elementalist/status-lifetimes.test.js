import { armElementalLightningJolt } from '#gw2/professions/elementalist/specializations/tempest/mechanics/lightning-jolt.js';
import { tempestState } from '#gw2/professions/elementalist/specializations/tempest/state.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import { elementalistRockBarrierTasks } from '#gw2/professions/elementalist/core/mechanics/rock-barrier.js';
import { elementalistCoreHooks } from '#gw2/professions/elementalist/core/hooks.js';
import {
  completeElementalistGlyphCast,
  completeElementalistElementalCommand,
  ensureElementalistElemental
} from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profile-ids.js';

const config = {
  specialization: 'Core',
  primaryWeapon: 'Scepter',
  startAttunement: 'Earth'
};
const glyphFor = (element) =>
  elementalistCatalog.skillsByName.get(element === 'Fire' ? 'Glyph of Elementals' : 'Glyph of Elementals (Earth)');
const commandFor = (element) => elementalistCatalog.skillsByName.get(element === 'Fire' ? 'Flame Barrage' : 'Stomp');
const complete = (r, skill, handler) => handler(r, { skill, effectiveEnd: r.time }, skill);

// Advance the native clock through each boundary; expiry and release must share one recharge owner.
test('Rock Barrier availability, palette, and natural recharge share an exact deadline', () => {
  const root = elementalistCatalog.skillsById.get(ID.ROCK_BARRIER),
    hurl = elementalistCatalog.skillsById.get(ID.HURL);
  const result = runElementalist([{ type: 'wait', durationMs: 72000 }], config, {
    timeline: [
      { at: 0.301, run: elementalistRockBarrierTasks['elementalist.core.open-rock-barrier'] },
      ...[30.300999, 30.301, 30.301001].map((at) => ({
        at,
        run: (r) => {
          const active = at < 30.301;
          assert.equal(elementalistCoreAvailability(r, hurl).ready, active);
          assert.equal(elementalistCoreAvailability(r, root).ready, !active);
        }
      })),
      { at: 40, run: (r) => assert.equal(r.cooldownController.readyAt(root.id), 36.701) },
      { at: 41, run: elementalistRockBarrierTasks['elementalist.core.open-rock-barrier'] },
      { at: 42, run: elementalistRockBarrierTasks['elementalist.core.release-rock-barrier'] }
    ]
  });
  assert.equal(observedRuntime(result).cooldownController.readyAt(root.id), 48.4);
  assert.equal(result.planningState.profession.availableFlips[ID.HURL], undefined);
});

test('elemental commands and Lightning Jolt retain the final live microsecond without early auto-replacement', () => {
  for (const element of ['Fire', 'Earth']) {
    const glyph = glyphFor(element),
      command = commandFor(element);
    const result = runElementalist(
      [{ type: 'wait', durationMs: 121000 }],
      { ...config, specialization: 'Tempest' },
      {
        timeline: [
          { at: 0.301, run: (r) => complete(r, glyph, completeElementalistGlyphCast) },
          ...[120.300999, 120.301].map((at) => ({
            at,
            priority: 40,
            run: (r) => {
              const tempest = tempestState.from(r);
              tempest.pendingLightningJolt = null;
              r.config.selectedSkillIds = {};
              assert.equal(elementalistCoreAvailability(r, command).ready, at < 120.301);
              r.config.selectedSkillIds = [glyph.id];
              assert.equal(elementalistCoreAvailability(r, command).ready, at < 120.301);
              assert.equal(elementalistCoreAvailability(r, glyph).ready, at >= 120.301);
              armElementalLightningJolt(r, { effectiveEnd: at }, 1, 0.5);
              assert.equal(tempest.pendingLightningJolt !== null, at < 120.301);
              ensureElementalistElemental(r);
              assert.equal(r.profession.core.summonedElemental.summonGeneration, 1);
            }
          }))
        ]
      }
    );
    assert.equal(result.planningState.profession.summonedElemental.element, null);
  }
});

test('an expired automatic elemental stays absent until an explicit glyph clears recharge', () => {
  // A short lifetime exercises expiry, an ordinary cast, the locked command, and a legal resummon for both glyphs.
  const profession = withPatchPreview(elementalistProfession, {
    id: 'elemental-lifecycle',
    label: 'Elemental lifecycle',
    professions: {
      elementalist: {
        balanceProfiles: { [PROFILE.summonedElemental]: { fields: { durationMultiplier: 2, recharge: 5 } } }
      }
    }
  });
  for (const element of ['Fire', 'Earth']) {
    const glyph = glyphFor(element),
      command = commandFor(element);
    const result = runElementalist(
      [
        { type: 'combat-start' },
        { type: 'wait', durationMs: 2100 },
        { type: 'cast', skillId: ID.WATER_ATTUNEMENT },
        { type: 'cast', skillId: glyph.id },
        { type: 'wait', durationMs: 1000 }
      ],
      {
        ...config,
        patchId: 'elemental-lifecycle',
        selectedSkillIds: [glyph.id],
        selectedTraitIds: []
      },
      {
        profession,
        timeline: [
          {
            at: 1,
            run(runtime) {
              assert.equal(runtime.profession.core.summonedElemental.summonGeneration, 1);
              assert.equal(elementalistCoreAvailability(runtime, command).ready, true);
              assert.equal(runtime.cooldownController.hasCooldown(glyph.id), false);
            }
          },
          {
            at: 3,
            run(runtime) {
              const elemental = runtime.profession.core.summonedElemental;
              assert.equal(elemental.element, null);
              assert.equal(elemental.summonGeneration, 1);
              assert.equal(runtime.cooldownController.readyAt(glyph.id), 6);
              assert.equal(elementalistCoreAvailability(runtime, command).ready, false);
            }
          },
          {
            at: 7,
            run(runtime) {
              assert.equal(runtime.profession.core.summonedElemental.summonGeneration, 2);
              assert.equal(elementalistCoreAvailability(runtime, command).ready, true);
              assert.ok((runtime.cooldownController.readyAt(glyph.id) ?? 0) <= runtime.time);
            }
          }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const summon = result.events.find((event) => event.type === 'action' && event.skillId === glyph.id);
    assert.equal(summon.at, 6);
    assert.equal(result.planningState.profession.summonedElemental.activeUntil, summon.endsAt + 2);
  }
});

test('elemental teardown clears the command and starts the glyph recharge once', () => {
  for (const element of ['Fire', 'Earth']) {
    const glyph = glyphFor(element);
    const result = runElementalist(
      [{ type: 'wait', durationMs: 122000 }],
      { ...config },
      { timeline: [{ at: 0.301, run: (r) => complete(r, glyph, completeElementalistGlyphCast) }] }
    );
    const r = observedRuntime(result);
    assert.equal(r.profession.core.summonedElemental.element, null);
    assert.deepEqual(r.profession.core.availableFlips, {});
    assert.equal(r.cooldownController.readyAt(glyph.id), 152.301);
    assert.ok(!result.events.some((e) => e.type === 'action' && e.actorType === 'summon' && e.at >= 120.301));
  }
});

test('replacing an elemental interrupts its action, removes its flip, and rejects stale tasks', () => {
  const result = runElementalist([{ type: 'wait', durationMs: 121000 }], config, {
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
  assert.equal(action.endsAt, 0.5);
  assert.equal(action.endsAt, 0.5);
  assert.ok(
    !result.resolvedEvents.some((e) => e.type === 'damage' && e.activationId === action.activationId && e.at >= 0.5)
  );
});

test('elemental boon candidacy includes the final impact timestamp without an epsilon grace period', () => {
  runElementalist([{ type: 'wait', durationMs: 1000 }], config, {
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
  const result = runElementalist(
    [ID.ROCK_BARRIER, { type: 'wait', durationMs: 29999 }, ID.HURL],
    { specialization: 'Core', primaryWeapon: 'Scepter', startAttunement: 'Earth' },
    { profession: elementalistProfession, observation: { kind: 'tail', durationMs: 2000 } }
  );
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
    const result = runElementalist(
      [ID.GLYPH_OF_ELEMENTALS, ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, { type: 'wait', durationMs: 3000 }],
      {
        patchId: 'short-elemental',
        specialization: 'Core',
        selectedSkillIds: [25488],
        boons: { quickness: false }
      },
      { profession }
    );
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
    const result = runElementalist(
      ['__combat_start', { type: 'wait', durationMs: 6000 }],
      { ...config },
      {
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
      }
    );
    assert.equal(interrupted.endsAt, 0.6);
    assert.ok(
      !result.resolvedEvents.some(
        (e) => e.type === 'damage' && e.activationId === interrupted.activationId && e.at > 0.6
      )
    );
    const resumed = result.events.find(
      (e) => e.type === 'action' && !['Flame Barrage', 'Stomp'].includes(e.skillName) && e.at > 0.6
    );
    assert.equal(resumed.at, recovery);
  }
});

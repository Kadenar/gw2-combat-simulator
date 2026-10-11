import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { MODIFIER_HOOK_NAMES } from '#gw2/platform/profession-definition/compile-contract.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { testProfession } from '#tests/fixtures/profession.js';

// Every reported packet carries an identity, and reactions name the event whose handling created them.
const catalog = createCanonicalCatalog({
  generated: [
    { id: 991001, name: 'Strike', weapon: 'Sword', castTimeMs: 0, effects: [{ type: 'strike', coefficient: 1 }] },
    { id: 991002, name: 'Boon', castTimeMs: 0, effects: [{ type: 'boon', boon: 'might', stacks: 1, duration: 5 }] }
  ],
  weapons: ['Sword']
});
const config = {
  attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0, expertise: 0 }),
  target: { armor: 1000, health: 0, conditions: {} },
  randomness: { mode: 'expected', seed: 123 }
};
const cast = (skillId) => ({ type: 'cast', skillId });
const wait = (durationMs) => ({ type: 'wait', durationMs });
const buff = (at, sourceId, extra = {}) => ({
  type: 'buff',
  at,
  source: 'fixture',
  sourceId,
  actorType: 'player',
  kind: 'fury',
  stacks: 1,
  duration: 5,
  ...extra
});

function run(rotation, hooks) {
  const profession = {
    ...Object.fromEntries(MODIFIER_HOOK_NAMES.map((key) => [key, testProfession[key]])),
    id: 'provenance-fixture',
    catalog,
    createState: () => ({}),
    ...hooks
  };
  return runGw2Runtime({ profession, config, rotation });
}

const strikeOf = (result) => result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === 991001);
const byType = (result, sourceId) => result.events.find((event) => event.sourceId === sourceId);

test('reactions queued directly or applied immediately receive identity and their triggering hit as parent', () => {
  const result = run([cast(991001)], {
    reactions: {
      'damage.resolved'(runtime, event) {
        if (event.skillId !== 991001) return;
        runtime.effects.emit({ kind: 'packet', event: buff(runtime.time, 'direct-buff') });
        runtime.effects.emit({
          kind: 'packet',
          settlement: 'reaction',
          event: {
            type: 'condition',
            at: runtime.time,
            source: 'fixture',
            sourceId: 'immediate-bleed',
            actorType: 'effect',
            condition: 'Bleeding',
            stacks: 1,
            duration: 2
          }
        });
      }
    }
  });
  const hit = strikeOf(result);
  const direct = byType(result, 'direct-buff');
  const bleed = result.resolvedEvents.find((event) => event.sourceId === 'immediate-bleed');

  assert.equal(hit.parentEventOrder, undefined);
  assert.ok(Number.isInteger(direct.eventOrder));
  assert.equal(direct.parentEventOrder, hit.eventOrder);
  assert.ok(Number.isInteger(bleed.eventOrder));
  assert.notEqual(bleed.eventOrder, direct.eventOrder);
  assert.equal(bleed.parentEventOrder, hit.eventOrder);
});

test('work done for a cast names the cast, while its own packets keep only their activation', () => {
  const result = run([cast(991002)], {
    onCastStart(runtime) {
      runtime.effects.emit({ kind: 'packet', event: buff(runtime.time, 'cast-side-effect') });
    }
  });
  const action = result.events.find((event) => event.type === 'action');
  const authored = result.events.find((event) => event.type === 'buff' && event.kind === 'might');

  assert.equal(byType(result, 'cast-side-effect').parentEventOrder, action.eventOrder);
  assert.equal(authored.activationId, action.activationId);
  assert.equal(authored.parentEventOrder, undefined);
});

test('packets of another cast keep their own activation as owner instead of the event that released them', () => {
  const result = run([cast(991002), wait(500), cast(991001)], {
    reactions: {
      'damage.resolved'(runtime, event) {
        if (event.skillId === 991001)
          runtime.effects.emit({ kind: 'packet', event: buff(runtime.time, 'released', { activationId: 'cast:1' }) });
      }
    }
  });

  assert.equal(byType(result, 'released').parentEventOrder, undefined);
});

test('scheduled work keeps the cause that scheduled it, except for summon packets', () => {
  const result = run([cast(991001), wait(2000)], {
    reactions: {
      'damage.resolved'(runtime, event) {
        if (event.skillId === 991001) runtime.schedule('later', runtime.time + 1);
      }
    },
    tasks: {
      later(runtime) {
        runtime.effects.emit({ kind: 'packet', event: buff(runtime.time, 'delayed') });
        runtime.effects.emit({
          kind: 'packet',
          event: buff(runtime.time, 'summon-loop', { actorType: 'summon', summonKind: 'fixture' })
        });
      }
    }
  });

  assert.equal(byType(result, 'delayed').parentEventOrder, strikeOf(result).eventOrder);
  assert.equal(byType(result, 'summon-loop').parentEventOrder, undefined);
});

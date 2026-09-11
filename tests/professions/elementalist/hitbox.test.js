import assert from 'node:assert/strict';
import test from 'node:test';
import { withSmallHitboxCap } from '#gw2/professions/elementalist/core/skills/hitbox.js';
import { prepareElementalistHitboxEvent } from '#gw2/professions/elementalist/core/mechanics/event-handlers.js';

test('small-hitbox caps pair offensive packets by timestamp and occurrence while preserving independent effects', () => {
  // Unequal timelines and simultaneous layers must preserve the companion of each retained strike.
  const skill = withSmallHitboxCap(
    {
      name: 'Packet pairing',
      effects: [
        { type: 'strike', ticks: [0, 100, 100, 200].map((atMs) => ({ atMs, coefficient: 1 })) },
        {
          type: 'condition',
          ticks: [100, 100, 200].map((atMs) => ({
            atMs,
            condition: 'Bleeding',
            stacks: 1,
            duration: 3,
            metadata: { original: true }
          }))
        },
        ...[100, 100, 200].map((atMs) => ({ type: 'blind', atMs })),
        { type: 'boon', boon: 'Resistance', atMs: 200, stacks: 1, duration: 4 },
        { type: 'buff', kind: 'test buff', atMs: 200, stacks: 1, duration: 4 },
        { type: 'condition', condition: 'Weakness', atMs: 150, stacks: 1, duration: 3 },
        { type: 'strike', atMs: 100, coefficient: 1 },
        { type: 'condition', condition: 'Vulnerability', atMs: 100, stacks: 1, duration: 3 }
      ]
    },
    2
  );
  const packets = skill.effects.flatMap((effect) =>
    Array.isArray(effect.ticks) ? effect.ticks.map((tick) => ({ ...effect, ...tick })) : [effect]
  );
  assert.deepEqual(
    packets.map((packet) => packet.metadata?.hitboxIndex),
    [1, 2, 3, 5, 2, 3, 5, 2, 3, 5, undefined, undefined, undefined, 4, 4]
  );
  assert.ok(skill.effects[1].ticks.every((tick) => tick.metadata.original));

  for (const hitboxSize of ['small', 'large']) {
    const events = packets.map((packet) => prepareElementalistHitboxEvent({ config: { hitboxSize } }, packet));
    assert.deepEqual(
      events.map((event) => Boolean(event.cancelled)),
      hitboxSize === 'small'
        ? [false, false, true, true, false, true, true, false, true, true, false, false, false, true, true]
        : packets.map(() => false)
    );
  }
});

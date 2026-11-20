import assert from 'node:assert/strict';
import test from 'node:test';

import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createCatalogNormalizer } from '#gw2/platform/skills/validation.js';
import { thiefStealthGrant } from '#gw2/professions/thief/core/skills/stealth-grant.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';

// Stealth belongs to a landed dagger hit; missing the target must not create stealth or its trait rewards.
test('Cloak and Dagger grants stealth only when its strike lands', () => {
  for (const offTarget of [false, true]) {
    const result = runThief([{ type: 'cast', skillId: ID.CLOAK_AND_DAGGER, offTarget }]);
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(runtime.profession.core.stealthUntil > runtime.time, !offTarget);
  }
});

// A separate hostile pulse after the dagger hit owns Revealed; cast completion cannot grant stealth again.
test('a delayed strike can reveal Cloak and Dagger stealth before the next input', () => {
  const result = runThief(
    [ID.CLOAK_AND_DAGGER, ID.DOUBLE_STRIKE],
    {},
    {
      timeline: [
        {
          at: 0.5,
          run(runtime) {
            assert.ok(runtime.profession.core.stealthUntil > runtime.time);
            runtime.effects.emit({ kind: 'packet', event: thiefHit(runtime.time, { skillId: ID.THOUSAND_NEEDLES }) });
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  assert.ok(runtime.profession.core.stealthUntil <= runtime.time);
  assert.ok(runtime.profession.core.revealedUntil > runtime.time);
});

// A dagger strike can reveal existing Stealth when a patch removes its own grant.
test('removing the landed Stealth grant also removes its strike protection', () => {
  for (const removed of [false, true]) {
    const result = runThief(
      [ID.CLOAK_AND_DAGGER],
      {},
      {
        initialize(runtime) {
          runtime.profession.core.stealthUntil = 10;
        },
        catalog: (catalog) =>
          removed
            ? applySkillPatch(catalog, {
                skills: {
                  [ID.CLOAK_AND_DAGGER]: {
                    sideEffects: { stealth: { removeEffects: [{ type: 'buff' }] } }
                  }
                }
              })
            : catalog
      }
    );
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(runtime.profession.core.revealedUntil > runtime.time, removed);
    assert.equal(runtime.profession.core.stealthUntil > runtime.time, !removed);
  }
});

// A delayed variant strike can extend existing Stealth or break it, according to its own reaction.
test('the selected dagger variant owns the Stealth grant after cast completion', () => {
  for (const grantsStealth of [true, false]) {
    const duration = 5;
    const result = runThief(
      [{ skillId: ID.CLOAK_AND_DAGGER, impactDelayMs: 1000 }],
      {},
      {
        observation: { kind: 'tail', durationMs: 1500 },
        initialize(runtime) {
          runtime.profession.core.stealthUntil = 8;
        },
        catalog(catalog) {
          const grant = { on: 'damage.resolved', actor: 'player', packets: 'first', do: [thiefStealthGrant(duration)] };
          const variant = createCatalogNormalizer(catalog).normalizeSkillEffects([
            {
              type: 'strike',
              actorType: 'player',
              ticks: [
                { atMs: 0, coefficient: 1 },
                { atMs: 240, coefficient: 1 }
              ],
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              reactions: grantsStealth ? [grant] : []
            }
          ]);
          return withSkill(catalog, ID.CLOAK_AND_DAGGER, {
            effectVariants: [{ when: () => true, transform: () => variant }]
          });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(runtime.profession.core.revealedUntil > runtime.time, !grantsStealth);
    const grants = result.events.filter((event) => event.kind === 'stealth');
    assert.deepEqual(
      grants.map((event) => event.duration),
      grantsStealth ? [duration] : []
    );

    if (grantsStealth) assert.equal(runtime.profession.core.stealthUntil, 8 + duration);
  }
});

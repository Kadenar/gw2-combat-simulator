import assert from 'node:assert/strict';
import test from 'node:test';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { completeElementalistGlyphCast } from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import { beforeElementalStrike } from '#gw2/professions/elementalist/core/mechanics/elementals/lifecycle.js';
import { armElementalLightningJolt } from '#gw2/professions/elementalist/specializations/tempest/mechanics/lightning-jolt.js';
import { tempestState } from '#gw2/professions/elementalist/specializations/tempest/state.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { applyWrittenInStone } from '#gw2/professions/elementalist/core/traits/earth.js';
import { applyEpitomeCombo } from '#gw2/professions/elementalist/specializations/catalyst/traits/auras.js';

const glyph = elementalistCatalog.skillsByName.get('Glyph of Elementals');
const summon = (runtime) => completeElementalistGlyphCast(runtime.mechanics, { effectiveEnd: runtime.time }, glyph);
const arm = (runtime, coefficient = 0.5) =>
  armElementalLightningJolt(runtime.mechanics, { effectiveEnd: runtime.time }, ID.LIGHTNING_JOLT, coefficient);
const wait = (durationMs) => [{ type: 'wait', durationMs }];
const aura = (at, duration = 2) => ({ at, duration, aura: 'Fire Aura', skillName: 'Fixture Aura', sourceId: 1 });

test('Tempest charges require a live elemental and retire on replacement and natural expiry', () => {
  // Delay attacks beyond the lifetime so only lifecycle retirement can clear these charges.
  const result = runElementalist(
    wait(5000),
    { specialization: 'Tempest' },
    {
      catalog: (catalog) =>
        withProfile(catalog, PROFILE.summonedElemental, { initialDelay: 10, durationMultiplier: 2 }),
      timeline: [
        {
          at: 0.1,
          run(runtime) {
            arm(runtime);
            assert.equal(tempestState.from(runtime).pendingLightningJolt, null);
          }
        },
        { at: 0.2, run: summon },
        {
          at: 0.3,
          run(runtime) {
            arm(runtime);
            assert.equal(tempestState.from(runtime).pendingLightningJolt.summonGeneration, 1);
          }
        },
        {
          at: 0.5,
          run(runtime) {
            summon(runtime);
            assert.equal(tempestState.from(runtime).pendingLightningJolt, null);
            arm(runtime);
          }
        }
      ],
      probes: [
        [2.2, (runtime) => assert.equal(tempestState.from(runtime).pendingLightningJolt.summonGeneration, 2)],
        [
          2.5,
          (runtime) => {
            assert.equal(tempestState.from(runtime).pendingLightningJolt, null);
            arm(runtime);
            assert.equal(tempestState.from(runtime).pendingLightningJolt, null);
          }
        ]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(!result.resolvedEvents.some((event) => event.skillId === ID.LIGHTNING_JOLT));
});

test('Tempest consumes the latest charge once before a current-generation strike', () => {
  // A stale boundary cannot spend a replacement actor's charge; repeated grants replace rather than stack.
  const result = runElementalist(
    [{ type: 'combat-start' }, ...wait(8000)],
    { specialization: 'Tempest' },
    {
      catalog: (catalog) => withProfile(catalog, PROFILE.summonedElemental, { initialDelay: 1 }),
      timeline: [
        { at: 0.1, run: summon },
        { at: 0.2, run: (runtime) => arm(runtime) },
        { at: 0.3, run: summon },
        { at: 0.4, run: (runtime) => arm(runtime, 0.4) },
        {
          at: 0.5,
          run(runtime) {
            arm(runtime, 0.8);
            beforeElementalStrike(runtime.mechanics, {
              summonGeneration: 1,
              element: 'Fire',
              companionId: 'elementalist-elemental:1',
              activationId: 'stale'
            });
            assert.equal(tempestState.from(runtime).pendingLightningJolt.coefficient, 0.8);
          }
        }
      ],
      probes: [[7, (runtime) => assert.equal(tempestState.from(runtime).pendingLightningJolt, null)]]
    }
  );
  assert.deepEqual(result.warnings, []);
  const jolts = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.LIGHTNING_JOLT);
  assert.equal(jolts.length, 1);
  assert.equal(jolts[0].coefficient, 0.8);
  assert.equal(jolts[0].summonOwner, 'elementalist-elemental:2');
  const strike = result.resolvedEvents.find(
    (event) =>
      event.type === 'damage' &&
      event.actorType === 'summon' &&
      event.skillId !== ID.LIGHTNING_JOLT &&
      event.at === jolts[0].at
  );
  assert.ok(strike);
  assert.ok(result.resolvedEvents.indexOf(jolts[0]) < result.resolvedEvents.indexOf(strike));
});

test('profession aura sources adjust duration once and record one accepted application', () => {
  // Exercise a direct request, a signet trait, and the resolver's Catalyst combo consequence through live delivery.
  const signet = elementalistCatalog.skillsById.get(ID.SIGNET_OF_FIRE);
  for (const [specialization, selectedTraitIds, produce, expectedDuration] of [
    ['Tempest', [], (runtime) => applyElementalistAura(runtime.mechanics, aura(runtime.time)), 4],
    [
      'Tempest',
      [TRAIT.WRITTEN_IN_STONE],
      (runtime) =>
        applyWrittenInStone(runtime.mechanics, { effectiveEnd: runtime.time }, signet, applyElementalistAura),
      8
    ],
    [
      'Catalyst',
      [TRAIT.ELEMENTAL_EPITOME],
      (runtime) => applyEpitomeCombo(runtime.mechanics, { type: 'combo', at: runtime.time, sourceId: 1 }),
      8
    ]
  ]) {
    const result = runElementalist(
      wait(10000),
      { specialization, startAttunement: 'Fire', selectedTraitIds: [TRAIT.SMOTHERING_AURAS, ...selectedTraitIds] },
      {
        catalog: (catalog) => withProfile(catalog, TRAIT.SMOTHERING_AURAS, { durationMultiplier: 2 }),
        timeline: [{ at: 1, run: produce }],
        probes: [
          [
            1,
            (runtime) => {
              assert.equal(runtime.profession.core.activeAuras.length, 1);
              assert.equal(runtime.profession.core.activeAuras[0].expiresAt, 1 + expectedDuration);
              assert.equal(runtime.facts.ofType('elementalist.aura').length, 1);
            }
          ],
          [1 + expectedDuration, (runtime) => assert.equal(runtime.profession.core.activeAuras.length, 0)]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.events.filter((event) => event.type === 'elementalist.aura').length, 1);
  }
});

test('Core aura consequences precede Tempest and combo auras are never republished', () => {
  // Both ingress paths pay out each selected trait once, in the declared Core-before-elite order.
  for (const combo of [false, true]) {
    const result = runElementalist(
      wait(5000),
      {
        specialization: 'Tempest',
        selectedTraitIds: [
          TRAIT.ZEPHYRS_BOON,
          TRAIT.ELEMENTAL_SHIELDING,
          TRAIT.INVIGORATING_TORRENTS,
          TRAIT.ELEMENTAL_BASTION,
          TRAIT.SMOTHERING_AURAS
        ]
      },
      {
        catalog: (catalog) => withProfile(catalog, TRAIT.SMOTHERING_AURAS, { durationMultiplier: 2 }),
        timeline: [
          {
            at: 1,
            run(runtime) {
              if (combo)
                runtime.effects.emit({
                  kind: 'packet',
                  event: { ...aura(runtime.time), type: 'aura', source: 'Fixture Combo', actorType: 'player' }
                });
              else applyElementalistAura(runtime.mechanics, aura(runtime.time));
            }
          }
        ],
        probes: [
          [
            1,
            (runtime) => {
              assert.equal(runtime.profession.core.activeAuras.length, 1);
              // The combo resolver supplies its materialized duration; profession requests apply their own adjustment.
              assert.equal(runtime.profession.core.activeAuras[0].expiresAt, combo ? 3 : 5);
            }
          ],
          [combo ? 3 : 5, (runtime) => assert.equal(runtime.profession.core.activeAuras.length, 0)]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      result.resolvedEvents.filter((event) => event.type === 'buff').map((event) => event.kind),
      ['fury', 'swiftness', 'protection', 'vigor', 'regeneration', 'alacrity']
    );
    assert.equal(result.events.filter((event) => event.type === (combo ? 'aura' : 'elementalist.aura')).length, 1);
  }
});

test('precombat auras retain state without publishing trait rewards and later applications survive older expiry', () => {
  // Auras are live before combat; each expiry removes only its own elapsed window.
  const result = runElementalist(
    wait(9000),
    { specialization: 'Tempest', selectedTraitIds: [TRAIT.INVIGORATING_TORRENTS] },
    {
      combatStartTime: 3,
      timeline: [
        { at: 1, run: (runtime) => applyElementalistAura(runtime.mechanics, aura(1, 4)) },
        { at: 4, run: (runtime) => applyElementalistAura(runtime.mechanics, aura(4, 4)) }
      ],
      probes: [
        [2, (runtime) => assert.equal(runtime.profession.core.activeAuras.length, 1)],
        [4, (runtime) => assert.equal(runtime.profession.core.activeAuras.length, 2)],
        [
          5,
          (runtime) =>
            assert.deepEqual(
              runtime.profession.core.activeAuras.map((entry) => entry.expiresAt),
              [8]
            )
        ],
        [8, (runtime) => assert.equal(runtime.profession.core.activeAuras.length, 0)]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const rewards = result.resolvedEvents.filter((event) => event.type === 'buff');
  assert.deepEqual(
    rewards.map((event) => [event.kind, event.at]),
    [
      ['vigor', 4],
      ['regeneration', 4]
    ]
  );
});

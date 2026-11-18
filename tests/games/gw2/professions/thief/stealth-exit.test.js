// Synthetic impacts verify stealth exit and Revealed ownership independently of native skill timing.
import assert from 'node:assert/strict';
import test from 'node:test';

import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

for (const skill of thiefCatalog.skillsById.values()) {
  if (!skill.stealthAttack || [ID.DEATHS_JUDGMENT, ID.MALICIOUS_DEATHS_JUDGMENT].includes(skill.id)) continue;

  const skillId = skill.id;

  test(`${skill.name} leaves stealth on its first landed strike without refreshing on later hits`, () => {
    for (const offTarget of [false, true]) {
      const observed = [];
      const result = runThief(
        [
          { type: 'cast', skillId, offTarget },
          { type: 'wait', durationMs: 3000 }
        ],
        {
          specialization: skill.malicious ? 'Deadeye' : 'Core',
          primaryWeapon: skill.requiredMainHand,
          secondaryWeapon: ''
        },
        {
          initialize(runtime) {
            runtime.profession.core.stealthUntil = 10;
          },
          catalog(catalog) {
            const skill = catalog.skillsById.get(skillId);
            const strike = skill.effects.find((effect) => effect.type === 'strike');
            return withSkill(catalog, skillId, {
              castTimeMs: 3000,
              effects: [
                {
                  type: 'strike',
                  actorType: 'player',
                  name: strike.name,
                  ticks: [
                    { atMs: 1000, coefficient: 1 },
                    { atMs: 2000, coefficient: 1 }
                  ],
                  timingAnchor: 'castStart',
                  timingScale: 'fixed'
                }
              ]
            });
          },
          probes: [0.5, 1.5, 2.5, 4.1].map((at) => [
            at,
            (runtime) => {
              const { stealthUntil, revealedUntil } = runtime.profession.core;
              observed.push({ stealthed: stealthUntil > at, revealed: revealedUntil > at, revealedUntil });
            }
          ])
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.deepEqual(
        observed,
        offTarget
          ? [0, 1, 2, 3].map(() => ({ stealthed: true, revealed: false, revealedUntil: 0 }))
          : [
              { stealthed: true, revealed: false, revealedUntil: 0 },
              { stealthed: false, revealed: true, revealedUntil: 4 },
              { stealthed: false, revealed: true, revealedUntil: 4 },
              { stealthed: false, revealed: false, revealedUntil: 4 }
            ]
      );
    }
  });
}

test("Death's Judgment still reveals before its strike", () => {
  for (const skillId of [ID.DEATHS_JUDGMENT, ID.MALICIOUS_DEATHS_JUDGMENT]) {
    const observed = [];
    const result = runThief(
      [skillId],
      {
        specialization: skillId === ID.MALICIOUS_DEATHS_JUDGMENT ? 'Deadeye' : 'Core',
        primaryWeapon: 'Rifle',
        secondaryWeapon: ''
      },
      {
        initialize(runtime) {
          runtime.profession.core.stealthUntil = 10;
        },
        catalog(catalog) {
          const skill = catalog.skillsById.get(skillId);
          const strike = skill.effects.find((effect) => effect.type === 'strike');
          return withSkill(catalog, skillId, {
            castTimeMs: 2000,
            effects: [
              {
                type: 'strike',
                actorType: 'player',
                name: strike.name,
                ticks: [{ atMs: 1000, coefficient: 1 }],
                timingAnchor: 'castStart',
                timingScale: 'fixed'
              }
            ]
          });
        },
        probes: [
          [
            0.5,
            (runtime) =>
              observed.push({
                stealthUntil: runtime.profession.core.stealthUntil,
                revealedUntil: runtime.profession.core.revealedUntil
              })
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(observed, [{ stealthUntil: 0, revealedUntil: 3 }]);
  }
});

test('Guitar charges allow consecutive Ashen Assaults without applying Revealed', () => {
  const result = runThief(['Skritt Swipe', 'Metal Legion Guitar', ID.ASHEN_ASSAULT, ID.ASHEN_ASSAULT], {
    specialization: 'Antiquary',
    primaryWeapon: 'Spear',
    secondaryWeapon: ''
  });
  assert.deepEqual(result.warnings, []);
  assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.ASHEN_ASSAULT));
  const { core, specialization } = observedRuntime(result).profession;
  assert.equal(core.revealedUntil, 0);
  assert.equal(
    specialization.state.antiquaryGuitarCharges.reduce((sum, grant) => sum + grant.count, 0),
    0
  );
});

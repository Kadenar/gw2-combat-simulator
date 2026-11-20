// The player buff and a landed turret hit must both exist; hits cannot extend the buff's deadline.
import assert from 'node:assert/strict';
import test from 'node:test';

import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

for (const lands of [true, false]) {
  test(`Kryptis requires a target hit and preserves buff expiry when strikes ${lands ? 'land' : 'are removed'}`, () => {
    const states = [];
    const result = runThief(
      ['Skritt Swipe', 'Summon Kryptis Turret', { type: 'wait', durationMs: 5000 }],
      { specialization: 'Antiquary' },
      {
        // Synthetic timing isolates mark activation and expiry from native packet calibration.
        catalog(catalog) {
          const skill = catalog.skillsById.get(ID.SUMMON_KRYPTIS_TURRET);
          const strike = skill.effects.find((effect) => effect.type === 'strike');
          return withSkill(catalog, ID.SUMMON_KRYPTIS_TURRET, {
            castTimeMs: 0,
            duration: 3,
            effects: lands
              ? [{ ...strike, ticks: [1000, 2000, 3000, 4000].map((atMs) => ({ atMs, coefficient: 1 })) }]
              : []
          });
        },
        probes: [0.5, 1.5, 4.5].map((at) => [
          at,
          (runtime) => {
            const state = runtime.profession.specialization.state;
            states.push({ window: state.kryptisDamageUntil, marked: state.antiquaryKryptisTargetUntil });
          }
        ])
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.ok(states[0].window > 0);
    assert.equal(states[0].marked, 0);
    assert.equal(states[1].marked, lands ? states[0].window : 0);
    assert.equal(states[2].marked, states[1].marked);
    const hits = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === ID.SUMMON_KRYPTIS_TURRET
    );

    if (lands) {
      assertFlooredDamageMultiplier(hits[1].damage, hits[0].damage, 1.15);
      assert.equal(hits[2].damage, hits[1].damage);
      assert.equal(hits[3].damage, hits[0].damage);
    } else {
      assert.equal(hits.length, 0);
    }
  });
}

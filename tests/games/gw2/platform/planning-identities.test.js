import assert from 'node:assert/strict';
import test from 'node:test';
import { planningState } from '#gw2/platform/results/planning-state.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

// Matching labels must never merge independent cooldowns or ammunition in public observations.
function fixture() {
  const catalog = createCanonicalCatalog({
    generated: [990101, 990102].map((id) => ({ id, name: 'Shared Name', effects: [] }))
  });
  const ammo = new Map([
    [990101, { charges: 0, maximum: 1, recharges: [{ startedAt: 0, work: 5 }], nextRechargeAt: 4 }],
    [990102, { charges: 1, maximum: 2, recharges: [{ startedAt: 0, work: 10 }], nextRechargeAt: 8 }]
  ]);
  const deadlines = new Map([
    [990101, 4],
    [990102, 8]
  ]);
  const capture = () =>
    planningState(
      {
        time: 0,
        profession: {},
        config: {},
        activeWeaponSet: 1,
        catalog,
        cooldownController: {
          cooldownSkillIds: () => deadlines.keys(),
          readyAt: (id) => deadlines.get(id),
          ammoSkillIds: () => ammo.keys(),
          readAmmo: (id) => ammo.get(id)
        }
      },
      undefined,
      () => ({ ready: true }),
      []
    );
  return { ammo, capture };
}

test('same-name skills retain independent planning identities', () => {
  const { capture } = fixture();
  const state = capture();
  assert.deepEqual(state.cooldowns, {
    990101: { readyAt: 4000, remaining: 4000 },
    990102: { readyAt: 8000, remaining: 8000 }
  });
  assert.deepEqual(Object.keys(state.ammoBySkillId), ['990101', '990102']);
  assert.equal(state.ammoBySkillId[990101].charges, 0);
  assert.equal(state.ammoBySkillId[990102].charges, 1);
  assert.equal(Object.hasOwn(state, 'ammo'), false);
});

// Neither editing a result nor advancing its source may mutate another captured observation.
test('planning ammo and recharge progress are detached from their owner and other observations', () => {
  const { ammo, capture } = fixture();
  const first = capture();
  const second = capture();
  first.ammoBySkillId[990101].charges = 99;
  first.ammoBySkillId[990101].recharges[0].work = 99;
  first.cooldowns[990101].remaining = 99;
  assert.equal(ammo.get(990101).charges, 0);
  assert.equal(ammo.get(990101).recharges[0].work, 5);
  assert.equal(second.ammoBySkillId[990101].charges, 0);
  assert.equal(second.ammoBySkillId[990101].recharges[0].work, 5);
  assert.equal(second.cooldowns[990101].remaining, 4000);
  ammo.get(990102).recharges[0].work = 20;
  assert.equal(second.ammoBySkillId[990102].recharges[0].work, 10);
});

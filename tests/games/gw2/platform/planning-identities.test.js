import assert from 'node:assert/strict';
import test from 'node:test';

import { createAutoattackChainController } from '#gw2/platform/execution/autoattack-chains.js';
import { planningState } from '#gw2/platform/results/planning-state.js';
import { SHARED_STATE_IDS as STATE } from '#gw2/platform/results/state-ids.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

// Matching labels must never merge independent cooldowns or ammunition in public observations.
function fixture(flips = {}) {
  const catalog = createCanonicalCatalog({
    skills: [990101, 990102].map((id) => ({ id, name: 'Shared Name', effects: [] }))
  });
  const ammo = new Map([
    [990101, { charges: 0, maximum: 1, recharges: [{ workAnchorAt: 0, work: 5 }], nextRechargeAt: 4 }],
    [990102, { charges: 1, maximum: 2, recharges: [{ workAnchorAt: 0, work: 10 }], nextRechargeAt: 8 }]
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
        flips,
        autoattackController: createAutoattackChainController(catalog),
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
      () => ({}),
      () => ({ ready: true }),
      []
    );
  return { ammo, capture };
}

// Public grouping stays independent of live ownership, including windows visible before they can be used.
test('shared flips are filtered and detached under the profession state key', () => {
  const visible = { identity: 1, visibleAt: 0, availableAt: 2, expiresAt: 3, remainingUses: 2 };
  const flips = {
    990101: visible,
    990102: { ...visible, identity: 2, visibleAt: -2, availableAt: -1, expiresAt: 0 },
    990103: { ...visible, identity: 3, visibleAt: 1 }
  };
  const { capture } = fixture(flips);
  const result = capture();
  assert.equal(Object.hasOwn(result, 'flips'), false);
  assert.deepEqual(result.profession[STATE.AVAILABLE_FLIPS], { 990101: visible });
  result.profession[STATE.AVAILABLE_FLIPS][990101].remainingUses = 1;
  assert.equal(visible.remainingUses, 2);
  assert.equal(capture().profession[STATE.AVAILABLE_FLIPS][990101].remainingUses, 2);
  assert.equal(flips[990102].expiresAt, 0);
});

test('same-name skills retain independent planning identities', () => {
  const { capture } = fixture();
  const state = capture();
  assert.deepEqual(state.cooldownsBySkillId, {
    990101: { readyAtMs: 4000, remainingMs: 4000 },
    990102: { readyAtMs: 8000, remainingMs: 8000 }
  });
  assert.deepEqual(Object.keys(state.ammoBySkillId), ['990101', '990102']);
  // Public ammo contains only display facts, even when the observation includes recharge work.
  assert.deepEqual(state.ammoBySkillId[990101], { charges: 0, maximum: 1, nextRechargeAt: 4 });
  assert.deepEqual(state.ammoBySkillId[990102], { charges: 1, maximum: 2, nextRechargeAt: 8 });
  assert.equal(Object.hasOwn(state, 'ammo'), false);
});

// Neither editing a result nor advancing its source may mutate another captured observation.
test('planning ammo display facts are detached from their owner and other observations', () => {
  const { ammo, capture } = fixture();
  const first = capture();
  const second = capture();
  first.ammoBySkillId[990101].charges = 99;
  first.ammoBySkillId[990101].nextRechargeAt = 99;
  first.cooldownsBySkillId[990101].remainingMs = 99;
  assert.equal(ammo.get(990101).charges, 0);
  assert.equal(ammo.get(990101).nextRechargeAt, 4);
  assert.equal(second.ammoBySkillId[990101].charges, 0);
  assert.equal(second.ammoBySkillId[990101].nextRechargeAt, 4);
  assert.equal(second.cooldownsBySkillId[990101].remainingMs, 4000);
  ammo.get(990102).charges = 2;
  ammo.get(990102).nextRechargeAt = null;
  assert.equal(second.ammoBySkillId[990102].charges, 1);
  assert.equal(second.ammoBySkillId[990102].nextRechargeAt, 8);
});

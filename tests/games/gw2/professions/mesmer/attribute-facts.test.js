import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMesmerCoreAttributes } from '#gw2/professions/mesmer/core/traits/modifiers.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';

// Cached build facts must not freeze signet recharge or timed stacks, or leak across simulation/patch queries.
test('Mesmer reuses fixed query inputs while cooldowns and timed attribute stacks remain live', () => {
  let loadoutReads = 0;
  const context = {
    query: {},
    config: {
      boons: { regeneration: true },
      get selectedSkills() {
        loadoutReads++;
        return ['Signet of Midnight', 'Signet of Domination'];
      }
    },
    time: 0,
    traits: new Set([PROFILE.chaoticPersistence]),
    catalog: {
      balanceProfilesById: new Map([
        [PROFILE.signetOfMidnight, { expertiseBonus: 200 }],
        [PROFILE.signetOfDomination, { conditionDamageBonus: 220 }],
        [PROFILE.chaoticPersistence, { expertiseBonus: 130, concentrationBonus: 270 }],
        [PROFILE.fencersFinesse, { durationMultiplier: 7, maximumStacks: 8, attributePerStack: 12 }]
      ])
    },
    timeline: {
      skillOnCooldownAt: (_id, time) => time === 1,
      timedStacks: (_kind, time, duration, maximum) => {
        assert.equal(duration, 7);
        assert.equal(maximum, 8);
        return time;
      }
    }
  };
  const base = { conditionDamage: 0, expertise: 0, ferocity: 0, concentration: 0 };
  const ready = applyMesmerCoreAttributes(context, base);
  assert.equal(ready.conditionDamage, 220);
  assert.equal(ready.expertise, 330);
  assert.equal(ready.concentration, 270);
  const recharging = applyMesmerCoreAttributes({ ...context, time: 1 }, base);
  assert.equal(recharging.conditionDamage, 0);
  assert.equal(recharging.expertise, 130);
  assert.equal(recharging.ferocity, 12);
  assert.equal(applyMesmerCoreAttributes({ ...context, time: 2 }, base).conditionDamage, 220);
  assert.equal(loadoutReads, 1);
  const patched = {
    ...context,
    query: {},
    catalog: { balanceProfilesById: new Map(context.catalog.balanceProfilesById) }
  };
  patched.catalog.balanceProfilesById.set(PROFILE.signetOfDomination, { conditionDamageBonus: 250 });
  assert.equal(applyMesmerCoreAttributes(patched, base).conditionDamage, 250);
  assert.equal(applyMesmerCoreAttributes(context, base).conditionDamage, 220);
  assert.equal(loadoutReads, 2);
});

test('detached Mesmer attribute queries observe edited loadouts', () => {
  const context = {
    catalog: mesmerCatalog,
    time: 0,
    config: { selectedSkills: ['Signet of Domination'] },
    timeline: { skillOnCooldownAt: () => false, timedStacks: () => 0, timedActive: () => false }
  };
  assert.equal(
    applyMesmerCoreAttributes({ catalog: mesmerCatalog, ...context }, { conditionDamage: 1000 }).conditionDamage,
    1180
  );
  context.config.selectedSkills = [];
  assert.equal(applyMesmerCoreAttributes(context, { conditionDamage: 1000 }).conditionDamage, 1000);
});

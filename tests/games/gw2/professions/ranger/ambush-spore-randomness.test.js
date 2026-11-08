// Ambush spores retain their source skill while sampling strength independently and granting Let Loose only once.
import assert from 'node:assert/strict';
import test from 'node:test';

import { weaponStrengthProfile } from '#gw2/platform/equipment/weapons/strength.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

for (const [skillId, weapon, sporeProfile] of [
  [ID.RELENTLESS_WHIRL, 'Hammer', 'nonweapon.unequipped'],
  [ID.DEFT_STRIKE, 'Sword', 'weapon.sword'],
  [ID.SAVAGE_SLASH, 'Greatsword', 'weapon.greatsword'],
  [ID.RAVAGERS_ABANDON, 'Spear', 'weapon.spear']
]) {
  for (const mode of ['deterministic', 'stochastic']) {
    test(`${weapon} ambush gives its spore independent strength ownership in ${mode} mode`, () => {
      const config = {
        specialization: 'Untamed',
        primaryWeapon: weapon,
        selectedTraitIds: [TRAIT.LET_LOOSE],
        randomness: { mode, seed: 7 }
      };
      const rotation = [ID.UNLEASH_RANGER, skillId];
      const options = { observation: { kind: 'tail', durationMs: 3000 } };
      const result = runRanger(rotation, config, options);
      assert.deepEqual(result.warnings, []);
      assert.equal(
        result.resolvedEvents.filter(
          (event) => event.type === 'buff' && event.kind === 'quickness' && event.sourceId === TRAIT.LET_LOOSE
        ).length,
        1
      );
      const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skillId);
      const weaponHits = hits.filter((event) => event.sourceId === skillId);
      const spores = hits.filter((event) => event.sourceId === ID.EXPLODING_SPORE);
      assert.ok(weaponHits.length > 0);
      assert.ok(spores.length > 0);
      assert.equal(new Set(weaponHits.map((event) => event.activationId)).size, 1);
      assert.equal(new Set(weaponHits.map((event) => event.resolvedWeaponStrength)).size, 1);
      for (const [events, profileId] of [
        [weaponHits, `weapon.${weapon.toLowerCase()}`],
        [spores, sporeProfile]
      ]) {
        const profile = weaponStrengthProfile(profileId);
        for (const event of events) {
          assert.equal(event.weaponStrengthProfileId, profileId);
          assert.equal(event.weaponStrengthSampled, mode === 'stochastic');
          assert.ok(event.resolvedWeaponStrength >= profile.min && event.resolvedWeaponStrength <= profile.max);
        }
      }

      for (const spore of spores) {
        assert.notEqual(spore.activationId, weaponHits[0].activationId);
        assert.equal(spore.actorType, 'player');

        if (mode === 'stochastic') assert.notEqual(spore.resolvedWeaponStrength, weaponHits[0].resolvedWeaponStrength);
      }

      const repeated = runRanger(rotation, config, options);
      const score = runRanger(rotation, config, { ...options, output: 'score' });
      assert.equal(result.totalDamage, repeated.totalDamage);
      assert.equal(result.totalDamage, score.totalDamage);
      assert.deepEqual(score.warnings, []);
    });
  }
}

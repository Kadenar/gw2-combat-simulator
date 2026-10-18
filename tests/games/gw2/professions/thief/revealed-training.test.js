import assert from 'node:assert/strict';
import test from 'node:test';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Compare trait power at each landed hit without depending on a skill's calibrated timing or packet count.
function attack(skillId, weapon, specialization, trained, { repeat = false, timeline = [] } = {}) {
  return runThief(
    repeat ? [skillId, { type: 'wait', durationMs: 4000 }, ID.BLINDING_POWDER, skillId] : [skillId],
    {
      specialization,
      primaryWeapon: weapon,
      secondaryWeapon: '',
      selectedTraitIds: trained ? [TRAIT.REVEALED_TRAINING] : [],
      selectedSkillIds: [ID.BLINDING_POWDER],
      attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, criticalChanceBonus: -100 })
    },
    {
      initialize(runtime) {
        runtime.profession.core.stealthUntil = 10;
      },
      timeline
    }
  );
}

const hits = (result, skillId) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skillId);

for (const [skillId, weapon, specialization] of [
  [ID.SHADOWSQUALL, 'Scepter', 'Core'],
  [ID.MALICIOUS_SHADOWSQUALL, 'Scepter', 'Deadeye'],
  [ID.SNEAK_ATTACK, 'Pistol', 'Core'],
  [ID.MALICIOUS_SNEAK_ATTACK, 'Pistol', 'Deadeye']
]) {
  test(`${specialization} ${weapon} stealth channel gains Revealed Training after its first hit in each cast`, () => {
    const baseline = attack(skillId, weapon, specialization, false, { repeat: true });
    const trained = attack(skillId, weapon, specialization, true, { repeat: true });
    assert.deepEqual(trained.warnings, []);
    const baselineHits = hits(baseline, skillId);
    const seen = new Set();
    let subsequentHitObserved = false;
    for (const [index, hit] of hits(trained, skillId).entries()) {
      const subsequent = seen.has(hit.activationId);
      subsequentHitObserved ||= subsequent;
      assertFlooredDamageMultiplier(hit.damage, baselineHits[index].damage, (subsequent ? 2200 : 2080) / 2000);
      seen.add(hit.activationId);
    }

    assert.ok(subsequentHitObserved);
    assert.equal(seen.size, 2);
  });
}

for (const [skillId, specialization] of [
  [ID.ASHEN_ASSAULT, 'Core'],
  [ID.MALICIOUS_ASHEN_ASSAULT, 'Deadeye']
]) {
  test(`${specialization} Ashen Assault uses live Revealed on subsequent hits without revealing itself`, () => {
    const baseline = attack(skillId, 'Spear', specialization, false);
    const baselineHits = hits(baseline, skillId);
    const noReveal = attack(skillId, 'Spear', specialization, true);
    assert.deepEqual(noReveal.warnings, []);
    assert.equal(observedRuntime(noReveal).profession.core.revealedUntil, 0);
    for (const [index, hit] of hits(noReveal, skillId).entries()) {
      assertFlooredDamageMultiplier(hit.damage, baselineHits[index].damage, 2080 / 2000);
    }

    // Apply an independent Revealed window between hits and let it expire before the final packet.
    const revealAt = (baselineHits[0].at + baselineHits[1].at) / 2;
    const expiresAt = (baselineHits.at(-2).at + baselineHits.at(-1).at) / 2;
    const trained = attack(skillId, 'Spear', specialization, true, {
      timeline: [
        {
          at: revealAt,
          run(runtime) {
            runtime.profession.core.revealedUntil = expiresAt;
          }
        }
      ]
    });
    for (const [index, hit] of hits(trained, skillId).entries()) {
      const revealed = hit.at >= revealAt && hit.at < expiresAt;
      assertFlooredDamageMultiplier(hit.damage, baselineHits[index].damage, (revealed ? 2200 : 2080) / 2000);
    }
  });
}

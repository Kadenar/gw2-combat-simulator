import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { THIEF_SKILL_IDS as THIEF_ID } from '#gw2/professions/thief/data/ids.js';
import { professionRegistry } from '#gw2/app/profession-registry.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';

test('Antiquary replacement owners emit their own packets instead of the authored effects', () => {
  // Skritt Scuffle and Forged Surfer author packets that their live owners replace with pilfers and a timed sequence.
  const config = { specialization: 'Antiquary', selectedSkills: ['Skritt Scuffle'] };
  const result = runGw2Runtime({
    profession: thiefProfession.liveRuntimeFor(config),
    rotation: ['Skritt Scuffle', 'Skritt Swipe', 'Forged Surfer Dash', { type: 'wait', durationMs: 500 }],
    config
  });
  assert.deepEqual(result.warnings, []);
  for (const skillId of [THIEF_ID.SKRITT_SCUFFLE, THIEF_ID.FORGED_SURFER_DASH])
    assert.equal(
      result.events.some(
        (event) => ['damage', 'condition', 'control'].includes(event.type) && event.skillId === skillId
      ),
      false,
      String(skillId)
    );
});

test('Grand Finale uses its live replacement owner and emits one packet for one orb', () => {
  // Replacement packets are authored from the consumed live orb pool.
  const result = runElementalist({
    profession: elementalistProfession,
    rotation: ['Flame Wheel', 'Grand Finale', { type: 'wait', durationMs: 1000 }],
    config: { specialization: 'Core', primaryWeapon: 'Hammer', startAttunement: 'Fire', selectedTraitIds: [] }
  });
  assert.deepEqual(result.warnings, []);
  const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.GRAND_FINALE);
  const packets = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.GRAND_FINALE);
  assert.equal(packets.length, 1);
  assert.equal(packets[0].coefficient, 1.4);
  assert.ok(Math.abs(packets[0].at - action.endsAt - 0.68) < 1e-9);
  assert.equal(result.planningState.profession.hammerOrbs.Fire, null);
});

test('native professions share one skill timing contract', async () => {
  for (const entry of professionRegistry) {
    const catalog = (await entry.loadProfession()).catalog;

    for (const skill of catalog.skills) {
      assert.equal('activation' in skill, false, skill.name);
      assert.equal('castTime' in skill, false, skill.name);
      assert.ok(Number.isFinite(skill.castTimeMs), skill.name);
      assert.ok(skill.castTimeMs >= 0, skill.name);

      if (skill.quicknessCastTimeMs != null) {
        // Summons retain optional measured Quickness durations.
        assert.ok(Number.isFinite(skill.quicknessCastTimeMs), skill.name);
        assert.ok(skill.quicknessCastTimeMs >= 0, skill.name);
      }

      assert.ok(Array.isArray(skill.lockouts), skill.name);
      for (const effect of skill.effects) {
        assert.equal('atMsList' in effect, false, skill.name);
        assert.equal('packetOffsets' in effect, false, skill.name);
        assert.equal('atCastEndOffsetMs' in effect, false, skill.name);
        assert.equal(effect.timingAnchor == null, effect.timingScale == null, skill.name);
      }
    }
  }
});

test('GW2 catalogs separate standard boons from generic timed buffs', async () => {
  for (const entry of professionRegistry) {
    const catalog = (await entry.loadProfession()).catalog;
    const records = [...catalog.skills, ...(catalog.balanceProfiles || [])];
    for (const record of records) {
      for (const status of record.effects || []) {
        if (status.type === 'boon') {
          assert.equal(
            isStandardBoon(status.boon),
            true,
            `${entry.id}: ${record.name} uses nonstandard boon ${status.boon}`
          );
        } else if (status.type === 'buff') {
          assert.equal(
            isStandardBoon(status.kind),
            false,
            `${entry.id}: ${record.name} authors standard boon ${status.kind} as a generic buff`
          );
        }
      }
    }
  }
});

test('native profession weapon swaps share timing policy except Elementalist', async () => {
  for (const entry of professionRegistry) {
    const catalog = (await entry.loadProfession()).catalog;
    const skill = catalog.skillsByName.get('Swap Weapons');

    if (entry.id === 'elementalist') {
      assert.equal(skill, undefined, entry.id);
      continue;
    }

    assert.ok(skill, entry.id);
    assert.equal(skill.castTimeMs, 0, entry.id);
    assert.equal(Number(skill.quicknessCastTimeMs || 0), 0, entry.id);
    assert.equal(skill.rechargeAnchor, 'castStart', entry.id);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { necromancerProfession } from '#gw2/professions/necromancer/definition.js';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';
import { elementalistProfession } from '#gw2/professions/elementalist/definition.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { professionRegistry } from '#gw2/app/profession/registry.js';
import { isStandardBoon } from '#gw2/platform/combat/state/boons.js';

test('Unconditional replacement handlers declare replacement without a mode override', () => {
  for (const [profession, specialization, ids] of [
    [necromancerProfession, 'Core', ['necromancer.minion-command', 'necromancer.summon-madness']],
    [necromancerProfession, 'Harbinger', ['necromancer.elixir', 'necromancer.blight-skill']],
    [
      necromancerProfession,
      'Ritualist',
      ['necromancer.ritualist', 'necromancer.innervate', 'necromancer.weapon-spell']
    ],
    [revenantProfession, 'Core', ['revenant.enchanted-daggers', 'revenant.upkeep', 'revenant.abyssal-raze']],
    [revenantProfession, 'Renegade', ['revenant.heroic-command', 'revenant.orders-from-above']],
    [
      revenantProfession,
      'Conduit',
      [
        'revenant.beguiling-haze',
        'revenant.gladiators-defense',
        'revenant.hex-eater-vortex',
        'revenant.twin-moon-sweep',
        'revenant.release-potential'
      ]
    ],
    [thiefProfession, 'Antiquary', ['thief.forged-surfer', 'thief.skritt-scuffle']]
  ]) {
    const catalog = profession.resolveRuntime({ specialization }).catalog;
    for (const id of ids) {
      const handler = catalog.skillHandlers.get(id);
      assert.equal(handler.mode, 'replace', id);
      assert.equal(handler.resolveMode, undefined, id);
    }
  }
});

test('Grand Finale uses its registered replacement handler and emits one packet for one orb', () => {
  const runtime = elementalistProfession.resolveRuntime({ specialization: 'Core' });
  const skill = runtime.catalog.skillsById.get(ID.GRAND_FINALE);
  assert.equal(skill.handlerId, 'elementalist.grand-finale');
  assert.equal(runtime.catalog.skillHandlers.get(skill.handlerId).mode, 'replace');
  const result = simulateGw2({
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
  assert.equal(result.endState.profession.hammerOrbs.Fire, null);
});

test('native professions share one skill timing contract', async () => {
  for (const entry of professionRegistry) {
    const catalog = (await entry.loadProfession()).catalog;

    for (const skill of catalog.skills) {
      assert.equal('activation' in skill, false, skill.name);
      assert.equal('castTime' in skill, false, skill.name);
      assert.ok(Number.isFinite(skill.castTimeMs), skill.name);

      if (skill.quicknessCastTimeMs != null) {
        assert.equal(skill.castTimeMs, skill.quicknessCastTimeMs * 1.5, skill.name);
      }

      if (skill.unaffectedByQuickness) {
        assert.equal(skill.quicknessCastTimeMs, undefined, skill.name);
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

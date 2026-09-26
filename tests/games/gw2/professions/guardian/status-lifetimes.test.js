import assert from 'node:assert/strict';
import test from 'node:test';
import { boonApplicationsAt } from '#gw2/platform/combat/boons.js';
import { timedBuffAt } from '#gw2/platform/results/query.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { luminaryModifierRules } from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge-rules.js';
import { bindLuminaryUi } from '#gw2/professions/guardian/specializations/luminary/presentation.js';
import { LUMINARY_INITIAL_STATE_SKILL_IDS as INITIAL } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { GUARDIAN_SPEAR_EXPIRY } from '#gw2/professions/guardian/core/live-spear.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { runtimeFor } from '#tests/helpers/live-runtime.js';

const config = { specialization: 'Luminary' };
const wait = (durationMs) => ({ type: 'wait', durationMs });
const state = (result) => runtimeFor(result).profession.specialization.state;
const ui = bindLuminaryUi(guardianCatalog);
const cause = {
  type: 'buff',
  source: 'fixture',
  sourceId: 'aura',
  actorType: 'player',
  at: 0,
  skillName: 'Aura fixture'
};

// Native tasks let microsecond lifetime checks avoid depending on skill animation lengths.
test('Empowered Armaments extends only its live remainder and shares the displayed capped deadline', () => {
  for (const at of [6.039999, 6.04, 6.040001]) {
    const run = (extra) =>
      runGuardian(
        [wait((at + 0.1) * 1000)],
        { ...config, selectedTraitIds: [TRAIT.EMPOWERED_ARMAMENTS] },
        (runtime) => {
          const equip = { skill: guardianCatalog.skillsById.get(ID.DAZZLING_HAMMER), id: 'fixture-equip' };
          runtime.schedule('guardian.luminary.equip-traits', 0.001, equip);
          for (let index = 0; index < extra + 1; index++) runtime.schedule('guardian.luminary.equip-traits', at, equip);
        }
      );
    const result = run(0);
    const buffs = result.events.filter((event) => event.kind === 'guardian-empowered-armaments');
    const first = boonApplicationsAt(result.events, buffs[0].kind, buffs[0].at)[0];
    assert.equal(first.expiresAt, 6.04);
    assert.ok(Math.abs(buffs[1].duration - (6 + Math.max(0, 6.04 - at))) < 1e-9);
    assert.equal(
      state(result).empoweredArmamentsUntil,
      boonApplicationsAt(result.events, buffs[0].kind, at).at(-1).expiresAt
    );
    const capped = run(5);
    const buff = capped.events.filter((event) => event.kind === 'guardian-empowered-armaments').at(-1);
    assert.equal(buff.duration, 20);
    assert.equal(
      state(capped).empoweredArmamentsUntil,
      boonApplicationsAt(capped.events, buff.kind, at).at(-1).expiresAt
    );
  }
});

test('Piercing Stance extends its live duration and imported armaments preserve the supplied duration', () => {
  const result = runGuardian([wait(1), ID.PIERCING_STANCE, ID.PIERCING_STANCE], config);
  const buffs = result.events.filter((event) => event.kind === 'guardian-piercing-stance');
  const first = boonApplicationsAt(result.events, buffs[0].kind, buffs[0].at)[0];
  assert.equal(state(result).piercingStanceUntil, first.expiresAt + 8);
  assert.equal(
    state(result).piercingStanceUntil,
    boonApplicationsAt(result.events, buffs[0].kind, buffs[1].at).at(-1).expiresAt
  );
  const imported = runGuardian([{ skillId: INITIAL.empoweredArmaments, initialStateDurationMs: 14514 }], config);
  const buff = imported.events.find((event) => event.kind === 'guardian-empowered-armaments');
  assert.equal(buff.duration, 14.514);
  assert.equal(
    state(imported).empoweredArmamentsUntil,
    boonApplicationsAt(imported.events, buff.kind, buff.at)[0].expiresAt
  );
});

test('Radiant Armaments damage and display agree through the final live microsecond and weapon replacement', () => {
  const settings = { ...config, selectedTraitIds: [TRAIT.RADIANT_ARMAMENTS] };
  const result = runGuardian([wait(1), ID.ENTER_RADIANT_FORGE, ID.DAZZLING_HAMMER], settings);
  const buff = result.events.find((event) => event.kind === 'guardian-radiant-armaments');
  const expiry = boonApplicationsAt(result.events, buff.kind, buff.at)[0].expiresAt;
  const rule = luminaryModifierRules.find((entry) => entry.id === 'guardian.radiant-armaments');
  for (const time of [expiry - 0.000001, expiry, expiry + 0.000001]) {
    assert.equal(rule.when({ events: result.events, time }), time < expiry);
    assert.equal(Boolean(timedBuffAt(result, buff.kind, time)), time < expiry);
  }

  const replaced = runGuardian([ID.ENTER_RADIANT_FORGE, ID.DAZZLING_HAMMER, ID.LUMINOUS_STAFF], settings);
  assert.equal(rule.when({ events: replaced.events, time: runtimeFor(replaced).time }), false);
});

test('Light Aura refreshes on the effect clock and can be consumed only once before expiry', () => {
  const settings = { ...config, selectedTraitIds: [TRAIT.SOVEREIGN_OF_LIGHT] };
  const initialize = (runtime) => {
    runtime.schedule('guardian.luminary.aura-grant', 0.001, { ...cause, at: 0.001 });
    runtime.schedule('guardian.luminary.aura-grant', 1.001, { ...cause, at: 1.001, duration: 4 });
  };

  const granted = runGuardian([wait(1100)], settings, initialize);
  assert.equal(state(granted).lightAuraUntil, 5.04);
  for (const at of [5.039999, 5.04, 5.040001]) {
    const snapshot = ui.rotationStateSnapshot({ professionState: granted.planningState.profession, atSeconds: at });
    assert.equal(
      snapshot.some((item) => item.id === 'luminary-light-aura'),
      at < 5.04
    );
    const result = runGuardian([wait(5100)], settings, (runtime) => {
      initialize(runtime);
      runtime.schedule('guardian.luminary.aura-detonate', at, { ...cause, at });
      runtime.schedule('guardian.luminary.aura-detonate', at, { ...cause, at });
    });
    assert.equal(
      result.resolvedEvents.filter((event) => event.skillId === ID.SOVEREIGN_OF_LIGHT_DAMAGE).length,
      Number(at < 5.04)
    );
  }
});

test('Effulgent counts the final live microsecond but excludes its exact detonation timestamp', () => {
  const result = runGuardian([wait(1), ID.EFFULGENT_STANCE, wait(4100)], config, (runtime) => {
    for (const at of [4.000999, 4.001, 4.001001])
      runtime.emit({
        type: 'damage',
        source: 'guardian',
        sourceId: ID.ORB_OF_WRATH,
        skillId: ID.ORB_OF_WRATH,
        actorType: 'player',
        coefficient: 1,
        at
      });
  });
  const detonation = result.resolvedEvents.find((event) => event.skillId === ID.EFFULGENT_STANCE_DAMAGE);
  assert.equal(detonation.at, 4.001);
  assert.equal(detonation.coefficient, 0.85);
  assert.equal(state(result).effulgentActiveUntil, 0);
  assert.equal(state(result).effulgentStacks, 0);
});

test('Radiant Forge exits exactly once at its canonical form deadline', () => {
  const result = runGuardian([wait(1), ID.ENTER_RADIANT_FORGE, wait(20001)], config);
  const exits = result.events.filter((event) => event.type === 'weapon_set' && event.skillId === ID.EXIT_RADIANT_FORGE);
  assert.equal(exits.length, 1);
  assert.equal(exits[0].at, 20.001);
  assert.equal(state(result).radiantForge, false);
  assert.equal(runtimeFor(result).cooldowns.get(ID.ENTER_RADIANT_FORGE), 25.001);
});

test('spear illumination expires before accepting a cast at its deadline', () => {
  for (const source of ['armed', 'symbol']) {
    for (const at of [5, 5.04, 5.08]) {
      const result = runGuardian(
        [wait(at * 1000), ID.SOLAR_STORM, wait(2500)],
        { primaryWeapon: 'Spear' },
        (runtime) => {
          const core = runtime.profession.core;
          if (source === 'armed') {
            core.spearIlluminatedArmed = true;
            core.spearIlluminatedUntil = 5.04;
          } else core.spearLuminanceUntil = 5.04;
          runtime.schedule(
            GUARDIAN_SPEAR_EXPIRY,
            5.04,
            { symbol: source === 'symbol', expiresAt: 5.04 },
            undefined,
            -220
          );
        }
      );
      assert.equal(
        result.procSteps.some((step) => step.skill === 'Illuminated'),
        at < 5.04
      );
      assert.ok(runtimeFor(result).profession.core.spearIlluminatedUntil > at);
    }
  }
});

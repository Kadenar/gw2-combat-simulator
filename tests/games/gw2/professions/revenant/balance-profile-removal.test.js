import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/revenant/core/profiles.js';
import { CONDUIT_BALANCE_PROFILE_IDS as CONDUIT } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { RENEGADE_PROFILE_IDS as RENEGADE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { revenantHit, runRevenant } from '#tests/helpers/revenant-simulation.js';

const remove = (type, name) => ({ removeEffects: [{ type, name }] });
const patched = (balanceProfiles) => (catalog) => applyBalanceProfilePatch(catalog, { balanceProfiles });
const RENEGADE_CONFIG = Object.freeze({
  specialization: 'Renegade',
  selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
  startingLegend: LEGEND.RENEGADE,
  initialEnergy: 100
});

test('removed Brutality quickness leaves the weapon-swap cooldown unclaimed', () => {
  // The live owner claims Brutality's cooldown only when it can deliver the Quickness.
  const result = runRevenant(
    ['Swap Weapons'],
    {
      ...RENEGADE_CONFIG,
      selectedTraitIds: [TRAIT.BRUTALITY],
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword',
      weaponSet2Primary: 'Hammer'
    },
    { catalog: patched({ [CORE.brutality]: remove('boon', 'quickness') }) }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).profession.core.traitProcReadyAt.brutality, undefined);
  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.skillId === TRAIT.BRUTALITY),
    false
  );
});

test('removed Battle Scars siphon keeps the scars it would have spent', () => {
  // A landed player strike spends a scar only to deliver its siphon.
  const result = runRevenant([{ type: 'wait', durationMs: 3000 }], RENEGADE_CONFIG, {
    catalog: patched({ [CORE.battleScars]: remove('strike', 'Battle Scars — Life Siphon') }),
    initialize(runtime) {
      runtime.profession.core.battleScars = [30, 10];
      runtime.emit(revenantHit(2));
    }
  });
  assert.deepEqual(observedRuntime(result).profession.core.battleScars, [30, 10]);
  assert.equal(
    result.events.some((event) => event.name === 'Battle Scars — Life Siphon'),
    false
  );
});

test('removed Band Together buff arms no enhancement while the unpatched window still does', () => {
  for (const [balanceProfiles, ready] of [
    [{ [RENEGADE.bandTogether]: remove('buff', 'band-together') }, false],
    [{}, true]
  ]) {
    const result = runRevenant(["Icerazor's Ire"], RENEGADE_CONFIG, { catalog: patched(balanceProfiles) });
    assert.deepEqual(result.warnings, []);
    assert.equal(observedRuntime(result).profession.specialization.state.bandTogetherReady, ready);
  }
});

test('Shared Wisdom boons stay bound to their triggering entity after a sibling removal', () => {
  // Removing Beguiling Haze's grant must not rebind the Entity-skill Swiftness or Gladiator's Defense Stability.
  const buffs = (selectedTraitIds, catalog) =>
    runRevenant(
      ["Gladiator's Defense"],
      {
        specialization: 'Conduit',
        selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
        startingLegend: LEGEND.ENTITY,
        selectedTraitIds,
        initialEnergy: 100
      },
      { catalog }
    )
      .events.filter((event) => event.type === 'buff' && event.skillId === ID.GLADIATORS_DEFENSE)
      .map((event) => event.kind);
  const native = buffs([]);
  assert.deepEqual(
    buffs([TRAIT.SHARED_WISDOM], patched({ [CONDUIT.sharedWisdom]: remove('boon', 'beguiling-haze') })).filter(
      (kind) => !native.includes(kind)
    ),
    ['swiftness', 'stability']
  );
});

test('a missing required Revenant profile fails in the selected catalog', () => {
  assert.throws(
    () =>
      runRevenant(
        ['Swap Weapons'],
        { ...RENEGADE_CONFIG, selectedTraitIds: [TRAIT.INCENSED_RESPONSE] },
        {
          catalog: (catalog) => ({ ...catalog, balanceProfilesById: new Map() })
        }
      ),
    /Invalid balance data: .*missing required profile/
  );
});

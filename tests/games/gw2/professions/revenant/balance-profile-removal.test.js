import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/revenant/core/profiles.js';
import { CONDUIT_BALANCE_PROFILE_IDS as CONDUIT } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { RENEGADE_PROFILE_IDS as RENEGADE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { createRevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import { createRenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { createConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { applyBrutality, consumeBattleScar } from '#gw2/professions/revenant/core/traits/devastation.js';
import { applyIncensedResponse } from '#gw2/professions/revenant/core/traits/invocation.js';
import { completeBandTogether } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { afterConduitTraitCast } from '#gw2/professions/revenant/specializations/conduit/traits/index.js';

const remove = (type, name) => ({ removeEffects: [{ type, name }] });

// Small owner contexts expose the state a removed packet owns without full rotation shapes.
function contextFor(specialization, selectedTraitIds, balanceProfiles = {}) {
  const config = { specialization, selectedTraitIds, boons: {} };
  const events = [];
  return {
    config,
    catalog: applyBalanceProfilePatch(revenantCatalog, { balanceProfiles }),
    profession: revenantProfession,
    start: 0,
    effectiveEnd: 1,
    hasExplicitCombatStart: true,
    combatStartTime: 0,
    action: {},
    state: {
      time: 0,
      cooldowns: new Map(),
      ammo: new Map(),
      profession: {
        core: createRevenantCoreState(config),
        specialization: {
          kind: specialization,
          state: specialization === 'Conduit' ? createConduitState(config) : createRenegadeState()
        }
      }
    },
    events,
    tasks: { schedule() {}, cancelOwner() {} },
    schedulerPolicy: { combatBeganAt: () => 0 },
    hasBuff: () => false,
    emit(event) {
      events.push(event);
      return event;
    },
    emitDerived(_cause, event) {
      return this.emit(event);
    }
  };
}

test('removed Brutality quickness leaves the weapon-swap cooldown unclaimed', () => {
  const context = contextFor('Renegade', [TRAIT.BRUTALITY], { [CORE.brutality]: remove('boon', 'quickness') });
  applyBrutality(context, { type: 'action', skillId: ID.SWAP_WEAPONS, at: 1 });
  assert.equal(context.state.profession.core.traitProcReadyAt.brutality, undefined);
  assert.deepEqual(context.events, []);
});

test('removed Battle Scars siphon keeps the scars it would have spent', () => {
  const context = contextFor('Renegade', [], { [CORE.battleScars]: remove('strike', 'Battle Scars — Life Siphon') });
  context.state.profession.core.battleScars = [30, 10];
  consumeBattleScar(context, { type: 'damage', at: 2 });
  assert.deepEqual(context.state.profession.core.battleScars, [30, 10]);
  assert.deepEqual(context.events, []);
});

test('removed Band Together buff arms no enhancement while the unpatched window still does', () => {
  const skill = revenantCatalog.skillsById.get(ID.ICERAZORS_IRE);
  for (const [balanceProfiles, ready] of [
    [{ [RENEGADE.bandTogether]: remove('buff', 'band-together') }, false],
    [{}, true]
  ]) {
    const context = contextFor('Renegade', [], balanceProfiles);
    completeBandTogether(context, skill, { enhanced: false, profileSkillId: skill.id });
    assert.equal(context.state.profession.specialization.state.bandTogetherReady, ready);
  }
});

test('Shared Wisdom boons stay bound to their triggering entity after a sibling removal', () => {
  const context = contextFor('Conduit', [TRAIT.SHARED_WISDOM], {
    [CONDUIT.sharedWisdom]: remove('boon', 'beguiling-haze')
  });
  const entitySkill = [...revenantCatalog.skillsById.values()].find(
    (skill) => skill.legendId === LEGEND.ENTITY && skill.slot === 'Utility'
  );
  afterConduitTraitCast(context, entitySkill);
  assert.deepEqual(
    context.events.filter((event) => event.type === 'buff').map((event) => event.kind),
    ['swiftness']
  );
});

test('a missing required Revenant profile fails in the selected catalog', () => {
  const context = contextFor('Renegade', [TRAIT.INCENSED_RESPONSE]);
  context.catalog = { ...revenantCatalog, balanceProfilesById: new Map() };
  assert.throws(
    () =>
      applyIncensedResponse(context, {
        type: 'buff',
        kind: 'fury',
        at: 1,
        actorType: 'player',
        resolvedAudience: { includesSelf: true }
      }),
    /Invalid balance data: .*missing required profile/
  );
});

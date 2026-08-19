import { vindicatorState } from './state.js';
import { professionCoreState } from '../../../../platform/engine/profession.js';
/**
 * Revenant dodge execution.
 *
 * Pays the core or Vindicator endurance cost, snapshots the new resource
 * state, and emits the selected dodge replacement's delayed strike from the
 * immutable profile in this specialization's mechanics module.
 */
import { emitRevenantState } from '../../core/shared.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasRevenantTrait } from '../../core/state.js';
import { emitRevenantBoon } from '../../core/boons.js';
import { revenantCombatActive } from '../../core/legend.js';
import { VINDICATOR_BALANCE_PROFILE_IDS } from './skills.js';
import type { BalanceProfile } from '../../../../platform/engine/types.js';
import type { RevenantCastContext, RevenantSchedulerContext, RevenantSkill } from '../../types.js';

function skillById(context: RevenantSchedulerContext, id: string | number): RevenantSkill | undefined {
  return context.catalog.skillsById.get(id);
}

function balanceProfileById(context: RevenantSchedulerContext, id: string | number): BalanceProfile | undefined {
  return context.catalog.balanceProfilesById.get(id);
}

function selectedDodgeSkill(context: RevenantSchedulerContext): RevenantSkill | undefined {
  return skillById(
    context,
    vindicatorState.from(context).selectedDodge === 'Imperial Impact' ? ID.IMPERIAL_IMPACT : ID.DEATH_DROP
  );
}

/** Applies Energy Meld's selected Vindicator trait package. */
export function performEnergyMeld(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = vindicatorState.from(context);
  const coreState = professionCoreState(context);
  const at = context.effectiveEnd;
  const songOfArboreum = hasRevenantTrait(context.config, TRAIT.SONG_OF_ARBOREUM);
  const enduranceProfile = songOfArboreum
    ? balanceProfileById(context, VINDICATOR_BALANCE_PROFILE_IDS.songOfArboreum)
    : skill;
  // Song of Arboreum is mutually exclusive with the base endurance amount.
  coreState.endurance = Math.min(
    coreState.maximumEndurance,
    coreState.endurance + Math.max(0, Number(enduranceProfile?.resourceGain))
  );
  // enduranceUpdatedAt must be stamped after a manual grant so regen calculations start from here.
  coreState.enduranceUpdatedAt = at;
  if (hasRevenantTrait(context.config, TRAIT.REAVERS_CURSE)) {
    const reaversCurse = balanceProfileById(context, VINDICATOR_BALANCE_PROFILE_IDS.reaversCurse);
    const effect = reaversCurse?.effects?.find((candidate) => candidate.type === 'buff');
    // Casting Energy Meld arms Reaver's Curse; the next dodge will consume and zero this timestamp.
    state.reaversCurseUntil = at + Math.max(0, Number(effect?.duration));
  }

  if (
    hasRevenantTrait(context.config, TRAIT.ANGSIYANS_TRUST) &&
    // Angsiyah's Trust energy is gated by combat; pre-combat Energy Meld does not refund energy.
    revenantCombatActive(context, at)
  ) {
    const angsiyansTrust = balanceProfileById(context, VINDICATOR_BALANCE_PROFILE_IDS.angsiyansTrust);
    coreState.energy = Math.min(
      coreState.maximumEnergy,
      coreState.energy + Math.max(0, Number(angsiyansTrust?.resourceGain))
    );
  }

  if (songOfArboreum) {
    const vigor = enduranceProfile?.effects?.find((candidate) => candidate.type === 'boon');
    if (vigor) {
      emitRevenantBoon(
        context,
        skill,
        String(vigor.boon || 'vigor'),
        Number(vigor.duration || 0),
        Number(vigor.stacks || 1),
        { at, sourceId: TRAIT.SONG_OF_ARBOREUM }
      );
    }
  }

  // State snapshot carries endurance value to the resolver; must come after all mutations above.
  emitRevenantState(context, at, 'energy-meld');
}

/** Toggles the active Luxon/Kurzick Alliance skill side. */
export function switchAllianceTactics(context: RevenantCastContext): void {
  const state = vindicatorState.from(context);
  const at = context.effectiveEnd;
  state.allianceSide = state.allianceSide === 'luxon' ? 'kurzick' : 'luxon';
  // State snapshot propagates the new side to the resolver for availability checks.
  emitRevenantState(context, at, 'alliance-tactics');
}

/** Emits the configured Vindicator dodge replacement at cast completion. */
export function completeVindicatorDodge(context: RevenantSchedulerContext, skill: RevenantSkill, start: number): void {
  const state = vindicatorState.from(context);
  const dodge = state.selectedDodge;
  const profile = selectedDodgeSkill(context);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'strike');
  // Guard against a missing or zero-damage entry so a misconfigured dodge produces no event.
  if (!effect || !(Number(effect.coefficient) > 0)) return;
  // Strike timestamp is relative to the start of the dodge animation, not the end of the cast window.
  const at = start + Math.max(0, Number(effect.atMs || 0)) / 1000;
  // epsilon tolerance absorbs floating-point drift when reaversCurseUntil and at are nominally equal.
  const reaversCurse =
    hasRevenantTrait(context.config, TRAIT.REAVERS_CURSE) &&
    Number(state.reaversCurseUntil || 0) + context.epsilon >= at;
  // Consume the buff immediately so a rapid second dodge cannot double-dip.
  if (reaversCurse) state.reaversCurseUntil = 0;
  const reaversCurseProfile = balanceProfileById(context, VINDICATOR_BALANCE_PROFILE_IDS.reaversCurse);
  // Capture forerunner state before the Death Drop below may extend it for this same hit.
  const previousForerunnerUntil = Number(state.forerunnerOfDeathUntil || 0);
  context.emit({
    type: 'damage',
    at,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: dodge,
    name: dodge,
    coefficient:
      Number(effect.coefficient) * (reaversCurse ? Math.max(0, Number(reaversCurseProfile?.damageMultiplier || 1)) : 1),
    hits: Number(effect.hits || 1),
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: 'Unequipped',
    // Baking the flag into the event avoids a resolver time-comparison race when events replay out of order.
    forerunnerOfDeathActive: previousForerunnerUntil > at
  });
  if (dodge === 'Death Drop' && hasRevenantTrait(context.config, TRAIT.FORERUNNER_OF_DEATH)) {
    const forerunner = balanceProfileById(context, VINDICATOR_BALANCE_PROFILE_IDS.forerunnerOfDeath);
    const forerunnerEffect = forerunner?.effects?.find((candidate) => candidate.type === 'buff');
    const duration = Math.max(0, Number(forerunnerEffect?.duration));
    // Forerunner window is set after the damage event is emitted; the current hit benefits from the old window.
    state.forerunnerOfDeathUntil = at + duration;
    context.emit({
      type: 'buff',
      at,
      source: 'revenant',
      sourceId: TRAIT.FORERUNNER_OF_DEATH,
      actorType: 'player',
      skillId: TRAIT.FORERUNNER_OF_DEATH,
      skillName: 'Forerunner of Death',
      name: 'Forerunner of Death',
      kind: String(forerunnerEffect?.kind || 'forerunner-of-death'),
      duration,
      stacks: Number(forerunnerEffect?.stacks || 1)
    });
  }

  emitRevenantState(context, at, 'vindicator-dodge-impact');
}

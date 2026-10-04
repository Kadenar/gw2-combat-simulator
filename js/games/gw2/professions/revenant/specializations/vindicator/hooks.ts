import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { strikeEffectCoefficient } from '#gw2/platform/effects/authoring.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { grantAllianceInvocationEndurance } from '#gw2/professions/revenant/core/traits/behavior.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_AIRBORNE_MS, VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import {
  VINDICATOR_LANDING_TASK,
  scheduleLanding,
  selectedDodge
} from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';
import {
  armReaversCurse,
  consumeReaversCurse,
  forerunnerOfDeathActive,
  grantAngsiyansTrustEnergy,
  reaversCurseMultiplier,
  renewForerunnerOfDeath
} from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

const ENERGY_MELD_IDS = new Set<SkillId>([ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058]);

/** Landing consumes an armed Reaver's Curse, strikes with the Forerunner window it lands in, then renews it. */
function land(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, activationId, origin } = data as { skillId: SkillId; activationId: string; origin: number };
  const profile = selectedDodge(runtime);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'strike' || candidate.type === 'boon');
  if (!profile || !effect) return;
  // An armed charge includes landing exactly at expiry; zero is the unarmed sentinel.
  const reaversCurse = consumeReaversCurse(runtime);
  if (effect.type === 'strike' && strikeEffectCoefficient(effect) > 0) {
    const forerunnerActive = forerunnerOfDeathActive(runtime);
    runtime.effects.emit({
      kind: 'profile',
      profile: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'strike'),
      at: origin,
      attribution: {
        source: 'revenant',
        sourceId: skillId,
        actorType: 'player',
        skillId,
        skillName: profile.name,
        activationId
      },
      transform: (event) => ({
        ...event,
        name: profile.name,
        coefficient: Number(event.coefficient) * reaversCurseMultiplier(runtime, reaversCurse),
        skillWeapon: 'Unequipped',
        forerunnerOfDeathActive: forerunnerActive
      })
    });
    renewForerunnerOfDeath(runtime, profile, activationId);
  }

  // Secondary effects retain their own timing and applications, independent of the strike timeline.
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: profile.effects?.filter((effect) => effect.type === 'boon' || effect.type === 'condition'),
    at: origin,
    fullEnd: runtime.time,
    attribution: {
      source: 'revenant',
      sourceId: profile.id,
      actorType: 'player',
      skillId: profile.id,
      skillName: profile.name,
      activationId
    }
  });
}

/** Energy Meld arms Reaver's Curse and refunds in-combat Energy independently of its boon reward. */
function energyMeld(runtime: RevenantRuntime): void {
  armReaversCurse(runtime);
  // Angsiyan's Trust refunds Energy only in combat.
  grantAngsiyansTrustEnergy(runtime);
}

/** Vindicator owns its dodge landings, Energy Meld, and Alliance invocation on the shared live state. */
export const vindicatorHooks: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  // Both Energy Meld variants grant the same Vigor without coupling it to resource or armed-window changes.

  // The landing-only Dodge input uses the selected dodge's fixed animation.
  castDurationMs: (runtime, skill, duration) =>
    skill.id === SHARED_SKILL_IDS.DODGE ? Math.max(0, selectedDodge(runtime)?.castTimeMs || 0) : duration,
  // Energy Meld variants share the same selected trait reduction.

  modifyEffects: (_runtime, cast, effects) => (cast.skill.id === VINDICATOR_JUMP_SKILL.id ? [] : effects),
  sideEffectHandlers: {
    'revenant.vindicator-jump'(runtime, context) {
      if (context.kind === 'cast')
        scheduleLanding(runtime, context.cast, context.cast.start + VINDICATOR_AIRBORNE_MS / 1000);
    },
    'revenant.vindicator-chain-reset'(runtime) {
      resetAutoattackChains(runtime);
    }
  },
  onCastCommit(runtime, cast) {
    if (ENERGY_MELD_IDS.has(cast.skill.id)) energyMeld(runtime);
    if (cast.skill.id === ID.SWAP_LEGENDS) grantAllianceInvocationEndurance(runtime);
  },
  onCastCancel(runtime, cast) {
    // Ending a cancelled jump also retires any autoattack chain advanced while airborne.
    if (cast.skill.id === VINDICATOR_JUMP_SKILL.id) resetAutoattackChains(runtime);
  },
  tasks: { [VINDICATOR_LANDING_TASK]: land }
};

import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { effectFirstAtMs } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_LANDING_MS } from '#gw2/professions/revenant/data/vindicator-jump.js';
import {
  imperialImpactDodge,
  saintsShieldDodge
} from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const VINDICATOR_LANDING_TASK = 'revenant.vindicator-landing';

/** The grandmaster trait selects the dodge landing, so no separate dodge choice can drift from the build. */
export function selectedDodge(runtime: MechanicQueriesOf<RevenantRuntime>): RevenantSkill | undefined {
  const skillId = saintsShieldDodge(runtime) ?? imperialImpactDodge(runtime) ?? ID.DEATH_DROP;
  return runtime.helpers.skillsById.get(skillId);
}

/** Shared Dodge and Vindicator Jump resolve landings at the authored offset from their landing origin. */
export function scheduleLanding(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>, origin: number): void {
  const profile = selectedDodge(runtime);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'strike' || candidate.type === 'boon');
  if (!profile || !effect) return;
  const offset = effect.type === 'strike' ? effectFirstAtMs(effect) : effect.atMs;
  runtime.schedule(VINDICATOR_LANDING_TASK, canonicalTime(origin + Math.max(0, offset || 0) / 1000), {
    origin,
    skillId: cast.skill.id,
    activationId: cast.id
  });
}

export const VINDICATOR_DODGE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Saint's Shield replaces dodge damage with a party alacrity application at the landing effect point.
  [ID.SAINTS_SHIELD]: {
    castTimeMs: VINDICATOR_LANDING_MS,

    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 4,
        stacks: 1,
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  [ID.DEATH_DROP]: {
    castTimeMs: VINDICATOR_LANDING_MS,

    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 3.3 }],
        name: 'Death Drop',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.IMPERIAL_IMPACT]: {
    castTimeMs: VINDICATOR_LANDING_MS,

    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 2 }],
        name: 'Imperial Impact',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      // The landing chills foes and shares both boons with the party; tooltips read these same packets.
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5,
        audience: { recipients: 'party', maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  }
});

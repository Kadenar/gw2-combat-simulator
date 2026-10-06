import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type { EngineerRuntime, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';

export const BARRIER_ENGINE_TASK = 'engineer.barrier-engine';

/** The passive starts in combat and runs independently of the mech's command lane. */
export function startBarrierEngine(runtime: EngineerRuntime): void {
  if (!hasTrait(runtime, TRAIT.MECH_CORE_BARRIER_ENGINE) || !mechanistState.from(runtime).mech.active) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.MECH_CORE_BARRIER_ENGINE);
  runtime.schedule(BARRIER_ENGINE_TASK, runtime.time + balanceProfileNumber(profile, 'interval'));
}

/** Each passive grant selects up to five recipients, with the mech behind players in recipient priority. */
export function pulseBarrierEngine(runtime: EngineerRuntime): void {
  if (!hasTrait(runtime, TRAIT.MECH_CORE_BARRIER_ENGINE) || !mechanistState.from(runtime).mech.active) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.MECH_CORE_BARRIER_ENGINE);
  runtime.effects.emit({
    kind: 'profile',
    profile,
    attribution: {
      source: 'Trait',
      sourceId: profile.id,
      skillName: profile.name,
      actorType: 'summon',
      metadata: { engineerMech: true }
    }
  });
  startBarrierEngine(runtime);
}

/** Barrier sources share a per-recipient cooldown; only recipients of the accepted barrier gain alacrity. */
export function channelBarrierAlacrity(runtime: EngineerRuntime, event: EngineerResolverEvent): void {
  if (
    !hasTrait(runtime, TRAIT.MECH_FRAME_CHANNELING_CONDUITS) ||
    event.kind !== 'barrier' ||
    (event.actorType !== 'player' && event.ownerActorType !== 'player' && event.summonOwner !== 'engineer.mech')
  )
    return;
  const audience = event.resolvedAudience;
  if (!audience) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.MECH_FRAME_CHANNELING_CONDUITS);
  if (!profile.effects?.some((effect) => effect.type === 'boon' && effect.boon === 'alacrity')) return;
  const interval = balanceProfileNumber(profile, 'internalCooldown');
  const claim = (recipient: string): boolean => {
    const key = `${TRAIT.MECH_FRAME_CHANNELING_CONDUITS}:${recipient}`;
    // A one-second barrier pulse is eligible as soon as this recipient's one-second ICD expires.
    if (canonicalTime(event.at) < canonicalTime(runtime.procs.deadline(key))) return false;
    runtime.procs.setDeadline(key, event.at + interval);
    return true;
  };

  const recipients = [
    ...(audience.includesSelf ? [{ key: 'self', audience: { recipients: 'self' as const } }] : []),
    ...Array.from({ length: audience.alliedPlayerCount }, (_, index) => {
      const ally = audience.alliedPlayerIndex ?? index + 1;
      return {
        key: `ally:${ally}`,
        audience: {
          recipients: 'party' as const,
          affectsSelf: false,
          alliedPlayerIndex: ally,
          maximumRecipients: 1,
          eligibleCompanionIds: []
        }
      };
    }),
    ...audience.companionIds.map((id) => ({
      key: `companion:${id}`,
      audience: { recipients: 'summons' as const, affectsSelf: false, maximumRecipients: 1, eligibleCompanionIds: [id] }
    }))
  ];
  for (const recipient of recipients) {
    if (!claim(recipient.key)) continue;
    runtime.effects.emit({
      kind: 'profile',
      profile,
      cause: event,
      attribution: {
        source: 'Trait',
        sourceId: profile.id,
        skillName: profile.name,
        actorType: 'player'
      },
      transform: (packet) => ({ ...packet, audience: recipient.audience })
    });
  }
}

/** Sigils own trigger transactions and armed effects while sharing combat cooldowns and effect delivery. */
import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { decideCriticalSigils } from '#gw2/platform/equipment/sigils/critical-procs.js';
import { SIGIL_BY_ID, SIGIL_IDS, SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import { gw2SigilIds } from '#gw2/platform/equipment/sigils/loadout.js';
import {
  createCriticalSigilRequest,
  createSigilConditionEvent,
  createSigilDamagePayload
} from '#gw2/platform/equipment/sigils/proc-events.js';
import { SEVERANCE_BUFF_POLICY } from '#gw2/platform/equipment/sigils/severance.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Sigils own their armed state and use shared combat facts, seeded rolls, cooldowns and effect grants. */
interface SigilRuntimeContext extends Pick<
  MechanicContext,
  'config' | 'effects' | 'engagement' | 'activeWeaponSet' | 'random'
> {
  readonly firstHitTime: number | null;
  readonly procs: Pick<MechanicContext['procs'], 'claimCooldown' | 'deadline'>;
  readonly endurance: Pick<MechanicContext['endurance'], 'grant'>;
}

interface CriticalSigilContext extends Pick<SigilRuntimeContext, 'activeWeaponSet' | 'effects'> {
  readonly config: Gw2Config;
  readonly procs: Pick<MechanicContext['procs'], 'deadline' | 'setDeadline'>;
}

type CriticalOutcome = { readonly chance: number; readonly didCrit?: boolean };

/** Callers supply live capabilities at each observation; armed state never leaves the sigil owner. */
export interface SigilRuntime {
  swap(context: SigilRuntimeContext, event: Gw2ResolverEvent): void;
  control(context: SigilRuntimeContext, event: Gw2ResolverEvent): void;
  strike(context: SigilRuntimeContext, event: Gw2ResolverEvent): void;
  criticalHit(context: CriticalSigilContext, event: Gw2ResolverEvent, critical: CriticalOutcome): void;
}

/** Every sigil announcement uses its catalog name and artwork while retaining the triggering skill. */
function announceProc(
  context: Pick<SigilRuntimeContext, 'effects'>,
  id: number,
  event: Gw2ResolverEvent,
  sourceSkill: string | undefined
): void {
  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'sigil',
      name: `Sigil of ${SIGIL_BY_ID[id].name}`,
      at: event.at,
      sourceSkill,
      detail: '',
      icon: SIGIL_PROCS[id].icon || ''
    }
  });
}

/** Each simulation owns its armed sigil effects; cooldowns live in the shared proc registry. */
export function createSigilRuntime(): Readonly<SigilRuntime> {
  let doomPending = false;

  /** Actual eligible hits consume Doom once; misses and post-death packets never enter this function. */
  function consumeDoom(context: SigilRuntimeContext, event: Gw2ResolverEvent): void {
    if (!doomPending || !isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0)) return;

    doomPending = false;
    context.effects.emit({
      kind: 'packet',
      cause: event,
      event: {
        ...createSigilConditionEvent(SIGIL_IDS.DOOM, SIGIL_PROCS[SIGIL_IDS.DOOM], event.skillName || ''),
        at: event.at
      }
    });
    announceProc(context, SIGIL_IDS.DOOM, event, event.skillName);
  }

  /** Swap, control and ordinary strike sigils claim namespaced cooldowns in the shared proc registry. */
  function applyTrigger(
    context: SigilRuntimeContext,
    trigger: 'swap' | 'control' | 'strike',
    event: Gw2ResolverEvent
  ): void {
    if (!context.engagement.hostileEffectsAllowed(event.at)) return;

    if (!context.engagement.active && context.firstHitTime == null && context.engagement.startTime == null) return;

    if (trigger === 'strike' && (!isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0))) return;

    const destination = Number(event.weaponSet);
    const set = trigger === 'swap' && (destination === 1 || destination === 2) ? destination : context.activeWeaponSet;
    for (const id of new Set(gw2SigilIds(context.config, set))) {
      const proc = SIGIL_PROCS[id];

      if (proc?.trigger !== trigger) continue;

      // Defiance also represents flanking; ineligible positional hits must leave the shared ICD untouched.
      if ((id === SIGIL_IDS.ICE || id === SIGIL_IDS.FRAILTY) && !context.config.target?.defiant) continue;

      const cooldownKey = `sigil.${id}`;

      if (id === SIGIL_IDS.SEVERANCE) {
        // Blocked controls never advance the stream; failed rolls leave the cooldown available.
        if (!isInternalCooldownReady(event.at, context.procs.deadline(cooldownKey))) continue;

        const chance = context.config.procRateOverrides?.['sigil.severance'] ?? 1;

        if (!context.random.roll(chance, 'sigil.severance')) continue;
      }

      if (!context.procs.claimCooldown(cooldownKey, event.at, proc.cooldown)) continue;

      const sourceSkill = event.skillName || (trigger === 'swap' ? 'Swap Weapons' : '');

      if (proc.effect === 'next-hit-condition') {
        doomPending = true;
        continue;
      }

      for (const payload of createSigilDamagePayload(id, proc, sourceSkill))
        context.effects.emit({
          kind: 'packet',
          cause: event,
          event: {
            ...payload,
            at: event.at,
            // Only the immediate swap strike samples the outgoing set; delayed conditions keep their live queries.
            ...(trigger === 'swap' && payload.type === 'damage' && event.weaponSwapFromSet != null
              ? { weaponSwapFromSet: event.weaponSwapFromSet }
              : {})
          }
        });

      if (proc.effect === 'endurance') context.endurance.grant(proc.amount ?? 0);

      if (proc.effect === 'severance')
        context.effects.emit({
          kind: 'packet',
          cause: event,
          event: {
            type: 'buff',
            at: event.at,
            kind: 'sigil-severance',
            stacks: 1,
            duration: proc.duration,
            source: 'Sigil',
            sourceId: `sigil.${SIGIL_IDS.SEVERANCE}`,
            actorType: ACTOR.EFFECT
          }
        });

      announceProc(context, id, event, sourceSkill);
    }
  }

  return Object.freeze({
    swap: (context, event) => applyTrigger(context, 'swap', event),
    control: (context, event) => applyTrigger(context, 'control', event),
    strike(context, event) {
      // Accepted strikes consume armed sigils before ordinary strike procs.
      consumeDoom(context, event);
      applyTrigger(context, 'strike', event);
    },
    criticalHit(context, event, critical) {
      const decision = decideCriticalSigils(
        event,
        gw2SigilIds(context.config, context.activeWeaponSet),
        critical,
        context.procs
      );
      const sourceSkill = event.skillName || '';
      // Reserve the whole decision before delivery can reenter and claim a later sigil in the same transaction.
      for (const { id, readyAt } of decision.procs) context.procs.setDeadline(`sigil.${id}`, readyAt);
      for (const { id } of decision.procs) {
        context.effects.emit(createCriticalSigilRequest(id, SIGIL_PROCS[id], event));
        announceProc(context, id, event, sourceSkill);
      }
    }
  } satisfies SigilRuntime);
}

/** Register both configured sets for the run so swapping cannot retire an active effect's owner. */
export function sigilBuffPolicies(config: Gw2Config): readonly BuffStatePolicy[] {
  return Object.freeze(
    [1, 2].some((set) => gw2SigilIds(config, set).includes(SIGIL_IDS.SEVERANCE)) ? [SEVERANCE_BUFF_POLICY] : []
  );
}

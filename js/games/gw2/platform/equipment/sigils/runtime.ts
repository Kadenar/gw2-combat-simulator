import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2SigilSet } from '#gw2/platform/equipment/sigils/rules.js';
import { SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import { createSigilConditionEvent, createSigilStrikeEvent } from '#gw2/platform/equipment/sigils/proc-events.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';

const procs = SIGIL_PROCS as Readonly<Record<string, Gw2SigilProc>>;

/** Actual eligible hits consume Doom once; misses and post-death packets never enter this function. */
export function consumeRuntimeDoom(runtime: Gw2Runtime, event: Gw2ResolverEvent): void {
  if (!runtime.sigil.doomPending || !isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0)) return;
  runtime.sigil.doomPending = false;
  runtime.emitDerived(event, { ...createSigilConditionEvent('Doom', procs.Doom, event.skillName || ''), at: event.at });
  runtime.recordProc('sigil', 'Sigil of Doom', event.at, event.skillName);
}

/** Swap, control and ordinary strike sigils claim the same per-run ICD map as critical sigils. */
export function applyRuntimeSigils(
  runtime: Gw2Runtime,
  trigger: 'swap' | 'control' | 'strike',
  event: Gw2ResolverEvent
): void {
  if (runtime.combatStartPending || (runtime.combatStartTime != null && event.at < runtime.combatStartTime)) return;
  if (!runtime.combatActive && runtime.firstHitTime == null && runtime.combatStartTime == null) return;
  if (trigger === 'strike' && (!isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0))) return;
  const destination = Number(event.weaponSet);
  const set = trigger === 'swap' && (destination === 1 || destination === 2) ? destination : runtime.activeWeaponSet;
  for (const name of new Set(gw2SigilSet(runtime.config, set).names || [])) {
    const proc = procs[name];
    if (proc?.trigger !== trigger || !isInternalCooldownReady(event.at, runtime.sigil.readyAt.get(name) ?? 0)) continue;
    runtime.sigil.readyAt.set(name, event.at + proc.cooldown);
    const sourceSkill = event.skillName || (trigger === 'swap' ? 'Swap Weapons' : '');
    if (proc.effect === 'next-hit-condition') {
      runtime.sigil.doomPending = true;
      continue;
    }

    if (proc.effect === 'strike' || proc.effect === 'strike-condition')
      runtime.emitDerived(event, { ...createSigilStrikeEvent(name, proc, sourceSkill), at: event.at });
    if (proc.effect === 'condition' || (proc.effect === 'strike-condition' && proc.condition))
      runtime.emitDerived(event, { ...createSigilConditionEvent(name, proc, sourceSkill), at: event.at });
    if (proc.effect === 'endurance') runtime.endurance.grant(Number(proc.amount ?? 0));
    if (proc.effect === 'severance')
      runtime.emitDerived(event, {
        type: 'buff',
        at: event.at,
        kind: 'sigil-severance',
        stacks: 1,
        duration: proc.duration,
        source: 'Sigil',
        sourceId: 'sigil.severance',
        actorType: 'effect'
      });
    runtime.recordProc('sigil', `Sigil of ${name}`, event.at, sourceSkill, '', proc.icon);
  }
}

/** Projects generic engine audits into UI facts; raw reference accounting stays alongside the view. */
import type { AuditEvent, EngineFailure, EngineResult } from '#gw2/platform/combat-engine/types.js';
import type { AdaptedEngineRequest, CombatPreviewInput } from '#gw2/platform/simulation/combat-engine-adapter/input.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type { SchedulerStep } from '#gw2/platform/engine/execution/types.js';
import type { Gw2DamageBreakdownEntry, Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2SimulationScore, Gw2SimulationViewResult } from '#gw2/platform/simulation/types.js';
import { rotationApm } from '#gw2/platform/simulation/rotation-apm.js';
import { ROTATION_END_SKILL } from '#gw2/platform/simulation/combat-engine-adapter/observation.js';

export type CombatPreviewOutcome =
  | EngineFailure
  | ({
      readonly ok: true;
      readonly identity: EngineResult['identity'];
      readonly reference: EngineResult;
    } & (
      | { readonly output: 'detailed'; readonly result: Gw2SimulationViewResult }
      | { readonly output: 'score'; readonly result: Gw2SimulationScore }
    ));

const conditionName = (key: string): string =>
  ({ torment_stationary: 'Torment', binding_blade: 'Binding Blade' })[key] ??
  key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
type DamageAudit = Extract<AuditEvent, { type: 'damage' }>;

export function adaptResult(
  reference: EngineResult,
  request: AdaptedEngineRequest,
  input: CombatPreviewInput,
  catalog: CanonicalCatalog,
  output: 'score' | 'detailed' = 'detailed'
): CombatPreviewOutcome {
  const audits = reference.events ?? [];
  const commands = new Map(request.commandSkills.map((command) => [command.skillKey, command]));
  const begin = audits.filter(
    (event): event is Extract<AuditEvent, { type: 'skill_cast_begin' }> =>
      event.type === 'skill_cast_begin' && event.actor === 'player'
  );
  const finishes = new Map(
    audits.flatMap((event) =>
      event.type === 'skill_cast_end' && event.actor === 'player' ? [[event.skill, event.timeMs] as const] : []
    )
  );
  const auditOrder = new Map(audits.map((event, index) => [event, index]));
  const completionOrder = new Map(
    audits.flatMap((event, index) =>
      event.type === 'skill_cast_end' && event.actor === 'player' ? [[event.skill, index] as const] : []
    )
  );
  const marker = begin.find((event) => commands.get(event.skill)?.type === 'combat-start');
  const rotationEnd = begin.find((event) => event.skill === ROTATION_END_SKILL)?.timeMs;
  const observedDeath = audits.find((event) => event.type === 'actor_downstate' && event.actor === 'golem')?.timeMs;
  if (
    input.observationPolicy?.kind === 'absolute' &&
    request.commandSkills.length &&
    rotationEnd === undefined &&
    reference.terminatedBy !== 'downstate'
  ) {
    return {
      ok: false,
      identity: reference.identity,
      code: 'preview.observation-before-rotation-end',
      path: 'observationPolicy.endTimeMs',
      message: 'Absolute observation end precedes rotation completion.'
    };
  }

  // An unaccepted explicit marker never turns preceding damage into an implicit combat window.
  const hasExplicitCombatStart = request.commandSkills.some((command) => command.type === 'combat-start');
  const startMs = marker?.timeMs ?? (hasExplicitCombatStart ? reference.endTick : 0);
  const commandEndMs = request.commandSkills.length ? (rotationEnd ?? reference.endTick) : 0;
  const policy = input.observationPolicy;
  const observationEndMs =
    policy?.kind === 'absolute'
      ? policy.endTimeMs
      : policy?.kind === 'active-skills'
        ? reference.endTick
        : commandEndMs + (policy?.kind === 'tail' ? policy.durationMs : 0);
  const endMs = Math.min(reference.endTick, observationEndMs);
  const deathTime = observedDeath !== undefined && observedDeath <= endMs ? observedDeath : undefined;
  const rotationEndTime = commandEndMs / 1000;
  const damage = audits.filter(
    (event): event is DamageAudit =>
      event.type === 'damage' &&
      event.actor === 'golem' &&
      event.timeMs >= startMs &&
      event.timeMs <= endMs &&
      (!hasExplicitCombatStart || marker !== undefined)
  );
  const playerDamage = damage.filter((event) => event.sourceActor === 'player');
  const environment = damage.filter((event) => event.sourceActor !== 'player');
  const total = (events: readonly DamageAudit[]) => events.reduce((sum, event) => sum + event.damage, 0);
  const positive = playerDamage.filter((event) => event.damage > 0);
  const firstHitTime = positive[0]?.timeMs == null ? null : positive[0].timeMs / 1000;
  const lastHitTime = positive.at(-1)?.timeMs == null ? null : positive.at(-1)!.timeMs / 1000;
  const dpsStartTime = firstHitTime ?? startMs / 1000;
  const dpsWindow = Math.max(0, endMs / 1000 - dpsStartTime);
  const environmentWindow = Math.max(0, (endMs - startMs) / 1000);
  const perSecond = (amount: number, window = dpsWindow) => (window > 0 ? amount / window : 0);
  const strikeDamage = total(playerDamage.filter((event) => event.damageType === 'strike'));
  const totalDamage = total(playerDamage);
  const environmentDamage = total(environment);
  const warnings: string[] = [];
  if (hasExplicitCombatStart && !marker)
    warnings.push('Combat-start command was not reached before the engine stopped.');
  const score: Gw2SimulationScore = {
    output: 'score',
    duration: rotationEndTime,
    combatStartTime: hasExplicitCombatStart ? (marker?.timeMs == null ? null : marker.timeMs / 1000) : firstHitTime,
    hasExplicitCombatStart,
    dpsStartTime,
    dpsWindow,
    firstHitTime,
    lastHitTime,
    deathTime: deathTime == null ? null : deathTime / 1000,
    totalDamage,
    dps: perSecond(totalDamage),
    strikeDamage,
    conditionDamage: totalDamage - strikeDamage,
    environmentDamage,
    environmentDps: perSecond(environmentDamage, environmentWindow),
    warnings
  };
  if (output === 'score') {
    const { events: _events, skillStatus: _status, ...numericReference } = reference;
    return { ok: true, output, identity: reference.identity, reference: numericReference, result: score };
  }

  const source = (key: string) => {
    const metadata = request.damageSources[key];
    const skill = metadata?.skillId == null ? undefined : catalog.skillsById.get(metadata.skillId);
    const name = metadata?.name ?? key;
    return {
      name,
      skillName: name,
      sourceSkill: name,
      source: name,
      sourceId: metadata?.skillId ?? key,
      ...(metadata?.skillId == null ? {} : { skillId: metadata.skillId }),
      icon: skill?.icon ?? '',
      actorType: 'player' as const,
      ...(metadata?.sourceIndex == null
        ? {}
        : { activationId: `preview:${metadata.sourceIndex}`, sourceIndex: metadata.sourceIndex }),
      ...(metadata?.parentSkill ? { parentSkillName: metadata.parentSkill } : {})
    };
  };

  const steps: SchedulerStep[] = [];
  const events: Gw2ResolverEvent[] = [];
  const resolvedEvents: Gw2ResolverEvent[] = [];
  const casts = new Map<string, number>();
  const castsById = new Map<number, number>();
  const procSteps: Gw2SimulationViewResult['procSteps'] = [];
  for (const [eventOrder, event] of audits.entries()) {
    if (event.timeMs > endMs) continue;
    const at = event.timeMs / 1000;
    if (event.type === 'skill_cast_begin') {
      const command = event.actor === 'player' ? commands.get(event.skill) : undefined;
      if (!command) {
        if (!event.skill.startsWith('adapter.'))
          procSteps.push({
            ri: -1,
            type: 'skill_proc',
            skill: source(event.skill).name,
            sourceSkill: source(event.skill).name,
            detail: 'Engine-triggered skill',
            icon: source(event.skill).icon,
            start: event.timeMs,
            end: event.timeMs
          });
        continue;
      }

      const skill = command.skillId == null ? undefined : catalog.skillsById.get(command.skillId);
      const end = finishes.get(event.skill) ?? endMs;
      const name = skill?.name ?? (command.type === 'wait' ? 'Wait' : 'Combat Start');
      const activationId = `preview:${command.sourceIndex}`;
      steps.push({
        ri: command.sourceIndex,
        skill: name,
        skillId: command.skillId,
        start: event.timeMs,
        actualStart: event.timeMs,
        end,
        activationId,
        fullCastMs: command.fullCastMs,
        interrupted: command.interrupted,
        cancelledBeforeCommit: command.cancelledBeforeCommit
      });
      events.push({
        ...source(event.skill),
        name,
        skillName: name,
        source: name,
        sourceId: command.skillId ?? event.skill,
        skillId: command.skillId,
        type: command.type === 'combat-start' ? 'combat_start' : command.type === 'wait' ? 'gw2.wait' : 'action',
        at,
        endsAt: end / 1000,
        fullEndsAt: (event.timeMs + command.fullCastMs) / 1000,
        completed: finishes.has(event.skill),
        interrupted: command.interrupted,
        cancelledBeforeCommit: command.cancelledBeforeCommit,
        activationId,
        eventOrder,
        auditOrder: eventOrder,
        completionOrder: completionOrder.get(event.skill)
      });
      if (command.type === 'cast') {
        casts.set(name, (casts.get(name) ?? 0) + 1);
        castsById.set(command.skillId!, (castsById.get(command.skillId!) ?? 0) + 1);
      }
    } else if (event.type === 'effect_application' && !event.uniqueEffect.startsWith('adapter.')) {
      // Audits expose applications, not individual stack lifetimes; log them without inventing uptime charts.
      events.push({
        ...source(event.sourceSkill),
        type: 'gw2.engine-effect',
        at,
        eventOrder,
        auditOrder: eventOrder,
        detail: `${event.actor}: ${event.uniqueEffect || conditionName(event.effect)} x${event.numStacks} (${event.durationMs / 1000}s)`
      });
    }
  }

  const breakdown = new Map<string, Gw2DamageBreakdownEntry>();
  const conditionTotals = new Map<string, number>();
  for (const event of playerDamage) {
    const presentation = source(event.sourceSkill);
    const strike = event.damageType === 'strike';
    const name = conditionName(event.damageType);
    const at = event.timeMs / 1000;
    resolvedEvents.push({
      ...presentation,
      at,
      flatDamage: event.damage,
      damage: event.damage,
      hits: strike ? 1 : 0,
      eventOrder: auditOrder.get(event),
      auditOrder: auditOrder.get(event),
      ...(strike
        ? { type: 'damage' as const }
        : {
            type: 'condition' as const,
            condition: name,
            duration: 0,
            stacks: 0,
            enginePayout: true,
            damageTicks: [{ at, damage: event.damage }]
          })
    });
    const key = `${presentation.sourceId}:${presentation.name}`;
    const entry = breakdown.get(key) ?? {
      name: presentation.name,
      sourceSkill: presentation.name,
      parentSkill: presentation.parentSkillName ?? '',
      icon: presentation.icon,
      skillId: presentation.skillId,
      sourceId: presentation.sourceId,
      actorType: 'player',
      damage: 0,
      strikeDamage: 0,
      conditionDamage: 0,
      hits: 0,
      casts: castsById.get(presentation.skillId!) ?? 0
    };
    entry.damage += event.damage;
    entry.strikeDamage += strike ? event.damage : 0;
    entry.conditionDamage += strike ? 0 : event.damage;
    entry.hits += strike ? 1 : 0;
    breakdown.set(key, entry);
    if (!strike) conditionTotals.set(name, (conditionTotals.get(name) ?? 0) + event.damage);
  }

  const environmentNames = [...new Set(environment.map((event) => conditionName(event.damageType)))];
  const { output: _output, ...numeric } = score;
  const result: Gw2SimulationViewResult = {
    ...numeric,
    engine: 'preview',
    rotationEndTime,
    steps,
    events,
    resolvedEvents,
    procSteps,
    breakdown: [...breakdown.values()].sort((a, b) => b.damage - a.damage),
    conditionBreakdown: [...conditionTotals].map(([name, damage]) => ({
      name,
      damage,
      dps: perSecond(damage),
      averageStacks: null
    })),
    environmentConditionBreakdown: environmentNames.map((name) => {
      const matching = environment.filter((event) => conditionName(event.damageType) === name);
      const damage = total(matching);
      return {
        name,
        damage,
        dps: perSecond(damage, environmentWindow),
        averageStacks: null,
        stacks: null,
        damageTicks: matching.map((event) => ({ at: event.timeMs / 1000, damage: event.damage }))
      };
    }),
    casts: [...casts].map(([name, count]) => ({ name, count })),
    randomness: { mode: 'deterministic', seed: reference.identity.seed },
    profession: {},
    rotationApm: rotationApm(
      {
        steps,
        stream: {
          events,
          rotationEndTime,
          resolverHandoff: { combatStartTime: marker?.timeMs == null ? null : marker.timeMs / 1000 }
        }
      },
      input.rotation,
      catalog
    )
  };
  return { ok: true, output, identity: reference.identity, reference, result };
}

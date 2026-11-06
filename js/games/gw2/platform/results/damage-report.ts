/** Observes accepted damage without owning combat state; projection returns independent presentation snapshots. */
import { ACTOR, type SimulationActorType } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';

/** Owns resolved damage attribution and critical-hit accounting; presentation must not infer metadata from other events. */
export interface Gw2DamageBreakdownEntry {
  name: string;
  sourceSkill: string;
  parentSkill: string;
  damageBreakdownName?: string;
  icon: string;
  /** Null is valid for effects without a catalog skill ID; their source identity remains separate. */
  skillId?: import('#gw2/platform/skills/types.js').SkillId | null;
  sourceId?: import('#gw2/platform/skills/types.js').SkillId;
  actorType?: SimulationActorType;
  summonKind?: string;
  entityName?: string;
  source?: string;
  damage: number;
  strikeDamage: number;
  conditionDamage: number;
  hits: number;
  // Crit accounting counts seeded critical outcomes in both modes;
  // critEligibleHits is the number of strike hits those crits are drawn from.
  critHits?: number;
  critEligibleHits?: number;
}

export interface Gw2EnvironmentConditionTick {
  readonly at: number;
  readonly damage: number;
}

export interface Gw2EnvironmentConditionBreakdownEntry {
  name: string;
  damage: number;
  damageTicks: Gw2EnvironmentConditionTick[];
}

export interface DamageReportProjection {
  readonly breakdown: Gw2DamageBreakdownEntry[];
  readonly conditionBreakdown: Array<{ name: string; damage: number; dps: number; averageStacks: number }>;
  readonly environmentConditionBreakdown: Gw2EnvironmentConditionBreakdownEntry[];
}

type DamageSource = Readonly<
  Pick<
    Gw2ResolverEvent,
    | 'skillName'
    | 'name'
    | 'parentSkillName'
    | 'skillId'
    | 'sourceId'
    | 'actorType'
    | 'summonKind'
    | 'source'
    | 'entityName'
    | 'damageBreakdownName'
    | 'icon'
  >
>;

export interface DamageReportObserver {
  recordDamage(fact: {
    readonly name: string;
    readonly damage: number;
    readonly component: 'strikeDamage' | 'conditionDamage';
    readonly hits: number;
    readonly source: DamageSource | null;
    readonly didCrit: boolean | null;
  }): void;
  recordConditionSettlement(fact: {
    readonly name: string;
    readonly damage: number;
    readonly stackSeconds: number;
  }): void;
  recordEnvironmentDamage(fact: { readonly name: string; readonly at: number; readonly damage: number }): void;
}

export function createDamageReportRecorder(): {
  readonly observer: DamageReportObserver;
  readonly project: (dpsWindow: number) => DamageReportProjection;
} {
  const breakdown = new Map<string, Omit<Gw2DamageBreakdownEntry, 'damage'>>();
  const conditions = new Map<string, { name: string; damage: number; stackSeconds: number }>();
  const environment = new Map<string, Gw2EnvironmentConditionBreakdownEntry>();
  const observer: DamageReportObserver = {
    recordDamage({ name, damage, component, hits, source, didCrit }) {
      const sourceSkill = source?.skillName || source?.name || name;
      const parentSkill = source?.parentSkillName || '';
      const skillId = source?.skillId ?? null;
      const sourceId = source?.sourceId ?? skillId ?? sourceSkill;
      const identityId = skillId ?? sourceId;
      // Summon subtype prevents clone and phantasm entries from sharing one identity bucket.
      const actorIdentity = source?.summonKind
        ? `${source.actorType}:${source.summonKind}`
        : (source?.actorType ?? source?.source ?? '');
      // Named summons keep separate contributions even when both pets use the same skill.
      const entityName = source?.actorType === ACTOR.SUMMON ? source.entityName || '' : '';
      const key = source ? `${String(identityId)}|${actorIdentity}|${parentSkill}|${name}|${entityName}` : name;
      const current: Omit<Gw2DamageBreakdownEntry, 'damage'> = breakdown.get(key) || {
        name,
        sourceSkill,
        parentSkill,
        damageBreakdownName: source?.damageBreakdownName,
        icon: source?.icon || '',
        skillId,
        sourceId,
        actorType: source?.actorType,
        summonKind: source?.summonKind,
        entityName,
        source: source?.source,
        strikeDamage: 0,
        conditionDamage: 0,
        hits: 0,
        critHits: 0,
        critEligibleHits: 0
      };

      if (current.skillId == null && source?.skillId != null) {
        current.skillId = source.skillId;
      }

      if (current.sourceId == null) {
        current.sourceId = sourceId;
      }

      if (!current.actorType && source?.actorType) {
        current.actorType = source.actorType;
      }

      if (!current.summonKind && source?.summonKind) {
        current.summonKind = source.summonKind;
      }

      if (!current.source && source?.source) {
        current.source = source.source;
      }

      // Retain only the independent damage components; result projection derives their combined total.
      current[component] += damage;
      current.hits += hits;

      // Both modes report the seeded critical outcomes used by proc reactions.
      if (component === 'strikeDamage' && didCrit !== null) {
        const eligible = hits || 0;
        current.critEligibleHits = (current.critEligibleHits || 0) + eligible;
        const critShare = didCrit ? eligible : 0;
        current.critHits = (current.critHits || 0) + critShare;
      }

      breakdown.set(key, current);
    },
    recordConditionSettlement({ name, damage, stackSeconds }) {
      const entry = conditions.get(name) ?? { name, damage: 0, stackSeconds: 0 };
      entry.damage += damage;
      entry.stackSeconds += stackSeconds;
      conditions.set(name, entry);
    },
    recordEnvironmentDamage({ name, at, damage }) {
      const entry = environment.get(name) ?? { name, damage: 0, damageTicks: [] };
      entry.damage += damage;
      entry.damageTicks.push({ at, damage });
      environment.set(name, entry);
    }
  };
  return {
    observer,
    project(dpsWindow) {
      const perSecond = (value: number): number => (dpsWindow > 0 ? value / dpsWindow : 0);
      return {
        breakdown: [...breakdown.values()]
          .map((entry) => ({ ...entry, damage: entry.strikeDamage + entry.conditionDamage }))
          .sort((left, right) => right.damage - left.damage),
        conditionBreakdown: [...conditions.values()]
          .map((entry) => ({
            name: entry.name,
            damage: entry.damage,
            dps: perSecond(entry.damage),
            averageStacks: perSecond(entry.stackSeconds)
          }))
          .sort((left, right) => right.damage - left.damage),
        environmentConditionBreakdown: [...environment.values()]
          .filter((entry) => entry.damage > 0)
          .map((entry) => ({ ...entry, damageTicks: entry.damageTicks.map((tick) => ({ ...tick })) }))
          .sort((left, right) => right.damage - left.damage)
      };
    }
  };
}

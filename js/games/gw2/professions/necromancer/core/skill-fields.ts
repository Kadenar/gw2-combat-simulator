import { dataField, defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Necromancer shroud, minion, and condition-transfer fields read only by Necromancer mechanics. */
export const NECROMANCER_CORE_SKILL_FIELDS = defineSkillFields(
  {
    // Summon activations select their canonical autonomous attack skill; actor tuning stays with that attack.
    summonAttackId: dataField,
    commandId: dataField,
    minionCount: numberField({ patch: 'primary' }),
    pulseInterval: numberField({ unit: 'seconds', patch: 'advanced' }),
    lifeForceGain: numberField({ patch: 'primary' }),
    // Minion attack timings are measured actor behavior, not patch-note values, so patches cannot edit them.
    openingAttackWindupMs: numberField({ unit: 'milliseconds' }),
    commandRecoveryDelayMs: numberField({ unit: 'milliseconds' }),
    basePower: numberField({ patch: 'primary' }),
    weaponStrength: numberField({ patch: 'primary' }),
    damagePerCoefficient: numberField({ patch: 'primary' }),
    criticalChance: numberField({ patch: 'primary' }),
    criticalDamage: numberField({ patch: 'primary' }),
    // Every Nth autonomous attack uses the alternate packets; an attack-cycle internal that authoring never shows.
    alternateEvery: numberField({ runtimeOnly: true }),
    // Core Dhuumfire reads skill-owned duration overrides from Harbinger and Scourge.
    dhuumfireDuration: numberField({ patch: 'primary', unit: 'seconds' }),
    // Shroud entries explicitly select skill-owned Core tuning or elite minor-trait tuning.
    shroudTuning: dataField,
    lifeForceDrain: numberField({ patch: 'primary' }),
    // Soul Shards checks target health, independently of the fixed full-health player.
    threshold: numberField({ maximum: 1, patch: 'primary' }),
    damageMultiplier: numberField({ patch: 'primary' }),
    // Shroud bar slot this skill occupies.
    shroudSlot: dataField,
    // Remains castable while a shroud is active.
    usableInShroud: dataField,
    // Percentage of maximum life force required to enter the shroud.
    minimumShroudLifeForcePercent: numberField({ maximum: 100 }),
    // Minion state this skill summons or commands.
    minionKey: dataField,
    // Starts recharging when its minion dies.
    rechargeOnMinionDeath: dataField,
    // Lifetime in seconds of the summoned minion.
    summonDuration: numberField(),
    // Seconds between summoned minion attacks; measured actor timing, not patchable.
    summonInterval: numberField({ unit: 'seconds' }),
    // Conditions moved from the player to the target.
    conditionsTransferred: numberField({ patch: 'primary' }),
    // Cap on conditions consumed or transferred by the skill.
    maximumConditions: numberField(),
    // Conditions consumed from the player by the skill.
    consumes: numberField(),
    // Seconds between a minion command and its impact.
    impactDelay: numberField()
  },
  'Necromancer Core'
);

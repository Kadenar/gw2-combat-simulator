const CLARITY_DURATION = 15;
const CLARITY_ICON =
  "https://wiki.guildwars2.com/wiki/Special:FilePath/Clarity.png";
const CLARITY_CONSUMERS = new Set([
  "Imaginary Inversion",
  "Phantasmal Lancer",
  "Mental Collapse",
]);

/**
 * Applies the scheduled effects of ordinary skills.
 */
export function createSkillEffectController({
  state,
  config,
  traits,
  resourceDefinition,
  phantasmNameBySkill,
  phantasmAttackTimings,
  allSkills,
  skillsByName,
  epsilon,
  activePrimaryWeapon,
  currentResource,
  markCompounding,
  queueResources,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  traitDamage,
}) {
  const handleGenericSkill = (skill, at, castStart = at) => {
    const clarityConsumed =
      CLARITY_CONSUMERS.has(skill.name)
      && state.profession.clarityUntil > castStart;
    if (CLARITY_CONSUMERS.has(skill.name)) {
      state.profession.clarityUntil = 0;
    }
    const pulseCount = Math.max(
      1,
      Math.trunc(Number(skill.pulseCount || 1)),
    );
    const pulseTimes =
      pulseCount > 1
        ? Array.from(
            { length: pulseCount },
            (_, index) =>
              castStart + ((at - castStart) * (index + 1)) / pulseCount,
          )
        : [];
    const etherCloneAtMaximum =
      skill.name === "Ether Clone"
      && resourceDefinition.singular === "clone"
      && currentResource() >= resourceDefinition.maximum;
    const isPhantasm = skill.resource?.mode === "phantasm";
    const bountifulBerserker =
      skill.name === "Phantasmal Berserker"
      && traits.has("Bountiful Blades");
    const bountifulBerserkerDamage = bountifulBerserker ? 0.66 : 1;
    const phantasmCount = isPhantasm
      ? Number(skill.resource?.count || 1)
        * (skill.name === "Phantasmal Lancer" && clarityConsumed ? 2 : 1)
        * (bountifulBerserker ? 2 : 1)
      : 1;
    const phantasmName = phantasmNameBySkill[skill.name] || skill.name;
    const phantasmTiming = phantasmAttackTimings[phantasmName];
    const hasChronophantasma =
      isPhantasm && traits.has("Chronophantasma");
    const phantasmSpeed = traits.has("Phantasmal Haste") ? 1.5 : 1;
    const phantasmEndpoint = (offset) => {
      const measuredCastTime = Number(phantasmTiming?.castTime || 0);
      const measuredPostCast = Number(offset) - measuredCastTime;
      const actualCastTime = at - castStart;
      return castStart + actualCastTime + measuredPostCast / phantasmSpeed;
    };
    const phantasmDamageAt = phantasmEndpoint(phantasmTiming?.damage);
    const phantasmSpawnAt = phantasmEndpoint(phantasmTiming?.spawn);
    const chronophantasmaDamageAt = phantasmEndpoint(
      phantasmTiming?.chronophantasmaDamage,
    );
    const phantasmConversionAt = hasChronophantasma
      ? phantasmEndpoint(phantasmTiming?.chronophantasmaSpawn)
      : phantasmSpawnAt;
    const virtuosoBladeHits =
      resourceDefinition.singular === "blade"
      && !hasChronophantasma
      && Array.isArray(phantasmTiming?.virtuosoBladeHits)
        ? phantasmTiming.virtuosoBladeHits
        : null;
    let chronophantasmaProc = false;

    if (isPhantasm) {
      if (traits.has("Compounding Power")) {
        markCompounding(at, phantasmCount);
        addTraitProc(
          "Compounding Power",
          at,
          skill.name,
          `${phantasmCount} phantasm${phantasmCount === 1 ? "" : "s"}`,
        );
      }
      addEvent({
        type: "mesmer.phantasm-summoned",
        at,
        name: skill.name,
        count: phantasmCount,
      });
      addEvent({
        type: "mesmer.phantasm-attack",
        at: phantasmDamageAt,
        name: skill.name,
        count: phantasmCount,
        repeat: false,
        complete: true,
      });
      if (traits.has("Phantasmal Blades")) {
        const blade = traitDamage["Phantasmal Blade"];
        addDamage(
          {
            name: "Phantasmal Blade",
            weapon: skill.weapon,
            blade: true,
          },
          phantasmDamageAt,
          {
            coefficient: blade.coefficient * phantasmCount,
            hits: blade.hits * phantasmCount,
            source: "Player",
            weaponStrength: blade.weaponStrength,
          },
        );
        addTraitProc("Phantasmal Blades", phantasmDamageAt, skill.name);
      }
      if (hasChronophantasma) {
        if (traits.has("Compounding Power")) {
          markCompounding(phantasmSpawnAt, phantasmCount);
          addTraitProc(
            "Compounding Power",
            phantasmSpawnAt,
            `${skill.name} — Chronophantasma`,
            `${phantasmCount} phantasm${phantasmCount === 1 ? "" : "s"}`,
          );
        }
        addEvent({
          type: "mesmer.phantasm-resummoned",
          at: phantasmSpawnAt,
          name: skill.name,
          count: phantasmCount,
        });
        addEvent({
          type: "mesmer.phantasm-attack",
          at: chronophantasmaDamageAt,
          name: skill.name,
          count: phantasmCount,
          repeat: true,
          complete: true,
        });
        if (traits.has("Phantasmal Blades")) {
          const blade = traitDamage["Phantasmal Blade"];
          addDamage(
            {
              name: "Phantasmal Blade",
              weapon: skill.weapon,
              blade: true,
            },
            chronophantasmaDamageAt,
            {
              coefficient: blade.coefficient * phantasmCount,
              hits: blade.hits * phantasmCount,
              source: "Player",
              weaponStrength: blade.weaponStrength,
            },
          );
          addTraitProc(
            "Phantasmal Blades",
            chronophantasmaDamageAt,
            `${skill.name} — Chronophantasma`,
          );
        }
      }
    }

    for (const group of skill.damage || []) {
      if (group.requiredTrait && !traits.has(group.requiredTrait)) {
        continue;
      }
      const hitAt = group.source === "Phantasm"
        ? phantasmDamageAt
        : at + Number(group.delay || 0);
      const selectedGroup =
        skill.boonlessCoefficient && config.target?.boonless
          ? { ...group, coefficient: skill.boonlessCoefficient }
          : group;
      const scaledGroup =
        group.source === "Phantasm" && phantasmCount > 1
          ? {
              ...selectedGroup,
              coefficient:
                Number(selectedGroup.coefficient || 0)
                * phantasmCount
                * bountifulBerserkerDamage,
              hits: Number(selectedGroup.hits || 1) * phantasmCount,
            }
          : selectedGroup;
      const interval = Number(group.interval || 0);
      if (
        interval > 0
        && Number(scaledGroup.hits || 1) > 1
      ) {
        const hits = Math.max(
          1,
          Math.trunc(Number(scaledGroup.hits || 1)),
        );
        for (let index = 0; index < hits; index += 1) {
          addDamage(
            skill,
            at + Number(group.firstDelay || 0) + index * interval,
            {
              ...scaledGroup,
              coefficient: Number(scaledGroup.coefficient || 0) / hits,
              hits: 1,
            },
          );
        }
      } else if (
        pulseTimes.length > 0
        && group.source !== "Phantasm"
        && Number(scaledGroup.hits || 1) === pulseCount
      ) {
        for (const pulseAt of pulseTimes) {
          addDamage(skill, pulseAt, {
            ...scaledGroup,
            coefficient: Number(scaledGroup.coefficient || 0) / pulseCount,
            hits: 1,
          });
        }
      } else {
        addDamage(skill, hitAt, scaledGroup);
      }
      if (group.source === "Phantasm" && hasChronophantasma) {
        addDamage(skill, chronophantasmaDamageAt, scaledGroup, {
          name: `${skill.name} — Chronophantasma`,
          multiplier: 1.05,
        });
        if (!chronophantasmaProc) {
          addTraitProc("Chronophantasma", phantasmSpawnAt, skill.name);
          chronophantasmaProc = true;
        }
      }
      if (
        traits.has("Fencer's Finesse")
        && skill.weapon === "Sword"
        && group.source === "Phantasm"
      ) {
        addEvent({
          type: "buff",
          at: phantasmDamageAt + epsilon,
          kind: "fencer",
          stacks: Math.min(10, Number(scaledGroup.hits || 1)),
          duration: 6,
        });
        if (hasChronophantasma) {
          addEvent({
            type: "buff",
            at: chronophantasmaDamageAt + epsilon,
            kind: "fencer",
            stacks: Math.min(10, Number(scaledGroup.hits || 1)),
            duration: 6,
          });
        }
      }
    }
    if (skill.trackedHitDamage) {
      const tracking = skill.trackedHitDamage;
      const minimum = at - Number(tracking.duration || 0);
      const recentHits = (state.profession.trackedSkillHits.get(skill.id) || [])
        .filter((hitAt) => hitAt > minimum + epsilon);
      const currentHits = (skill.damage || []).reduce(
        (sum, group) =>
          sum + (
            group.source === "Player"
              ? Math.max(1, Math.trunc(Number(group.hits || 1)))
              : 0
          ),
        0,
      );
      recentHits.push(...Array(currentHits).fill(at));
      const required = Math.max(
        1,
        Math.trunc(Number(tracking.hitsRequired || 1)),
      );
      while (recentHits.length >= required) {
        recentHits.splice(0, required);
        addDamage(skill, at, tracking.damage, {
          blade: skill.blade,
          name: tracking.damage.label,
        });
      }
      state.profession.trackedSkillHits.set(skill.id, recentHits);
    }

    const appliedConditions = etherCloneAtMaximum
      ? skill.maxCloneConditions || []
      : skill.conditions || [];
    const conditionAt = isPhantasm ? phantasmDamageAt : at;
    for (const condition of appliedConditions) {
      const scaledCondition =
        isPhantasm && phantasmCount > 1
          ? {
              ...condition,
              stacks: Number(condition.stacks || 1) * phantasmCount,
            }
          : condition;
      if (
        pulseTimes.length > 0
        && !isPhantasm
        && Number(scaledCondition.stacks || 1) === pulseCount
      ) {
        for (const pulseAt of pulseTimes) {
          addCondition(skill.name, pulseAt, {
            ...scaledCondition,
            stacks: 1,
          });
        }
      } else {
        addCondition(
          skill.name,
          conditionAt,
          scaledCondition,
          isPhantasm ? "Phantasm" : "Player",
        );
      }
    }
    if (isPhantasm && hasChronophantasma && appliedConditions.length > 0) {
      for (const condition of appliedConditions) {
        const scaledCondition =
          phantasmCount > 1
            ? {
                ...condition,
                stacks: Number(condition.stacks || 1) * phantasmCount,
              }
            : condition;
        addCondition(
          skill.name,
          chronophantasmaDamageAt,
          scaledCondition,
          "Phantasm",
          `${skill.name} — Chronophantasma`,
        );
      }
    }

    if (skill.resource?.mode === "fill") {
      queueResources(
        at + epsilon,
        resourceDefinition.maximum,
        skill.weapon || activePrimaryWeapon(),
        skill.name,
      );
    } else if (skill.resource?.mode === "add" && !etherCloneAtMaximum) {
      queueResources(
        at + epsilon,
        skill.resource.count,
        skill.weapon || activePrimaryWeapon(),
        skill.name,
      );
    } else if (skill.resource?.mode === "phantasm" && virtuosoBladeHits) {
      for (let index = 0; index < phantasmCount; index += 1) {
        const measuredOffset =
          virtuosoBladeHits[Math.min(index, virtuosoBladeHits.length - 1)];
        queueResources(
          phantasmEndpoint(measuredOffset) + epsilon,
          1,
          null,
          `${skill.name} phantasm conversion`,
        );
      }
    } else if (skill.resource?.mode === "phantasm") {
      queueResources(
        phantasmConversionAt + epsilon,
        phantasmCount,
        null,
        `${skill.name} phantasm conversion`,
      );
    }

    if (skill.name === "Mind the Gap") {
      state.profession.clarityUntil = at + CLARITY_DURATION;
      addEvent({
        type: "proc",
        procType: "skill",
        at,
        name: "Clarity",
        sourceSkill: skill.name,
        detail: "Spear skills 3-5 empowered for 15s",
        icon: CLARITY_ICON,
      });
    }
    if (skill.name === "Signet of the Ether") {
      for (const phantasmSkill of allSkills.filter(
        (candidate) => candidate.phantasm,
      )) {
        state.cooldowns.delete(phantasmSkill.id);
      }
      addEvent({
        type: "marker",
        at,
        name: "Signet of the Ether",
        detail: "Phantasm skill cooldowns reset",
      });
    }
    if (skill.name === "Mental Collapse") {
      const mindTheGap = skillsByName.get("Mind the Gap");
      if (mindTheGap) {
        state.cooldowns.delete(mindTheGap.id);
        addEvent({
          type: "marker",
          at,
          name: "Mental Collapse",
          detail: "Mind the Gap cooldown reset",
        });
      }
    }
    if (skill.type === "Heal" && traits.has("Method of Madness")) {
      const storm = traitDamage["Lesser Chaos Storm"];
      const readyAt =
        state.profession.traitReadyAt.get("Method of Madness") || 0;
      if (at >= readyAt - epsilon) {
        addDamage(
          {
            name: "Lesser Chaos Storm",
            weapon: "Utility",
            blade: false,
          },
          at,
          {
            coefficient: storm.coefficient,
            hits: storm.hits,
            source: "Player",
            weapon: "utility",
          },
        );
        addTraitProc("Method of Madness", at, skill.name);
        state.profession.traitReadyAt.set(
          "Method of Madness",
          at + storm.cooldown,
        );
        if (traits.has("Syncopate")) {
          const syncopate = traitDamage.Syncopate;
          addDamage(
            {
              name: "Syncopate",
              weapon: "Utility",
              blade: false,
            },
            at,
            {
              coefficient: syncopate.coefficient,
              hits: syncopate.hits,
              source: "Player",
              weapon: "utility",
            },
          );
          addTraitProc("Syncopate", at, "Lesser Chaos Storm");
        }
      }
    }
    if (
      traits.has("Fencer's Finesse")
      && skill.weapon === "Sword"
      && (skill.damage || []).some((group) => group.source === "Player")
    ) {
      addEvent({
        type: "buff",
        at: at + epsilon,
        kind: "fencer",
        stacks: Math.min(
          10,
          skill.damage.reduce(
            (sum, group) =>
              sum
              + (group.source === "Player" ? Number(group.hits || 1) : 0),
            0,
          ),
        ),
        duration: 6,
      });
      addTraitProc("Fencer's Finesse", at + epsilon, skill.name);
    }
    return clarityConsumed;
  };

  return {
    handleGenericSkill,
  };
}

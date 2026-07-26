import { MESMER_TRAIT_IDS as TRAIT } from "../data/ids.js";

const MIRAGE_CLOAK_SKILLS = new Set([
  "Illusionary Ambush",
  "Sand through Glass",
]);

/**
 * Owns Mirage cloak, ambush, and shatter reactions.
 */
export function createMirageActionController({
  state,
  config,
  traits,
  ambushAttacks,
  cloneAttacks,
  skillsByName,
  epsilon,
  addEvent,
  addTraitProc,
  addCondition,
  addDamage,
  activePrimaryWeapon,
  queueResources,
  currentResource,
}) {
  const addBoon = (at, boon, sourceSkill) => {
    addEvent({
      type: "buff",
      at,
      kind: String(boon.name || "").toLowerCase(),
      stacks: Number(boon.stacks || 1),
      duration: Number(boon.duration || 0),
      sourceSkill,
    });
  };

  const addAmbushVulnerability = (at, ambush) => {
    if (!ambush.vulnerability) return;
    addEvent({
      type: "buff",
      at,
      kind: "target-vulnerability",
      stacks: ambush.vulnerability.stacks,
      duration: ambush.vulnerability.duration,
      sourceSkill: ambush.name,
    });
    addEvent({
      type: "weakness_vulnerability",
      at,
      skillName: ambush.name,
    });
  };

  const executeCloneAmbushes = (at, clones = state.profession.clones) => {
    if (!traits.has(TRAIT.INFINITE_HORIZON) || !clones.length) return;
    addTraitProc(
      "Infinite Horizon",
      at,
      activePrimaryWeapon(),
      `${clones.length} clone${clones.length === 1 ? "" : "s"}`,
    );
    for (const clone of clones) {
      const weapon = clone.weapon || activePrimaryWeapon();
      const ambush = ambushAttacks[weapon];
      if (!ambush) continue;
      const attack = cloneAttacks[weapon] || cloneAttacks.Sword;
      const pseudo = { name: ambush.name, weapon, blade: false };
      const impactAt = at + Number(ambush.clone.activation || 0);
      addDamage(
        pseudo,
        impactAt,
        {
          coefficient: ambush.clone.coefficient,
          hits: ambush.clone.hits,
          source: "Clone",
        },
        {
          cloneId: clone.id,
          weaponStrength: attack.weaponStrength,
          source: "Clone",
          name: `${ambush.name} — Clone`,
        },
      );
      for (const condition of ambush.clone.conditions || []) {
        addCondition(
          `${ambush.name} — Clone`,
          impactAt,
          condition,
          "Clone",
          "",
          { cloneId: clone.id },
        );
      }
      for (const boon of ambush.cloneBoons || []) {
        addBoon(impactAt, boon, `${ambush.name} — Clone`);
      }
    }
  };

  const grantAmbushWindow = (at, source, duration = 1.5) => {
    if (config.specialization !== "Mirage") return;
    state.profession.ambushUntil = Math.max(
      state.profession.ambushUntil,
      at + duration,
    );
    state.profession.ambushSource = source;
    addEvent({
      type: "marker",
      at,
      name: "Ambush Window",
      detail: `${source} (${duration}s)`,
    });
  };

  const reduceDuneCloakShatters = (at, source) => {
    if (!traits.has(TRAIT.DUNE_CLOAK)) return;
    for (const name of ["Mind Wrack", "Cry of Frustration"]) {
      const shatter = skillsByName.get(name);
      const readyAt = shatter ? state.cooldowns.get(shatter.id) : null;
      if (readyAt != null) {
        state.cooldowns.set(shatter.id, Math.max(at, readyAt - 1));
      }
    }
    addTraitProc(
      "Dune Cloak",
      at,
      source,
      "Mind Wrack and Cry of Frustration recharge reduced by 1s",
    );
  };

  const grantMirageCloak = (
    at,
    source,
    { duration = 0.75, grantCloneCloak = true } = {},
  ) => {
    if (config.specialization !== "Mirage") return;
    grantAmbushWindow(at, source);
    addEvent({
      type: "buff",
      at,
      kind: "mirage-cloak",
      stacks: 1,
      duration,
      sourceSkill: source,
    });
    if (traits.has(TRAIT.RENEWING_OASIS)) {
      addBoon(at, { name: "Regeneration", duration: 4 }, source);
      addTraitProc("Renewing Oasis", at, source, "4s regeneration");
    }
    if (traits.has(TRAIT.ELUSIVE_MIND)) {
      addTraitProc("Elusive Mind", at, source, "3 conditions removed");
    }
    reduceDuneCloakShatters(at, source);
    if (grantCloneCloak && traits.has(TRAIT.INFINITE_HORIZON)) {
      state.profession.cloneAmbushUntil = at + duration;
      executeCloneAmbushes(at, state.profession.clones);
    }
  };

  const executePlayerAmbush = (skill, at) => {
    const weapon = activePrimaryWeapon();
    const ambush = ambushAttacks[weapon];
    if (!ambush || skill.name !== ambush.name) return;
    const pseudo = { name: ambush.name, weapon, blade: false };
    addDamage(pseudo, at, {
      coefficient: ambush.player.coefficient,
      hits: ambush.player.hits,
      source: "Player",
    });
    for (const condition of ambush.player.conditions || []) {
      addCondition(ambush.name, at, condition);
    }
    if (
      state.profession.riddleOfSandReady
      && traits.has(TRAIT.RIDDLE_OF_SAND)
    ) {
      addCondition(
        ambush.name,
        at,
        { name: "Confusion", duration: 4, stacks: 2 },
        "Player",
        `${ambush.name} — Riddle of Sand`,
      );
      addTraitProc("Riddle of Sand", at, ambush.name, "2 confusion");
      state.profession.riddleOfSandReady = false;
    }
    for (const boon of ambush.playerBoons || []) {
      addBoon(at, boon, ambush.name);
    }
    if (traits.has(TRAIT.MIRAGE_MANTLE)) {
      addBoon(at, { name: "Alacrity", duration: 4 }, ambush.name);
      addBoon(at, { name: "Vigor", duration: 3 }, ambush.name);
      addTraitProc("Mirage Mantle", at, ambush.name, "4s alacrity, 3s vigor");
    }
    addAmbushVulnerability(at, ambush);
    if (ambush.createsClone) {
      queueResources(at + epsilon, 1, weapon, ambush.name);
    }
    state.profession.ambushUntil = 0;
    state.profession.ambushSource = "";
  };

  const handleMirageShatter = (skill, at, spent) => {
    if (config.specialization !== "Mirage") return;
    if (traits.has(TRAIT.RIDDLE_OF_SAND)) {
      state.profession.riddleOfSandReady = true;
      addTraitProc("Riddle of Sand", at, skill.name, "ambush primed");
    }
    if (traits.has(TRAIT.NOMADS_ENDURANCE)) {
      addBoon(at, { name: "Vigor", duration: 3 }, skill.name);
      addTraitProc("Nomad's Endurance", at, skill.name, "3s vigor");
    }
    if (skill.name === "Distortion" && traits.has(TRAIT.DESERT_DISTORTION)) {
      grantAmbushWindow(at, "Desert Distortion");
      addTraitProc(
        "Desert Distortion",
        at,
        skill.name,
        `${spent} Mirage Mirror${spent === 1 ? "" : "s"} created`,
      );
    }
    if (traits.has(TRAIT.DUNE_CLOAK) && spent >= 3) {
      grantMirageCloak(at, "Dune Cloak", { duration: 1 });
    }
  };

  const handlePostSkill = (skill, at) => {
    if (MIRAGE_CLOAK_SKILLS.has(skill.name)) {
      grantMirageCloak(at, skill.name);
    }
    if (
      traits.has(TRAIT.SELF_DECEPTION)
      && String(skill.description || "").startsWith("Deception.")
      && currentResource() > 0
    ) {
      queueResources(
        at + epsilon,
        1,
        activePrimaryWeapon(),
        `Self-Deception: ${skill.name}`,
      );
    }
  };

  return {
    executeCloneAmbushes,
    executePlayerAmbush,
    grantMirageCloak,
    handleMirageShatter,
    handlePostSkill,
  };
}

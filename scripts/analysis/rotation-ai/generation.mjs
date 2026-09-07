import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { selectedGw2TraitValues } from '#gw2/platform/combat/query/combat-query.js';
import { weaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import { MAX_COMMANDS, prepareBuild, validateBody } from './engine.mjs';
import { random, shuffle } from './storage.mjs';

export const GENERATOR = 'luminary-from-scratch-v1';
const EPSILON = 0.00001;

function requireLuminary(scenario) {
  if (scenario.profession !== 'guardian' || scenario.config.specialization !== 'Luminary')
    throw new Error('--from-scratch currently supports Guardian / Luminary builds only.');
}

/** Temporary scoring context only; makeScenario still owns persisted scenario construction. */
export async function generationContext(saved, seconds) {
  const prepared = await prepareBuild(saved);
  const context = {
    profession: saved.profession,
    build: prepared.build,
    config: prepared.config,
    prefix: [{ type: 'combat-start' }],
    seconds,
    combatStart: 0,
    endTime: seconds
  };
  requireLuminary(context);
  return context;
}

export async function createRotationGenerator(scenario) {
  requireLuminary(scenario);
  const adapter = await loadProfessionAppAdapter(scenario.profession);
  const profession = resolveProfessionRuntime(adapter.profession, scenario.config);
  const catalog = profession.catalog;
  const config = scenario.config;
  const traits = selectedGw2TraitValues(config, catalog);
  const weaponSets = [
    [config.primaryWeapon, config.secondaryWeapon],
    [config.weaponSet2Primary, config.weaponSet2Secondary]
  ];
  const matcher = profession.ui.weaponSkillMatchesSet;
  const context = { config, build: scenario.build, specialization: config.specialization, catalog };
  const selected = new Set(config.selectedSkills || []);
  const ids = new Set(profession.ui.paletteGroups(context).flatMap((group) => group.skillIds || []));
  const weaponSkills = profession.ui.paletteWeaponSkills(
    context,
    catalog.skills.filter(
      (skill) =>
        skill.type === 'Weapon' &&
        skill.weapon &&
        weaponSets.some((set) => weaponSkillMatchesSet(matcher, skill, set, context))
    )
  );
  weaponSkills.forEach((skill) => ids.add(skill.id));
  catalog.skills.filter((skill) => selected.has(skill.name)).forEach((skill) => ids.add(skill.id));
  if (weaponSets.every((set) => set[0])) {
    const swap = catalog.skillsByName.get('Swap Weapons');
    if (swap) ids.add(swap.id);
  }

  // Follow catalog links, including Forge exit/armament flips and weapon autoattack chains.
  for (const id of ids) {
    const skill = catalog.skillsById.get(id);
    for (const next of [skill?.flipSkillId, skill?.nextChainId])
      if (next != null && catalog.skillsById.has(next)) ids.add(next);
  }

  const skills = [...ids]
    .map((id) => catalog.skillsById.get(id))
    .filter((skill) => skill && !skill.simulatorExcluded && !skill.initialStateOnly)
    .sort((a, b) => a.id - b.id);
  const actions = skills.map((skill) => ({ type: 'cast', skillId: skill.id }));
  validateBody(actions);

  function schedule(rotation) {
    return createScheduler({
      profession,
      config,
      schedulerPolicy: createGw2SchedulerPolicy(config, { traits, catalog, weaponSkillMatchesSet: matcher })
    }).run([...scenario.prefix, ...rotation]);
  }

  /** Scheduler probes own legality and timing; only completed rotations go through damage resolution. */
  function generate(seed) {
    const rng = random(seed);
    const rotation = [];
    let current = schedule(rotation);
    if (current.warnings.length) throw new Error(`Generation prefix: ${current.warnings.join('; ')}`);
    let probes = 0;
    let idleSeconds = 0;
    let instantaneous = new Set();
    while (current.stream.rotationEndTime < scenario.endTime - EPSILON) {
      if (rotation.length + scenario.prefix.length + 1 >= MAX_COMMANDS)
        throw new Error('Generation reached the command limit. Use a shorter --seconds window.');
      const now = current.stream.rotationEndTime;
      let chosen = null;
      let delayed = null;
      // Prefer ready skills, but let the scheduler decide whether a delayed cast can legally fit.
      const ordered = shuffle(skills, rng).sort(
        (a, b) =>
          Number((current.state.cooldowns.get(a.id) || 0) > now + EPSILON && !a.usableWhileRecharging) -
          Number((current.state.cooldowns.get(b.id) || 0) > now + EPSILON && !b.usableWhileRecharging)
      );
      for (const skill of ordered) {
        if (instantaneous.has(skill.id)) continue;
        const availability = profession.ui.paletteSkillAvailability(current.context, skill);
        if (availability?.available === false) continue;
        if (
          skill.type === 'Weapon' &&
          !weaponSkillMatchesSet(matcher, skill, weaponSets[current.state.activeWeaponSet - 1], {
            ...context,
            state: current.state
          })
        )
          continue;
        const action = { type: 'cast', skillId: skill.id };
        const gate = profession.availability(
          {
            ...current.context,
            command: action,
            commandIndex: scenario.prefix.length + rotation.length,
            skill,
            start: now,
            ammo: current.state.ammo.get(skill.id) || null
          },
          skill
        );
        if (gate?.ready === false && gate.retryAt == null) continue;
        const result = schedule([...rotation, action]);
        probes++;
        if (result.warnings.length || result.stream.rotationEndTime > scenario.endTime + EPSILON) continue;
        const step = result.steps.at(-1);
        if (step?.skillId !== skill.id) continue;
        const start = step.start / 1000;
        const candidate = { action, result, start };
        if (start <= now + EPSILON) {
          chosen = candidate;
          break;
        }

        if (!delayed || start < delayed.start) delayed = candidate;
      }

      chosen ||= delayed;
      if (!chosen) {
        // Revisit timed Forge/flip transitions instead of padding the rest of the fight after a dead end.
        const durationMs = Math.min(250, (scenario.endTime - now) * 1000);
        rotation.push({ type: 'wait', durationMs });
        idleSeconds += durationMs / 1000;
        instantaneous.clear();
        current = schedule(rotation);
        continue;
      }

      idleSeconds += Math.max(0, chosen.start - now);
      rotation.push(chosen.action);
      if (chosen.result.stream.rotationEndTime > now + EPSILON) instantaneous.clear();
      else instantaneous.add(chosen.action.skillId);
      current = chosen.result;
    }

    validateBody(rotation);
    return { rotation, generation: { generator: GENERATOR, seed, probes, idleSeconds } };
  }

  return { actions, generate };
}

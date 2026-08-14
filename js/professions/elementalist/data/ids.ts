import { ELEMENTALIST_SKILL_IDS_BY_NAME } from "./native-skill-data.js";

export function elementalistSkillId(name: string): number {
  const id = ELEMENTALIST_SKILL_IDS_BY_NAME[name];
  if (!Number.isFinite(id)) {
    throw new TypeError(`Unknown Elementalist skill ${name}.`);
  }
  return id;
}

export const ELEMENTALIST_ATTUNEMENT_SKILL_IDS = Object.freeze({
  Fire: elementalistSkillId("Fire Attunement"),
  Water: elementalistSkillId("Water Attunement"),
  Air: elementalistSkillId("Air Attunement"),
  Earth: elementalistSkillId("Earth Attunement"),
});

export const ELEMENTALIST_OVERLOAD_SKILL_IDS = Object.freeze({
  Fire: elementalistSkillId("Overload Fire"),
  Water: elementalistSkillId("Overload Water"),
  Air: elementalistSkillId("Overload Air"),
  Earth: elementalistSkillId("Overload Earth"),
});

export const ELEMENTALIST_JADE_SPHERE_SKILL_IDS = Object.freeze({
  Fire: elementalistSkillId("Deploy Jade Sphere (Fire)"),
  Water: elementalistSkillId("Deploy Jade Sphere (Water)"),
  Air: elementalistSkillId("Deploy Jade Sphere (Air)"),
  Earth: elementalistSkillId("Deploy Jade Sphere (Earth)"),
});

export const ELEMENTALIST_FAMILIAR_SKILL_IDS = Object.freeze({
  Ignite: elementalistSkillId("Ignite"),
  Conflagration: elementalistSkillId("Conflagration"),
  Splash: elementalistSkillId("Splash"),
  BuoyantDeluge: elementalistSkillId("Buoyant Deluge"),
  Zap: elementalistSkillId("Zap"),
  LightningBlitz: elementalistSkillId("Lightning Blitz"),
  Calcify: elementalistSkillId("Calcify"),
  SeismicImpact: elementalistSkillId("Seismic Impact"),
});

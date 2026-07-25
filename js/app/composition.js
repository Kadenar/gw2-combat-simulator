import { mesmerProfession } from "../professions/mesmer/definition.js";
import { mesmerAppAdapter } from "../professions/mesmer/app/adapter.js";

export const activeProfession = mesmerProfession;
export const activeProfessionAppAdapter = mesmerAppAdapter;

export const professionOptions = Object.freeze([
  { id: "mesmer", name: "Mesmer" },
  { id: "elementalist", name: "Elementalist" },
  { id: "guardian", name: "Guardian" },
]);

const professionLoaders = Object.freeze({
  mesmer: async () => mesmerProfession,
  elementalist: async () => {
    const module = await import("../professions/elementalist/definition.js");
    return module.elementalistProfession;
  },
  guardian: async () => {
    const module = await import("../professions/guardian/definition.js");
    return module.guardianProfession;
  },
});

export async function getProfession(professionId) {
  const load = professionLoaders[professionId];
  return load ? load() : null;
}

const appAdapterLoaders = Object.freeze({
  mesmer: async () => mesmerAppAdapter,
  guardian: async () => {
    const module = await import(
      "../professions/guardian/app/adapter.js"
    );
    return module.guardianAppAdapter;
  },
});

export async function getProfessionAppAdapter(professionId) {
  const load = appAdapterLoaders[professionId];
  return load ? load() : null;
}

import { mesmerProfession } from "../professions/mesmer/definition.js";

export const activeProfession = mesmerProfession;

export const professionOptions = Object.freeze([
  { id: "mesmer", name: "Mesmer" },
  { id: "elementalist", name: "Elementalist" },
]);

const professionLoaders = Object.freeze({
  mesmer: async () => mesmerProfession,
  elementalist: async () => {
    const module = await import("../professions/elementalist/definition.js");
    return module.elementalistProfession;
  },
});

export async function getProfession(professionId) {
  const load = professionLoaders[professionId];
  return load ? load() : null;
}

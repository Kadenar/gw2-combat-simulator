import type { EvtcProfessionAnalyzer } from "./contract.js";

type AnalyzerLoader = () => Promise<EvtcProfessionAnalyzer>;

const baseAnalyzers = new Map<string, AnalyzerLoader>([
  [
    "necromancer",
    async () => {
      const module = await import("./necromancer.js");
      return module.necromancerEvtcAnalyzer;
    },
  ],
]);

const specializationAnalyzers = new Map<string, readonly AnalyzerLoader[]>();

export async function loadEvtcProfessionAnalyzers(
  professionId: string,
  specializationId: string,
): Promise<readonly EvtcProfessionAnalyzer[]> {
  const loaders: AnalyzerLoader[] = [];
  const base = baseAnalyzers.get(professionId);
  if (base) loaders.push(base);
  loaders.push(
    ...(specializationAnalyzers.get(`${professionId}:${specializationId}`) ||
      []),
  );
  return Promise.all(loaders.map((load) => load()));
}

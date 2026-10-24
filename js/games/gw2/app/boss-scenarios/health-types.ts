/** Runtime health retains exact target totals and bars; report provenance stays in offline maintenance files. */
export interface EncounterHealth {
  encounterId: string;
  difficulty: 'normal' | 'challenge' | 'legendary';
  targets: { index: number; name: string; health: number; primary: boolean; healthBars: number[][] | null }[];
}

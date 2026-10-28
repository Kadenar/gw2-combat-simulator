/** Runtime health retains exact target totals and bars; report provenance stays in offline maintenance files. */
export interface EncounterHealth {
  encounterId: string;
  difficulty: 'normal' | 'challenge' | 'legendary';
  targets: {
    index: number;
    name: string;
    health: number;
    armor: number;
    /** EI target hitbox diameter in game units. */
    hitboxWidth: number;
    primary: boolean;
    healthBars: number[][] | null;
  }[];
}

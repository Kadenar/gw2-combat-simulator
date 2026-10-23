/** EI observations retain target identity and difficulty; multi-target fights never become a guessed health pool. */
export interface EncounterHealthReport {
  encounterId: string;
  difficulty: 'normal' | 'challenge' | 'legendary';
  report: string;
  endpoint: string;
  parser: string;
  gw2Build: number;
  targets: { index: number; name: string; health: number; primary: boolean; healthBars: number[][] | null }[];
  corroboratingReports: string[];
  differingReports: string[];
}

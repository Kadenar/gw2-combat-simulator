/** Explicit EI d7f186c instant finders; unsupported checker families are listed in the adapter README. */
export interface EiInstantRule {
  readonly profession: string;
  readonly specialization?: string;
  readonly skillId: number;
  readonly signal: number | string;
  readonly kind:
    'buff-gain' | 'buff-loss' | 'buff-give' | 'damage' | 'effect' | 'effect-dst' | 'minion-cast' | 'minion-command';
  readonly rule: string;
  readonly origin?: 'skill' | 'trait' | 'gear' | 'unconditional';
  readonly notAccurate?: boolean;
  readonly disableWithEffects?: boolean;
  readonly timeOffset?: number;
  readonly icd?: number;
  readonly swapOffset?: number;
  readonly minions?: boolean;
  readonly excludeSpec?: string;
  readonly minBuild?: number;
  readonly maxBuild?: number;
  readonly minEvtcBuild?: number;
  readonly maxEvtcBuild?: number;
  readonly secondary?: readonly string[];
}
export const EI_INSTANT_RULES: readonly EiInstantRule[] = [
  {
    profession: 'elementalist',
    skillId: 5492,
    signal: 5585,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(FireAttunementSkill)'
  },
  {
    profession: 'elementalist',
    skillId: 5493,
    signal: 5586,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(WaterAttunementSkill)'
  },
  {
    profession: 'elementalist',
    skillId: 5494,
    signal: 5575,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(AirAttunementSkill)'
  },
  {
    profession: 'elementalist',
    skillId: 5495,
    signal: 5580,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(EarthAttunementSkill)'
  },
  {
    profession: 'elementalist',
    skillId: 34736,
    signal: 5739,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(GlyphOfElementalPowerFireSkill)'
  },
  {
    profession: 'elementalist',
    skillId: 34772,
    signal: 5741,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(GlyphOfElementalPowerWaterSkill)'
  },
  {
    profession: 'elementalist',
    skillId: 34637,
    signal: 5740,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(GlyphOfElementalPowerAirSkill)'
  },
  {
    profession: 'elementalist',
    skillId: 34714,
    signal: 5742,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(GlyphOfElementalPowerEarthSkill)'
  },
  {
    profession: 'elementalist',
    skillId: 5539,
    signal: 5539,
    kind: 'damage',
    rule: 'ElementalistHelper.DamageCastFinder(ArcaneBlast)'
  },
  {
    profession: 'elementalist',
    skillId: 5635,
    signal: 5582,
    kind: 'buff-give',
    rule: 'ElementalistHelper.BuffGiveCastFinder(ArcanePower_ArcaneEcho_Skill)',
    minBuild: 0,
    maxBuild: 182824
  },
  {
    profession: 'elementalist',
    skillId: 5641,
    signal: 5640,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(ArcaneShieldSkill)'
  },
  {
    profession: 'elementalist',
    skillId: 5635,
    signal: 76507,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(ArcanePower_ArcaneEcho_Skill)',
    minBuild: 182824
  },
  {
    profession: 'elementalist',
    skillId: 22572,
    signal: 22572,
    kind: 'damage',
    rule: 'ElementalistHelper.DamageCastFinder(ArcaneWave)'
  },
  {
    profession: 'elementalist',
    skillId: 5535,
    signal: 'BFFE3477ECFA26458D69E93EE76EFF6B',
    kind: 'effect-dst',
    rule: 'ElementalistHelper.EffectCastFinderByDst(CleansingFire)',
    secondary: ['61F5669F9FAC1F48B47635C9F3833CEF', 'ABF2332D28C7D6449A5B822E5714ADA4']
  },
  {
    profession: 'elementalist',
    skillId: 5543,
    signal: 5543,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(MistForm)'
  },
  {
    profession: 'elementalist',
    skillId: 5536,
    signal: 5536,
    kind: 'damage',
    rule: 'ElementalistHelper.DamageCastFinder(LightningFlash)'
  },
  {
    profession: 'elementalist',
    skillId: 5639,
    signal: 'D43DC34DEF81B746BC130F7A0393AAC7',
    kind: 'effect-dst',
    rule: 'ElementalistHelper.EffectCastFinderByDst(ArmorOfEarth)'
  },
  {
    profession: 'elementalist',
    skillId: 5572,
    signal: 5572,
    kind: 'damage',
    rule: 'ElementalistHelper.DamageCastFinder(SignetOfAirSkill)',
    disableWithEffects: true
  },
  {
    profession: 'elementalist',
    skillId: 5572,
    signal: '30A96C0E559DBD489FEE36DA96CC374A',
    kind: 'effect-dst',
    rule: 'ElementalistHelper.EffectCastFinderByDst(SignetOfAirSkill)'
  },
  {
    profession: 'elementalist',
    skillId: 56883,
    signal: 56883,
    kind: 'damage',
    rule: 'ElementalistHelper.DamageCastFinder(Sunspot)',
    origin: 'unconditional'
  },
  {
    profession: 'elementalist',
    skillId: 13334,
    signal: 13334,
    kind: 'damage',
    rule: 'ElementalistHelper.DamageCastFinder(FlameExpulsion)',
    origin: 'unconditional'
  },
  {
    profession: 'elementalist',
    skillId: 56885,
    signal: 56885,
    kind: 'damage',
    rule: 'ElementalistHelper.DamageCastFinder(EarthenBlast)',
    origin: 'unconditional'
  },
  {
    profession: 'elementalist',
    skillId: 24305,
    signal: 24305,
    kind: 'damage',
    rule: 'ElementalistHelper.DamageCastFinder(LightningRod)',
    origin: 'trait'
  },
  {
    profession: 'elementalist',
    skillId: 25499,
    signal: 6524,
    kind: 'minion-command',
    rule: 'ElementalistHelper.MinionCommandCastFinder(FireElementalFlameBarrage)'
  },
  {
    profession: 'elementalist',
    skillId: 25492,
    signal: 6525,
    kind: 'minion-command',
    rule: 'ElementalistHelper.MinionCommandCastFinder(WaterElementalCrashingWaves)'
  },
  {
    profession: 'elementalist',
    skillId: 25480,
    signal: 6522,
    kind: 'minion-command',
    rule: 'ElementalistHelper.MinionCommandCastFinder(AirElementalShockingBolt)'
  },
  {
    profession: 'elementalist',
    skillId: 25498,
    signal: 6523,
    kind: 'minion-command',
    rule: 'ElementalistHelper.MinionCommandCastFinder(EarthElementalStomp)'
  },
  {
    profession: 'elementalist',
    skillId: 5561,
    signal: 5561,
    kind: 'damage',
    rule: 'ElementalistHelper.DamageCastFinder(LightningStrike)'
  },
  {
    profession: 'elementalist',
    skillId: 73037,
    signal: 73071,
    kind: 'buff-gain',
    rule: 'ElementalistHelper.BuffGainCastFinder(EnergizeSkill)'
  },
  {
    profession: 'elementalist',
    specialization: 'tempest',
    skillId: 30662,
    signal: 'C668B5DB6220D9448817B3E5F7DE6E46',
    kind: 'effect',
    rule: 'TempestHelper.EffectCastFinder(FeelTheBurn)'
  },
  {
    profession: 'elementalist',
    specialization: 'tempest',
    skillId: 30047,
    signal: '52FEF389CF7D014BAA375EACF1826BB6',
    kind: 'effect',
    rule: 'TempestHelper.EffectCastFinder(EyeOfTheStormShout)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 40183,
    signal: 42086,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(PrimordialStanceSkill)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 44926,
    signal: 45097,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(StoneResonanceSkill)',
    icd: 500
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 44612,
    signal: 42683,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(UnravelSkill)',
    minBuild: 82356,
    maxBuild: 203989
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 80231,
    signal: 42683,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(UnravelElementsOfRageSkill)',
    minBuild: 203989
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 43470,
    signal: 43470,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(DualFireAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -5,
    signal: -5,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(FireWaterAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -6,
    signal: -6,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(FireAirAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -7,
    signal: -7,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(FireEarthAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -8,
    signal: -8,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(WaterFireAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 41166,
    signal: 41166,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(DualWaterAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -9,
    signal: -9,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(WaterAirAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -10,
    signal: -10,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(WaterEarthAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -11,
    signal: -11,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(AirFireAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -12,
    signal: -12,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(AirWaterAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 42264,
    signal: 42264,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(DualAirAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -13,
    signal: -13,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(AirEarthAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -14,
    signal: -14,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(EarthFireAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -15,
    signal: -15,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(EarthWaterAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: -16,
    signal: -16,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(EarthAirAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 44857,
    signal: 44857,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(DualEarthAttunement)'
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 72916,
    signal: 72961,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(FrostfireWardSkill)',
    minBuild: 0,
    maxBuild: 193778
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 72916,
    signal: 79372,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(FrostfireWardSkill)',
    minBuild: 193778
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 73104,
    signal: 73073,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(GalvanizeSkill)',
    minBuild: 0,
    maxBuild: 193778
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 73104,
    signal: 79347,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(GalvanizeSkill)',
    minBuild: 193778
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 72914,
    signal: 73023,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(FieryImpactSkill)',
    minBuild: 0,
    maxBuild: 193778
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 72914,
    signal: 79346,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(FieryImpactSkill)',
    minBuild: 193778
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 73052,
    signal: 72979,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(ElutriateSkill)',
    minBuild: 0,
    maxBuild: 193778
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 73052,
    signal: 79364,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(ElutriateSkill)',
    minBuild: 193778
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 72906,
    signal: 72996,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(ShaleStormSkill)',
    minBuild: 0,
    maxBuild: 193778
  },
  {
    profession: 'elementalist',
    specialization: 'weaver',
    skillId: 72906,
    signal: 79373,
    kind: 'buff-gain',
    rule: 'WeaverHelper.BuffGainCastFinder(ShaleStormSkill)',
    minBuild: 193778
  },
  {
    profession: 'elementalist',
    specialization: 'catalyst',
    skillId: 62982,
    signal: 62726,
    kind: 'buff-gain',
    rule: 'CatalystHelper.BuffGainCastFinder(InvigoratingAirSkill)',
    minBuild: 122479,
    maxBuild: 147734
  },
  {
    profession: 'elementalist',
    specialization: 'catalyst',
    skillId: 62813,
    signal: 'AFC5D5C7DA63D64BAAD55F787205B64F',
    kind: 'effect',
    rule: 'CatalystHelper.EffectCastFinder(DeployJadeSphereFire)'
  },
  {
    profession: 'elementalist',
    specialization: 'catalyst',
    skillId: 62940,
    signal: 'A3C8A55C3E530140A7F99AAA1CBB4E09',
    kind: 'effect',
    rule: 'CatalystHelper.EffectCastFinder(DeployJadeSphereAir)'
  },
  {
    profession: 'elementalist',
    specialization: 'catalyst',
    skillId: 62723,
    signal: '6D7EB5747873484DAF29C01FA51FE175',
    kind: 'effect',
    rule: 'CatalystHelper.EffectCastFinder(DeployJadeSphereWater)'
  },
  {
    profession: 'elementalist',
    specialization: 'catalyst',
    skillId: 62837,
    signal: 'A674D3E7BC0C4342BC7A4EF0EE8FF8F0',
    kind: 'effect',
    rule: 'CatalystHelper.EffectCastFinder(DeployJadeSphereEarth)'
  },
  {
    profession: 'elementalist',
    specialization: 'evoker',
    skillId: 76643,
    signal: 76882,
    kind: 'minion-cast',
    rule: 'EvokerHelper.MinionCastCastFinder(IgnitePlayerSkill)'
  },
  {
    profession: 'elementalist',
    specialization: 'evoker',
    skillId: 77225,
    signal: 76709,
    kind: 'minion-cast',
    rule: 'EvokerHelper.MinionCastCastFinder(SplashPlayerSkill)'
  },
  {
    profession: 'elementalist',
    specialization: 'evoker',
    skillId: 77370,
    signal: 76803,
    kind: 'minion-cast',
    rule: 'EvokerHelper.MinionCastCastFinder(ZapPlayerSkill)'
  },
  {
    profession: 'elementalist',
    specialization: 'evoker',
    skillId: 77226,
    signal: 76925,
    kind: 'minion-cast',
    rule: 'EvokerHelper.MinionCastCastFinder(CalcifyPlayerSkill)'
  },
  {
    profession: 'elementalist',
    specialization: 'evoker',
    skillId: 77190,
    signal: 'A30DE35C04E1454EB3B0DCC0BCF9BD9A',
    kind: 'effect',
    rule: 'EvokerHelper.EffectCastFinder(OttersCompassion)',
    secondary: ['6507424A0B7C384A9C6DB125E4724854']
  },
  {
    profession: 'elementalist',
    specialization: 'evoker',
    skillId: 77038,
    signal: 'CA9899BBDAC8C348B9011250945C9A7B',
    kind: 'effect',
    rule: 'EvokerHelper.EffectCastFinder(HaresAgilitySkill)',
    secondary: ['FF3DE8D09A6FE846B24A7CDFACB8078C'],
    minBuild: 190000
  },
  {
    profession: 'engineer',
    skillId: 59562,
    signal: 59579,
    kind: 'buff-loss',
    rule: 'EngineerHelper.BuffLossCastFinder(ExplosiveEntranceSkill)',
    minBuild: 102321,
    origin: 'trait'
  },
  {
    profession: 'engineer',
    skillId: 5861,
    signal: 5863,
    kind: 'buff-gain',
    rule: 'EngineerHelper.BuffGainCastFinder(ElixirSSkill)'
  },
  {
    profession: 'engineer',
    skillId: 5825,
    signal: 5833,
    kind: 'buff-gain',
    rule: 'EngineerHelper.BuffGainCastFinder(SlickShoesSkill)'
  },
  {
    profession: 'engineer',
    skillId: 5977,
    signal: 5976,
    kind: 'buff-gain',
    rule: 'EngineerHelper.BuffGainCastFinder(IncendiaryAmmoSkill)'
  },
  {
    profession: 'engineer',
    skillId: 6154,
    signal: 6154,
    kind: 'damage',
    rule: 'EngineerHelper.DamageCastFinder(OverchargedShot)'
  },
  {
    profession: 'engineer',
    skillId: 6126,
    signal: 6126,
    kind: 'damage',
    rule: 'EngineerHelper.DamageCastFinder(MagneticInversion)',
    disableWithEffects: true
  },
  {
    profession: 'engineer',
    skillId: -29,
    signal: 'B02D3D0FF0A4FC47B23B1478D8E770AE',
    kind: 'effect-dst',
    rule: 'EngineerHelper.EffectCastFinderByDst(HealingMistOrSoothingDetonation)'
  },
  {
    profession: 'engineer',
    skillId: 73064,
    signal: 73064,
    kind: 'damage',
    rule: 'EngineerHelper.DamageCastFinder(FocusedDevastation)',
    icd: 1100
  },
  {
    profession: 'engineer',
    skillId: 41612,
    signal: 41612,
    kind: 'damage',
    rule: 'EngineerHelper.DamageCastFinder(OrbitalCommandStrike)',
    timeOffset: -2000,
    disableWithEffects: true,
    origin: 'trait'
  },
  {
    profession: 'engineer',
    skillId: 41612,
    signal: '0D388D23FF313F489794881A540E5A24',
    kind: 'effect',
    rule: 'EngineerHelper.EffectCastFinder(OrbitalCommandStrike)',
    origin: 'trait'
  },
  {
    profession: 'engineer',
    specialization: 'scrapper',
    skillId: 30101,
    signal: '611D90C69ECF8142BEEE84139F333388',
    kind: 'effect',
    rule: 'ScrapperHelper.EffectCastFinder(BulwarkGyro)'
  },
  {
    profession: 'engineer',
    specialization: 'scrapper',
    skillId: 30101,
    signal: 'C6A40B12F9E6E046A98223F30E717633',
    kind: 'effect',
    rule: 'ScrapperHelper.EffectCastFinder(BulwarkGyro)'
  },
  {
    profession: 'engineer',
    specialization: 'scrapper',
    skillId: 29739,
    signal: '0DBE4F7115EADC4889F1E00232B2398B',
    kind: 'effect',
    rule: 'ScrapperHelper.EffectCastFinder(PurgeGyro)'
  },
  {
    profession: 'engineer',
    specialization: 'scrapper',
    skillId: 29739,
    signal: '86DC533FBB84BC43BBA03EC3B3E13034',
    kind: 'effect',
    rule: 'ScrapperHelper.EffectCastFinder(PurgeGyro)'
  },
  {
    profession: 'engineer',
    specialization: 'scrapper',
    skillId: 30027,
    signal: '9E2D190A92E2B5498A88722910A9DECD',
    kind: 'effect',
    rule: 'ScrapperHelper.EffectCastFinder(DefenseField)'
  },
  {
    profession: 'engineer',
    specialization: 'scrapper',
    skillId: 29665,
    signal: 'D2307A69B227BE4B831C2AA1DAAE646A',
    kind: 'effect',
    rule: 'ScrapperHelper.EffectCastFinder(BypassCoating)'
  },
  {
    profession: 'engineer',
    specialization: 'holosmith',
    skillId: 42938,
    signal: 43708,
    kind: 'buff-gain',
    rule: 'HolosmithHelper.BuffGainCastFinder(EnterPhotonForge)',
    swapOffset: -1
  },
  {
    profession: 'engineer',
    specialization: 'holosmith',
    skillId: 41123,
    signal: 43708,
    kind: 'buff-loss',
    rule: 'HolosmithHelper.BuffLossCastFinder(ExitPhotonForge)',
    swapOffset: -1
  },
  {
    profession: 'engineer',
    specialization: 'holosmith',
    skillId: 43937,
    signal: 41037,
    kind: 'buff-gain',
    rule: 'HolosmithHelper.BuffGainCastFinder(OverheatSkill)',
    swapOffset: -1
  },
  {
    profession: 'engineer',
    specialization: 'holosmith',
    skillId: 41218,
    signal: 43066,
    kind: 'buff-gain',
    rule: 'HolosmithHelper.BuffGainCastFinder(SpectrumShieldSkill)'
  },
  {
    profession: 'engineer',
    specialization: 'holosmith',
    skillId: 43630,
    signal: 43630,
    kind: 'damage',
    rule: 'HolosmithHelper.DamageCastFinder(ThermalReleaseValve)',
    origin: 'trait'
  },
  {
    profession: 'engineer',
    specialization: 'holosmith',
    skillId: 43176,
    signal: '418A090D719AB44AAF1C4AD1473068C4',
    kind: 'effect-dst',
    rule: 'HolosmithHelper.EffectCastFinderByDst(FlashSpark)'
  },
  {
    profession: 'engineer',
    specialization: 'mechanist',
    skillId: 63111,
    signal: 'E1C1DD7F866B4149A1BADD216C9AA69D',
    kind: 'effect',
    rule: 'MechanistHelper.EffectCastFinder(ShiftSignetSkill)'
  },
  {
    profession: 'engineer',
    specialization: 'mechanist',
    skillId: 63095,
    signal: 63334,
    kind: 'minion-cast',
    rule: 'MechanistHelper.MinionCastCastFinder(OverclockSignetSkill)',
    disableWithEffects: true,
    notAccurate: true
  },
  {
    profession: 'engineer',
    specialization: 'mechanist',
    skillId: 63095,
    signal: '734834E7EB7CD74EB129ACBCE5C64C1D',
    kind: 'effect-dst',
    rule: 'MechanistHelper.EffectCastFinderByDst(OverclockSignetSkill)'
  },
  {
    profession: 'engineer',
    specialization: 'mechanist',
    skillId: 63334,
    signal: 63334,
    kind: 'minion-cast',
    rule: 'MechanistHelper.MinionCastCastFinder(RoilingSmash)'
  },
  {
    profession: 'engineer',
    specialization: 'mechanist',
    skillId: 63365,
    signal: 63365,
    kind: 'minion-cast',
    rule: 'MechanistHelper.MinionCastCastFinder(ExplosiveKnuckle)'
  },
  {
    profession: 'engineer',
    specialization: 'mechanist',
    skillId: 63188,
    signal: 63188,
    kind: 'minion-cast',
    rule: 'MechanistHelper.MinionCastCastFinder(SparkRevolver)'
  },
  {
    profession: 'engineer',
    specialization: 'mechanist',
    skillId: 63367,
    signal: 63238,
    kind: 'buff-gain',
    rule: 'MechanistHelper.BuffGainCastFinder(DischargeArray)',
    minions: true
  },
  {
    profession: 'engineer',
    specialization: 'mechanist',
    skillId: 63345,
    signal: 63345,
    kind: 'minion-cast',
    rule: 'MechanistHelper.MinionCastCastFinder(CoreReactorShot)'
  },
  {
    profession: 'engineer',
    specialization: 'mechanist',
    skillId: 63121,
    signal: 63121,
    kind: 'minion-cast',
    rule: 'MechanistHelper.MinionCastCastFinder(JadeMortar)'
  },
  {
    profession: 'engineer',
    specialization: 'mechanist',
    skillId: 63141,
    signal: 63141,
    kind: 'minion-cast',
    rule: 'MechanistHelper.MinionCastCastFinder(BarrierBurst)'
  },
  {
    profession: 'engineer',
    specialization: 'mechanist',
    skillId: 63236,
    signal: 63236,
    kind: 'minion-cast',
    rule: 'MechanistHelper.MinionCastCastFinder(SkyCircus)'
  },
  {
    profession: 'engineer',
    specialization: 'amalgam',
    skillId: 77018,
    signal: 77362,
    kind: 'buff-gain',
    rule: 'AmalgamHelper.BuffGainCastFinder(GaseousStateSkill)'
  },
  {
    profession: 'engineer',
    specialization: 'amalgam',
    skillId: 77163,
    signal: 77283,
    kind: 'buff-gain',
    rule: 'AmalgamHelper.BuffGainCastFinder(DefensiveProtocolThorns1)',
    minBuild: 190000
  },
  {
    profession: 'engineer',
    specialization: 'amalgam',
    skillId: 76798,
    signal: 'F2FB8A03178A2B43B82E0113F20DF932',
    kind: 'effect',
    rule: 'AmalgamHelper.EffectCastFinder(DefensiveProtocolCleanse)'
  },
  {
    profession: 'engineer',
    specialization: 'amalgam',
    skillId: 76613,
    signal: '842F977C318FDC4F96C99C385C1D0672',
    kind: 'effect',
    rule: 'AmalgamHelper.EffectCastFinder(SymbioticShielding)'
  },
  {
    profession: 'guardian',
    skillId: 9082,
    signal: 9123,
    kind: 'buff-gain',
    rule: 'GuardianHelper.BuffGainCastFinder(ShieldOfWrathSkill)'
  },
  {
    profession: 'guardian',
    skillId: 9104,
    signal: 9103,
    kind: 'buff-gain',
    rule: 'GuardianHelper.BuffGainCastFinder(ZealotsFlameSkill)',
    icd: 0
  },
  {
    profession: 'guardian',
    skillId: 9247,
    signal: 9247,
    kind: 'damage',
    rule: 'GuardianHelper.DamageCastFinder(JudgesIntervention)',
    disableWithEffects: true
  },
  {
    profession: 'guardian',
    skillId: 9245,
    signal: 9245,
    kind: 'damage',
    rule: 'GuardianHelper.DamageCastFinder(SmiteCondition)'
  },
  {
    profession: 'guardian',
    skillId: 9101,
    signal: 9101,
    kind: 'damage',
    rule: 'GuardianHelper.DamageCastFinder(LesserSmiteCondition)',
    origin: 'trait'
  },
  {
    profession: 'guardian',
    skillId: 9120,
    signal: '5EAC13DB0953EF4C9C5BCC10DB13C9C8',
    kind: 'effect-dst',
    rule: 'GuardianHelper.EffectCastFinderByDst(SignetOfJudgmentSkill)'
  },
  {
    profession: 'guardian',
    skillId: 30255,
    signal: 30255,
    kind: 'damage',
    rule: 'GuardianHelper.DamageCastFinder(LesserSignetOfWrath)',
    origin: 'trait'
  },
  {
    profession: 'guardian',
    skillId: 21795,
    signal: 21795,
    kind: 'damage',
    rule: 'GuardianHelper.DamageCastFinder(GlacialHeart)',
    origin: 'trait',
    minBuild: 0,
    maxBuild: 159951
  },
  {
    profession: 'guardian',
    skillId: 22499,
    signal: 22499,
    kind: 'damage',
    rule: 'GuardianHelper.DamageCastFinder(ShatteredAegis)',
    origin: 'trait'
  },
  {
    profession: 'guardian',
    skillId: 71989,
    signal: '6646D48A2446884998EFADB3EFEF0483',
    kind: 'effect',
    rule: 'GuardianHelper.EffectCastFinder(DetonateJurisdiction)'
  },
  {
    profession: 'guardian',
    skillId: 71989,
    signal: '3E33C9645D62CF4DBC208511BB3D12F1',
    kind: 'effect',
    rule: 'GuardianHelper.EffectCastFinder(DetonateJurisdiction)'
  },
  {
    profession: 'guardian',
    skillId: 71989,
    signal: '29F6AADDF5E75348854123B956E4BF0E',
    kind: 'effect',
    rule: 'GuardianHelper.EffectCastFinder(DetonateJurisdiction)'
  },
  {
    profession: 'guardian',
    specialization: 'dragonhunter',
    skillId: 29786,
    signal: 'D7006AC247BBE74BA54E912188EF6B12',
    kind: 'effect',
    rule: 'DragonhunterHelper.EffectCastFinder(TestOfFaith)'
  },
  {
    profession: 'guardian',
    specialization: 'dragonhunter',
    skillId: 30553,
    signal: 'C84644DDAA59E542989FDB98CD69134C',
    kind: 'effect',
    rule: 'DragonhunterHelper.EffectCastFinder(FragmentsOfFaith)'
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 41714,
    signal: '8F0C77784AFD7F40B27446617DC05CDC',
    kind: 'effect-dst',
    rule: 'FirebrandHelper.EffectCastFinderByDst(MantraOfSolace)',
    minBuild: 115190,
    maxBuild: 141374
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: -20,
    signal: '8F0C77784AFD7F40B27446617DC05CDC',
    kind: 'effect-dst',
    rule: 'FirebrandHelper.EffectCastFinderByDst(RestoringReprieveOrRejunevatingRespite)',
    minBuild: 141374
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 46618,
    signal: 46618,
    kind: 'damage',
    rule: 'FirebrandHelper.DamageCastFinder(FlameRushOld)',
    minBuild: 0,
    maxBuild: 115190
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 45082,
    signal: 45082,
    kind: 'damage',
    rule: 'FirebrandHelper.DamageCastFinder(FlameRush)',
    minBuild: 141374,
    disableWithEffects: true
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 46616,
    signal: 46616,
    kind: 'damage',
    rule: 'FirebrandHelper.DamageCastFinder(FlameSurgeOld)',
    minBuild: 0,
    maxBuild: 115190
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 42924,
    signal: 42924,
    kind: 'damage',
    rule: 'FirebrandHelper.DamageCastFinder(FlameSurge)',
    minBuild: 141374,
    disableWithEffects: true
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 46148,
    signal: 46618,
    kind: 'damage',
    rule: 'FirebrandHelper.DamageCastFinder(MantraOfFlameCast)',
    minBuild: 115190,
    maxBuild: 141374,
    disableWithEffects: true
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 46148,
    signal: 'AF2B09AC1145AA4880B967C32A11E81C',
    kind: 'effect-dst',
    rule: 'FirebrandHelper.EffectCastFinderByDst(MantraOfFlameCast)',
    minBuild: 115190,
    maxBuild: 141374
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: -21,
    signal: '3D01B04C5700904BA279E9F135A3FAB3',
    kind: 'effect-dst',
    rule: 'FirebrandHelper.EffectCastFinderByDst(OpeningPassageOrClarifiedConclusion)',
    minBuild: 141374
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 40915,
    signal: '95B52793B838524AB237EB9FED7834BF',
    kind: 'effect-dst',
    rule: 'FirebrandHelper.EffectCastFinderByDst(MantraOfPotence)',
    minBuild: 115190,
    maxBuild: 141374
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: -22,
    signal: '95B52793B838524AB237EB9FED7834BF',
    kind: 'effect-dst',
    rule: 'FirebrandHelper.EffectCastFinderByDst(PotentHasteOrOverwhelmingCelerity)',
    minBuild: 141374
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 42360,
    signal: 42360,
    kind: 'damage',
    rule: 'FirebrandHelper.DamageCastFinder(EchoOfTruth)',
    minBuild: 141374,
    disableWithEffects: true
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 44008,
    signal: 44008,
    kind: 'damage',
    rule: 'FirebrandHelper.DamageCastFinder(VoiceOfTruth)',
    minBuild: 141374,
    disableWithEffects: true
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 44080,
    signal: 46508,
    kind: 'damage',
    rule: 'FirebrandHelper.DamageCastFinder(MantraOfTruthCast)',
    minBuild: 115190,
    maxBuild: 141374,
    disableWithEffects: true
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 44080,
    signal: 'E33EA0A63898CA469F864EDA1336FCD0',
    kind: 'effect-dst',
    rule: 'FirebrandHelper.EffectCastFinderByDst(MantraOfTruthCast)',
    minBuild: 115190,
    maxBuild: 141374
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 43357,
    signal: 'A8E0E4C48848424D85503B674015D247',
    kind: 'effect-dst',
    rule: 'FirebrandHelper.EffectCastFinderByDst(MantraOfLiberation)',
    minBuild: 115190,
    maxBuild: 141374
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: -23,
    signal: 'A8E0E4C48848424D85503B674015D247',
    kind: 'effect-dst',
    rule: 'FirebrandHelper.EffectCastFinderByDst(PortentOfFreedomOrUnhinderedDelivery)',
    minBuild: 141374
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 44364,
    signal: 44291,
    kind: 'buff-gain',
    rule: 'FirebrandHelper.BuffGainCastFinder(TomeOfJusticeSkill)',
    minBuild: 137943,
    swapOffset: -1
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 41780,
    signal: 41493,
    kind: 'buff-gain',
    rule: 'FirebrandHelper.BuffGainCastFinder(TomeOfResolveSkill)',
    minBuild: 137943,
    swapOffset: -1
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 42259,
    signal: 42404,
    kind: 'buff-gain',
    rule: 'FirebrandHelper.BuffGainCastFinder(TomeOfCourageSkill)',
    minBuild: 137943,
    swapOffset: -1
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 41380,
    signal: 44291,
    kind: 'buff-loss',
    rule: 'FirebrandHelper.BuffLossCastFinder(StowTome)',
    minBuild: 137943,
    swapOffset: -1
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 41380,
    signal: 41493,
    kind: 'buff-loss',
    rule: 'FirebrandHelper.BuffLossCastFinder(StowTome)',
    minBuild: 137943,
    swapOffset: -1
  },
  {
    profession: 'guardian',
    specialization: 'firebrand',
    skillId: 41380,
    signal: 42404,
    kind: 'buff-loss',
    rule: 'FirebrandHelper.BuffLossCastFinder(StowTome)',
    minBuild: 137943,
    swapOffset: -1
  },
  {
    profession: 'guardian',
    specialization: 'luminary',
    skillId: 78837,
    signal: 'FB78801BB31CAF488B55F2F57EF9B070',
    kind: 'effect',
    rule: 'LuminaryHelper.EffectCastFinder(RadiantJusticeSkill)',
    secondary: ['7535B4CB815232418B69092F3390A7AB']
  },
  {
    profession: 'guardian',
    specialization: 'luminary',
    skillId: 78604,
    signal: '4A83F0B627B75C47894941C4D35BA89F',
    kind: 'effect',
    rule: 'LuminaryHelper.EffectCastFinder(RadiantResolveSkill)',
    secondary: ['FBA4C4F041E78748AC1CA5FF5D37D2DA']
  },
  {
    profession: 'guardian',
    specialization: 'luminary',
    skillId: 78358,
    signal: '03850757F14FD44A9998D4CAD71CC589',
    kind: 'effect',
    rule: 'LuminaryHelper.EffectCastFinder(RadiantCourageSkill)',
    secondary: ['08E6D231507CDD458EDECF67D264228C']
  },
  {
    profession: 'guardian',
    specialization: 'luminary',
    skillId: 77164,
    signal: 'FB066A1F03294D4D850D22B26650FFA9',
    kind: 'effect',
    rule: 'LuminaryHelper.EffectCastFinder(SovereignOfLight)',
    secondary: ['D23CB7F8A2755F4FA2A68A6834ABAD98'],
    origin: 'trait'
  },
  {
    profession: 'guardian',
    specialization: 'luminary',
    skillId: 77073,
    signal: 77142,
    kind: 'buff-gain',
    rule: 'LuminaryHelper.BuffGainCastFinder(EnterRadiantForge)',
    swapOffset: -1
  },
  {
    profession: 'guardian',
    specialization: 'luminary',
    skillId: 76616,
    signal: 77142,
    kind: 'buff-loss',
    rule: 'LuminaryHelper.BuffLossCastFinder(ExitRadiantForge)',
    swapOffset: -1
  },
  {
    profession: 'guardian',
    specialization: 'luminary',
    skillId: 77300,
    signal: 76736,
    kind: 'buff-gain',
    rule: 'LuminaryHelper.BuffGainCastFinder(ValorousStanceSkill)'
  },
  {
    profession: 'guardian',
    specialization: 'luminary',
    skillId: 76813,
    signal: 77095,
    kind: 'buff-gain',
    rule: 'LuminaryHelper.BuffGainCastFinder(EffulgentStanceSkill)'
  },
  {
    profession: 'guardian',
    specialization: 'luminary',
    skillId: 76730,
    signal: 77265,
    kind: 'buff-loss',
    rule: 'LuminaryHelper.BuffLossCastFinder(EffulgentStanceDamage)'
  },
  {
    profession: 'mesmer',
    skillId: 10234,
    signal: '02154B72900B5740A73CD0ADECED27BF',
    kind: 'effect-dst',
    rule: 'MesmerHelper.EffectCastFinderByDst(SignetOfMidnightSkill)'
  },
  {
    profession: 'mesmer',
    skillId: 10197,
    signal: 10198,
    kind: 'buff-gain',
    rule: 'MesmerHelper.BuffGainCastFinder(PortalEntre)'
  },
  {
    profession: 'mesmer',
    skillId: 10199,
    signal: 16553,
    kind: 'buff-gain',
    rule: 'MesmerHelper.BuffGainCastFinder(PortalExeunt)'
  },
  {
    profession: 'mesmer',
    skillId: 30192,
    signal: 30192,
    kind: 'damage',
    rule: 'MesmerHelper.DamageCastFinder(LesserPhantasmalDefender)',
    origin: 'trait'
  },
  {
    profession: 'mesmer',
    skillId: 10302,
    signal: 'D6C8F406E4DEE04AB16A215BE068E910',
    kind: 'effect',
    rule: 'MesmerHelper.EffectCastFinder(Feedback)'
  },
  {
    profession: 'mesmer',
    skillId: 10331,
    signal: '9E6A9107AF3D1547A59B4A05FFC43AE5',
    kind: 'effect',
    rule: 'MesmerHelper.EffectCastFinder(ChaosArmor)',
    secondary: ['731F6451C6C9874DA629D92C355194F0']
  },
  {
    profession: 'mesmer',
    skillId: 10202,
    signal: '40818C8E9CC6EF4388C2821FCC26A9EC',
    kind: 'effect',
    rule: 'MesmerHelper.EffectCastFinder(MirrorImages)',
    secondary: ['73414BA39AFCF540A90CF91DE961CCEF']
  },
  {
    profession: 'mesmer',
    skillId: 10212,
    signal: 10212,
    kind: 'damage',
    rule: 'MesmerHelper.DamageCastFinder(PowerSpike)',
    minBuild: 0,
    maxBuild: 115190
  },
  {
    profession: 'mesmer',
    skillId: 10211,
    signal: 10211,
    kind: 'damage',
    rule: 'MesmerHelper.DamageCastFinder(MantraOfPain)',
    minBuild: 115190,
    maxBuild: 141374
  },
  {
    profession: 'mesmer',
    skillId: 10212,
    signal: 10212,
    kind: 'damage',
    rule: 'MesmerHelper.DamageCastFinder(PowerSpike)',
    minBuild: 141374
  },
  {
    profession: 'mesmer',
    skillId: 10214,
    signal: 'F53E2CE3B06B934085D46FA59468477B',
    kind: 'effect-dst',
    rule: 'MesmerHelper.EffectCastFinderByDst(PowerReturn)',
    minBuild: 141374
  },
  {
    profession: 'mesmer',
    skillId: 10207,
    signal: '593E668A006AB24D84999AED68F2E4C4',
    kind: 'effect',
    rule: 'MesmerHelper.EffectCastFinder(MantraOfResolve)',
    minBuild: 0,
    maxBuild: 141374
  },
  {
    profession: 'mesmer',
    skillId: 10209,
    signal: '593E668A006AB24D84999AED68F2E4C4',
    kind: 'effect',
    rule: 'MesmerHelper.EffectCastFinder(PowerCleanse)',
    minBuild: 141374,
    maxBuild: 158837
  },
  {
    profession: 'mesmer',
    skillId: 10237,
    signal: '5B488D552E316045AD99C4A98EEDDB1E',
    kind: 'effect-dst',
    rule: 'MesmerHelper.EffectCastFinderByDst(MantraOfConcentration)',
    minBuild: 0,
    maxBuild: 141374
  },
  {
    profession: 'mesmer',
    skillId: 10238,
    signal: '5B488D552E316045AD99C4A98EEDDB1E',
    kind: 'effect-dst',
    rule: 'MesmerHelper.EffectCastFinderByDst(PowerBreak)',
    minBuild: 141374
  },
  {
    profession: 'mesmer',
    skillId: 71792,
    signal: 71890,
    kind: 'buff-give',
    rule: 'MesmerHelper.BuffGiveCastFinder(DimensionalApertureSkill)'
  },
  {
    profession: 'mesmer',
    skillId: 72076,
    signal: '6E2B9CF3E5C95846B15BBD1EAA9B3E98',
    kind: 'effect',
    rule: 'MesmerHelper.EffectCastFinder(Abstraction)',
    secondary: ['593E668A006AB24D84999AED68F2E4C4']
  },
  {
    profession: 'mesmer',
    specialization: 'chronomancer',
    skillId: 29830,
    signal: 30136,
    kind: 'buff-gain',
    rule: 'ChronomancerHelper.BuffGainCastFinder(ContinuumSplit)'
  },
  {
    profession: 'mesmer',
    specialization: 'chronomancer',
    skillId: 30747,
    signal: 30136,
    kind: 'buff-loss',
    rule: 'ChronomancerHelper.BuffLossCastFinder(ContinuumShift)'
  },
  {
    profession: 'mesmer',
    specialization: 'chronomancer',
    skillId: 79359,
    signal: 79359,
    kind: 'damage',
    rule: 'ChronomancerHelper.DamageCastFinder(TimeBombDamage)'
  },
  {
    profession: 'mesmer',
    specialization: 'mirage',
    skillId: 45449,
    signal: 45449,
    kind: 'damage',
    rule: 'MirageHelper.DamageCastFinder(Jaunt)',
    disableWithEffects: true
  },
  {
    profession: 'mesmer',
    specialization: 'mirage',
    skillId: 45449,
    signal: '3A5A38C26A1FFB438EAD734F3ED42E5E',
    kind: 'effect',
    rule: 'MirageHelper.EffectCastFinder(Jaunt)',
    secondary: ['B6557C336041B24FA7CC198B6EBDAD9A', 'D7A05478BA0E164396EB90C037DCCF42']
  },
  {
    profession: 'mesmer',
    specialization: 'mirage',
    skillId: -17,
    signal: 40408,
    kind: 'buff-gain',
    rule: 'MirageHelper.BuffGainCastFinder(MirageCloakDodge)'
  },
  {
    profession: 'mesmer',
    specialization: 'virtuoso',
    skillId: 62597,
    signal: '87B761200637AC48B71469F553BA6F60',
    kind: 'effect',
    rule: 'VirtuosoHelper.EffectCastFinder(BladeturnRequiem)',
    minBuild: 147734
  },
  {
    profession: 'mesmer',
    specialization: 'virtuoso',
    skillId: 24755,
    signal: 'E4002B7AD7DF024394D0184B47A316E7',
    kind: 'effect',
    rule: 'VirtuosoHelper.EffectCastFinder(ThousandCuts)'
  },
  {
    profession: 'mesmer',
    specialization: 'troubadour',
    skillId: 76850,
    signal: 'FF116F5E112DA042B238469590A1FCD8',
    kind: 'effect',
    rule: 'TroubadourHelper.EffectCastFinder(TaleOfTheSoulkeeper)'
  },
  {
    profession: 'mesmer',
    specialization: 'troubadour',
    skillId: 77178,
    signal: 'EBC45B862D299143B4D63CB6CAEC26ED',
    kind: 'effect',
    rule: 'TroubadourHelper.EffectCastFinder(TaleOfTheValiantMarshal)'
  },
  {
    profession: 'mesmer',
    specialization: 'troubadour',
    skillId: 76611,
    signal: 'DBECB5867D11264FA19FFCDC487A410E',
    kind: 'effect',
    rule: 'TroubadourHelper.EffectCastFinder(TaleOfTheHonorableRogue)'
  },
  {
    profession: 'mesmer',
    specialization: 'troubadour',
    skillId: 76689,
    signal: '24498E18DEC97B4094376849EF7A3746',
    kind: 'effect',
    rule: 'TroubadourHelper.EffectCastFinder(SyncopateDelayedWave)',
    secondary: ['8ECB35B63BA6C045BE9F0B864972B983'],
    origin: 'unconditional'
  },
  {
    profession: 'necromancer',
    skillId: 10574,
    signal: 790,
    kind: 'buff-gain',
    rule: 'NecromancerHelper.BuffGainCastFinder(EnterDeathShroud)',
    swapOffset: -1
  },
  {
    profession: 'necromancer',
    skillId: 10585,
    signal: 790,
    kind: 'buff-loss',
    rule: 'NecromancerHelper.BuffLossCastFinder(ExitDeathShroud)',
    swapOffset: -1
  },
  {
    profession: 'necromancer',
    skillId: 13907,
    signal: 13907,
    kind: 'damage',
    rule: 'NecromancerHelper.DamageCastFinder(LesserEnfeeble)',
    origin: 'unconditional'
  },
  {
    profession: 'necromancer',
    skillId: 13906,
    signal: 13906,
    kind: 'damage',
    rule: 'NecromancerHelper.DamageCastFinder(LesserSpinalShivers)',
    origin: 'trait'
  },
  {
    profession: 'necromancer',
    skillId: 38767,
    signal: 38767,
    kind: 'damage',
    rule: 'NecromancerHelper.DamageCastFinder(UnholyBurst)'
  },
  {
    profession: 'necromancer',
    skillId: 29560,
    signal: 29560,
    kind: 'damage',
    rule: 'NecromancerHelper.DamageCastFinder(SpitefulSpirit)',
    disableWithEffects: true,
    origin: 'unconditional'
  },
  {
    profession: 'necromancer',
    skillId: 10562,
    signal: 'E78ED095E97F1D4A8BEB901796449E2F',
    kind: 'effect-dst',
    rule: 'NecromancerHelper.EffectCastFinderByDst(PlagueSignetSkill)'
  },
  {
    profession: 'necromancer',
    skillId: 10570,
    signal: 1458,
    kind: 'minion-command',
    rule: 'NecromancerHelper.MinionCommandCastFinder(RigorMortisSkill)'
  },
  {
    profession: 'necromancer',
    skillId: 10590,
    signal: 5673,
    kind: 'minion-command',
    rule: 'NecromancerHelper.MinionCommandCastFinder(HauntSkill)'
  },
  {
    profession: 'necromancer',
    skillId: 10600,
    signal: 6002,
    kind: 'minion-command',
    rule: 'NecromancerHelper.MinionCommandCastFinder(NecroticTraversal)'
  },
  {
    profession: 'necromancer',
    specialization: 'reaper',
    skillId: 30792,
    signal: 29446,
    kind: 'buff-gain',
    rule: 'ReaperHelper.BuffGainCastFinder(EnterReaperShroud)',
    swapOffset: -1
  },
  {
    profession: 'necromancer',
    specialization: 'reaper',
    skillId: 30961,
    signal: 29446,
    kind: 'buff-loss',
    rule: 'ReaperHelper.BuffLossCastFinder(ExitReaperShroud)',
    swapOffset: -1
  },
  {
    profession: 'necromancer',
    specialization: 'reaper',
    skillId: 29958,
    signal: 30129,
    kind: 'buff-gain',
    rule: 'ReaperHelper.BuffGainCastFinder(InfusingTerrorSkill)'
  },
  {
    profession: 'necromancer',
    specialization: 'reaper',
    skillId: 29414,
    signal: 29414,
    kind: 'damage',
    rule: 'ReaperHelper.DamageCastFinder(YouAreAllWeaklings)',
    disableWithEffects: true
  },
  {
    profession: 'necromancer',
    specialization: 'reaper',
    skillId: 29414,
    signal: '37242DF51D238A409E822E7A1936D7A6',
    kind: 'effect',
    rule: 'ReaperHelper.EffectCastFinder(YouAreAllWeaklings)',
    secondary: ['FEE4F26C2866E34C9D75506A8ED94F5E', 'ED6A8440CB49B248A352B2073FAF1F5F']
  },
  {
    profession: 'necromancer',
    specialization: 'reaper',
    skillId: 30670,
    signal: 30670,
    kind: 'damage',
    rule: 'ReaperHelper.DamageCastFinder(Suffer)',
    disableWithEffects: true
  },
  {
    profession: 'necromancer',
    specialization: 'reaper',
    skillId: 30670,
    signal: '6C8C388BCD26F04CA6618D2916B8D796',
    kind: 'effect',
    rule: 'ReaperHelper.EffectCastFinder(Suffer)'
  },
  {
    profession: 'necromancer',
    specialization: 'reaper',
    skillId: 29604,
    signal: 29604,
    kind: 'damage',
    rule: 'ReaperHelper.DamageCastFinder(ChillingNova)',
    origin: 'trait'
  },
  {
    profession: 'necromancer',
    specialization: 'scourge',
    skillId: 40274,
    signal: 42311,
    kind: 'buff-gain',
    rule: 'ScourgeHelper.BuffGainCastFinder(TrailOfAnguish)'
  },
  {
    profession: 'necromancer',
    specialization: 'scourge',
    skillId: 40813,
    signal: 46808,
    kind: 'damage',
    rule: 'ScourgeHelper.DamageCastFinder(NefariousFavorSkill)'
  },
  {
    profession: 'necromancer',
    specialization: 'scourge',
    skillId: 43448,
    signal: '44092AEF6D619F4093FEA4E9D9142D01',
    kind: 'effect',
    rule: 'ScourgeHelper.EffectCastFinder(SandCascadeSkill)'
  },
  {
    profession: 'necromancer',
    specialization: 'scourge',
    skillId: 44428,
    signal: 40071,
    kind: 'damage',
    rule: 'ScourgeHelper.DamageCastFinder(GarishPillarSkill)'
  },
  {
    profession: 'necromancer',
    specialization: 'scourge',
    skillId: 43626,
    signal: 43626,
    kind: 'buff-gain',
    rule: 'ScourgeHelper.BuffGainCastFinder(SadisticSearing)',
    origin: 'trait'
  },
  {
    profession: 'necromancer',
    specialization: 'harbinger',
    skillId: 62567,
    signal: 59964,
    kind: 'buff-gain',
    rule: 'HarbingerHelper.BuffGainCastFinder(EnterHarbingerShroud)',
    swapOffset: -1
  },
  {
    profession: 'necromancer',
    specialization: 'harbinger',
    skillId: 62540,
    signal: 59964,
    kind: 'buff-loss',
    rule: 'HarbingerHelper.BuffLossCastFinder(ExitHarbingerShroud)',
    swapOffset: -1
  },
  {
    profession: 'necromancer',
    specialization: 'harbinger',
    skillId: 62660,
    signal: 62660,
    kind: 'damage',
    rule: 'HarbingerHelper.DamageCastFinder(CascadingCorruptionDamage)',
    disableWithEffects: true,
    origin: 'trait',
    minBuild: 118697,
    maxBuild: 203989
  },
  {
    profession: 'necromancer',
    specialization: 'harbinger',
    skillId: 62660,
    signal: 'EEDCAB61CD35E840909B03D398878B1C',
    kind: 'effect-dst',
    rule: 'HarbingerHelper.EffectCastFinderByDst(CascadingCorruptionDamage)',
    origin: 'trait',
    minBuild: 118697,
    maxBuild: 203989
  },
  {
    profession: 'necromancer',
    specialization: 'harbinger',
    skillId: 62671,
    signal: '9C06D9D9B0E22247A1752C426808CD80',
    kind: 'effect-dst',
    rule: 'HarbingerHelper.EffectCastFinderByDst(DeathlyHaste)',
    origin: 'trait',
    minBuild: 118697,
    maxBuild: 203989
  },
  {
    profession: 'necromancer',
    specialization: 'harbinger',
    skillId: 62558,
    signal: '88C0010F0B7148469B88E2A1B4500DCC',
    kind: 'effect-dst',
    rule: 'HarbingerHelper.EffectCastFinderByDst(ApproachingDoom)',
    origin: 'trait',
    minBuild: 118697,
    maxBuild: 203989
  },
  {
    profession: 'necromancer',
    specialization: 'harbinger',
    skillId: 80215,
    signal: 80215,
    kind: 'buff-gain',
    rule: 'HarbingerHelper.BuffGainCastFinder(Meltdown)',
    minBuild: 203989
  },
  {
    profession: 'necromancer',
    specialization: 'ritualist',
    skillId: 77238,
    signal: 76958,
    kind: 'buff-gain',
    rule: 'RitualistHelper.BuffGainCastFinder(EnterRitualistsShroud)',
    swapOffset: -1
  },
  {
    profession: 'necromancer',
    specialization: 'ritualist',
    skillId: 76933,
    signal: 76958,
    kind: 'buff-loss',
    rule: 'RitualistHelper.BuffLossCastFinder(ExitRitualistsShroud)',
    swapOffset: -1
  },
  {
    profession: 'necromancer',
    specialization: 'ritualist',
    skillId: 76607,
    signal: '0BC4AABB74F2AC43963CBB7B52993559',
    kind: 'effect',
    rule: 'RitualistHelper.EffectCastFinder(SummonSpiritsPlayerSkill)'
  },
  {
    profession: 'necromancer',
    specialization: 'ritualist',
    skillId: 76783,
    signal: 76783,
    kind: 'damage',
    rule: 'RitualistHelper.DamageCastFinder(ExplosiveGrowthDamageSkill)',
    origin: 'unconditional',
    minBuild: 186019,
    maxBuild: 190000
  },
  {
    profession: 'necromancer',
    specialization: 'ritualist',
    skillId: 79105,
    signal: 76783,
    kind: 'buff-gain',
    rule: 'RitualistHelper.BuffGainCastFinder(ExplosiveGrowthBuff)',
    origin: 'unconditional',
    minBuild: 190000,
    maxBuild: 192224
  },
  {
    profession: 'necromancer',
    specialization: 'ritualist',
    skillId: 76783,
    signal: 76783,
    kind: 'damage',
    rule: 'RitualistHelper.DamageCastFinder(ExplosiveGrowthDamageSkill)',
    origin: 'unconditional',
    minBuild: 192224
  },
  {
    profession: 'necromancer',
    specialization: 'ritualist',
    skillId: 77003,
    signal: '98E9E5F26FF76F449A181654E4F39695',
    kind: 'effect',
    rule: 'RitualistHelper.EffectCastFinder(InnervateAnguishSkill)',
    secondary: ['A170A1C61CD09742A79848D143749003']
  },
  {
    profession: 'necromancer',
    specialization: 'ritualist',
    skillId: 76732,
    signal: 'BEFD0FD6AC4AE24096590DCDC655F16C',
    kind: 'effect',
    rule: 'RitualistHelper.EffectCastFinder(InnervateWanderlustSkill)',
    secondary: ['A8FA2AFABB3FC840893E441F47693524']
  },
  {
    profession: 'necromancer',
    specialization: 'ritualist',
    skillId: 76602,
    signal: '81146A66FCE3A342B00D4D2EB2A7643E',
    kind: 'effect',
    rule: 'RitualistHelper.EffectCastFinder(InnervatePreservationSkill)',
    secondary: ['9F62B1407B5E2A45B068967C0F176315']
  },
  {
    profession: 'ranger',
    skillId: 12633,
    signal: 33902,
    kind: 'buff-gain',
    rule: 'RangerHelper.BuffGainCastFinder(SicEmSkill)',
    minions: true
  },
  {
    profession: 'ranger',
    skillId: 79348,
    signal: 79348,
    kind: 'buff-gain',
    rule: 'RangerHelper.BuffGainCastFinder(LesserSicEm)',
    minions: true,
    minBuild: 193778
  },
  {
    profession: 'ranger',
    skillId: 12633,
    signal: 56923,
    kind: 'buff-gain',
    rule: 'RangerHelper.BuffGainCastFinder(SicEmSkill)',
    minions: true
  },
  {
    profession: 'ranger',
    skillId: 12537,
    signal: 12536,
    kind: 'buff-gain',
    rule: 'RangerHelper.BuffGainCastFinder(SharpeningStonesSkill)'
  },
  {
    profession: 'ranger',
    skillId: 29703,
    signal: 29703,
    kind: 'buff-gain',
    rule: 'RangerHelper.BuffGainCastFinder(QuickDraw)',
    swapOffset: 1,
    origin: 'trait'
  },
  {
    profession: 'ranger',
    skillId: 12574,
    signal: 12574,
    kind: 'buff-gain',
    rule: 'RangerHelper.BuffGainCastFinder(AttackOfOpportunity)',
    origin: 'trait'
  },
  {
    profession: 'ranger',
    skillId: 34309,
    signal: 34236,
    kind: 'buff-give',
    rule: 'RangerHelper.BuffGiveCastFinder(SearchAndRescueSkill)',
    icd: 1100,
    notAccurate: true
  },
  {
    profession: 'ranger',
    skillId: 12494,
    signal: '3CF1D1228CBC3740AA33EDA357EABED4',
    kind: 'effect',
    rule: 'RangerHelper.EffectCastFinder(LightningReflexes)'
  },
  {
    profession: 'ranger',
    skillId: 12550,
    signal: 'B23157C515072E46B5514419B0F923B7',
    kind: 'effect-dst',
    rule: 'RangerHelper.EffectCastFinderByDst(QuickeningZephyr)'
  },
  {
    profession: 'ranger',
    skillId: 12502,
    signal: 'EA9896A81DDF4843B18DBF6EE4F25E18',
    kind: 'effect-dst',
    rule: 'RangerHelper.EffectCastFinderByDst(SignetOfRenewalSkill)'
  },
  {
    profession: 'ranger',
    skillId: 12542,
    signal: '1A38CAE72C2F164BA3815441CA643A20',
    kind: 'effect-dst',
    rule: 'RangerHelper.EffectCastFinderByDst(SignetOfTheHuntSkill)'
  },
  {
    profession: 'ranger',
    skillId: 71002,
    signal: 25652,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(DimensionBreach)'
  },
  {
    profession: 'ranger',
    skillId: 12744,
    signal: 8035,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(StunningRush)'
  },
  {
    profession: 'ranger',
    skillId: 12722,
    signal: 8003,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(BrashSlash)'
  },
  {
    profession: 'ranger',
    skillId: 20975,
    signal: 10022,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(LaceratingSlash)'
  },
  {
    profession: 'ranger',
    skillId: 12721,
    signal: 8002,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ChillingSlash)'
  },
  {
    profession: 'ranger',
    skillId: 12722,
    signal: 6045,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(BlindingSlash)'
  },
  {
    profession: 'ranger',
    skillId: 12722,
    signal: 8004,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(BlindingSlash)'
  },
  {
    profession: 'ranger',
    skillId: 63716,
    signal: 25131,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(GaleBreath)'
  },
  {
    profession: 'ranger',
    skillId: 78873,
    signal: 27259,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(PiercingShriek)'
  },
  {
    profession: 'ranger',
    skillId: 31367,
    signal: 15418,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(SpikeBarrage)'
  },
  {
    profession: 'ranger',
    skillId: 12716,
    signal: 6043,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ChillingHowl)'
  },
  {
    profession: 'ranger',
    skillId: 12717,
    signal: 7336,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(Regenerate_FernHound)'
  },
  {
    profession: 'ranger',
    skillId: 12718,
    signal: 7976,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(HowlOfThePack)'
  },
  {
    profession: 'ranger',
    skillId: 12715,
    signal: 4425,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(IntimidatingHowl)'
  },
  {
    profession: 'ranger',
    skillId: 12714,
    signal: 7975,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(TerrifyingHowl)'
  },
  {
    profession: 'ranger',
    skillId: 71688,
    signal: 26147,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(LeyEnergyPulse)'
  },
  {
    profession: 'ranger',
    skillId: 72843,
    signal: 26220,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(Panopticon)'
  },
  {
    profession: 'ranger',
    skillId: 12675,
    signal: 5581,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(PoisonousCloud)'
  },
  {
    profession: 'ranger',
    skillId: 12703,
    signal: 5581,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(Regenerate_CarrionDevourer)'
  },
  {
    profession: 'ranger',
    skillId: 12679,
    signal: 7949,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(RendingBarbs)'
  },
  {
    profession: 'ranger',
    skillId: 12704,
    signal: 7949,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(LashtailVenom)'
  },
  {
    profession: 'ranger',
    skillId: 12674,
    signal: 7948,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(PoisonBarbs)'
  },
  {
    profession: 'ranger',
    skillId: 12702,
    signal: 7948,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(PoisonCloud_WhiptailDevourer)'
  },
  {
    profession: 'ranger',
    skillId: 12696,
    signal: 6889,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(FrostBreath)'
  },
  {
    profession: 'ranger',
    skillId: 12697,
    signal: 6889,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(FrostNova)'
  },
  {
    profession: 'ranger',
    skillId: 12701,
    signal: 6850,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(InsectSwarm)'
  },
  {
    profession: 'ranger',
    skillId: 12700,
    signal: 6850,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(PoisonCloud_MarshDrake)'
  },
  {
    profession: 'ranger',
    skillId: 16426,
    signal: 11491,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(SonicShriek)'
  },
  {
    profession: 'ranger',
    skillId: 16427,
    signal: 11491,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(SonicBarrier)'
  },
  {
    profession: 'ranger',
    skillId: 12698,
    signal: 6888,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(LightningBreath)'
  },
  {
    profession: 'ranger',
    skillId: 12699,
    signal: 6888,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(Electrocute_RiverDrake)'
  },
  {
    profession: 'ranger',
    skillId: 12670,
    signal: 5582,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(FireBreath_SalamanderDrake)'
  },
  {
    profession: 'ranger',
    skillId: 12695,
    signal: 5582,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(Boil_SalamanderDrake)'
  },
  {
    profession: 'ranger',
    skillId: 12681,
    signal: 6849,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(Stalk)'
  },
  {
    profession: 'ranger',
    skillId: 12658,
    signal: 3827,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(MightyRoar)'
  },
  {
    profession: 'ranger',
    skillId: 12693,
    signal: 6044,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(IcyPounce)'
  },
  {
    profession: 'ranger',
    skillId: 12656,
    signal: 6044,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(IcyBite)'
  },
  {
    profession: 'ranger',
    skillId: 31451,
    signal: 15380,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(FuriousPounce)'
  },
  {
    profession: 'ranger',
    skillId: 65109,
    signal: 24298,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(GuardiansRoar)'
  },
  {
    profession: 'ranger',
    skillId: 12680,
    signal: 7932,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(RendingPounce)'
  },
  {
    profession: 'ranger',
    skillId: 42963,
    signal: 19005,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(SavannahStrike)'
  },
  {
    profession: 'ranger',
    skillId: 42180,
    signal: 19166,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(BlindingRoar)'
  },
  {
    profession: 'ranger',
    skillId: 74314,
    signal: 26628,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(RallyingRoar)'
  },
  {
    profession: 'ranger',
    skillId: 41156,
    signal: 18688,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(FangGrapple)'
  },
  {
    profession: 'ranger',
    skillId: 44980,
    signal: 18119,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(JacarandasEmbraceSkill)'
  },
  {
    profession: 'ranger',
    skillId: 75783,
    signal: 26851,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(HoneyToss)'
  },
  {
    profession: 'ranger',
    skillId: 12748,
    signal: 8041,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ChillingWhirl)'
  },
  {
    profession: 'ranger',
    skillId: 12749,
    signal: 8042,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ImmobilizingWhirl)'
  },
  {
    profession: 'ranger',
    skillId: 12748,
    signal: 9458,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ChillingWhirl)'
  },
  {
    profession: 'ranger',
    skillId: 12713,
    signal: 6883,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ProtectingScreech)'
  },
  {
    profession: 'ranger',
    skillId: 12708,
    signal: 6884,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(DazingScreech_PinkMoa)'
  },
  {
    profession: 'ranger',
    skillId: 12712,
    signal: 6885,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(FuriousScreech)'
  },
  {
    profession: 'ranger',
    skillId: 12711,
    signal: 6886,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(IcyScreech)'
  },
  {
    profession: 'ranger',
    skillId: 12709,
    signal: 6887,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(DazingScreech_BlackMoa)'
  },
  {
    profession: 'ranger',
    skillId: 12754,
    signal: 8013,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ForageRock)'
  },
  {
    profession: 'ranger',
    skillId: 12732,
    signal: 8016,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ForageSword)'
  },
  {
    profession: 'ranger',
    skillId: 12756,
    signal: 8015,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ForageFeathers)'
  },
  {
    profession: 'ranger',
    skillId: 12755,
    signal: 8014,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ForageScale)'
  },
  {
    profession: 'ranger',
    skillId: 66622,
    signal: 24203,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(BloodthirstyCharge)'
  },
  {
    profession: 'ranger',
    skillId: 43636,
    signal: 19104,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(HeadToss)'
  },
  {
    profession: 'ranger',
    skillId: 79766,
    signal: 27687,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(InnocentDisplayJuvenileRiverOtter)'
  },
  {
    profession: 'ranger',
    skillId: 12757,
    signal: 6968,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(FeedingFrenzy)'
  },
  {
    profession: 'ranger',
    skillId: 65418,
    signal: 24796,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(HunkerDown_Turtle)'
  },
  {
    profession: 'ranger',
    skillId: 31568,
    signal: 15402,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(SmokeCloud)'
  },
  {
    profession: 'ranger',
    skillId: 12730,
    signal: 8005,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(WeakeningVenom)'
  },
  {
    profession: 'ranger',
    skillId: 12731,
    signal: 8007,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(DeadlyVenom)'
  },
  {
    profession: 'ranger',
    skillId: 12729,
    signal: 8006,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ParalyzingVenom)'
  },
  {
    profession: 'ranger',
    skillId: 12729,
    signal: 8008,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ParalyzingVenom)'
  },
  {
    profession: 'ranger',
    skillId: 12664,
    signal: 7928,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(RendingMaul)'
  },
  {
    profession: 'ranger',
    skillId: 12685,
    signal: 7927,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(EnfeeblingRoar)'
  },
  {
    profession: 'ranger',
    skillId: 12688,
    signal: 7927,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(EnfeeblingMaul)'
  },
  {
    profession: 'ranger',
    skillId: 12666,
    signal: 4426,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ShakeItOff)'
  },
  {
    profession: 'ranger',
    skillId: 12691,
    signal: 4426,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(PurgeConditions)'
  },
  {
    profession: 'ranger',
    skillId: 12687,
    signal: 6898,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(PoisonCloud_Murellow)'
  },
  {
    profession: 'ranger',
    skillId: 12690,
    signal: 6898,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(PoisonousMaul)'
  },
  {
    profession: 'ranger',
    skillId: 12667,
    signal: 7926,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(IcyRoar)'
  },
  {
    profession: 'ranger',
    skillId: 12689,
    signal: 7926,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(IcyMaul)'
  },
  {
    profession: 'ranger',
    skillId: 31639,
    signal: 15436,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(LightningAssault)'
  },
  {
    profession: 'ranger',
    skillId: 31459,
    signal: 15399,
    kind: 'minion-command',
    rule: 'RangerHelper.MinionCommandCastFinder(ConsumingFlame)'
  },
  {
    profession: 'ranger',
    specialization: 'druid',
    skillId: 31869,
    signal: 31508,
    kind: 'buff-gain',
    rule: 'DruidHelper.BuffGainCastFinder(EnterCelestialAvatar)',
    swapOffset: -1
  },
  {
    profession: 'ranger',
    specialization: 'druid',
    skillId: 31411,
    signal: 31508,
    kind: 'buff-loss',
    rule: 'DruidHelper.BuffLossCastFinder(ExitCelestialAvatar)',
    swapOffset: -1
  },
  {
    profession: 'ranger',
    specialization: 'druid',
    skillId: 31406,
    signal: '19C4FA17A38E7E4780722799B48BF2BE',
    kind: 'effect',
    rule: 'DruidHelper.EffectCastFinder(SeedOfLife)',
    minBuild: 135242
  },
  {
    profession: 'ranger',
    specialization: 'druid',
    skillId: 31658,
    signal: 31658,
    kind: 'damage',
    rule: 'DruidHelper.DamageCastFinder(GlyphOfEquality)',
    disableWithEffects: true
  },
  {
    profession: 'ranger',
    specialization: 'druid',
    skillId: 31401,
    signal: '74870558C43E4747955C573CAAC630A7',
    kind: 'effect-dst',
    rule: 'DruidHelper.EffectCastFinderByDst(GlyphOfEqualityCA)'
  },
  {
    profession: 'ranger',
    specialization: 'druid',
    skillId: 31658,
    signal: '9B8A1BE554450B4899B64F7579DF0A8C',
    kind: 'effect',
    rule: 'DruidHelper.EffectCastFinder(GlyphOfEquality)'
  },
  {
    profession: 'ranger',
    specialization: 'druid',
    skillId: 31749,
    signal: '28346F32FD199C4B8F9B15438F27A434',
    kind: 'effect',
    rule: 'DruidHelper.EffectCastFinder(BloodMoonDaze)',
    origin: 'trait'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 42944,
    signal: 40272,
    kind: 'buff-gain',
    rule: 'SoulbeastHelper.BuffGainCastFinder(EnterBeastMode)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 43014,
    signal: 40272,
    kind: 'buff-loss',
    rule: 'SoulbeastHelper.BuffLossCastFinder(ExitBeastMode)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 42944,
    signal: 44932,
    kind: 'buff-gain',
    rule: 'SoulbeastHelper.BuffGainCastFinder(EnterBeastMode)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 43014,
    signal: 44932,
    kind: 'buff-loss',
    rule: 'SoulbeastHelper.BuffLossCastFinder(ExitBeastMode)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 42944,
    signal: 44693,
    kind: 'buff-gain',
    rule: 'SoulbeastHelper.BuffGainCastFinder(EnterBeastMode)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 43014,
    signal: 44693,
    kind: 'buff-loss',
    rule: 'SoulbeastHelper.BuffLossCastFinder(ExitBeastMode)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 42944,
    signal: 41720,
    kind: 'buff-gain',
    rule: 'SoulbeastHelper.BuffGainCastFinder(EnterBeastMode)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 43014,
    signal: 41720,
    kind: 'buff-loss',
    rule: 'SoulbeastHelper.BuffLossCastFinder(ExitBeastMode)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 42944,
    signal: 40069,
    kind: 'buff-gain',
    rule: 'SoulbeastHelper.BuffGainCastFinder(EnterBeastMode)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 43014,
    signal: 40069,
    kind: 'buff-loss',
    rule: 'SoulbeastHelper.BuffLossCastFinder(ExitBeastMode)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 45789,
    signal: 41815,
    kind: 'buff-give',
    rule: 'SoulbeastHelper.BuffGiveCastFinder(DolyakStanceSkill)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 45970,
    signal: 45038,
    kind: 'buff-give',
    rule: 'SoulbeastHelper.BuffGiveCastFinder(MoaStanceSkill)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 40498,
    signal: 44651,
    kind: 'buff-give',
    rule: 'SoulbeastHelper.BuffGiveCastFinder(VultureStanceSkill)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 45479,
    signal: 43266,
    kind: 'buff-gain',
    rule: 'SoulbeastHelper.BuffGainCastFinder(SharpenSpinesBeastmode)'
  },
  {
    profession: 'ranger',
    specialization: 'soulbeast',
    skillId: 59554,
    signal: 'BF0A5B11A4076A4F98C6E1D655D507B1',
    kind: 'effect',
    rule: 'SoulbeastHelper.EffectCastFinder(EternalBondSkill)',
    minBuild: 135242
  },
  {
    profession: 'ranger',
    specialization: 'untamed',
    skillId: 63344,
    signal: 63145,
    kind: 'buff-gain',
    rule: 'UntamedHelper.BuffGainCastFinder(UnleashPet)'
  },
  {
    profession: 'ranger',
    specialization: 'untamed',
    skillId: 63147,
    signal: 63317,
    kind: 'buff-gain',
    rule: 'UntamedHelper.BuffGainCastFinder(UnleashRanger)'
  },
  {
    profession: 'ranger',
    specialization: 'untamed',
    skillId: 69193,
    signal: 69193,
    kind: 'buff-gain',
    rule: 'UntamedHelper.BuffGainCastFinder(RestorativeStrikesAndBiorhythm)',
    origin: 'trait',
    minBuild: 0,
    maxBuild: 182824
  },
  {
    profession: 'ranger',
    specialization: 'untamed',
    skillId: 63256,
    signal: 'D7DCD4ABF9E4A749950AF0175E02EA06',
    kind: 'effect-dst',
    rule: 'UntamedHelper.EffectCastFinderByDst(MutateConditions)'
  },
  {
    profession: 'ranger',
    specialization: 'untamed',
    skillId: 63195,
    signal: '8D36806A690A5442A983308EDCECB018',
    kind: 'effect-dst',
    rule: 'UntamedHelper.EffectCastFinderByDst(UnnaturalTraversal)'
  },
  {
    profession: 'ranger',
    specialization: 'untamed',
    skillId: 63209,
    signal: '60BE4692A455B140A05AD794BF4753F6',
    kind: 'effect',
    rule: 'UntamedHelper.EffectCastFinder(VenomousOutburst)',
    minions: true
  },
  {
    profession: 'ranger',
    specialization: 'untamed',
    skillId: 63258,
    signal: '2C40B0741111444F98895A658A7F978F',
    kind: 'effect',
    rule: 'UntamedHelper.EffectCastFinder(RendingVines)',
    minions: true
  },
  {
    profession: 'ranger',
    specialization: 'untamed',
    skillId: 63094,
    signal: 'F2B1B61970FC59418AC049BF3A07FFD4',
    kind: 'effect',
    rule: 'UntamedHelper.EffectCastFinder(EnvelopingHaze)',
    minions: true
  },
  {
    profession: 'ranger',
    specialization: 'galeshot',
    skillId: 77213,
    signal: '9242D10B4F04274EB6E9EBCDB2262181',
    kind: 'effect-dst',
    rule: 'GaleshotHelper.EffectCastFinderByDst(DismissCycloneBow)',
    swapOffset: -1
  },
  {
    profession: 'ranger',
    specialization: 'galeshot',
    skillId: 76905,
    signal: 76905,
    kind: 'damage',
    rule: 'GaleshotHelper.DamageCastFinder(WutheringWindSkill)'
  },
  {
    profession: 'revenant',
    skillId: 28134,
    signal: 27890,
    kind: 'buff-gain',
    rule: 'RevenantHelper.BuffGainCastFinder(LegendaryAssassinStanceSkill)'
  },
  {
    profession: 'revenant',
    skillId: 28494,
    signal: 27928,
    kind: 'buff-gain',
    rule: 'RevenantHelper.BuffGainCastFinder(LegendaryDemonStanceSkill)'
  },
  {
    profession: 'revenant',
    skillId: 28419,
    signal: 27205,
    kind: 'buff-gain',
    rule: 'RevenantHelper.BuffGainCastFinder(LegendaryDwarfStanceSkill)'
  },
  {
    profession: 'revenant',
    skillId: 28195,
    signal: 27972,
    kind: 'buff-gain',
    rule: 'RevenantHelper.BuffGainCastFinder(LegendaryCentaurStanceSkill)'
  },
  {
    profession: 'revenant',
    skillId: 27107,
    signal: 27581,
    kind: 'buff-gain',
    rule: 'RevenantHelper.BuffGainCastFinder(ImpossibleOddsSkill)',
    icd: 500
  },
  {
    profession: 'revenant',
    skillId: 28382,
    signal: 27581,
    kind: 'buff-loss',
    rule: 'RevenantHelper.BuffLossCastFinder(RelinquishPower)',
    icd: 500
  },
  {
    profession: 'revenant',
    skillId: 26557,
    signal: 27273,
    kind: 'buff-gain',
    rule: 'RevenantHelper.BuffGainCastFinder(VengefulHammersSkill)'
  },
  {
    profession: 'revenant',
    skillId: 26956,
    signal: 27273,
    kind: 'buff-loss',
    rule: 'RevenantHelper.BuffLossCastFinder(ReleaseHammers)'
  },
  {
    profession: 'revenant',
    skillId: 26693,
    signal: 28001,
    kind: 'buff-loss',
    rule: 'RevenantHelper.BuffLossCastFinder(ResistTheDarkness)'
  },
  {
    profession: 'revenant',
    skillId: 59591,
    signal: 59591,
    kind: 'damage',
    rule: 'RevenantHelper.DamageCastFinder(InvokingTorment)',
    minBuild: 102321,
    origin: 'unconditional'
  },
  {
    profession: 'revenant',
    skillId: 46854,
    signal: 46854,
    kind: 'damage',
    rule: 'RevenantHelper.DamageCastFinder(CallOfTheAssassin)'
  },
  {
    profession: 'revenant',
    skillId: 46843,
    signal: 46843,
    kind: 'damage',
    rule: 'RevenantHelper.DamageCastFinder(CallOfTheDwarf)'
  },
  {
    profession: 'revenant',
    skillId: 46856,
    signal: 46856,
    kind: 'damage',
    rule: 'RevenantHelper.DamageCastFinder(CallOfTheDemon)'
  },
  {
    profession: 'revenant',
    skillId: 28388,
    signal: 28388,
    kind: 'damage',
    rule: 'RevenantHelper.DamageCastFinder(LesserBanishEnchantment)',
    minBuild: 94051,
    maxBuild: 102321,
    origin: 'trait'
  },
  {
    profession: 'revenant',
    skillId: 29197,
    signal: 'D2B388E8DB721544A110979C3A384977',
    kind: 'effect',
    rule: 'RevenantHelper.EffectCastFinder(PurifyingEssence)',
    minBuild: 130910
  },
  {
    profession: 'revenant',
    skillId: 29114,
    signal: 'BE191381B1BC984A989D94D215DDEA1F',
    kind: 'effect',
    rule: 'RevenantHelper.EffectCastFinder(EnergyExpulsion)',
    minBuild: 130910
  },
  {
    profession: 'revenant',
    skillId: -39,
    signal: '25908EB455863D43AE70FB3F4A22D6E4',
    kind: 'effect',
    rule: 'RevenantHelper.EffectCastFinder(BlitzMinesDrop)'
  },
  {
    profession: 'revenant',
    skillId: 73149,
    signal: '40C9F5FE5BD3BD449B5E48DF1E5FD348',
    kind: 'effect',
    rule: 'RevenantHelper.EffectCastFinder(BlitzMines)',
    secondary: ['1B3ACEE36F61DE42AB1C24BD33B5B5AD']
  },
  {
    profession: 'revenant',
    specialization: 'herald',
    skillId: 28085,
    signal: 27732,
    kind: 'buff-gain',
    rule: 'HeraldHelper.BuffGainCastFinder(LegendaryDragonStanceSkill)'
  },
  {
    profession: 'revenant',
    specialization: 'herald',
    skillId: 29371,
    signal: 29275,
    kind: 'buff-gain',
    rule: 'HeraldHelper.BuffGainCastFinder(FacetOfNatureSkill)'
  },
  {
    profession: 'revenant',
    specialization: 'herald',
    skillId: 28379,
    signal: 28036,
    kind: 'buff-gain',
    rule: 'HeraldHelper.BuffGainCastFinder(FacetOfDarknessSkill)'
  },
  {
    profession: 'revenant',
    specialization: 'herald',
    skillId: 27014,
    signal: 28243,
    kind: 'buff-gain',
    rule: 'HeraldHelper.BuffGainCastFinder(FacetOfElementsSkill)'
  },
  {
    profession: 'revenant',
    specialization: 'herald',
    skillId: 26644,
    signal: 27376,
    kind: 'buff-gain',
    rule: 'HeraldHelper.BuffGainCastFinder(FacetOfStrengthSkill)'
  },
  {
    profession: 'revenant',
    specialization: 'herald',
    skillId: 27760,
    signal: 27983,
    kind: 'buff-gain',
    rule: 'HeraldHelper.BuffGainCastFinder(FacetOfChaosSkill)'
  },
  {
    profession: 'revenant',
    specialization: 'herald',
    skillId: 46857,
    signal: 46857,
    kind: 'damage',
    rule: 'HeraldHelper.DamageCastFinder(CallOfTheDragon)'
  },
  {
    profession: 'revenant',
    specialization: 'renegade',
    skillId: 41858,
    signal: 44272,
    kind: 'buff-gain',
    rule: 'RenegadeHelper.BuffGainCastFinder(LegendaryRenegadeStanceSkill)'
  },
  {
    profession: 'revenant',
    specialization: 'renegade',
    skillId: 46849,
    signal: 46849,
    kind: 'damage',
    rule: 'RenegadeHelper.DamageCastFinder(CallOfTheRenegade)'
  },
  {
    profession: 'revenant',
    specialization: 'renegade',
    skillId: 45537,
    signal: 'F53F05F041957A47AD62B522FE030408',
    kind: 'effect',
    rule: 'RenegadeHelper.EffectCastFinder(OrdersFromAbove)'
  },
  {
    profession: 'revenant',
    specialization: 'renegade',
    skillId: 45537,
    signal: 'B63D192DED78B1489DDB6E742D603CE5',
    kind: 'effect',
    rule: 'RenegadeHelper.EffectCastFinder(OrdersFromAbove)'
  },
  {
    profession: 'revenant',
    specialization: 'vindicator',
    skillId: 62749,
    signal: 62919,
    kind: 'buff-gain',
    rule: 'VindicatorHelper.BuffGainCastFinder(LegendaryAllianceStanceSkill)'
  },
  {
    profession: 'revenant',
    specialization: 'vindicator',
    skillId: 62705,
    signal: 62705,
    kind: 'damage',
    rule: 'VindicatorHelper.DamageCastFinder(CallOfTheAlliance)'
  },
  {
    profession: 'revenant',
    specialization: 'vindicator',
    skillId: 62687,
    signal: 62864,
    kind: 'buff-gain',
    rule: 'VindicatorHelper.BuffGainCastFinder(UrnOfSaintViktorSkill)'
  },
  {
    profession: 'revenant',
    specialization: 'conduit',
    skillId: 76610,
    signal: 77234,
    kind: 'buff-gain',
    rule: 'ConduitHelper.BuffGainCastFinder(LegendaryEntityStanceSkill)'
  },
  {
    profession: 'revenant',
    specialization: 'conduit',
    skillId: 77021,
    signal: 77021,
    kind: 'damage',
    rule: 'ConduitHelper.DamageCastFinder(Mistfire)',
    origin: 'unconditional'
  },
  {
    profession: 'thief',
    skillId: 13002,
    signal: 13135,
    kind: 'buff-gain',
    rule: 'ThiefHelper.BuffGainCastFinder(Shadowstep)'
  },
  {
    profession: 'thief',
    skillId: 13014,
    signal: 13014,
    kind: 'damage',
    rule: 'ThiefHelper.DamageCastFinder(Mug)'
  },
  {
    profession: 'thief',
    skillId: 13015,
    signal: 13015,
    kind: 'damage',
    rule: 'ThiefHelper.DamageCastFinder(InfiltratorsStrike)'
  },
  {
    profession: 'thief',
    skillId: 13046,
    signal: 44597,
    kind: 'buff-gain',
    rule: 'ThiefHelper.BuffGainCastFinder(AssassinsSignet)'
  },
  {
    profession: 'thief',
    skillId: 13093,
    signal: 13094,
    kind: 'buff-give',
    rule: 'ThiefHelper.BuffGiveCastFinder(DevourerVenomSkill)'
  },
  {
    profession: 'thief',
    skillId: 13096,
    signal: 13095,
    kind: 'buff-give',
    rule: 'ThiefHelper.BuffGiveCastFinder(IceDrakeVenomSkill)'
  },
  {
    profession: 'thief',
    skillId: 13055,
    signal: 13054,
    kind: 'buff-give',
    rule: 'ThiefHelper.BuffGiveCastFinder(SkaleVenomSkill)'
  },
  {
    profession: 'thief',
    skillId: 49052,
    signal: 49083,
    kind: 'buff-give',
    rule: 'ThiefHelper.BuffGiveCastFinder(SoulStoneVenomSkill)'
  },
  {
    profession: 'thief',
    skillId: 56911,
    signal: '7325E9B0DD2E914F9837E5FCFC740A95',
    kind: 'effect',
    rule: 'ThiefHelper.EffectCastFinder(Pitfall)'
  },
  {
    profession: 'thief',
    skillId: 13099,
    signal: '92A7634C2C7F2746AFDA88E1AD9AE886',
    kind: 'effect',
    rule: 'ThiefHelper.EffectCastFinder(SealArea)'
  },
  {
    profession: 'thief',
    skillId: 16435,
    signal: 57031,
    kind: 'buff-gain',
    rule: 'ThiefHelper.BuffGainCastFinder(ShadowPortal)'
  },
  {
    profession: 'thief',
    skillId: 13064,
    signal: '23284B87C26C9A41A887F410F930E1A2',
    kind: 'effect-dst',
    rule: 'ThiefHelper.EffectCastFinderByDst(InfiltratorsSignetSkill)',
    secondary: ['2C89A39F7B88614ABED16D4B5A5BD2EB']
  },
  {
    profession: 'thief',
    skillId: 13062,
    signal: 'BB5488951B60B546BB1BD5626DAE83E1',
    kind: 'effect-dst',
    rule: 'ThiefHelper.EffectCastFinderByDst(SignetOfAgilitySkill)'
  },
  {
    profession: 'thief',
    skillId: 13060,
    signal: '14A5982DB277744CB928A4935555F563',
    kind: 'effect-dst',
    rule: 'ThiefHelper.EffectCastFinderByDst(SignetOfShadowsSkill)'
  },
  {
    profession: 'thief',
    specialization: 'daredevil',
    skillId: 31129,
    signal: 33162,
    kind: 'buff-gain',
    rule: 'DaredevilHelper.BuffGainCastFinder(Bound)',
    origin: 'trait'
  },
  {
    profession: 'thief',
    specialization: 'daredevil',
    skillId: 31267,
    signal: 32200,
    kind: 'buff-gain',
    rule: 'DaredevilHelper.BuffGainCastFinder(ImpalingLotus)',
    origin: 'trait'
  },
  {
    profession: 'thief',
    specialization: 'daredevil',
    skillId: 31187,
    signal: 32931,
    kind: 'buff-gain',
    rule: 'DaredevilHelper.BuffGainCastFinder(Dash)',
    origin: 'trait'
  },
  {
    profession: 'thief',
    specialization: 'deadeye',
    skillId: 41372,
    signal: 'B59FCEFCF1D5D84B9FDB17F11E9B52E6',
    kind: 'effect-dst',
    rule: 'DeadeyeHelper.EffectCastFinderByDst(Mercy)'
  },
  {
    profession: 'thief',
    specialization: 'specter',
    skillId: 63155,
    signal: 63239,
    kind: 'buff-gain',
    rule: 'SpecterHelper.BuffGainCastFinder(EnterShadowShroud)',
    swapOffset: -1
  },
  {
    profession: 'thief',
    specialization: 'specter',
    skillId: 63251,
    signal: 63239,
    kind: 'buff-loss',
    rule: 'SpecterHelper.BuffLossCastFinder(ExitShadowShroud)',
    swapOffset: -1
  },
  {
    profession: 'thief',
    specialization: 'antiquary',
    skillId: 76909,
    signal: 'F0A23BA5903B91409D3940AD3335DEF1',
    kind: 'effect',
    rule: 'AntiquaryHelper.EffectCastFinder(UnstableSkrittBombSkill)'
  },
  {
    profession: 'thief',
    specialization: 'antiquary',
    skillId: 76816,
    signal: '1B48B91A5B0EC540BEA2765583412CBC',
    kind: 'effect',
    rule: 'AntiquaryHelper.EffectCastFinder(ChakShield)',
    secondary: ['F011BC77BB1D4D40BDE0C0788F51224B', 'EE180AE86C6D314E90A6E35D6C9BA5C6']
  },
  {
    profession: 'thief',
    specialization: 'antiquary',
    skillId: 77230,
    signal: 76659,
    kind: 'buff-gain',
    rule: 'AntiquaryHelper.BuffGainCastFinder(CanachCoinToss)'
  },
  {
    profession: 'thief',
    specialization: 'antiquary',
    skillId: 77230,
    signal: 77252,
    kind: 'buff-gain',
    rule: 'AntiquaryHelper.BuffGainCastFinder(CanachCoinToss)'
  },
  {
    profession: 'thief',
    specialization: 'antiquary',
    skillId: 76744,
    signal: 77054,
    kind: 'buff-gain',
    rule: 'AntiquaryHelper.BuffGainCastFinder(CanachCoinTossBackfired)'
  },
  {
    profession: 'thief',
    specialization: 'antiquary',
    skillId: 76744,
    signal: 76574,
    kind: 'buff-gain',
    rule: 'AntiquaryHelper.BuffGainCastFinder(CanachCoinTossBackfired)'
  },
  {
    profession: 'thief',
    specialization: 'antiquary',
    skillId: 76879,
    signal: 77086,
    kind: 'buff-gain',
    rule: 'AntiquaryHelper.BuffGainCastFinder(EmergencyJadeShieldSkill)'
  },
  {
    profession: 'thief',
    specialization: 'antiquary',
    skillId: 76784,
    signal: 76921,
    kind: 'buff-gain',
    rule: 'AntiquaryHelper.BuffGainCastFinder(EmergencyJadeShieldBackfiredSkill)'
  },
  {
    profession: 'warrior',
    skillId: 14410,
    signal: 51664,
    kind: 'buff-gain',
    rule: 'WarriorHelper.BuffGainCastFinder(SignetOfFurySkill)'
  },
  {
    profession: 'warrior',
    skillId: 14404,
    signal: '75EF160EAFC0394CACC436CF89819148',
    kind: 'effect-dst',
    rule: 'WarriorHelper.EffectCastFinderByDst(SignetOfMightSkill)'
  },
  {
    profession: 'warrior',
    skillId: 14479,
    signal: '1E720C4D42448D45BDCB6307869D3D66',
    kind: 'effect-dst',
    rule: 'WarriorHelper.EffectCastFinderByDst(SignetOfStaminaSkill)'
  },
  {
    profession: 'warrior',
    skillId: 14413,
    signal: 'D7F8FA5695F8714B99A51EE72EF6E178',
    kind: 'effect-dst',
    rule: 'WarriorHelper.EffectCastFinderByDst(DolyakSignetSkill)'
  },
  {
    profession: 'warrior',
    specialization: 'berserker',
    skillId: 31289,
    signal: 31289,
    kind: 'damage',
    rule: 'BerserkerHelper.DamageCastFinder(KingOfFires)',
    minBuild: 97950,
    disableWithEffects: true,
    origin: 'trait'
  },
  {
    profession: 'warrior',
    specialization: 'berserker',
    skillId: 31289,
    signal: '5E77D6C93F3D0747B0B81169C7C0E506',
    kind: 'effect',
    rule: 'BerserkerHelper.EffectCastFinder(KingOfFires)',
    origin: 'trait'
  },
  {
    profession: 'warrior',
    specialization: 'berserker',
    skillId: 30258,
    signal: 'AC32B7F7BB281B4D94713F180C44F322',
    kind: 'effect',
    rule: 'BerserkerHelper.EffectCastFinder(Outrage)'
  },
  {
    profession: 'warrior',
    specialization: 'berserker',
    skillId: -41,
    signal: 29502,
    kind: 'buff-loss',
    rule: 'BerserkerHelper.BuffLossCastFinder(BerserkEndSkill)'
  },
  {
    profession: 'warrior',
    specialization: 'berserker',
    skillId: 30435,
    signal: 29502,
    kind: 'buff-gain',
    rule: 'BerserkerHelper.BuffGainCastFinder(BerserkSkill)',
    minBuild: 135242
  },
  {
    profession: 'warrior',
    specialization: 'spellbreaker',
    skillId: 43532,
    signal: 42428,
    kind: 'buff-give',
    rule: 'SpellbreakerHelper.BuffGiveCastFinder(MagebaneTetherSkill)',
    origin: 'trait'
  },
  {
    profession: 'warrior',
    specialization: 'spellbreaker',
    skillId: 45534,
    signal: 45534,
    kind: 'damage',
    rule: 'SpellbreakerHelper.DamageCastFinder(LossAversion)',
    origin: 'trait'
  },
  {
    profession: 'warrior',
    specialization: 'bladesworn',
    skillId: 62861,
    signal: 62769,
    kind: 'buff-loss',
    rule: 'BladeswornHelper.BuffLossCastFinder(GunsaberSheath)',
    minBuild: 119939,
    swapOffset: -1
  },
  {
    profession: 'warrior',
    specialization: 'bladesworn',
    skillId: 62745,
    signal: 62769,
    kind: 'buff-gain',
    rule: 'BladeswornHelper.BuffGainCastFinder(Gunsaber)',
    minBuild: 119939,
    swapOffset: -1
  },
  {
    profession: 'warrior',
    specialization: 'bladesworn',
    skillId: 62847,
    signal: 62847,
    kind: 'damage',
    rule: 'BladeswornHelper.DamageCastFinder(UnseenSword)',
    minBuild: 119939,
    origin: 'trait'
  },
  {
    profession: 'warrior',
    specialization: 'bladesworn',
    skillId: 62960,
    signal: 'B5BE541DBF290E4AA381E1E52A2A3525',
    kind: 'effect',
    rule: 'BladeswornHelper.EffectCastFinder(DragonspikeMineSkill)'
  },
  {
    profession: 'warrior',
    specialization: 'paragon',
    skillId: 76769,
    signal: 'CB237E7C35B61E47A67663B95CB6E094',
    kind: 'effect',
    rule: 'ParagonHelper.EffectCastFinder(NeverSurrender)'
  }
];

/** Exact item icons from the GW2 v2/items API; keys match the selectable equipment catalogs. */
export const EQUIPMENT_ICONS: Readonly<Record<string, string>> = {
  // The generic slaying potion uses the undead variant's icon to represent the shared effect.
  'Potion of Slaying': 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Potent_Potion_of_Undead_Slaying.png',
  'Bowl of Curry Butternut Squash Soup':
    'https://render.guildwars2.com/file/0AEDB9B0AA4274930F55919A6D21251BFDA1EB09/433673.png',
  'Bowl of Fancy Potato and Leek Soup':
    'https://render.guildwars2.com/file/AD7A1D7FAEE6E6F3AA9061CFDC90A418633DDD5C/433672.png',
  'Bowl of Fire Meat Chili': 'https://render.guildwars2.com/file/E03C2CA53D4B324379EF5DA85CF3CF547D551F7E/433671.png',
  'Bowl of Kimchi Tofu Stew': 'https://render.guildwars2.com/file/FBF61D9D2FB5265FF016E67677BE722A432BBF96/2594836.png',
  'Bowl of Sawgill Mushroom Risotto':
    'https://render.guildwars2.com/file/10540F463B30B4B5AEA130A2B124B0129F6EE272/339938.png',
  'Bowl of Sweet and Spicy Beans':
    'https://render.guildwars2.com/file/C63C32C6FF0344FF32EC40582042DD35CD6DC794/831444.png',
  'Bowl of Sweet and Spicy Butternut Squash Soup':
    'https://render.guildwars2.com/file/FD0A2497B8C711A73AE9A6020118A895091E68E5/561719.png',
  'Bowl of Truffle Risotto': 'https://render.guildwars2.com/file/4315B40EE513364BD62BB9A351E633FC771FC5D3/433654.png',
  'Cilantro and Cured Meat Flatbread':
    'https://render.guildwars2.com/file/13906DE02D374DBB6A013C5EF76F26FBAFD5A39A/2191050.png',
  'Cilantro Lime Sous-Vide Steak':
    'https://render.guildwars2.com/file/D2C00407A3FFE06251BDE9DC13525FE167ABA3E6/2191069.png',
  "Dragon's Revelry Starcake": 'https://render.guildwars2.com/file/4CEA3CEE0C98320F2CB653D9AA52779BBBF46AF9/598591.png',
  'Fishy Rice Bowl': 'https://render.guildwars2.com/file/C318CFBFE2BA565A5D1505FBAFA0F89F3211C22D/2594834.png',
  'Ghost Pepper Popper': 'https://render.guildwars2.com/file/1C1D9D0407CD96F3E80266DEBD2B544E799AF658/433666.png',
  'Meaty Asparagus Skewer': 'https://render.guildwars2.com/file/A4D8E658C8D547E0F7602458D00BCADADC62EDFE/2594837.png',
  'Meaty Rice Bowl': 'https://render.guildwars2.com/file/2859624C31DF16A4BBAA21B1BC2B0CA3251810DD/2594838.png',
  'Plate of Beef Carpaccio with Salsa Garnish':
    'https://render.guildwars2.com/file/012F16A0E3F01C78387747FD7373269D08A2413F/2191023.png',
  'Plate of Beef Rendang': 'https://render.guildwars2.com/file/ED54F2CA2B6AEAE258C90A20BB213E60956CDD13/1947191.png',
  'Plate of Coq Au Vin with Salsa':
    'https://render.guildwars2.com/file/5B0BE79E271153D9350BC3E14034482BEA073C5C/2191039.png',
  'Plate of Eggs Benedict': 'https://render.guildwars2.com/file/D4276027EE4A9C47F418373965493D2BF2C3F81E/2191051.png',
  'Plate of Fire Flank Steak': 'https://render.guildwars2.com/file/7D2FDB50466F561234CA3EDB49FFD6594132A65B/433655.png',
  'Plate of Jerk Poultry': 'https://render.guildwars2.com/file/5D61D107C193DBC3D47EF17CFE29B2BF46D162F9/1201836.png',
  'Plate of Kimchi Pancakes': 'https://render.guildwars2.com/file/D64959DDB9D89E6A4FE321EC2965B6C72B557575/2594835.png',
  'Plate of Truffle Steak': 'https://render.guildwars2.com/file/EB78371F9DADA4A130EDBD0D192D320402370F47/433656.png',
  'Rare Veggie Pizza': 'https://render.guildwars2.com/file/E9D55361679172330E9F08706820A180DD1D145A/433653.png',
  'Salsa Eggs Benedict': 'https://render.guildwars2.com/file/0C1654600B0E40F9EEC909B8950CD6140FE17FCD/2191055.png',
  'Salsa-Topped Veggie Flatbread':
    'https://render.guildwars2.com/file/161BD739DCBE0BA737081A079017D6F660BE5642/2191029.png',
  'Soul Pastry': 'https://render.guildwars2.com/file/5905C8207CDB4A2122FC465BD7D4A4A9BA36B0F6/2056189.png',
  'Spherified Cilantro Oyster Soup':
    'https://render.guildwars2.com/file/9B0D0173051264281BBA4F4B10D7514DF54105E2/2191074.png',
  'Furious Sharpening Stone': 'https://render.guildwars2.com/file/91AC9F70D30C5E3E22635DF4F30CAFA1F6F803A0/219361.png',
  'Furious Tuning Crystal': 'https://render.guildwars2.com/file/071410D26DC8480BA014C84A05EC7BE4DA0FDA5A/219373.png',
  'Leviathan Tempering Oil': 'https://render.guildwars2.com/file/B32E4DAE9F7AE0732C22E5D2F299E9D1FD0514D3/3795950.png',
  'Magnanimous Tuning Crystal':
    'https://render.guildwars2.com/file/69DDBB1A79A104656C631204D4FC65C941D24319/1676541.png',
  'Potent Lucent Oil': 'https://render.guildwars2.com/file/B4335597D7C65F33163D5DFAB83A4E2734D2E2D4/2063492.png',
  'Superior Sharpening Stone': 'https://render.guildwars2.com/file/91AC9F70D30C5E3E22635DF4F30CAFA1F6F803A0/219361.png',
  'Toxic Maintenance Oil': 'https://render.guildwars2.com/file/7AB4D4BBBF563E0B5796C7CD645BDAB7BF9753B4/665780.png',
  'Toxic Sharpening Stone': 'https://render.guildwars2.com/file/09B6025D01199D77CACA2980A159D2C30F9D3256/665779.png',
  'Toxic Tuning Crystal': 'https://render.guildwars2.com/file/CAE216F71766AD4407ECD8C70894792DE41B0366/665781.png',
  'Tuning Icicle': 'https://render.guildwars2.com/file/05A70B2FEFB3B4F31365309F464C3E2CC9D99427/1322537.png',
  'Writ of Masterful Malice': 'https://render.guildwars2.com/file/0B09BA2F77DD6B686D7DD2F700975E4B0CAF4C1D/1201888.png',
  'Writ of Masterful Strength':
    'https://render.guildwars2.com/file/01B49D4EFF3BB71D27A7B0649F0FF3E277E4D6C7/1201925.png',
  Adventurer: 'https://render.guildwars2.com/file/3C053CD2680D7DAE5E0899E8F6FF530D0E445704/221141.png',
  Afflicted: 'https://render.guildwars2.com/file/B952E2BB3ACDF477F4C823655DAC1294C9A12745/220692.png',
  Aristocracy: 'https://render.guildwars2.com/file/D8375410EAF95DB5D29CAB063051AD2AA8FAD740/221152.png',
  Baelfire: 'https://render.guildwars2.com/file/BE044D76F2F1762634B00A5E4216E7B8C104D1FB/220741.png',
  Balthazar: 'https://render.guildwars2.com/file/7CEF770BE7E6A5E507B6D98018155CD2395FAD18/220694.png',
  Berserker: 'https://render.guildwars2.com/file/EB082298F2B83D4E042EF9C1566F3D4E250EB204/1201518.png',
  Deadeye: 'https://render.guildwars2.com/file/17E6C846E62E51AFF8B8AF5A33FD53B391BD7E75/1766386.png',
  Divinity: 'https://render.guildwars2.com/file/7431F5E2780106172D4A97C863D80BDAAC681FBF/220697.png',
  Dragonhunter: 'https://render.guildwars2.com/file/E698E699D9A75AC90CA47A3FBA0259216C29041D/1201528.png',
  Eagle: 'https://render.guildwars2.com/file/2966CB3D97E85EB0E4C33AFB6D1FB63D7304EC97/220700.png',
  Elementalist: 'https://render.guildwars2.com/file/F321ABCA3954145A4A17046D6170767740674866/220730.png',
  Fire: 'https://render.guildwars2.com/file/6967534DA6E09150241DC411B0F4A4B415520FF7/220702.png',
  Firebrand: 'https://render.guildwars2.com/file/5BB9C1FF1BFF6A52217F4007C2B1FFCAB9BCC6B3/1766387.png',
  Fireworks: 'https://render.guildwars2.com/file/CECC01C8220163A9646171B0BAA528B73DE3D527/2100803.png',
  'Flame Legion': 'https://render.guildwars2.com/file/776392A017E4DA16BF3DCA69292BB31ABA998010/220703.png',
  Golemancer: 'https://render.guildwars2.com/file/EB4F765E36EC9CF57526789A3EAB6702110D0949/220705.png',
  Infiltration: 'https://render.guildwars2.com/file/F9C62BCFB70106EEBCA33C4AC35352CE2A082F10/220710.png',
  Krait: 'https://render.guildwars2.com/file/F0932EF967413023BE0CC1EEF5E2536B2764E65A/220711.png',
  Leadership: 'https://render.guildwars2.com/file/0CD614069C9917057D1BEC5B060E689E18E8EE51/1201517.png',
  'Mad King': 'https://render.guildwars2.com/file/0A0E6F80DA16D7764FFEA33893B66051FBE07A3F/499379.png',
  Pack: 'https://render.guildwars2.com/file/FEF77764F24C0548271F29337268970C092DA5D3/220717.png',
  Perplexity: 'https://render.guildwars2.com/file/F67A922A4624470EBAD493920DC1EE2616769E9D/619716.png',
  Rage: 'https://render.guildwars2.com/file/5F65FDA9D721B6BA5654E5ED29A42B01C04DF2DA/220719.png',
  Renegade: 'https://render.guildwars2.com/file/6701DC14A246E241E006A54D04206F01997ED8B9/1766391.png',
  Scholar: 'https://render.guildwars2.com/file/4378ABC0415950DAC6A05C76920392D72E242EC2/220736.png',
  Strength: 'https://render.guildwars2.com/file/F33F44776DFCB0D75B48005904E3C75456C4F5FA/220644.png',
  Tempest: 'https://render.guildwars2.com/file/D144F10ABB48042794BA0627EE04B3311A4131DB/1201529.png',
  Thief: 'https://render.guildwars2.com/file/997AEFF0927F640DE515B4DA516911B3B3B6B9EA/220731.png',
  Thorns: 'https://render.guildwars2.com/file/32DA0B5704E8DEC0F36B6C460734C496C603541C/1201523.png',
  Tormenting: 'https://render.guildwars2.com/file/F8BC046221EA49EB3D349B5D3C50DDF33213D8B3/619715.png',
  Trapper: 'https://render.guildwars2.com/file/4A322301EDD61898193B9B94A0A6A1F1DC06BF24/866844.png',
  Weaver: 'https://render.guildwars2.com/file/C0D36E7D6CAAA060F2EFB0E1CAA2587002F3F451/1766394.png'
};

/** Representative ascended icons by armor weight and item type, matching Discretize's CreateItem catalog. */
export const ARMOR_ICONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  light: {
    Helm: 'https://render.guildwars2.com/file/AD7849A39265D6AA1C712ACD476E912E1EC30839/699210.png',
    Shoulders: 'https://render.guildwars2.com/file/0C4E1FEED2C75BC8F6F1D3D11C18303EEF573EED/699208.png',
    Chest: 'https://render.guildwars2.com/file/6E0C12721BAA5E343813DE9F2C7EFE064AECCE0A/699212.png',
    Gloves: 'https://render.guildwars2.com/file/5859B5CF97C0D394CF5CB5B3042775C6E6C1A1EB/699211.png',
    Leggins: 'https://render.guildwars2.com/file/58F7090A0E429EA35DF1C9F36DBD281552CA12F9/699209.png',
    Boots: 'https://render.guildwars2.com/file/5C63AF3E5541CBBF54C8656DD8F5E274590BEA52/699213.png'
  },
  medium: {
    Helm: 'https://render.guildwars2.com/file/0EBB9F33579CC54CC39F685868FFD79D7A0FEEDC/699204.png',
    Shoulders: 'https://render.guildwars2.com/file/D52D7C621150ADD5AC264256194D9A58B85E447B/699202.png',
    Chest: 'https://render.guildwars2.com/file/957B01535AB96230450BA110704557C9C607054F/699206.png',
    Gloves: 'https://render.guildwars2.com/file/E3BCBC4053466DEBC50B0B0894996353DE03C749/699205.png',
    Leggins: 'https://render.guildwars2.com/file/0D284759AF7E3E9454210A3E7DECF0000B7E5D7F/699203.png',
    Boots: 'https://render.guildwars2.com/file/33BC7FAC99DD9F5E68DFEAED70AC3145DBA707B0/699207.png'
  },
  heavy: {
    Helm: 'https://render.guildwars2.com/file/D4FC06FD1B58AF62E771D7747C66F0E8FAAB8054/699216.png',
    Shoulders: 'https://render.guildwars2.com/file/BCF8FD08CF3F4A263704370659D69FEE2EDD0C45/699214.png',
    Chest: 'https://render.guildwars2.com/file/64725E0CEBDA22C75C16B70B0CDE58E4E6E7400A/699218.png',
    Gloves: 'https://render.guildwars2.com/file/BD20599D290345BE7D98BD270FBE502CF5212654/699217.png',
    Leggins: 'https://render.guildwars2.com/file/089C3C370428039590EF055CA33AED03E99E7951/699215.png',
    Boots: 'https://render.guildwars2.com/file/DBEE7E93AF2FF0FAEC1CE996F52B949EC872D69C/699219.png'
  }
};

/** Match the selected attribute to its +5 Agony Infusion item icon from the GW2 API. */
export const INFUSION_ICONS: Readonly<Record<string, string>> = {
  Power: 'https://render.guildwars2.com/file/1B18A669E1900107755B12ABAA7DD2071E974C53/511835.png',
  Precision: 'https://render.guildwars2.com/file/57F96C19D8380892B754F776322F30A6EB4EF2B4/511848.png',
  'Condition Damage': 'https://render.guildwars2.com/file/110F6F3CCE9129BEA23E0D44754630BCECC90838/511850.png',
  Expertise: 'https://render.guildwars2.com/file/110F6F3CCE9129BEA23E0D44754630BCECC90838/511850.png',
  Concentration: 'https://render.guildwars2.com/file/79FB4479F4A0E9DB923E48CAB1F777F8F70B974F/511834.png',
  'Healing Power': 'https://render.guildwars2.com/file/79FB4479F4A0E9DB923E48CAB1F777F8F70B974F/511834.png',
  Vitality: 'https://render.guildwars2.com/file/66EC922E1AA5340FB5A63D997D92655775B524AA/511845.png',
  Toughness: 'https://render.guildwars2.com/file/4DF43AFD06A460A19C90B011D3157BA969AD21CE/511844.png'
};

export const GEAR_ICONS: Readonly<Record<string, string>> = {
  // The default skin has no API unlock item; use its matching wiki icon (game file 2595061).
  JadeBot: 'https://wiki.guildwars2.com/images/b/bf/Jade_Bot_%28skin%29.png',
  Ring: 'https://render.guildwars2.com/file/EAA61AAF9BEF031104FD063C0A301A520EF5F5E6/1614682.png',
  Accessory: 'https://render.guildwars2.com/file/741D3F520D1DFD7BB9A35AD50FC75152D2B3CA6B/1614709.png',
  Amulet: 'https://render.guildwars2.com/file/4944FD054FD80D805B0BFFB2DA60363A7DD31FDB/1614376.png',
  Back: 'https://render.guildwars2.com/file/66A65645BE085493A9E30EA659651715CDE91D07/1202361.png',
  Greatsword: 'https://render.guildwars2.com/file/B1A52DB3FCD8A6C744144FD4770BCBE8F95A4CBA/631562.png',
  Hammer: 'https://render.guildwars2.com/file/A3455EC1C59AC001E12C65740DE32DA12645EFA5/631576.png',
  Longbow: 'https://render.guildwars2.com/file/773EB91B749EB947CBB277D3219090CC1BDCCAC4/631592.png',
  Rifle: 'https://render.guildwars2.com/file/9D0F6CE0C16A43FD0E66C55E3E27CCDF260779ED/631616.png',
  Shortbow: 'https://render.guildwars2.com/file/3D7A68807006A225D124A4315DDAFB10AA07CE0F/631634.png',
  Staff: 'https://render.guildwars2.com/file/F86C3CD9FA20D20EE920590517993211C6F9B99C/631650.png',
  Focus: 'https://render.guildwars2.com/file/3F2F9F46E00592FE966F0E976445A87536743513/631554.png',
  Shield: 'https://render.guildwars2.com/file/59060CD4B67508090C0F5F436499F07B71080E1B/631632.png',
  Torch: 'https://render.guildwars2.com/file/081557906F6FDA4160320E3AFD42D4B11FEDDC0B/631666.png',
  Warhorn: 'https://render.guildwars2.com/file/F4407BC09091D6042078B05D4B0757037300A333/631683.png',
  Axe: 'https://render.guildwars2.com/file/AE4909124900E1A3006CEA394670603D5B0C15EE/631536.png',
  Dagger: 'https://render.guildwars2.com/file/2F94A543C87EAEE701BE28B26564C7B3D19C0977/631546.png',
  Mace: 'https://render.guildwars2.com/file/6EA5EEBFDC1278F3F997A248362A6F9698CA09FD/631600.png',
  Pistol: 'https://render.guildwars2.com/file/51217142E12EB2FE19B1DB1CAE4F1D275CC9EA03/631608.png',
  Scepter: 'https://render.guildwars2.com/file/3832066C1A5B45F1C40930C703573C65CB53D73B/631624.png',
  Sword: 'https://render.guildwars2.com/file/3C4AA1BD79DAB49201C81D934AC7567B286E711B/631658.png',
  Speargun: 'https://render.guildwars2.com/file/5C473933354CB8F1542F9F0FF39A5B445877CC06/631642.png',
  Spear: 'https://render.guildwars2.com/file/C427A73B00AB091FE8049AC2FD7EDEB4AF9A093F/631584.png',
  Trident: 'https://render.guildwars2.com/file/434F5946A9020500C2EE2E1F0F38E2CF7F0654BC/631675.png'
};

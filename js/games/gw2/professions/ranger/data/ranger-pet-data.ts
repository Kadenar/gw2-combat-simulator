/** Maintained pet identities and family membership; their skills are authored under core/skills/pets. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerPetDefinition } from '#gw2/professions/ranger/types.js';

// Archetype determines the final Beastmode command for every pet.
const ARCHETYPE_BEAST_SKILLS = Object.freeze({
  Supportive: ID.SPIRITUAL_REPRIEVE,
  Versatile: ID.PRELUDE_LASH,
  Deadly: ID.PRIMAL_CRY,
  Stout: ID.UNFLINCHING_FORTITUDE,
  Ferocious: ID.WORLDLY_IMPACT
});

const PETS = [
  {
    id: 1,
    name: 'Jungle Stalker',
    icon: 'https://render.guildwars2.com/file/EF1CBC60372CC60E420AD479A3504D90207A9A3F/52535.png',
    description:
      'Jungle stalkers rely on their power to take down prey. They enter battle with a mighty roar, inspiring allies as they lay into their victims with claws and teeth. They love tummy rubs. -Acht',
    family: 'feline',
    archetype: 'Supportive',
    skillIds: [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL, ID.MIGHTY_ROAR],
    beastmodeSkillIds: [ID.BITE, ID.MAUL_ID_44514]
  },
  {
    id: 2,
    name: 'Boar',
    icon: 'https://render.guildwars2.com/file/F4A7D5033C6BBB14F4EDE9F0946190047D2AA96F/52537.png',
    description:
      "This boar is a tough, strong fighter with wicked tusks. It's difficult for foes to stay on their feet against his charges. Though polite society may not appreciate his charms, a boar can be a ranger's best friend. -Acht",
    family: 'porcine',
    archetype: 'Versatile',
    skillIds: [ID.PORCINE_JAB, ID.PORCINE_MAUL, ID.PORCINE_BRUTAL_CHARGE, ID.FORAGE_ROCK],
    beastmodeSkillIds: [ID.MAUL_ID_41406, ID.BRUTAL_CHARGE_ID_46432]
  },
  {
    id: 3,
    name: 'Lynx',
    icon: 'https://render.guildwars2.com/file/6C1D64F7D34D073A7E1860B754A33DBCBFCC6CE6/52539.png',
    description:
      'Lynx are tenacious hunters, capable of leaping long distances to chase down fleeing prey. When they feel especially comfortable and safe, they will sometimes roll onto their backs and stick their paws in the air. -Acht',
    family: 'feline',
    archetype: 'Deadly',
    skillIds: [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL, ID.RENDING_POUNCE],
    beastmodeSkillIds: [ID.BITE, ID.MAUL_ID_44514]
  },
  {
    id: 4,
    name: 'Krytan Drakehound',
    icon: 'https://render.guildwars2.com/file/76E6FF0DCD60DFC7287FB14542234EFAAA92194F/52541.png',
    description:
      'This Krytan hound is a loyal, protective pet. It uses its great strength and toughness to fight for its master and can immobilize foes in fear with its howl. -Acht',
    family: 'canine',
    archetype: 'Versatile',
    skillIds: [ID.CANINE_BITE, ID.CANINE_CRIPPLING_LEAP, ID.CANINE_BRUTAL_CHARGE, ID.INTIMIDATING_HOWL],
    beastmodeSkillIds: [ID.CRIPPLING_LEAP, ID.BRUTAL_CHARGE]
  },
  {
    id: 5,
    name: 'Brown Bear',
    icon: 'https://render.guildwars2.com/file/1B51DCA656B8ED7A2C1C48AC03A4BCD6EDA66901/52543.png',
    description:
      'Brown bears are tremendously strong and fiercely protective. They throw themselves into combat selflessly to distract attention from their masters and use their great strength to shrug off blows that would kill any other creature. -Acht',
    family: 'ursine',
    archetype: 'Supportive',
    skillIds: [ID.URSINE_SLASH, ID.SHAKE_IT_OFF],
    beastmodeSkillIds: [ID.BITE_ID_43136, ID.DEFY_PAIN]
  },
  {
    id: 6,
    name: 'Carrion Devourer',
    icon: 'https://render.guildwars2.com/file/C608E0CA50E16897B1BB7FCD492703E7D20308C8/52545.png',
    description:
      'This carrion devourer is a deadly, ruthless predator. It poisons its foes from a distance, hides underground to ambush them, and can bite them to replenish its health. -Acht',
    family: 'devourer',
    archetype: 'Deadly',
    skillIds: [ID.TWIN_DARTS, ID.PET_TAIL_LASH, ID.POISONOUS_CLOUD],
    beastmodeSkillIds: [ID.TAIL_LASH, ID.DEVOURER_RETREAT]
  },
  {
    id: 7,
    name: 'Salamander Drake',
    icon: 'https://render.guildwars2.com/file/5EF6FBFDD6E60258DDFDD5467071E4FB31503BAC/52547.png',
    description:
      'Red salamander drakes are often hunted because of their similarity to the myth of dragons, though they are a different species. They continue to survive because their fire breath makes them deadly to hunters and prey alike. -Acht',
    family: 'drake',
    archetype: 'Deadly',
    skillIds: [ID.DRAKE_BITE, ID.DRAKE_TAIL_SWIPE, ID.FIRE_BREATH],
    beastmodeSkillIds: [ID.CHOMP, ID.TAIL_SWIPE]
  },
  {
    id: 8,
    name: 'Alpine Wolf',
    icon: 'https://render.guildwars2.com/file/9255640360EAAAF61A09284742E44A4626626339/52549.png',
    description:
      'This snowy wolf is at home in the frigid lands of the north. Their howl chills their foes to the bone, leaving them vulnerable to their powerful claws and jaws. -Acht',
    family: 'canine',
    archetype: 'Stout',
    skillIds: [ID.CANINE_BITE, ID.CANINE_CRIPPLING_LEAP, ID.CANINE_BRUTAL_CHARGE, ID.CHILLING_HOWL],
    beastmodeSkillIds: [ID.CRIPPLING_LEAP, ID.BRUTAL_CHARGE]
  },
  {
    id: 9,
    name: 'Snow Leopard',
    icon: 'https://render.guildwars2.com/file/923714681AB4117A300E0946487CCB0F72E10921/52551.png',
    description:
      "Snow leopards have internalized the harsh climate they live in. Their pounce debilitates their victims with chilling cold, making it harder for them to escape. Though they're comfortable in freezing cold, snow leopards love a good sunbeam. -Acht",
    family: 'feline',
    archetype: 'Stout',
    skillIds: [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL, ID.ICY_POUNCE],
    beastmodeSkillIds: [ID.BITE, ID.MAUL_ID_44514]
  },
  {
    id: 10,
    name: 'Raven',
    icon: 'https://render.guildwars2.com/file/0BE49B5A5868FD4DAA02D2BE37DE5FC002A41E7D/52553.png',
    description:
      "The raven is cunning and clever. Its intelligence makes them excellent scouts. In combat, they evade attacks and strike at their foes' eyes to blind them. -Acht",
    family: 'avian',
    archetype: 'Versatile',
    skillIds: [ID.BIRD_SLASH, ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET, ID.BLINDING_SLASH],
    beastmodeSkillIds: [ID.SWOOP_ID_44991, ID.QUICKENING_SCREECH]
  },
  {
    id: 11,
    name: 'Jaguar',
    icon: 'https://render.guildwars2.com/file/B90D0599D6F8B50AE1C24D140EFFC4F93303E62E/52555.png',
    description:
      'The jaguar is a silent predator, capable of sneaking up on an unsuspecting foe and unleashing a deadly ambush. When not rending prey with their claws, jaguars also enjoy playing with colorful fabrics and shiny objects. -Acht',
    family: 'feline',
    archetype: 'Versatile',
    skillIds: [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL, ID.STALK],
    beastmodeSkillIds: [ID.BITE, ID.MAUL_ID_44514]
  },
  {
    id: 12,
    name: 'Marsh Drake',
    icon: 'https://render.guildwars2.com/file/75D8EEA0425007A3D1AC0A01D2CCC17036D65D23/1128510.png',
    description:
      "The standard diet of the swamp drake includes a variety of noxious marsh insects. The drake's digestive system isolates those unsavory poisons and enables them to breathe a venomous cloud to debilitate foes. -Acht",
    family: 'drake',
    archetype: 'Supportive',
    skillIds: [ID.DRAKE_BITE, ID.DRAKE_TAIL_SWIPE, ID.INSECT_SWARM],
    beastmodeSkillIds: [ID.CHOMP, ID.TAIL_SWIPE]
  },
  {
    id: 13,
    name: 'Blue Moa',
    icon: 'https://render.guildwars2.com/file/9220AB4AD4B72194F22A9864B5B59CF8C518096A/52559.png',
    description:
      'Blue moas are protective and paternal to their flock. Their bright red crests make them easy to rally around, and many a flock has survived due to the presence of a blue moa. -Acht',
    family: 'moa',
    archetype: 'Stout',
    skillIds: [ID.MOA_PECK, ID.MOA_FRENZIED_ATTACK, ID.PROTECTING_SCREECH],
    beastmodeSkillIds: [ID.HARMONIC_CRY, ID.FRENZIED_ATTACK]
  },
  {
    id: 15,
    name: 'Pink Moa',
    icon: 'https://render.guildwars2.com/file/D4F01CBFF90D45E04C98B836E836280AB01A0BB1/52563.png',
    description:
      'Pink moas are adorable but have a tendency to be annoying. They frequently poke other moas for attention and have a particularly aggravating screech, which disorients their enemies. -Acht',
    family: 'moa',
    archetype: 'Versatile',
    skillIds: [ID.MOA_PECK, ID.MOA_FRENZIED_ATTACK, ID.DAZING_SCREECH],
    beastmodeSkillIds: [ID.HARMONIC_CRY, ID.FRENZIED_ATTACK]
  },
  {
    id: 16,
    name: 'Black Moa',
    icon: 'https://render.guildwars2.com/file/6B9111F0B1CF94B4A4052FF39FB4E5041702FCDF/52565.png',
    description:
      'The rare black moa is seen as a harbinger of death and plague by some cultures. That belief is misguided, as biologically, their only major difference from other moas is a particular fondness for acorns. -Acht',
    family: 'moa',
    archetype: 'Versatile',
    skillIds: [ID.MOA_PECK, ID.MOA_FRENZIED_ATTACK, ID.DAZING_SCREECH_ID_12709],
    beastmodeSkillIds: [ID.HARMONIC_CRY, ID.FRENZIED_ATTACK]
  },
  {
    id: 17,
    name: 'Red Moa',
    icon: 'https://render.guildwars2.com/file/FCB3E7C150F206DE3CE9D53A247A1EDD01080F6E/52566.png',
    description:
      'Red moas are a fierce and aggressive breed of the bird. Their screech fills their allies with fury, energizing them as they fight. Despite their rough-and-tumble nature, though, red moas are very neat and compulsively groom themselves and other moas. -Acht',
    family: 'moa',
    archetype: 'Ferocious',
    skillIds: [ID.MOA_PECK, ID.MOA_FRENZIED_ATTACK, ID.FURIOUS_SCREECH],
    beastmodeSkillIds: [ID.HARMONIC_CRY, ID.FRENZIED_ATTACK]
  },
  {
    id: 18,
    name: 'Ice Drake',
    icon: 'https://render.guildwars2.com/file/FC57A3DA7DB01370A16DE0CAF09BDF0F5A6464A6/52568.png',
    description:
      'Ice drakes have a unique biology, considering they are a cold-blooded creature that lives in arctic climates. They can breathe ice to attack their prey. -Acht',
    family: 'drake',
    archetype: 'Stout',
    skillIds: [ID.DRAKE_BITE, ID.DRAKE_TAIL_SWIPE, ID.FROST_BREATH],
    beastmodeSkillIds: [ID.CHOMP, ID.TAIL_SWIPE]
  },
  {
    id: 19,
    name: 'River Drake',
    icon: 'https://render.guildwars2.com/file/0E0A036C030F8013556C0715CCC9B11C08B7926D/52570.png',
    description:
      'River drakes hunt by throwing foes into water then unleashing their electrical breath. Fortunately, they are immune to their own breath, but most prey cannot withstand its power. -Acht',
    family: 'drake',
    archetype: 'Ferocious',
    skillIds: [ID.DRAKE_BITE, ID.DRAKE_TAIL_SWIPE, ID.LIGHTNING_BREATH],
    beastmodeSkillIds: [ID.CHOMP, ID.TAIL_SWIPE]
  },
  {
    id: 20,
    name: 'Murellow',
    icon: 'https://render.guildwars2.com/file/4AA07A3721C4050A92A9EA4D905366303E5AF4D4/52572.png',
    description:
      "The elusive murellow's body courses with poisons, giving it a sickly appearance and causing its hair to fall out. Despite its gaunt frame, it is a fierce protector, spitting clouds of poison as it shrugs off attacks. -Acht",
    family: 'ursine',
    archetype: 'Deadly',
    skillIds: [ID.URSINE_SLASH, ID.POISON_CLOUD_MURELLOW],
    beastmodeSkillIds: [ID.BITE_ID_43136, ID.DEFY_PAIN]
  },
  {
    id: 22,
    name: 'Fern Hound',
    icon: 'https://render.guildwars2.com/file/5EBD4E7C03ABEC7EE648B30197559F660651BB00/52576.png',
    description:
      'Sylvari wetlands plant wolves are rare, magical creatures that share many characteristics with their mundane brothers. They fight fiercely for their pack, using their plant affinity to rapidly regenerate wounds.-Acht',
    family: 'canine',
    archetype: 'Supportive',
    skillIds: [ID.CANINE_BITE, ID.CANINE_CRIPPLING_LEAP, ID.CANINE_BRUTAL_CHARGE, ID.REGENERATE_FERN_HOUND],
    beastmodeSkillIds: [ID.CRIPPLING_LEAP, ID.BRUTAL_CHARGE]
  },
  {
    id: 23,
    name: 'Black Bear',
    icon: 'https://render.guildwars2.com/file/750CA07BDEC1D16FE29BD1AE17EE0C22F366E16E/52578.png',
    description:
      'Black bears are territorial and private animals, but they form strong bonds with their friends and selflessly intervene when their friends are threatened. Despite their fearsome appearance, they primarily eat berries, fruit, and fish. -Acht',
    family: 'ursine',
    archetype: 'Stout',
    skillIds: [ID.URSINE_SLASH, ID.ENFEEBLING_ROAR],
    beastmodeSkillIds: [ID.BITE_ID_43136, ID.DEFY_PAIN]
  },
  {
    id: 24,
    name: 'Polar Bear',
    icon: 'https://render.guildwars2.com/file/A4FE067546F4AF76AE15B5A1A45447E4A3FB5AFC/52580.png',
    description:
      'Found in the frozen north, polar bears are adapted to survive in the harshest conditions on Tyria. The most durable of pets, they can shrug off painful blows and weaken foes with their chilling bite. -Acht',
    family: 'ursine',
    archetype: 'Versatile',
    skillIds: [ID.URSINE_SLASH, ID.ICY_ROAR],
    beastmodeSkillIds: [ID.BITE_ID_43136, ID.DEFY_PAIN]
  },
  {
    id: 25,
    name: 'Arctodus',
    icon: 'https://render.guildwars2.com/file/A54EA5421979C33E0F364301262416D4512D0DBF/52582.png',
    description:
      'The arctodus is a mighty snow wolf-bear. Its wolf side gives it a strong pack mentality that makes it very protective of its companions. It can roar with arctic might, chilling opponents to the core and making it harder for them to move or act. -Acht',
    family: 'ursine',
    archetype: 'Ferocious',
    skillIds: [ID.URSINE_SLASH, ID.RENDING_MAUL],
    beastmodeSkillIds: [ID.BITE_ID_43136, ID.DEFY_PAIN]
  },
  {
    id: 26,
    name: 'Whiptail Devourer',
    icon: 'https://render.guildwars2.com/file/F350B25F6746B555B4A76BFC78CC0E94BF546A67/52584.png',
    description:
      'Whiptail devourers are especially deadly ranged attackers, using poison and a volley of tail spikes to take down prey from a distance. -Acht',
    family: 'devourer',
    archetype: 'Versatile',
    skillIds: [ID.TWIN_DARTS, ID.POISON_BARBS],
    beastmodeSkillIds: [ID.TAIL_LASH, ID.DEVOURER_RETREAT]
  },
  {
    id: 27,
    name: 'Lashtail Devourer',
    icon: 'https://render.guildwars2.com/file/E2E73A4428C6C566F1F551563167070D6F917173/52586.png',
    description:
      'Lashtail devourers are fortunately uncommon, as their tactic of ambushing foes and unleashing a flurry of tail strikes that immobilize their prey make them especially deadly. -Acht',
    family: 'devourer',
    archetype: 'Ferocious',
    skillIds: [ID.TWIN_DARTS, ID.RENDING_BARBS],
    beastmodeSkillIds: [ID.TAIL_LASH, ID.DEVOURER_RETREAT]
  },
  {
    id: 28,
    name: 'Hyena',
    icon: 'https://render.guildwars2.com/file/31CCCCA90BAA6B09A80E2978D794DF2ED42B3779/52588.png',
    description:
      "This hyena is a wily, cunning combatant. A hyena's pack is never far away, and they can summon another hyena to fight alongside them. -Acht",
    family: 'canine',
    archetype: 'Ferocious',
    skillIds: [ID.CANINE_BITE, ID.CANINE_CRIPPLING_LEAP, ID.CANINE_BRUTAL_CHARGE, ID.HOWL_OF_THE_PACK],
    beastmodeSkillIds: [ID.CRIPPLING_LEAP, ID.BRUTAL_CHARGE]
  },
  {
    id: 29,
    name: 'Wolf',
    icon: 'https://render.guildwars2.com/file/D7E020A1FEDD31DB47F21E22A2217CA94C282A0C/52590.png',
    description:
      'This wolf is a deadly predator, with powerful jaws and a howl that sends foes fleeing in terror. Pack is everything for a wolf, and they will fight tirelessly for their alpha. -Acht',
    family: 'canine',
    archetype: 'Deadly',
    skillIds: [ID.CANINE_BITE, ID.CANINE_CRIPPLING_LEAP, ID.CANINE_BRUTAL_CHARGE, ID.TERRIFYING_HOWL],
    beastmodeSkillIds: [ID.CRIPPLING_LEAP, ID.BRUTAL_CHARGE]
  },
  {
    id: 30,
    name: 'Owl',
    icon: 'https://render.guildwars2.com/file/5A4CB8FF3E02BE075877C6DE2309394FCE549054/52592.png',
    description:
      'This snowy white owl is a graceful and elegant pet. White owls are fiercely loyal to their friends and family. They unleash chilling cold and claw slashes on their foes while evading attacks in a flurry of wings. -Acht',
    family: 'avian',
    archetype: 'Supportive',
    skillIds: [ID.BIRD_SLASH, ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET, ID.CHILLING_SLASH],
    beastmodeSkillIds: [ID.SWOOP_ID_44991, ID.QUICKENING_SCREECH]
  },
  {
    id: 31,
    name: 'Eagle',
    icon: 'https://render.guildwars2.com/file/43495C762E04BEDDB5BB3EA467D63409F212F2CF/52594.png',
    description:
      'This mighty eagle is the most majestic of birds. They are strong, deadly predators, inflicting bleeding wounds with their claws and beak while evading counterattacks. -Acht',
    family: 'avian',
    archetype: 'Ferocious',
    skillIds: [ID.BIRD_SLASH, ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET, ID.BRASH_SLASH],
    beastmodeSkillIds: [ID.SWOOP_ID_44991, ID.QUICKENING_SCREECH]
  },
  {
    id: 32,
    name: 'White Raven',
    icon: 'https://render.guildwars2.com/file/4C314B00DC20F50F2FCACC14615C91BB4F2262A3/52596.png',
    description:
      'White ravens are exceedingly rare. This exceptionally intelligent and elegant bird is nonetheless a deadly fighter, neutralizing foes by clawing at their eyes and blinding them while evading their counterattacks. -Acht',
    family: 'avian',
    archetype: 'Versatile',
    skillIds: [ID.BIRD_SLASH, ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET, ID.BLINDING_SLASH],
    beastmodeSkillIds: [ID.SWOOP_ID_44991, ID.QUICKENING_SCREECH]
  },
  {
    id: 33,
    name: 'Forest Spider',
    icon: 'https://render.guildwars2.com/file/46021B0706D37EEF1F3DE7090E5B0ACF0F927E7C/52598.png',
    description:
      'While other spiders use debilitating or paralyzing poison, forest-spider poison is simply corrosive and destructive. Fortunately they are immune to the acidic qualities of their own poison, but they do need to eat quickly. -Acht',
    family: 'spider',
    archetype: 'Deadly',
    skillIds: [ID.SPIT, ID.SPIDER_POISON_GAS, ID.SPIDER_ENTANGLING_WEB, ID.DEADLY_VENOM],
    beastmodeSkillIds: [ID.ENTANGLING_WEB, ID.POISON_GAS]
  },
  {
    id: 34,
    name: 'Jungle Spider',
    icon: 'https://render.guildwars2.com/file/227AF44EC32FC170BB76B5AA352DA0460374FB01/52600.png',
    description:
      "It takes a particular frame of mind to have a giant spider as a pet-especially a rare jungle spider. Fortunately, they're capable of feeding themselves, disabling foes with a poison spit that can paralyze foes temporarily. -Acht",
    family: 'spider',
    archetype: 'Versatile',
    skillIds: [ID.SPIT, ID.SPIDER_POISON_GAS, ID.SPIDER_ENTANGLING_WEB, ID.PARALYZING_VENOM],
    beastmodeSkillIds: [ID.ENTANGLING_WEB, ID.POISON_GAS]
  },
  {
    id: 35,
    name: 'Cave Spider',
    icon: 'https://render.guildwars2.com/file/61567AC1D76EF13C4CD0D1D33018B09F7EA494D4/52602.png',
    description:
      "The wily cave spider is a deadly predator that uses debilitating poison to weaken its foes' offenses and defenses as it brings them down. They make surprisingly affectionate pets, though rangers should not eat creatures they bring as gifts. -Acht",
    family: 'spider',
    archetype: 'Ferocious',
    skillIds: [ID.SPIT, ID.SPIDER_POISON_GAS, ID.SPIDER_ENTANGLING_WEB, ID.WEAKENING_VENOM],
    beastmodeSkillIds: [ID.ENTANGLING_WEB, ID.POISON_GAS]
  },
  {
    id: 36,
    name: 'Black Widow Spider',
    icon: 'https://render.guildwars2.com/file/07EA03060306A6D95752C70CA7D8931420069B0D/52604.png',
    description:
      'The black widow is the rarest variety of spider. Like other spiders, they can throw poison and spin webs to immobilize their foes. Black widows can also use a special poison that paralyzes foes in their tracks. -Acht',
    family: 'spider',
    archetype: 'Versatile',
    skillIds: [ID.SPIT, ID.SPIDER_POISON_GAS, ID.SPIDER_ENTANGLING_WEB, ID.PARALYZING_VENOM],
    beastmodeSkillIds: [ID.ENTANGLING_WEB, ID.POISON_GAS]
  },
  {
    id: 37,
    name: 'Warthog',
    icon: 'https://render.guildwars2.com/file/DF96C29EFA4BDEC66C3149F280141490C20458D3/52606.png',
    description:
      'This warthog is an ornery, tough creature that will never back down from a fight. Many foes have underestimated it, only to be undone by its tusks and powerful charge attacks. -Acht',
    family: 'porcine',
    archetype: 'Deadly',
    skillIds: [ID.PORCINE_JAB, ID.PORCINE_MAUL, ID.PORCINE_BRUTAL_CHARGE, ID.FORAGE_SCALE],
    beastmodeSkillIds: [ID.MAUL_ID_41406, ID.BRUTAL_CHARGE_ID_46432]
  },
  {
    id: 38,
    name: 'Siamoth',
    icon: 'https://render.guildwars2.com/file/0471617BD371046C089D7CDDB9104E57C33DA391/52608.png',
    description:
      'Though it may look bizarre, this tapir is a good-natured creature and an amiable companion. Its unassuming appearance hides a ferocious side, though, and siamoths are known for sending their opponents flying with a well-placed charge. -Acht',
    family: 'porcine',
    archetype: 'Stout',
    skillIds: [ID.PORCINE_JAB, ID.PORCINE_MAUL, ID.PORCINE_BRUTAL_CHARGE, ID.FORAGE_FEATHERS],
    beastmodeSkillIds: [ID.MAUL_ID_41406, ID.BRUTAL_CHARGE_ID_46432]
  },
  {
    id: 39,
    name: 'Pig',
    icon: 'https://render.guildwars2.com/file/CE671613E510096E1E0FA1ABCA6AD668900F03E1/52610.png',
    description:
      'This pig is one of the rarest, most exotic pets in all of Tyria. As you walk the land with this pig by your side, people will stare in wonder at the mysterious creature they have never seen before. Truly, this is a time of wonders. -Acht',
    family: 'porcine',
    archetype: 'Ferocious',
    skillIds: [ID.PORCINE_JAB, ID.PORCINE_MAUL, ID.PORCINE_BRUTAL_CHARGE, ID.FORAGE_SWORD],
    beastmodeSkillIds: [ID.MAUL_ID_41406, ID.BRUTAL_CHARGE_ID_46432]
  },
  {
    id: 44,
    name: 'Hawk',
    icon: 'https://render.guildwars2.com/file/70F79F793C0625969046DF0C00B548C50E17115B/543019.png',
    description:
      'This hawk is a crafty ally. He is a fierce and deadly predator that inflicts bleeding wounds with its claws and beak, while evading counterattacks.-Acht',
    family: 'avian',
    archetype: 'Deadly',
    skillIds: [ID.BIRD_SLASH, ID.BIRD_SWOOP, ID.QUICKENING_SCREECH_PET, ID.LACERATING_SLASH],
    beastmodeSkillIds: [ID.SWOOP_ID_44991, ID.QUICKENING_SCREECH]
  },
  {
    id: 45,
    name: 'Reef Drake',
    icon: 'https://render.guildwars2.com/file/A90B47ECE2A57D71DB23384E23F5EFF7130176B4/511359.png',
    description:
      "Reef drakes emit a high-pitched screech to disorient their foes. Don't let them confuse you; these drakes are dangerous.\n-Acht",
    family: 'drake',
    archetype: 'Versatile',
    skillIds: [ID.DRAKE_BITE, ID.DRAKE_TAIL_SWIPE, ID.SONIC_SHRIEK],
    beastmodeSkillIds: [ID.CHOMP, ID.TAIL_SWIPE]
  },
  {
    id: 46,
    name: 'Smokescale',
    icon: 'https://render.guildwars2.com/file/9B1BB03EA406016DE343EBF4C733C05ADA7FD70D/1128512.png',
    description:
      'Smokescales have an ability to conceal themselves in smoke. These stealthy saurians emerge from their smoke cloud to ambush prey without warning.-Acht',
    family: 'smokescale',
    archetype: 'Ferocious',
    skillIds: [ID.SMOKESCALE_BITE, ID.SMOKESCALE_TAKEDOWN, ID.SMOKESCALE_SMOKE_ASSAULT, ID.SMOKE_CLOUD],
    beastmodeSkillIds: [ID.TAKEDOWN, ID.SMOKE_ASSAULT]
  },
  {
    id: 47,
    name: 'Tiger',
    icon: 'https://render.guildwars2.com/file/A41953A8682309700FA17601FE05DB040C6CD07B/1128514.png',
    description:
      'Tigers are among the largest feline predators, with striped markings that help conceal them in heavy vegetation. Fierce hunters with tooth and claw, they spend most of their lives in solitude.-Acht',
    family: 'feline',
    archetype: 'Ferocious',
    skillIds: [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL, ID.FURIOUS_POUNCE],
    beastmodeSkillIds: [ID.BITE, ID.MAUL_ID_44514]
  },
  {
    id: 48,
    name: 'Electric Wyvern',
    icon: 'https://render.guildwars2.com/file/E93F21BDA224010D2A7CF90B9297E3083C436BF7/1128506.png',
    description:
      'Electric wyverns are a unique variant of their winged species that generate and channel electricity. They isolate and shock their prey with powerful electrical pulses.-Acht',
    family: 'wyvern',
    archetype: 'Versatile',
    skillIds: [ID.WYVERN_WING_SWIPE, ID.WYVERN_TAIL_LASH, ID.WYVERN_WING_BUFFET, ID.LIGHTNING_ASSAULT],
    beastmodeSkillIds: [ID.TAIL_LASH_ID_46386, ID.WING_BUFFET]
  },
  {
    id: 51,
    name: 'Fire Wyvern',
    icon: 'https://render.guildwars2.com/file/AE90459E46D1F3E01C94A09A117FFA06ED2B54EB/1128508.png',
    description:
      'Fire wyverns are winged relatives of the terrestrial drake. These voracious predators contain and then roast their prey with swaths of fiery breath.-Acht',
    family: 'wyvern',
    archetype: 'Deadly',
    skillIds: [ID.WYVERN_WING_SWIPE, ID.WYVERN_TAIL_LASH, ID.WYVERN_WING_BUFFET, ID.CONSUMING_FLAME],
    beastmodeSkillIds: [ID.TAIL_LASH_ID_46386, ID.WING_BUFFET]
  },
  {
    id: 52,
    name: 'Bristleback',
    icon: 'https://render.guildwars2.com/file/371C4E26DD3744CDEEEE5D45142519561E286FFE/1128504.png',
    description:
      'Bristlebacks are spiny saurians with thick hides and sharp claws. When provoked, they can eject their sharp dorsal spines at high velocity.-Acht',
    family: 'bristleback',
    archetype: 'Deadly',
    skillIds: [
      ID.BRISTLEBACK_SPIKE_SHOOT,
      ID.BRISTLEBACK_SHARPEN_SPINES,
      ID.BRISTLEBACK_RAIN_OF_SPIKES,
      ID.SPIKE_BARRAGE
    ],
    beastmodeSkillIds: [ID.RAIN_OF_SPIKES, ID.SHARPEN_SPINES]
  },
  {
    id: 54,
    name: 'Cheetah',
    icon: 'https://render.guildwars2.com/file/1911090762244A310BD539B2C54A23F702F66D0A/1769877.png',
    description:
      "It's a blur, sir! The desert cheetah is rumored to travel faster than the eye can see, pouncing upon its victim with fang and claw. -Acht",
    family: 'feline',
    archetype: 'Versatile',
    skillIds: [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL, ID.SAVANNAH_STRIKE],
    beastmodeSkillIds: [ID.BITE, ID.MAUL_ID_44514]
  },
  {
    id: 55,
    name: 'Sand Lion',
    icon: 'https://render.guildwars2.com/file/0D23EE67F7C4F4E300637D43B9A46F500FD4799C/1769879.png',
    description:
      'Sand lions lay claim to massive dunes and viciously defend their territory from dozens of desert encroachers. -Acht',
    family: 'feline',
    archetype: 'Ferocious',
    skillIds: [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_MAUL, ID.BLINDING_ROAR],
    beastmodeSkillIds: [ID.BITE, ID.MAUL_ID_44514]
  },
  {
    id: 57,
    name: 'Jacaranda',
    icon: 'https://render.guildwars2.com/file/DFA4A1F6006A0769DAAD0C7909FB607A3A21693D/1769881.png',
    description:
      'Capable of calling lightning from the skies while blending into terrain. They are not standing still; they are lying in wait. -Acht',
    family: 'jacaranda',
    archetype: 'Supportive',
    skillIds: [
      ID.JACARANDA_ROOT_SLAP,
      ID.JACARANDA_CALL_LIGHTNING,
      ID.JACARANDA_PHOTOSYNTHESIZE,
      ID.JACARANDAS_EMBRACE
    ],
    beastmodeSkillIds: [ID.CALL_LIGHTNING_ID_43788, ID.PHOTOSYNTHESIZE]
  },
  {
    id: 59,
    name: 'Rock Gazelle',
    icon: 'https://render.guildwars2.com/file/F3EED35B2DD6B52FFCBFD7FCCA184EB7EBCF01A4/1769875.png',
    description:
      'The elegant rock gazelle grazes on rocky outcroppings over its lifetime to enhance its impressive antlers. -Acht',
    family: 'rock gazelle',
    archetype: 'Ferocious',
    skillIds: [ID.ROCK_GAZELLE_HEADBUTT, ID.ROCK_GAZELLE_KICK, ID.ROCK_GAZELLE_CHARGE, ID.HEAD_TOSS],
    beastmodeSkillIds: [ID.KICK, ID.CHARGE]
  },
  {
    id: 61,
    name: 'Fanged Iboga',
    icon: 'https://render.guildwars2.com/file/BE037F03F337204F7D9C99F1B94D7FA708AE00A7/1769883.png',
    description:
      'The fanged iboga is one of the most aggressive members of its family, actively seeking out prey and mercilessly dousing it in acid. -Acht',
    family: 'fanged iboga',
    archetype: 'Deadly',
    skillIds: [ID.CONSUMING_BITE, ID.CRIPPLING_ANGUISH_PET, ID.NARCOTIC_SPORES_PET, ID.FANG_GRAPPLE],
    beastmodeSkillIds: [ID.CRIPPLING_ANGUISH, ID.NARCOTIC_SPORES]
  },
  {
    id: 63,
    name: 'White Tiger',
    icon: 'https://render.guildwars2.com/file/5F10BEA9C0919C6AD32FEB5F51143835060E4209/2604596.png',
    description:
      'A Canthan variant of its orange-furred cousin, the white tiger is well known in the region as a fierce protector of its master. It is a symbol of wealth and power for a household to own one as a pet. -Acht',
    family: 'feline',
    archetype: 'Stout',
    skillIds: [ID.FELINE_SLASH, ID.FELINE_BITE, ID.FELINE_PHASE_POUNCE, ID.GUARDIANS_ROAR],
    beastmodeSkillIds: [ID.BITE, ID.MAUL_ID_44514]
  },
  {
    id: 64,
    name: 'Wallow',
    icon: 'https://render.guildwars2.com/file/58AFDFDFDDB8325F5E076C2400C63D450C15EA09/2604592.png',
    description:
      'Despite their ferocious appearance, wallows are actually quite docile and make for lovely companions. Canthan farmers use them to dig up truffles, as well as to protect themselves from hostile wildlife. -Acht',
    family: 'porcine',
    archetype: 'Supportive',
    skillIds: [ID.VAMPIRIC_BITE, ID.WALLOW_MAUL, ID.UNDEAD_PLAGUE_PET, ID.BLOODTHIRSTY_CHARGE],
    beastmodeSkillIds: [ID.MAUL_ID_41406, ID.UNDEAD_PLAGUE]
  },
  {
    id: 65,
    name: 'Phoenix',
    icon: 'https://render.guildwars2.com/file/E4090046CDB5069D7DF91DE605FBF3F2071CE946/2604594.png',
    description:
      'Boasting colorful plumage that rivals that of the rainbow moa, the phoenix is a regal avian considered by many to be the ruler of all birds. The largest phoenixes are owned by Canthan royalty. -Acht',
    family: 'phoenix',
    archetype: 'Ferocious',
    skillIds: [ID.PHOENIX_WICKED_BITE, ID.PHOENIX_DASH, ID.PHOENIX_WING_BUFFET, ID.GALE_BREATH],
    beastmodeSkillIds: [ID.DASH, ID.WING_BUFFET]
  },
  {
    id: 66,
    name: 'Siege Turtle',
    icon: 'https://render.guildwars2.com/file/090DAF0BC96523FF613BB30FF36F4A23EBFB49CD/2604598.png',
    description:
      'Giant turtles used by the Luxon Armada as mobile siege weapons. They are trained from a young age to carry heavy artillery on their backs to prepare them for battle. -Acht',
    family: 'turtle',
    archetype: 'Supportive',
    skillIds: [ID.TURTLE_JADE_CANNON, ID.TURTLE_HEAVY_SHOT, ID.TURTLE_SLAM, ID.HUNKER_DOWN],
    beastmodeSkillIds: [ID.SLAM, ID.HEAVY_SHOT]
  },
  {
    id: 67,
    name: 'Aether Hunter',
    icon: 'https://render.guildwars2.com/file/51F3981E290D556DC861953CF3A37FC2B306000D/3124863.png',
    description:
      'Imbued with ley-line energy, aether hunters can travel through the toughest of terrains with ease, unlike their sand-dwelling counterparts. -Acht',
    family: 'aether hunter',
    archetype: 'Versatile',
    skillIds: [ID.AETHER_HUNTER_BITE, ID.AETHER_HUNTER_LUNGE, ID.AETHER_HUNTER_LEY_LINE_VORTEX, ID.DIMENSION_BREACH],
    beastmodeSkillIds: [ID.LUNGE, ID.LEY_LINE_VORTEX]
  },
  {
    id: 68,
    name: 'Sky-Chak Striker',
    icon: 'https://render.guildwars2.com/file/16B2200803B76ABEDEA8DB1A40E04D14FE7D99DC/3256314.png',
    description:
      "Able to harness and control bursts of electricity, the sky-chak striker's ability to glide by attuning to ley-line energy allowed them to adapt to the floating islands of Skywatch Archipelago. -Acht",
    family: 'chak',
    archetype: 'Ferocious',
    skillIds: [ID.CHAK_UNLEASH_ENERGY, ID.CHAK_ELECTROCUTE, ID.CHAK_SPIT_GOOP, ID.LEY_ENERGY_PULSE],
    beastmodeSkillIds: [ID.ELECTROCUTE, ID.SPIT_GOOP]
  },
  {
    id: 69,
    name: 'Spinegazer',
    icon: 'https://render.guildwars2.com/file/FB779ACEF8182B465916A693EEC471AEE6BB7C15/3307063.png',
    description:
      "If you've explored the Realm of Dreams, you've likely experienced the terror of the spinegazer's stare; not only can it launch a barrage of ranged physical attacks, it also wages psychological warfare by planting tormenting visions in the minds of its enemies.-Acht",
    family: 'spinegazer',
    archetype: 'Deadly',
    skillIds: [ID.SPINEGAZER_EVIL_EYE, ID.SPINEGAZER_TORMENTING_VISIONS, ID.SPINEGAZER_STARING_VOID, ID.PANOPTICON],
    beastmodeSkillIds: [ID.STARING_VOID, ID.TORMENTING_VISIONS]
  },
  {
    id: 70,
    name: 'Warclaw',
    icon: 'https://render.guildwars2.com/file/7C5A4035C51E9EB3CEBA7028240CEA9E5F5FC038/3378993.png',
    description:
      'The warclaw has always been a very peculiar creature of study, previously thought to be Mists-locked and of an ethereal nature rather than biological. The warclaw of Janthir seem to be the origin of the creatures we know, possessing an untapped well of magic that manifests as immense speed and athletic ability. Occasionally, the feline will need to expel pent-up energies by running in a circle for minutes on end. -Acht',
    family: 'warclaw',
    archetype: 'Ferocious',
    skillIds: [ID.WARCLAW_SLASH, ID.WARCLAW_BATTLE_MAUL, ID.WARCLAW_BOP, ID.RALLYING_ROAR],
    beastmodeSkillIds: [ID.BATTLE_MAUL, ID.BOP]
  },
  {
    id: 71,
    name: 'Janthiri Bee',
    icon: 'https://render.guildwars2.com/file/03BF0B1C079C06B359E0CE520E747AC5E878F395/3594054.png',
    description:
      "The honeybees of Janthir are an incredibly pragmatic subspecies. When bonded to an individual, or the hive's queen as they most often are, the bees are incredibly chivalrous toward their proprietor. However, I'd be remiss if I didn't mention their stingers. Likely adapted to protect themselves from the treacherous nature of the region, the Janthiri bee's ovipositor is markedly durable and even more hazardous. The lowland kodan often coat their weapons in bee venom before a challenging hunt. -Acht",
    family: 'janthiri bee',
    archetype: 'Deadly',
    skillIds: [ID.JANTHIRI_BEE_NIBBLE, ID.JANTHIRI_BEE_BUMBLE, ID.JANTHIRI_BEE_STINGING_SORROW, ID.HONEY_TOSS],
    beastmodeSkillIds: [ID.BUMBLE, ID.STINGING_SORROW]
  },
  {
    id: 72,
    name: 'Raptor Swiftwing',
    icon: 'https://render.guildwars2.com/file/7DFEA0B69A935295F938F1BC043A3BAAAF506A1B/3713047.png',
    description:
      "Only recently discovered on the island of Castora, the swiftwing raptor is covered in a thick layer of jewel-toned feathers that blend in with the island's vivid vegetation. Researchers have noted its ear-shattering shriek and razor-edged talons, urging members of the Tyrian Alliance to approach the saurian with caution. -Acht",
    family: 'raptor swiftwing',
    archetype: 'Versatile',
    skillIds: [
      ID.RAPTOR_SWIFTWING_CLAW,
      ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT,
      ID.RAPTOR_SWIFTWING_LEAPING_LIZARD,
      ID.PIERCING_SHRIEK
    ],
    beastmodeSkillIds: [ID.SAURIAN_MIGHT, ID.LEAPING_LIZARD]
  },
  {
    id: 73,
    name: 'River Otter',
    icon: 'https://render.guildwars2.com/file/4821BEE8B3346E020F982650A22548801C082352/3772540.png',
    description:
      "While the river otters found in the Castoran inland appear paradisiacal, don't let their charm disarm you! I suspect that they've adapted to the richly magical ecosystem and have become adept at maneuvering the numerous predators found across the island. They tend to linger near the riverside in broods, giving them quick access to the complex channel system. One swipe from their tail and you may find yourself debilitated and vulnerable. -Acht",
    family: 'river otter',
    archetype: 'Supportive',
    skillIds: [ID.INNOCENT_DISPLAY],
    beastmodeSkillIds: [ID.JET, ID.TAIL_WHIP]
  }
] satisfies readonly (Omit<RangerPetDefinition, 'beastmodeSkillIds' | 'archetype'> & {
  readonly archetype: keyof typeof ARCHETYPE_BEAST_SKILLS;
  readonly beastmodeSkillIds: readonly [number, number];
})[];

export const RANGER_PETS: readonly RangerPetDefinition[] = Object.freeze(
  PETS.map((pet) => ({ ...pet, beastmodeSkillIds: [...pet.beastmodeSkillIds, ARCHETYPE_BEAST_SKILLS[pet.archetype]] }))
);

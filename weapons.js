// ── Weapon Definitions ────────────────────────────────────────
const WEAPONS = [
  {
    id: "longbow",
    name: "Longbow",
    icon: "🏹",
    desc: "The standard weapon of the Ember Order. Balanced fire rate, solid damage, and manageable heat. The reliable choice for any knight.",
    bulletSpeed: 10,
    fireRate: 10,         // frames between shots
    damage: 1,
    heatPerShot: 4,
    heatCool: 2,
    overheatLock: 120,
    bulletColor: "#FFD700",
    bulletSize: 5,
    skillType: "burst",   // E skill
    ultType:   "beam",    // Q skill
    stats: { "Fire Rate": "★★★☆☆", "Damage": "★★☆☆☆", "Heat": "★★★☆☆", "Range": "★★★★☆" }
  },
  {
    id: "crossbow",
    name: "Crossbow",
    icon: "⚔️",
    desc: "A heavy siege crossbow. Fires slowly but each bolt hits like a battering ram. No overheat — it simply can't fire faster than you can reload.",
    bulletSpeed: 13,
    fireRate: 22,
    damage: 3,
    heatPerShot: 0,
    heatCool: 0,
    overheatLock: 0,
    bulletColor: "#FF8800",
    bulletSize: 7,
    skillType: "pierce",  // piercing shot
    ultType:   "volley",  // triple volley
    stats: { "Fire Rate": "★☆☆☆☆", "Damage": "★★★★★", "Heat": "N/A", "Range": "★★★★★" }
  },
  {
    id: "spellstaff",
    name: "Spellstaff",
    icon: "🔮",
    desc: "Channelled from the last embers of arcane light. Fires homing orbs that curve slightly toward enemies. Beam skill covers the entire screen.",
    bulletSpeed: 8,
    fireRate: 8,
    damage: 1,
    heatPerShot: 3,
    heatCool: 3,
    overheatLock: 90,
    bulletColor: "#CC44FF",
    bulletSize: 6,
    homing: true,
    skillType: "nova",    // screen-wide nova
    ultType:   "beam",
    stats: { "Fire Rate": "★★★★☆", "Damage": "★★☆☆☆", "Heat": "★★★★☆", "Range": "★★☆☆☆" }
  },
  {
    id: "daggers",
    name: "Twin Daggers",
    icon: "🗡️",
    desc: "Two enchanted throwing daggers hurled in a tight spread. Blazing fast, but the blades are short-ranged and build heat rapidly.",
    bulletSpeed: 9,
    fireRate: 4,
    damage: 1,
    heatPerShot: 7,
    heatCool: 1,
    overheatLock: 150,
    bulletColor: "#AAFFDD",
    bulletSize: 4,
    spread: true,         // fires 2 bullets with slight angle spread
    skillType: "burst",
    ultType:   "storm",   // dagger storm around player
    stats: { "Fire Rate": "★★★★★", "Damage": "★★☆☆☆", "Heat": "★★☆☆☆", "Range": "★★☆☆☆" }
  }
];

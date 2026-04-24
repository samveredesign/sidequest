/** Deterministic rank titles by leaderboard placement (0 = 1st). */

const LEGENDARY = [
  "Hero",
  "Arch Mage",
  "Destroyer of worlds",
  "Supreme Overlord",
  "Dragon Slayer",
  "Grand Sorcerer",
  "Champion of Chaos",
  "The Undisputed One",
  "Conqueror of Quests",
  "Mythic Champion",
  "High Queen",
] as const;

const ELITE = [
  "Paladin",
  "Royal Guard",
  "High Priest",
  "Nobleman",
  "Master Baiter",
  "Lord Protector",
  "Silver Champion",
  "High Inquisitor",
] as const;

const ADVENTURER = [
  "Knight",
  "Vassal",
  "Lord",
  "Hedge Wizard",
  "Wandering Ranger",
  "Apprentice Mage",
  "Tavern Hero",
  "Little Dwarf Guy",
  "Witch hunter",
] as const;

const NOVICE = [
  "Novice",
  "Bard",
  "Squire",
  "Gnome",
  "Lost Adventurer",
  "Smelly old man",
  "Goblin",
  "Magic Toad",
  "Lazy Watchman",
  "Witch",
] as const;

const HUMILIATING = [
  "Peasant",
  "Serf",
  "Slug",
  "Worm",
  "Knave",
  "Court Jester",
  "Village Idiot",
  "Tavern Lurker",
  "Goblin Snack",
  "Stable Rat",
  "Professional Bystander",
  "NPC",
  "Fool",
  "Bag of Potatoes",
  "Suspicious Mushroom",
  "Slightly Damp Sock",
  "Hag",
  "Egg",
] as const;

function poolForPlacement(placementIndex: number): readonly string[] {
  if (placementIndex <= 0) return LEGENDARY;
  if (placementIndex === 1) return ELITE;
  if (placementIndex === 2) return ADVENTURER;
  if (placementIndex === 3) return NOVICE;
  return HUMILIATING;
}

function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(31, h) + input.charCodeAt(i);
  }
  return Math.abs(h);
}

export function rankTitleForPlayer(
  gameId: string,
  playerId: string,
  placementIndex: number,
): string {
  const pool = poolForPlacement(placementIndex);
  const idx = stableHash(`${gameId}:${playerId}:${placementIndex}`) % pool.length;
  return pool[idx] ?? pool[0]!;
}

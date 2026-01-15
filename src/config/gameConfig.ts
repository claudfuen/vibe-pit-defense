// === TOWER CONFIGURATIONS ===
export type TowerType = 'cannon' | 'laser' | 'frost' | 'missile' | 'tesla';

export interface TowerLevel {
  damage: number;
  range: number;
  fireRate: number;
  cost: number;
  special?: number; // splash radius, slow %, chain count, etc.
}

export interface TowerConfig {
  type: TowerType;
  name: string;
  description: string;
  baseColor: number;
  accentColor: number;
  projectileColor: number;
  levels: TowerLevel[];
  damageType: 'single' | 'splash' | 'chain' | 'slow' | 'dot';
  sound?: string;
}

export const TOWERS: Record<TowerType, TowerConfig> = {
  cannon: {
    type: 'cannon',
    name: 'Cannon',
    description: 'Balanced damage dealer with splash',
    baseColor: 0x5d6d7e,
    accentColor: 0x85929e,
    projectileColor: 0xf39c12,
    damageType: 'splash',
    levels: [
      { damage: 30, range: 100, fireRate: 1.2, cost: 100, special: 30 },
      { damage: 50, range: 120, fireRate: 1.5, cost: 150, special: 40 },
      { damage: 80, range: 140, fireRate: 1.8, cost: 250, special: 50 },
    ],
  },
  laser: {
    type: 'laser',
    name: 'Laser',
    description: 'High single-target DPS',
    baseColor: 0xe74c3c,
    accentColor: 0xf1948a,
    projectileColor: 0xff6b6b,
    damageType: 'single',
    levels: [
      { damage: 15, range: 130, fireRate: 4, cost: 120 },
      { damage: 25, range: 150, fireRate: 5, cost: 180 },
      { damage: 40, range: 170, fireRate: 6, cost: 300 },
    ],
  },
  frost: {
    type: 'frost',
    name: 'Frost',
    description: 'Slows enemies in range',
    baseColor: 0x3498db,
    accentColor: 0x85c1e9,
    projectileColor: 0xaed6f1,
    damageType: 'slow',
    levels: [
      { damage: 10, range: 90, fireRate: 2, cost: 80, special: 30 },
      { damage: 18, range: 110, fireRate: 2.5, cost: 130, special: 45 },
      { damage: 28, range: 130, fireRate: 3, cost: 220, special: 60 },
    ],
  },
  missile: {
    type: 'missile',
    name: 'Missile',
    description: 'Long range, high damage',
    baseColor: 0x2ecc71,
    accentColor: 0x82e0aa,
    projectileColor: 0xf1c40f,
    damageType: 'single',
    levels: [
      { damage: 100, range: 200, fireRate: 0.5, cost: 200 },
      { damage: 180, range: 240, fireRate: 0.6, cost: 300 },
      { damage: 300, range: 280, fireRate: 0.7, cost: 500 },
    ],
  },
  tesla: {
    type: 'tesla',
    name: 'Tesla',
    description: 'Chain lightning between enemies',
    baseColor: 0x9b59b6,
    accentColor: 0xd7bde2,
    projectileColor: 0xe8daef,
    damageType: 'chain',
    levels: [
      { damage: 20, range: 100, fireRate: 1.5, cost: 180, special: 3 },
      { damage: 35, range: 120, fireRate: 1.8, cost: 280, special: 4 },
      { damage: 55, range: 140, fireRate: 2.2, cost: 450, special: 5 },
    ],
  },
};

// === ENEMY CONFIGURATIONS ===
// Brainrot-themed enemies - original characters, no copyright
export type EnemyType = 'gooner' | 'edgelord' | 'chonker' | 'copium' | 'final_boss';

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  title: string; // Serious title
  baseHealth: number;
  baseSpeed: number;
  baseReward: number;
  color: number;
  accentColor: number;
  size: number;
  healthScaling: number;
  special?: string;
  emoji: string;
}

export const ENEMIES: Record<EnemyType, EnemyConfig> = {
  gooner: {
    type: 'gooner',
    name: 'Gooner',
    title: 'Shambling Husk',
    baseHealth: 100,
    baseSpeed: 50,
    baseReward: 10,
    color: 0xc0392b,
    accentColor: 0xe74c3c,
    size: 12,
    healthScaling: 1.15,
    emoji: '💀',
  },
  edgelord: {
    type: 'edgelord',
    name: 'Edgelord',
    title: 'Shadow Sprinter',
    baseHealth: 50,
    baseSpeed: 110,
    baseReward: 8,
    color: 0x1a1a1a,
    accentColor: 0x444444,
    size: 9,
    healthScaling: 1.12,
    special: 'fast',
    emoji: '🖤',
  },
  chonker: {
    type: 'chonker',
    name: 'Chonker',
    title: 'Absolute Unit',
    baseHealth: 500,
    baseSpeed: 22,
    baseReward: 30,
    color: 0xf39c12,
    accentColor: 0xf5b041,
    size: 22,
    healthScaling: 1.2,
    special: 'armored',
    emoji: '🍔',
  },
  copium: {
    type: 'copium',
    name: 'Copium Dealer',
    title: 'Reality Denier',
    baseHealth: 80,
    baseSpeed: 40,
    baseReward: 25,
    color: 0x27ae60,
    accentColor: 0x58d68d,
    size: 11,
    healthScaling: 1.1,
    special: 'heals nearby',
    emoji: '🌿',
  },
  final_boss: {
    type: 'final_boss',
    name: 'Sigma Overlord',
    title: 'The Grindset Incarnate',
    baseHealth: 3000,
    baseSpeed: 18,
    baseReward: 300,
    color: 0x9b59b6,
    accentColor: 0xd7bde2,
    size: 32,
    healthScaling: 1.5,
    special: 'immune to slow',
    emoji: '👑',
  },
};

// === WAVE CONFIGURATIONS ===
export interface WaveEnemy {
  type: EnemyType;
  count: number;
  delay: number; // ms between spawns
}

export interface WaveConfig {
  enemies: WaveEnemy[];
  bonus: number;
}

export function generateWave(waveNum: number): WaveConfig {
  const enemies: WaveEnemy[] = [];

  // Gooners - the base enemy, always present
  enemies.push({
    type: 'gooner',
    count: 5 + Math.floor(waveNum * 1.5),
    delay: Math.max(400, 800 - waveNum * 20),
  });

  // Edgelords starting wave 3 - fast bois
  if (waveNum >= 3) {
    enemies.push({
      type: 'edgelord',
      count: 2 + Math.floor(waveNum * 0.8),
      delay: 300,
    });
  }

  // Chonkers starting wave 5 - absolute units
  if (waveNum >= 5) {
    enemies.push({
      type: 'chonker',
      count: 1 + Math.floor((waveNum - 4) * 0.5),
      delay: 1500,
    });
  }

  // Copium Dealers starting wave 8 - they heal others
  if (waveNum >= 8) {
    enemies.push({
      type: 'copium',
      count: 1 + Math.floor((waveNum - 7) * 0.3),
      delay: 2000,
    });
  }

  // Sigma Overlord every 10 waves - the grindset never stops
  if (waveNum % 10 === 0) {
    enemies.push({
      type: 'final_boss',
      count: Math.floor(waveNum / 10),
      delay: 3000,
    });
  }

  return {
    enemies,
    bonus: 50 + waveNum * 15,
  };
}

// === GAME SETTINGS ===
export const GAME_CONFIG = {
  TILE_SIZE: 48,
  MAP_COLS: 20,
  MAP_ROWS: 12,
  STARTING_MONEY: 400,
  STARTING_LIVES: 20,
  SELL_REFUND: 0.7,
  COMBO_WINDOW: 1500, // ms
  COMBO_BONUS: 0.1, // 10% per combo level
};

// === PATH ===
export const PATH = [
  { x: -1, y: 6 },
  { x: 3, y: 6 },
  { x: 3, y: 2 },
  { x: 7, y: 2 },
  { x: 7, y: 9 },
  { x: 11, y: 9 },
  { x: 11, y: 4 },
  { x: 15, y: 4 },
  { x: 15, y: 8 },
  { x: 20, y: 8 },
];

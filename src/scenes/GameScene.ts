import Phaser from 'phaser';
import { TOWERS, ENEMIES, GAME_CONFIG, PATH, generateWave, TowerType, EnemyType } from '../config/gameConfig';

interface Tower {
  id: number;
  x: number;
  y: number;
  type: TowerType;
  level: number;
  lastFired: number;
  graphics: Phaser.GameObjects.Container;
  kills: number;
}

interface Enemy {
  id: number;
  x: number;
  y: number;
  type: EnemyType;
  health: number;
  maxHealth: number;
  speed: number;
  pathIndex: number;
  pathProgress: number;
  graphics: Phaser.GameObjects.Container;
  reward: number;
  slowedUntil: number;
  config: typeof ENEMIES[EnemyType];
}

interface Projectile {
  x: number;
  y: number;
  targetId: number;
  damage: number;
  speed: number;
  type: TowerType;
  level: number;
  graphics: Phaser.GameObjects.Graphics;
}

interface FloatingText {
  text: Phaser.GameObjects.Text;
  life: number;
  vy: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

const { TILE_SIZE, MAP_COLS, MAP_ROWS, STARTING_MONEY, STARTING_LIVES, SELL_REFUND } = GAME_CONFIG;

export class GameScene extends Phaser.Scene {
  private towers: Tower[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private floatingTexts: FloatingText[] = [];
  private particles: Particle[] = [];

  private selectedTower: TowerType = 'cannon';
  private money = STARTING_MONEY;
  private lives = STARTING_LIVES;
  private wave = 0;
  private waveInProgress = false;
  private gameSpeed = 1;
  private nextId = 0;
  private combo = 0;
  private lastKillTime = 0;
  private totalKills = 0;

  // Spawn management
  private spawnQueue: { type: EnemyType; delay: number }[] = [];
  private spawnTimer = 0;

  // Graphics
  private groundLayer!: Phaser.GameObjects.Graphics;
  private pathLayer!: Phaser.GameObjects.Graphics;
  private effectsLayer!: Phaser.GameObjects.Graphics;
  private uiLayer!: Phaser.GameObjects.Container;
  private hoverGraphics!: Phaser.GameObjects.Graphics;
  private particleGraphics!: Phaser.GameObjects.Graphics;

  // UI elements
  private moneyText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private towerButtons: Phaser.GameObjects.Container[] = [];
  private waveButton!: Phaser.GameObjects.Container;
  private selectedTowerInfo!: Phaser.GameObjects.Container;
  private wavePreview!: Phaser.GameObjects.Container;

  // Grid
  private blocked: boolean[][] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Reset all game state for fresh start / restart
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.floatingTexts = [];
    this.particles = [];
    this.selectedTower = 'cannon';
    this.money = STARTING_MONEY;
    this.lives = STARTING_LIVES;
    this.wave = 0;
    this.waveInProgress = false;
    this.gameSpeed = 1;
    this.nextId = 0;
    this.combo = 0;
    this.lastKillTime = 0;
    this.totalKills = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.blocked = [];
    this.towerButtons = [];

    this.initBlockedGrid();
    this.createLayers();
    this.drawGround();
    this.drawPath();
    this.createUI();
    this.setupInput();
    this.cameras.main.fadeIn(300);
  }

  update(_time: number, delta: number) {
    const dt = delta * this.gameSpeed;
    this.updateSpawning(dt);
    this.updateEnemies(dt);
    this.updateTowers();
    this.updateProjectiles(dt);
    this.updateFloatingTexts(dt);
    this.updateParticles(dt);
    this.updateCombo();
    this.checkWaveComplete();
  }

  private initBlockedGrid() {
    for (let y = 0; y < MAP_ROWS; y++) {
      this.blocked[y] = [];
      for (let x = 0; x < MAP_COLS; x++) {
        this.blocked[y][x] = false;
      }
    }

    for (let i = 0; i < PATH.length - 1; i++) {
      const from = PATH[i];
      const to = PATH[i + 1];
      this.blockLine(from.x, from.y, to.x, to.y);
    }
  }

  private blockLine(x1: number, y1: number, x2: number, y2: number) {
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    let x = x1, y = y1;

    while (x !== x2 || y !== y2) {
      if (x >= 0 && x < MAP_COLS && y >= 0 && y < MAP_ROWS) {
        this.blocked[y][x] = true;
      }
      if (x !== x2) x += dx;
      if (y !== y2) y += dy;
    }
    if (x >= 0 && x < MAP_COLS && y >= 0 && y < MAP_ROWS) {
      this.blocked[y][x] = true;
    }
  }

  private createLayers() {
    this.groundLayer = this.add.graphics();
    this.pathLayer = this.add.graphics();
    this.effectsLayer = this.add.graphics();
    this.particleGraphics = this.add.graphics().setDepth(50);
    this.hoverGraphics = this.add.graphics().setDepth(100);
  }

  private drawGround() {
    // Dark grass base
    this.groundLayer.fillStyle(0x1a2f1a, 1);
    this.groundLayer.fillRect(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);

    // Grid pattern
    this.groundLayer.lineStyle(1, 0x2d4a2d, 0.3);
    for (let x = 0; x <= MAP_COLS; x++) {
      this.groundLayer.moveTo(x * TILE_SIZE, 0);
      this.groundLayer.lineTo(x * TILE_SIZE, MAP_ROWS * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_ROWS; y++) {
      this.groundLayer.moveTo(0, y * TILE_SIZE);
      this.groundLayer.lineTo(MAP_COLS * TILE_SIZE, y * TILE_SIZE);
    }
    this.groundLayer.strokePath();

    // Some decorative darker spots
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * MAP_COLS * TILE_SIZE;
      const y = Math.random() * MAP_ROWS * TILE_SIZE;
      this.groundLayer.fillStyle(0x152515, 0.5);
      this.groundLayer.fillCircle(x, y, Math.random() * 20 + 5);
    }
  }

  private drawPath() {
    // Path shadow
    this.pathLayer.lineStyle(TILE_SIZE + 8, 0x000000, 0.3);
    this.drawPathLine();

    // Main path
    this.pathLayer.lineStyle(TILE_SIZE - 4, 0x4a3728, 1);
    this.drawPathLine();

    // Path highlight
    this.pathLayer.lineStyle(TILE_SIZE - 16, 0x5d4632, 1);
    this.drawPathLine();

    // Path texture dots
    for (let i = 0; i < PATH.length - 1; i++) {
      const from = PATH[i];
      const to = PATH[i + 1];
      const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
      const steps = Math.floor(dist * 3);

      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        const x = (from.x + (to.x - from.x) * t) * TILE_SIZE + TILE_SIZE / 2;
        const y = (from.y + (to.y - from.y) * t) * TILE_SIZE + TILE_SIZE / 2;
        this.pathLayer.fillStyle(0x3d2a1d, 0.4);
        this.pathLayer.fillCircle(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, 3);
      }
    }

    // Start portal (green glow) - clamp to screen edge
    const start = PATH[0];
    const startX = Math.max(20, start.x * TILE_SIZE + TILE_SIZE / 2);
    this.drawPortal(startX, start.y * TILE_SIZE + TILE_SIZE / 2, 0x27ae60, 'SPAWN');

    // End portal (red glow) - THE VIBE PIT - clamp to screen edge
    const end = PATH[PATH.length - 1];
    const endX = Math.min(MAP_COLS * TILE_SIZE - 20, end.x * TILE_SIZE + TILE_SIZE / 2);
    this.drawPortal(endX, end.y * TILE_SIZE + TILE_SIZE / 2, 0xe74c3c, 'VIBE PIT');
  }

  private drawPathLine() {
    this.pathLayer.beginPath();
    const start = PATH[0];
    this.pathLayer.moveTo(start.x * TILE_SIZE + TILE_SIZE / 2, start.y * TILE_SIZE + TILE_SIZE / 2);
    for (let i = 1; i < PATH.length; i++) {
      const p = PATH[i];
      this.pathLayer.lineTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2);
    }
    this.pathLayer.strokePath();
  }

  private drawPortal(x: number, y: number, color: number, label: string) {
    // Outer glow
    for (let i = 3; i > 0; i--) {
      this.pathLayer.fillStyle(color, 0.1 * i);
      this.pathLayer.fillCircle(x, y, 20 + i * 8);
    }
    // Core
    this.pathLayer.fillStyle(color, 1);
    this.pathLayer.fillCircle(x, y, 15);
    this.pathLayer.fillStyle(0xffffff, 0.5);
    this.pathLayer.fillCircle(x - 4, y - 4, 6);

    // Label
    this.add.text(x, y + 35, label, {
      fontSize: '10px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private createUI() {
    const panelX = MAP_COLS * TILE_SIZE + 10;
    this.uiLayer = this.add.container(0, 0);

    // Main panel background
    const panel = this.add.graphics();
    panel.fillStyle(0x0d0d14, 0.95);
    panel.fillRoundedRect(panelX, 0, 220, MAP_ROWS * TILE_SIZE, 0);
    panel.lineStyle(2, 0x9b59b6, 0.5);
    panel.strokeRoundedRect(panelX, 0, 220, MAP_ROWS * TILE_SIZE, 0);
    this.uiLayer.add(panel);

    let y = 15;

    // Stats section
    this.moneyText = this.add.text(panelX + 15, y, `$${this.money}`, {
      fontSize: '24px', color: '#f1c40f', fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.uiLayer.add(this.moneyText);

    this.livesText = this.add.text(panelX + 130, y, `♥ ${this.lives}`, {
      fontSize: '24px', color: '#e74c3c', fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.uiLayer.add(this.livesText);

    y += 35;
    this.waveText = this.add.text(panelX + 15, y, `Wave ${this.wave}`, {
      fontSize: '16px', color: '#3498db', fontFamily: 'monospace'
    });
    this.uiLayer.add(this.waveText);

    this.comboText = this.add.text(panelX + 130, y, '', {
      fontSize: '16px', color: '#e74c3c', fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.uiLayer.add(this.comboText);

    y += 30;

    // Divider
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x9b59b6, 0.3);
    divider.moveTo(panelX + 15, y);
    divider.lineTo(panelX + 205, y);
    divider.strokePath();
    this.uiLayer.add(divider);

    y += 15;

    // Tower buttons
    this.add.text(panelX + 15, y, 'TOWERS', {
      fontSize: '12px', color: '#7f8c8d', fontFamily: 'monospace'
    });
    y += 20;

    const towerTypes: TowerType[] = ['cannon', 'laser', 'frost', 'missile', 'tesla'];
    towerTypes.forEach((type, i) => {
      const btn = this.createTowerButton(panelX + 15, y + i * 52, type, i + 1);
      this.towerButtons.push(btn);
      this.uiLayer.add(btn);
    });

    y += towerTypes.length * 52 + 10;

    // Selected tower info panel
    this.selectedTowerInfo = this.add.container(panelX + 15, y);
    this.uiLayer.add(this.selectedTowerInfo);
    this.updateSelectedTowerInfo();

    // Wave button at bottom
    this.waveButton = this.createWaveButton(panelX + 110, MAP_ROWS * TILE_SIZE - 45);
    this.uiLayer.add(this.waveButton);

    // Speed controls
    this.speedText = this.add.text(panelX + 15, MAP_ROWS * TILE_SIZE - 45, `Speed: ${this.gameSpeed}x`, {
      fontSize: '12px', color: '#7f8c8d', fontFamily: 'monospace'
    });
    this.uiLayer.add(this.speedText);

    const speedUp = this.add.text(panelX + 15, MAP_ROWS * TILE_SIZE - 25, '[+]', {
      fontSize: '14px', color: '#27ae60', fontFamily: 'monospace'
    }).setInteractive({ useHandCursor: true });
    speedUp.on('pointerdown', () => this.changeSpeed(1));
    this.uiLayer.add(speedUp);

    const speedDown = this.add.text(panelX + 45, MAP_ROWS * TILE_SIZE - 25, '[-]', {
      fontSize: '14px', color: '#e74c3c', fontFamily: 'monospace'
    }).setInteractive({ useHandCursor: true });
    speedDown.on('pointerdown', () => this.changeSpeed(-1));
    this.uiLayer.add(speedDown);

    // Wave preview at bottom of game area
    this.wavePreview = this.add.container(10, MAP_ROWS * TILE_SIZE - 60);
    this.updateWavePreview();
  }

  private updateWavePreview() {
    this.wavePreview.removeAll(true);

    const nextWave = this.wave + 1;
    const waveConfig = generateWave(nextWave);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(0, 0, 350, 55, 6);
    this.wavePreview.add(bg);

    // Title
    const title = this.add.text(10, 8, `NEXT: Wave ${nextWave}`, {
      fontSize: '11px', color: '#9b59b6', fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.wavePreview.add(title);

    // Enemy icons
    let iconX = 10;
    for (const group of waveConfig.enemies) {
      const config = ENEMIES[group.type];

      // Icon
      const icon = this.add.graphics();
      icon.fillStyle(config.color, 1);
      icon.fillCircle(iconX + 10, 38, 8);
      this.wavePreview.add(icon);

      // Count and name
      const label = this.add.text(iconX + 22, 30, `${config.emoji}x${group.count}`, {
        fontSize: '10px', color: '#ffffff', fontFamily: 'monospace'
      });
      this.wavePreview.add(label);

      iconX += 65;
    }
  }

  private createTowerButton(x: number, y: number, type: TowerType, key: number): Phaser.GameObjects.Container {
    const config = TOWERS[type];
    const container = this.add.container(x, y);
    const isSelected = this.selectedTower === type;
    const cost = config.levels[0].cost;
    const canAfford = this.money >= cost;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(isSelected ? 0x2c3e50 : 0x1a1a2e, 1);
    bg.fillRoundedRect(0, 0, 190, 48, 6);
    if (isSelected) {
      bg.lineStyle(2, config.baseColor, 1);
      bg.strokeRoundedRect(0, 0, 190, 48, 6);
    }
    container.add(bg);

    // Tower icon
    const icon = this.add.graphics();
    icon.fillStyle(config.baseColor, canAfford ? 1 : 0.4);
    icon.fillCircle(24, 24, 16);
    icon.fillStyle(config.accentColor, canAfford ? 1 : 0.4);
    icon.fillCircle(24, 24, 8);
    container.add(icon);

    // Key hint
    const keyHint = this.add.text(24, 24, `${key}`, {
      fontSize: '10px', color: '#000', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(keyHint);

    // Name and cost
    const nameText = this.add.text(48, 8, config.name.toUpperCase(), {
      fontSize: '13px', color: canAfford ? '#ecf0f1' : '#7f8c8d', fontFamily: 'monospace', fontStyle: 'bold'
    });
    container.add(nameText);

    const costText = this.add.text(48, 26, `$${cost}`, {
      fontSize: '12px', color: canAfford ? '#f1c40f' : '#7f8c8d', fontFamily: 'monospace'
    });
    container.add(costText);

    // Damage type indicator
    const typeLabel = this.add.text(170, 24, config.damageType.charAt(0).toUpperCase(), {
      fontSize: '10px', color: '#7f8c8d', fontFamily: 'monospace'
    }).setOrigin(0.5);
    container.add(typeLabel);

    // Interactivity
    container.setSize(190, 48);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => this.selectTower(type));

    return container;
  }

  private createWaveButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x27ae60, 1);
    bg.fillRoundedRect(-50, -18, 100, 36, 6);
    container.add(bg);

    const text = this.add.text(0, 0, 'START', {
      fontSize: '14px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(text);

    container.setSize(100, 36);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => this.startWave());
    container.on('pointerover', () => bg.clear().fillStyle(0x2ecc71, 1).fillRoundedRect(-50, -18, 100, 36, 6));
    container.on('pointerout', () => bg.clear().fillStyle(0x27ae60, 1).fillRoundedRect(-50, -18, 100, 36, 6));

    return container;
  }

  private updateSelectedTowerInfo() {
    this.selectedTowerInfo.removeAll(true);
    const config = TOWERS[this.selectedTower];
    const level = config.levels[0];

    const title = this.add.text(0, 0, config.name, {
      fontSize: '14px', color: '#' + config.baseColor.toString(16).padStart(6, '0'), fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.selectedTowerInfo.add(title);

    const desc = this.add.text(0, 18, config.description, {
      fontSize: '10px', color: '#7f8c8d', fontFamily: 'monospace'
    });
    this.selectedTowerInfo.add(desc);

    const stats = this.add.text(0, 36, `DMG: ${level.damage}  RNG: ${level.range}  SPD: ${level.fireRate}/s`, {
      fontSize: '10px', color: '#bdc3c7', fontFamily: 'monospace'
    });
    this.selectedTowerInfo.add(stats);
  }

  private updateTowerButtons() {
    const towerTypes: TowerType[] = ['cannon', 'laser', 'frost', 'missile', 'tesla'];
    this.towerButtons.forEach((btn, i) => {
      btn.destroy();
    });
    this.towerButtons = [];

    const panelX = MAP_COLS * TILE_SIZE + 10;
    let y = 95;
    towerTypes.forEach((type, i) => {
      const btn = this.createTowerButton(panelX + 15, y + i * 52, type, i + 1);
      this.towerButtons.push(btn);
      this.uiLayer.add(btn);
    });
  }

  private setupInput() {
    // Keyboard
    this.input.keyboard!.on('keydown-ONE', () => this.selectTower('cannon'));
    this.input.keyboard!.on('keydown-TWO', () => this.selectTower('laser'));
    this.input.keyboard!.on('keydown-THREE', () => this.selectTower('frost'));
    this.input.keyboard!.on('keydown-FOUR', () => this.selectTower('missile'));
    this.input.keyboard!.on('keydown-FIVE', () => this.selectTower('tesla'));
    this.input.keyboard!.on('keydown-SPACE', () => this.startWave());
    this.input.keyboard!.on('keydown-R', () => this.sellHoveredTower());
    this.input.keyboard!.on('keydown-PLUS', () => this.changeSpeed(1));
    this.input.keyboard!.on('keydown-MINUS', () => this.changeSpeed(-1));
    this.input.keyboard!.on('keydown-U', () => this.upgradeHoveredTower());

    // Mouse
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown() && p.x < MAP_COLS * TILE_SIZE) {
        const gx = Math.floor(p.x / TILE_SIZE);
        const gy = Math.floor(p.y / TILE_SIZE);
        this.placeTower(gx, gy);
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.updateHover(p));
  }

  private selectTower(type: TowerType) {
    this.selectedTower = type;
    this.updateTowerButtons();
    this.updateSelectedTowerInfo();
  }

  private changeSpeed(delta: number) {
    const speeds = [0.5, 1, 2, 3];
    const idx = speeds.indexOf(this.gameSpeed);
    const newIdx = Phaser.Math.Clamp(idx + delta, 0, speeds.length - 1);
    this.gameSpeed = speeds[newIdx];
    this.speedText.setText(`Speed: ${this.gameSpeed}x`);
  }

  private placeTower(gx: number, gy: number) {
    if (gx < 0 || gx >= MAP_COLS || gy < 0 || gy >= MAP_ROWS) return;
    if (this.blocked[gy][gx]) return;
    if (this.towers.some(t => t.x === gx && t.y === gy)) return;

    const config = TOWERS[this.selectedTower];
    const cost = config.levels[0].cost;
    if (this.money < cost) return;

    this.money -= cost;
    this.moneyText.setText(`$${this.money}`);

    const cx = gx * TILE_SIZE + TILE_SIZE / 2;
    const cy = gy * TILE_SIZE + TILE_SIZE / 2;

    const container = this.add.container(cx, cy).setDepth(10);

    // Base
    const base = this.add.graphics();
    base.fillStyle(0x1a1a1a, 1);
    base.fillCircle(0, 0, 20);
    base.fillStyle(config.baseColor, 1);
    base.fillCircle(0, 0, 17);
    container.add(base);

    // Turret
    const turret = this.add.graphics();
    turret.fillStyle(config.accentColor, 1);
    turret.fillCircle(0, 0, 10);
    turret.fillStyle(0x000000, 0.3);
    turret.fillCircle(0, 0, 5);
    container.add(turret);

    // Level indicator
    const levelText = this.add.text(0, 22, '★', {
      fontSize: '10px', color: '#f1c40f', fontFamily: 'monospace'
    }).setOrigin(0.5);
    container.add(levelText);

    this.towers.push({
      id: this.nextId++,
      x: gx,
      y: gy,
      type: this.selectedTower,
      level: 0,
      lastFired: 0,
      graphics: container,
      kills: 0,
    });

    // Placement effect
    this.spawnParticles(cx, cy, config.baseColor, 10);
    this.updateTowerButtons();
  }

  private sellHoveredTower() {
    const p = this.input.activePointer;
    const gx = Math.floor(p.x / TILE_SIZE);
    const gy = Math.floor(p.y / TILE_SIZE);

    const idx = this.towers.findIndex(t => t.x === gx && t.y === gy);
    if (idx === -1) return;

    const tower = this.towers[idx];
    const config = TOWERS[tower.type];
    let totalCost = 0;
    for (let i = 0; i <= tower.level; i++) {
      totalCost += config.levels[i].cost;
    }
    const refund = Math.floor(totalCost * SELL_REFUND);

    this.money += refund;
    this.moneyText.setText(`$${this.money}`);
    this.spawnFloatingText(tower.graphics.x, tower.graphics.y - 20, `+$${refund}`, 0x27ae60);

    const cx = tower.graphics.x;
    const cy = tower.graphics.y;
    this.spawnParticles(cx, cy, 0xf1c40f, 15);

    tower.graphics.destroy();
    this.towers.splice(idx, 1);
    this.updateTowerButtons();
  }

  private upgradeHoveredTower() {
    const p = this.input.activePointer;
    const gx = Math.floor(p.x / TILE_SIZE);
    const gy = Math.floor(p.y / TILE_SIZE);

    const tower = this.towers.find(t => t.x === gx && t.y === gy);
    if (!tower) return;

    const config = TOWERS[tower.type];
    if (tower.level >= config.levels.length - 1) return;

    const upgradeCost = config.levels[tower.level + 1].cost;
    if (this.money < upgradeCost) return;

    this.money -= upgradeCost;
    tower.level++;
    this.moneyText.setText(`$${this.money}`);

    // Update visuals
    const stars = '★'.repeat(tower.level + 1);
    const levelText = tower.graphics.getAt(2) as Phaser.GameObjects.Text;
    levelText.setText(stars);

    this.spawnFloatingText(tower.graphics.x, tower.graphics.y - 30, 'UPGRADED!', 0x9b59b6);
    this.spawnParticles(tower.graphics.x, tower.graphics.y, 0x9b59b6, 20);
    this.updateTowerButtons();
  }

  private updateHover(p: Phaser.Input.Pointer) {
    this.hoverGraphics.clear();
    if (p.x >= MAP_COLS * TILE_SIZE) return;

    const gx = Math.floor(p.x / TILE_SIZE);
    const gy = Math.floor(p.y / TILE_SIZE);
    if (gx < 0 || gx >= MAP_COLS || gy < 0 || gy >= MAP_ROWS) return;

    const cx = gx * TILE_SIZE + TILE_SIZE / 2;
    const cy = gy * TILE_SIZE + TILE_SIZE / 2;

    // Check if hovering over an enemy - show their name
    const hoveredEnemy = this.enemies.find(e => {
      const dist = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
      return dist < e.config.size + 5;
    });

    if (hoveredEnemy) {
      const config = hoveredEnemy.config;
      const boxWidth = 120;
      const boxHeight = 50;
      const bx = Math.min(hoveredEnemy.x, MAP_COLS * TILE_SIZE - boxWidth - 10);
      const by = hoveredEnemy.y - config.size - boxHeight - 10;

      this.hoverGraphics.fillStyle(0x000000, 0.9);
      this.hoverGraphics.fillRoundedRect(bx - 10, by, boxWidth, boxHeight, 6);
      this.hoverGraphics.lineStyle(2, config.color, 1);
      this.hoverGraphics.strokeRoundedRect(bx - 10, by, boxWidth, boxHeight, 6);

      const nameText = this.add.text(bx + boxWidth / 2 - 10, by + 10, `${config.emoji} ${config.name}`, {
        fontSize: '12px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
      }).setOrigin(0.5, 0).setDepth(150);

      const titleText = this.add.text(bx + boxWidth / 2 - 10, by + 28, config.title, {
        fontSize: '9px', color: '#95a5a6', fontFamily: 'monospace'
      }).setOrigin(0.5, 0).setDepth(150);

      this.time.delayedCall(16, () => {
        nameText.destroy();
        titleText.destroy();
      });
      return;
    }

    const existingTower = this.towers.find(t => t.x === gx && t.y === gy);
    if (existingTower) {
      const config = TOWERS[existingTower.type];
      const level = config.levels[existingTower.level];
      this.hoverGraphics.lineStyle(2, config.baseColor, 0.5);
      this.hoverGraphics.strokeCircle(cx, cy, level.range);

      // Show upgrade cost if available
      if (existingTower.level < config.levels.length - 1) {
        const upgradeCost = config.levels[existingTower.level + 1].cost;
        const canAfford = this.money >= upgradeCost;
        this.hoverGraphics.fillStyle(0x000000, 0.85);
        this.hoverGraphics.fillRoundedRect(cx - 50, cy - 55, 100, 24, 4);
        // Draw upgrade text manually with graphics
        const upgradeText = this.add.text(cx, cy - 43, `[U] $${upgradeCost}`, {
          fontSize: '12px',
          color: canAfford ? '#f1c40f' : '#e74c3c',
          fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(101);
        // Clean up text next frame
        this.time.delayedCall(16, () => upgradeText.destroy());
      }
      return;
    }

    const config = TOWERS[this.selectedTower];
    const level = config.levels[0];
    const canPlace = !this.blocked[gy][gx] && this.money >= level.cost;

    // Range preview
    this.hoverGraphics.lineStyle(2, config.baseColor, 0.3);
    this.hoverGraphics.strokeCircle(cx, cy, level.range);

    // Tower preview
    this.hoverGraphics.fillStyle(config.baseColor, canPlace ? 0.6 : 0.2);
    this.hoverGraphics.fillCircle(cx, cy, 17);

    // Border
    this.hoverGraphics.lineStyle(2, canPlace ? 0x27ae60 : 0xe74c3c, 0.8);
    this.hoverGraphics.strokeRect(gx * TILE_SIZE + 2, gy * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  }

  private startWave() {
    if (this.waveInProgress) return;

    this.wave++;
    this.waveText.setText(`Wave ${this.wave}`);
    this.waveInProgress = true;

    const waveConfig = generateWave(this.wave);
    this.spawnQueue = [];

    for (const group of waveConfig.enemies) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({ type: group.type, delay: group.delay });
      }
    }

    // Shuffle spawn queue slightly for variety
    this.spawnQueue.sort(() => Math.random() - 0.5);
    this.spawnTimer = 0;

    // Update button
    const bg = this.waveButton.getAt(0) as Phaser.GameObjects.Graphics;
    const text = this.waveButton.getAt(1) as Phaser.GameObjects.Text;
    bg.clear().fillStyle(0x7f8c8d, 1).fillRoundedRect(-50, -18, 100, 36, 6);
    text.setText('ACTIVE');
    this.waveButton.disableInteractive();
  }

  private updateSpawning(dt: number) {
    if (!this.waveInProgress || this.spawnQueue.length === 0) return;

    this.spawnTimer += dt;
    const next = this.spawnQueue[0];

    if (this.spawnTimer >= next.delay) {
      this.spawnTimer = 0;
      this.spawnQueue.shift();
      this.spawnEnemy(next.type);
    }
  }

  private spawnEnemy(type: EnemyType) {
    const config = ENEMIES[type];
    const healthMult = Math.pow(config.healthScaling, this.wave - 1);
    const health = Math.floor(config.baseHealth * healthMult);

    const start = PATH[0];
    const x = start.x * TILE_SIZE + TILE_SIZE / 2;
    const y = start.y * TILE_SIZE + TILE_SIZE / 2;

    const container = this.add.container(x, y).setDepth(20);

    // Shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillEllipse(0, config.size * 0.6, config.size * 1.2, config.size * 0.5);
    container.add(shadow);

    // Body
    const body = this.add.graphics();
    body.fillStyle(config.color, 1);
    body.fillCircle(0, 0, config.size);
    body.fillStyle(config.accentColor, 1);
    body.fillCircle(-config.size * 0.2, -config.size * 0.2, config.size * 0.4);
    container.add(body);

    // Eyes (brainrot style - slightly unhinged)
    const eyes = this.add.graphics();
    eyes.fillStyle(0xffffff, 1);
    eyes.fillCircle(-config.size * 0.3, -config.size * 0.1, config.size * 0.25);
    eyes.fillCircle(config.size * 0.3, -config.size * 0.1, config.size * 0.25);
    eyes.fillStyle(0x000000, 1);
    eyes.fillCircle(-config.size * 0.25, -config.size * 0.1, config.size * 0.12);
    eyes.fillCircle(config.size * 0.35, -config.size * 0.1, config.size * 0.12);
    container.add(eyes);

    // Health bar background
    const hpBg = this.add.graphics();
    hpBg.fillStyle(0x000000, 0.7);
    hpBg.fillRect(-15, -config.size - 12, 30, 5);
    container.add(hpBg);

    // Health bar
    const hpBar = this.add.graphics();
    hpBar.fillStyle(0x2ecc71, 1);
    hpBar.fillRect(-14, -config.size - 11, 28, 3);
    container.add(hpBar);

    const enemy: Enemy = {
      id: this.nextId++,
      x, y,
      type,
      health,
      maxHealth: health,
      speed: config.baseSpeed,
      pathIndex: 0,
      pathProgress: 0,
      graphics: container,
      reward: config.baseReward + this.wave * 2,
      slowedUntil: 0,
      config,
    };

    this.enemies.push(enemy);
  }

  private updateEnemies(dt: number) {
    const now = this.time.now;
    const toRemove: number[] = [];

    for (const enemy of this.enemies) {
      // Check if reached end
      if (enemy.pathIndex >= PATH.length - 1) {
        this.lives--;
        this.livesText.setText(`♥ ${this.lives}`);
        this.spawnFloatingText(enemy.x, enemy.y, '-1 ♥', 0xe74c3c);
        toRemove.push(enemy.id);

        if (this.lives <= 0) {
          this.gameOver();
          return;
        }
        continue;
      }

      // Calculate speed (check slow)
      let speed = enemy.speed;
      const isSlowed = enemy.slowedUntil > now && enemy.config.special !== 'immune to slow';
      const body = enemy.graphics.getAt(1) as Phaser.GameObjects.Graphics;

      if (isSlowed) {
        speed *= 0.5;
        // Slow visual - blue glow
        body.clear();
        body.fillStyle(0x85c1e9, 0.5);
        body.fillCircle(0, 0, enemy.config.size + 3);
        body.fillStyle(enemy.config.color, 1);
        body.fillCircle(0, 0, enemy.config.size);
        body.fillStyle(enemy.config.accentColor, 1);
        body.fillCircle(-enemy.config.size * 0.2, -enemy.config.size * 0.2, enemy.config.size * 0.4);
      } else {
        // Normal visual - redraw without glow
        body.clear();
        body.fillStyle(enemy.config.color, 1);
        body.fillCircle(0, 0, enemy.config.size);
        body.fillStyle(enemy.config.accentColor, 1);
        body.fillCircle(-enemy.config.size * 0.2, -enemy.config.size * 0.2, enemy.config.size * 0.4);
      }

      // Move along path
      const from = PATH[enemy.pathIndex];
      const to = PATH[enemy.pathIndex + 1];
      const fx = from.x * TILE_SIZE + TILE_SIZE / 2;
      const fy = from.y * TILE_SIZE + TILE_SIZE / 2;
      const tx = to.x * TILE_SIZE + TILE_SIZE / 2;
      const ty = to.y * TILE_SIZE + TILE_SIZE / 2;

      const segmentDist = Math.sqrt((tx - fx) ** 2 + (ty - fy) ** 2);
      enemy.pathProgress += (speed * dt / 1000) / segmentDist;

      if (enemy.pathProgress >= 1) {
        enemy.pathProgress = 0;
        enemy.pathIndex++;
      }

      const t = enemy.pathProgress;
      enemy.x = fx + (tx - fx) * t;
      enemy.y = fy + (ty - fy) * t;
      enemy.graphics.setPosition(enemy.x, enemy.y);

      // Wobble animation
      const wobble = Math.sin(now * 0.01 + enemy.id) * 2;
      enemy.graphics.setRotation(wobble * 0.05);
    }

    // Healer logic
    for (const enemy of this.enemies) {
      if (enemy.config.special === 'heals nearby') {
        for (const other of this.enemies) {
          if (other.id === enemy.id) continue;
          const dist = Math.sqrt((other.x - enemy.x) ** 2 + (other.y - enemy.y) ** 2);
          if (dist < 80 && other.health < other.maxHealth) {
            other.health = Math.min(other.maxHealth, other.health + 0.5 * dt / 16);
            this.updateEnemyHealthBar(other);
          }
        }
      }
    }

    for (const id of toRemove) {
      this.removeEnemy(id, false);
    }
  }

  private updateEnemyHealthBar(enemy: Enemy) {
    const hpBar = enemy.graphics.getAt(4) as Phaser.GameObjects.Graphics;
    const pct = enemy.health / enemy.maxHealth;
    const color = pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf39c12 : 0xe74c3c;
    hpBar.clear();
    hpBar.fillStyle(color, 1);
    hpBar.fillRect(-14, -enemy.config.size - 11, 28 * pct, 3);
  }

  private removeEnemy(id: number, killed: boolean) {
    const idx = this.enemies.findIndex(e => e.id === id);
    if (idx === -1) return;

    const enemy = this.enemies[idx];

    if (killed) {
      this.money += enemy.reward;
      this.moneyText.setText(`$${this.money}`);
      this.totalKills++;
      this.combo++;
      this.lastKillTime = this.time.now;

      const comboBonus = Math.floor(enemy.reward * (this.combo - 1) * 0.1);
      if (comboBonus > 0) {
        this.money += comboBonus;
        this.moneyText.setText(`$${this.money}`);
      }

      this.spawnFloatingText(enemy.x, enemy.y - 20, `+$${enemy.reward + comboBonus}`, 0xf1c40f);
      this.spawnParticles(enemy.x, enemy.y, enemy.config.color, 15);
    }

    enemy.graphics.destroy();
    this.enemies.splice(idx, 1);
    this.updateTowerButtons();
  }

  private updateTowers() {
    const now = this.time.now;

    for (const tower of this.towers) {
      const config = TOWERS[tower.type];
      const level = config.levels[tower.level];
      const fireInterval = 1000 / level.fireRate;

      if (now - tower.lastFired < fireInterval) continue;

      const cx = tower.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = tower.y * TILE_SIZE + TILE_SIZE / 2;

      // Find target
      let target: Enemy | null = null;
      let bestScore = -1;

      for (const enemy of this.enemies) {
        const dist = Math.sqrt((enemy.x - cx) ** 2 + (enemy.y - cy) ** 2);
        if (dist > level.range) continue;

        // Prioritize enemies further along path
        const score = enemy.pathIndex + enemy.pathProgress;
        if (score > bestScore) {
          bestScore = score;
          target = enemy;
        }
      }

      if (target) {
        tower.lastFired = now;
        this.fireProjectile(tower, target);

        // Rotate turret toward target
        const angle = Math.atan2(target.y - cy, target.x - cx);
        const turret = tower.graphics.getAt(1) as Phaser.GameObjects.Graphics;
        turret.setRotation(angle);
      }
    }
  }

  private fireProjectile(tower: Tower, target: Enemy) {
    const config = TOWERS[tower.type];
    const level = config.levels[tower.level];
    const cx = tower.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = tower.y * TILE_SIZE + TILE_SIZE / 2;

    const graphics = this.add.graphics().setDepth(15);

    this.projectiles.push({
      x: cx,
      y: cy,
      targetId: target.id,
      damage: level.damage,
      speed: 500,
      type: tower.type,
      level: tower.level,
      graphics,
    });
  }

  private updateProjectiles(dt: number) {
    const toRemove: number[] = [];

    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      const target = this.enemies.find(e => e.id === proj.targetId);

      if (!target) {
        toRemove.push(i);
        continue;
      }

      const dx = target.x - proj.x;
      const dy = target.y - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 12) {
        // Hit!
        this.applyDamage(proj, target);
        toRemove.push(i);
      } else {
        proj.x += (dx / dist) * proj.speed * dt / 1000;
        proj.y += (dy / dist) * proj.speed * dt / 1000;
      }

      // Draw
      const config = TOWERS[proj.type];
      proj.graphics.clear();
      proj.graphics.fillStyle(config.projectileColor, 1);

      if (proj.type === 'laser') {
        proj.graphics.fillRect(proj.x - 8, proj.y - 2, 16, 4);
      } else if (proj.type === 'tesla') {
        proj.graphics.lineStyle(3, config.projectileColor, 0.8);
        proj.graphics.moveTo(proj.x - 5, proj.y);
        proj.graphics.lineTo(proj.x + 5, proj.y);
        proj.graphics.strokePath();
      } else {
        proj.graphics.fillCircle(proj.x, proj.y, 5);
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.projectiles[toRemove[i]].graphics.destroy();
      this.projectiles.splice(toRemove[i], 1);
    }
  }

  private applyDamage(proj: Projectile, target: Enemy) {
    const config = TOWERS[proj.type];
    const level = config.levels[proj.level];

    target.health -= proj.damage;
    this.updateEnemyHealthBar(target);
    this.spawnParticles(target.x, target.y, config.projectileColor, 5);

    // Special effects
    if (config.damageType === 'splash' && level.special) {
      for (const enemy of this.enemies) {
        if (enemy.id === target.id) continue;
        const dist = Math.sqrt((enemy.x - target.x) ** 2 + (enemy.y - target.y) ** 2);
        if (dist < level.special) {
          enemy.health -= proj.damage * 0.5;
          this.updateEnemyHealthBar(enemy);
          if (enemy.health <= 0) {
            this.removeEnemy(enemy.id, true);
          }
        }
      }
    }

    if (config.damageType === 'slow') {
      target.slowedUntil = this.time.now + 2000;
    }

    if (config.damageType === 'chain' && level.special) {
      let chainCount = level.special - 1;
      let lastTarget = target;
      const hit = new Set([target.id]);

      while (chainCount > 0) {
        let closest: Enemy | null = null;
        let closestDist = 100;

        for (const enemy of this.enemies) {
          if (hit.has(enemy.id)) continue;
          const dist = Math.sqrt((enemy.x - lastTarget.x) ** 2 + (enemy.y - lastTarget.y) ** 2);
          if (dist < closestDist) {
            closestDist = dist;
            closest = enemy;
          }
        }

        if (!closest) break;

        closest.health -= proj.damage * 0.7;
        this.updateEnemyHealthBar(closest);
        hit.add(closest.id);

        // Chain lightning visual
        this.effectsLayer.lineStyle(2, config.projectileColor, 0.8);
        this.effectsLayer.moveTo(lastTarget.x, lastTarget.y);
        this.effectsLayer.lineTo(closest.x, closest.y);
        this.effectsLayer.strokePath();

        if (closest.health <= 0) {
          this.removeEnemy(closest.id, true);
        }

        lastTarget = closest;
        chainCount--;
      }

      this.time.delayedCall(100, () => this.effectsLayer.clear());
    }

    if (target.health <= 0) {
      this.removeEnemy(target.id, true);
    }
  }

  private updateCombo() {
    if (this.combo > 0 && this.time.now - this.lastKillTime > 1500) {
      this.combo = 0;
    }

    if (this.combo > 1) {
      this.comboText.setText(`${this.combo}x COMBO`);
      this.comboText.setScale(1 + Math.sin(this.time.now * 0.01) * 0.1);
    } else {
      this.comboText.setText('');
    }
  }

  private checkWaveComplete() {
    if (!this.waveInProgress) return;
    if (this.spawnQueue.length > 0 || this.enemies.length > 0) return;

    this.waveInProgress = false;

    const bonus = 50 + this.wave * 15;
    this.money += bonus;
    this.moneyText.setText(`$${this.money}`);
    this.spawnFloatingText(MAP_COLS * TILE_SIZE / 2, MAP_ROWS * TILE_SIZE / 2, `WAVE COMPLETE! +$${bonus}`, 0x9b59b6);

    // Reset wave button
    const bg = this.waveButton.getAt(0) as Phaser.GameObjects.Graphics;
    const text = this.waveButton.getAt(1) as Phaser.GameObjects.Text;
    bg.clear().fillStyle(0x27ae60, 1).fillRoundedRect(-50, -18, 100, 36, 6);
    text.setText('START');
    this.waveButton.setInteractive({ useHandCursor: true });

    this.updateTowerButtons();
    this.updateWavePreview();
  }

  private spawnFloatingText(x: number, y: number, message: string, color: number) {
    const text = this.add.text(x, y, message, {
      fontSize: '16px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(200);

    this.floatingTexts.push({ text, life: 1000, vy: -1 });
  }

  private updateFloatingTexts(dt: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.text.y += ft.vy * dt * 0.05;
      ft.text.setAlpha(ft.life / 1000);

      if (ft.life <= 0) {
        ft.text.destroy();
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private spawnParticles(x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 500,
        maxLife: 500,
        color,
        size: Math.random() * 4 + 2,
      });
    }
  }

  private updateParticles(dt: number) {
    this.particleGraphics.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt * 0.1;
      p.y += p.vy * dt * 0.1;
      p.vy += 0.1; // gravity
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const alpha = p.life / p.maxLife;
      this.particleGraphics.fillStyle(p.color, alpha);
      this.particleGraphics.fillCircle(p.x, p.y, p.size * alpha);
    }
  }

  private gameOver() {
    this.scene.pause();

    const { width, height } = this.cameras.main;

    const overlay = this.add.graphics().setDepth(1000);
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, width, height);

    this.add.text(width / 2 - 100, height / 2 - 80, 'GAME OVER', {
      fontSize: '48px', color: '#e74c3c', fontFamily: 'monospace', fontStyle: 'bold'
    }).setDepth(1001);

    this.add.text(width / 2 - 100, height / 2, `Waves Survived: ${this.wave}`, {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace'
    }).setDepth(1001);

    this.add.text(width / 2 - 100, height / 2 + 30, `Total Kills: ${this.totalKills}`, {
      fontSize: '20px', color: '#f1c40f', fontFamily: 'monospace'
    }).setDepth(1001);

    const restartBtn = this.add.text(width / 2 - 100, height / 2 + 80, '[ PLAY AGAIN ]', {
      fontSize: '20px', color: '#27ae60', fontFamily: 'monospace'
    }).setDepth(1001).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerover', () => restartBtn.setColor('#2ecc71'));
    restartBtn.on('pointerout', () => restartBtn.setColor('#27ae60'));
    restartBtn.on('pointerdown', () => this.scene.restart());

    const menuBtn = this.add.text(width / 2 - 100, height / 2 + 115, '[ MAIN MENU ]', {
      fontSize: '20px', color: '#9b59b6', fontFamily: 'monospace'
    }).setDepth(1001).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor('#bb8fce'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#9b59b6'));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}

import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  private particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];
  private particleGraphics!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private time_elapsed = 0;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background gradient
    const bg = this.add.graphics();
    this.createGradientBackground(bg, width, height);

    // Particle system for ambiance
    this.particleGraphics = this.add.graphics();
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 0.5 - 0.2,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.5 + 0.2,
      });
    }

    // Glowing title
    this.add.text(width / 2, 100, 'TOWER DEFENSE', {
      fontSize: '16px',
      color: '#8e44ad',
      fontFamily: 'monospace',
      letterSpacing: 12,
    }).setOrigin(0.5);

    this.titleText = this.add.text(width / 2, 160, 'VIBE PIT DEFENSE', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, 220, 'They vibin. You defendin.', {
      fontSize: '16px',
      color: '#95a5a6',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Start button
    this.createButton(width / 2, 340, 'START GAME', () => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start('GameScene');
      });
    });

    // How to play button
    this.createButton(width / 2, 410, 'HOW TO PLAY', () => {
      this.showHowToPlay();
    });

    // Tower preview
    this.createTowerPreview(width / 2, 520);

    // Version
    this.add.text(width - 20, height - 20, 'v1.0.0', {
      fontSize: '12px',
      color: '#34495e',
      fontFamily: 'monospace',
    }).setOrigin(1);

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  update(_time: number, delta: number) {
    this.time_elapsed += delta;

    // Animate particles
    this.particleGraphics.clear();
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y < -10) {
        p.y = this.cameras.main.height + 10;
        p.x = Math.random() * this.cameras.main.width;
      }

      this.particleGraphics.fillStyle(0x9b59b6, p.alpha);
      this.particleGraphics.fillCircle(p.x, p.y, p.size);
    }

    // Pulsing title
    const pulse = Math.sin(this.time_elapsed * 0.003) * 0.1 + 1;
    this.titleText.setScale(pulse);
  }

  private createGradientBackground(graphics: Phaser.GameObjects.Graphics, width: number, height: number) {
    const steps = 50;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.floor(26 + t * 10);
      const g = Math.floor(26 + t * 5);
      const b = Math.floor(46 + t * 20);
      const color = (r << 16) | (g << 8) | b;
      graphics.fillStyle(color, 1);
      graphics.fillRect(0, (i / steps) * height, width, height / steps + 1);
    }
  }

  private createButton(x: number, y: number, text: string, callback: () => void) {
    const buttonWidth = 240;
    const buttonHeight = 50;

    const container = this.add.container(x, y);

    // Button background
    const bg = this.add.graphics();
    bg.fillStyle(0x2c3e50, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
    bg.lineStyle(2, 0x9b59b6, 1);
    bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
    container.add(bg);

    // Button text
    const buttonText = this.add.text(0, 0, text, {
      fontSize: '18px',
      color: '#ecf0f1',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    container.add(buttonText);

    // Interactivity
    container.setSize(buttonWidth, buttonHeight);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x9b59b6, 1);
      bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
      buttonText.setColor('#ffffff');
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x2c3e50, 1);
      bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
      bg.lineStyle(2, 0x9b59b6, 1);
      bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
      buttonText.setColor('#ecf0f1');
    });

    container.on('pointerdown', callback);
  }

  private createTowerPreview(x: number, y: number) {
    const towers = [
      { color: 0x5d6d7e, name: 'Cannon', desc: 'Splash' },
      { color: 0xe74c3c, name: 'Laser', desc: 'DPS' },
      { color: 0x3498db, name: 'Frost', desc: 'Slow' },
      { color: 0x2ecc71, name: 'Missile', desc: 'Sniper' },
      { color: 0x9b59b6, name: 'Tesla', desc: 'Chain' },
    ];

    const spacing = 100;
    const startX = x - (towers.length - 1) * spacing / 2;

    towers.forEach((tower, i) => {
      const tx = startX + i * spacing;

      // Tower icon
      const g = this.add.graphics();
      g.fillStyle(tower.color, 1);
      g.fillCircle(tx, y, 20);
      g.fillStyle(0x000000, 0.3);
      g.fillCircle(tx, y, 10);
      g.lineStyle(2, 0xffffff, 0.3);
      g.strokeCircle(tx, y, 20);

      // Name
      this.add.text(tx, y + 35, tower.name, {
        fontSize: '11px',
        color: '#bdc3c7',
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      // Type
      this.add.text(tx, y + 50, tower.desc, {
        fontSize: '9px',
        color: '#7f8c8d',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
    });
  }

  private showHowToPlay() {
    const { width, height } = this.cameras.main;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.9);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(100);

    const panel = this.add.graphics();
    panel.fillStyle(0x1a1a2e, 1);
    panel.fillRoundedRect(100, 50, width - 200, height - 100, 16);
    panel.lineStyle(2, 0x9b59b6, 1);
    panel.strokeRoundedRect(100, 50, width - 200, height - 100, 16);
    panel.setDepth(101);

    const title = this.add.text(width / 2, 90, 'HOW TO PLAY', {
      fontSize: '28px',
      color: '#9b59b6',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(102);

    const instructions = `
OBJECTIVE
Prevent enemies from reaching the exit. You lose lives for each enemy that escapes.

CONTROLS
• Click on grass to place towers
• Press 1-5 to select tower type
• Hover over tower + R to sell (70% refund)
• SPACE to start the next wave
• +/- to change game speed

TOWERS
1. Cannon - Splash damage in an area
2. Laser - High fire rate, single target
3. Frost - Slows enemies, low damage
4. Missile - Long range, high damage
5. Tesla - Chain lightning between enemies

TIPS
• Mix tower types for best results
• Frost towers are great at chokepoints
• Upgrade towers instead of building more
• Save money for boss waves (every 10 waves)
    `.trim();

    const text = this.add.text(width / 2, 300, instructions, {
      fontSize: '13px',
      color: '#bdc3c7',
      fontFamily: 'monospace',
      lineSpacing: 6,
      align: 'left',
    }).setOrigin(0.5).setDepth(102);

    const closeBtn = this.add.text(width / 2, height - 80, '[ CLOSE ]', {
      fontSize: '16px',
      color: '#9b59b6',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#9b59b6'));
    closeBtn.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
      title.destroy();
      text.destroy();
      closeBtn.destroy();
    });
  }
}

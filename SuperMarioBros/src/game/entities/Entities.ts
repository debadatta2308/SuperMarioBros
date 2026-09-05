import Phaser from 'phaser';
import { createBody, KinematicBody, PHYSICS } from '../config/Constants';
import type { World } from '../world/World';

// ------------------------------------------------------------------ Enemy
export class Enemy {
  body: KinematicBody;
  sprite: Phaser.GameObjects.Image;
  alive = true;
  dir: 1 | -1 = -1;
  speed = 64;
  private removeTimer = 0;
  private wobble = 0;

  constructor(
    private scene: Phaser.Scene,
    private world: World,
    x: number,
    groundY: number
  ) {
    this.body = createBody(x - 14, groundY - 28, 28, 28);
    this.sprite = scene.add.image(0, 0, 'goomba').setOrigin(0.5, 1).setDepth(18);
    this.sync();
  }

  update(dt: number, wonder: boolean) {
    if (!this.alive) {
      this.removeTimer -= dt;
      if (this.removeTimer <= 0) this.sprite.destroy();
      return;
    }
    const b = this.body;
    b.vx = this.dir * this.speed * (wonder ? 1.5 : 1);
    b.vy = Math.min(b.vy + PHYSICS.GRAVITY_FALLING * dt, PHYSICS.TERMINAL_VELOCITY);
    this.world.moveAndCollide(b, dt);
    if (b.hitWall !== 0) this.dir = -this.dir as 1 | -1;
    // ledge check: turn around instead of walking off
    if (b.onGround) {
      const frontX = this.dir > 0 ? b.x + b.w + 2 : b.x - 2;
      if (!this.world.isSolidAt(frontX, b.y + b.h + 6)) this.dir = -this.dir as 1 | -1;
    }
    this.wobble += dt * (wonder ? 22 : 12);
    this.sync();
    if (b.y > this.world.heightPx + 64) this.destroy();
  }

  stomp() {
    this.alive = false;
    this.removeTimer = 0.5;
    this.sprite.setScale(1.3, 0.35).setAlpha(0.8);
  }

  whipped(dir: number) {
    this.alive = false;
    this.removeTimer = 0.9;
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.sprite.x + dir * 140,
      y: this.sprite.y - 120,
      angle: dir * 540,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
    });
  }

  destroy() {
    this.alive = false;
    this.removeTimer = 0;
    this.sprite.destroy();
  }

  get destroyed() {
    return !this.alive && this.removeTimer <= 0;
  }

  private sync() {
    const b = this.body;
    this.sprite.x = b.x + b.w / 2;
    this.sprite.y = b.y + b.h;
    this.sprite.setFlipX(this.dir > 0);
    if (this.alive) this.sprite.setScale(1 + Math.sin(this.wobble) * 0.06, 1 - Math.sin(this.wobble) * 0.06);
  }
}

// ------------------------------------------------------------------ Item
export type ItemKind = 'elephant' | 'drill' | 'coin' | 'flower' | 'seed' | 'flag' | 'checkpoint';

export class Item {
  body: KinematicBody;
  sprite: Phaser.GameObjects.Image;
  collected = false;
  /** Items emerging from blocks rise for a moment before becoming interactive. */
  emerging = 0;
  private t = Math.random() * 10;
  private baseY: number;
  private label?: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private world: World,
    public kind: ItemKind,
    x: number,
    y: number,
    emergeFromBlock = false
  ) {
    const size = kind === 'coin' ? 20 : kind === 'flag' ? 32 : 28;
    const h = kind === 'flag' ? 160 : size;
    this.body = createBody(x - size / 2, y - h, size, h);
    const tex = { elephant: 'fruit_elephant', drill: 'fruit_drill', coin: 'coin', flower: 'wonder_flower', seed: 'wonder_seed', flag: 'flag', checkpoint: 'checkpoint' }[kind];
    this.sprite = scene.add.image(0, 0, tex).setOrigin(0.5, 1).setDepth(emergeFromBlock ? 9 : 15);
    this.baseY = y;
    if (emergeFromBlock) this.emerging = 0.45;
    if (kind === 'flower') {
      this.label = scene.add.text(x, y - 60, 'WONDER FLOWER', { fontFamily: 'monospace', fontSize: '12px', color: '#fff7c2', stroke: '#6b2fb3', strokeThickness: 3 }).setOrigin(0.5).setDepth(15);
    }
    this.sync();
  }

  get isPhysical() {
    return this.kind === 'elephant' || this.kind === 'drill';
  }

  update(dt: number) {
    if (this.collected) return;
    this.t += dt;
    const b = this.body;
    if (this.emerging > 0) {
      this.emerging -= dt;
      b.y -= 70 * dt;
      if (this.emerging <= 0) {
        this.sprite.setDepth(15);
        b.vx = 60;
      }
      this.sync();
      return;
    }
    if (this.isPhysical) {
      b.vy = Math.min(b.vy + PHYSICS.GRAVITY_FALLING * dt, PHYSICS.TERMINAL_VELOCITY);
      this.world.moveAndCollide(b, dt);
      if (b.hitWall !== 0) b.vx = -Math.sign(b.hitWall) * 60;
      else if (b.vx === 0) b.vx = 60;
      if (b.y > this.world.heightPx + 64) this.collect();
    } else {
      // floating collectibles bob in place and ride the wave
      const col = Math.floor((b.x + b.w / 2) / this.world.tile);
      const wave = this.world.columnOffset(col);
      if (this.kind === 'flag' || this.kind === 'checkpoint') b.y = this.baseY - b.h + wave;
      else b.y = this.baseY - b.h + Math.sin(this.t * 3) * 4 + wave;
    }
    this.sync();
  }

  collect() {
    this.collected = true;
    this.label?.destroy();
    if (this.kind === 'flag' || this.kind === 'checkpoint') return;
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 40,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => this.sprite.destroy(),
    });
  }

  private sync() {
    const b = this.body;
    this.sprite.x = b.x + b.w / 2;
    this.sprite.y = b.y + b.h;
    if (this.kind === 'flower' || this.kind === 'seed') {
      this.sprite.setAngle(Math.sin(this.t * 4) * 12);
      this.sprite.setScale(1 + Math.sin(this.t * 6) * 0.08);
      if (this.label) this.label.y = this.sprite.y - 60;
    }
    if (this.kind === 'coin') this.sprite.setScale(Math.abs(Math.cos(this.t * 4)) * 0.8 + 0.2, 1);
  }
}

export const overlaps = (a: KinematicBody, b: KinematicBody) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

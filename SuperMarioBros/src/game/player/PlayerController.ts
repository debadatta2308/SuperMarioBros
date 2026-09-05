import Phaser from 'phaser';
import { createBody, InputState, KinematicBody, PHYSICS } from '../config/Constants';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/AudioManager';
import type { IBadge } from '../badges/IBadge';
import { createPowerUp, IPowerUp, PowerUpId } from '../powerups/PowerUps';

/** Services the player needs from the scene (kept as an interface for testability). */
export interface PlayerContext {
  scene: Phaser.Scene;
  world: World;
  audio: AudioManager;
  /** Defeat enemies overlapping the rect. Returns count hit. */
  hitEnemiesInRect(x: number, y: number, w: number, h: number, source: 'whip' | 'stomp'): number;
  /** A block was struck (from below or by trunk). `strong` = can break bricks. */
  onBlockHit(col: number, row: number, tile: number, strong: boolean): void;
  spawnDust(x: number, y: number, color: number): void;
  onPlayerDied(): void;
  onPowerUpChanged(id: PowerUpId): void;
}

const BASE_W = 24;
const BASE_H = 40;

export class PlayerController {
  readonly body: KinematicBody;
  readonly sprite: Phaser.GameObjects.Image;
  readonly gfx: Phaser.GameObjects.Graphics;
  readonly ctx: PlayerContext;

  facing: 1 | -1 = 1;
  /** True while ascending under the influence of a held jump (low gravity). */
  isJumping = false;
  burrowed = false;
  dead = false;
  invulnFrames = 0;

  powerUp: IPowerUp;
  badges: IBadge[] = [];

  private coyoteFrames = 0;
  private jumpBufferFrames = 0;
  private wasOnGround = false;
  private prevVy = 0;
  private baseScale = 1;
  private gliding = false;
  private parachute: Phaser.GameObjects.Image;
  private deathTimer = 0;
  private runAnimT = 0;

  constructor(ctx: PlayerContext, x: number, y: number) {
    this.ctx = ctx;
    this.body = createBody(x, y - BASE_H, BASE_W, BASE_H);
    this.sprite = ctx.scene.add.image(0, 0, 'mario_small').setOrigin(0.5, 1).setDepth(20);
    this.gfx = ctx.scene.add.graphics().setDepth(21);
    this.parachute = ctx.scene.add.image(0, 0, 'parachute').setOrigin(0.5, 1).setDepth(19).setVisible(false);
    this.powerUp = createPowerUp('small');
    this.syncSprite();
  }

  // ---------------------------------------------------------------- power-ups / badges
  setPowerUp(id: PowerUpId) {
    if (this.powerUp.id === id) return;
    this.powerUp.onExit(this);
    const next = createPowerUp(id);
    // resize hitbox anchored at the feet, keep inside geometry
    const feetY = this.body.y + this.body.h;
    const cx = this.body.x + this.body.w / 2;
    this.body.w = BASE_W * next.hitboxScale;
    this.body.h = BASE_H * next.hitboxScale;
    this.body.x = cx - this.body.w / 2;
    this.body.y = feetY - this.body.h;
    // if growing pushed us into a ceiling, nudge down is impossible (feet anchored) → nudge sideways/up handled by solver
    this.powerUp = next;
    this.baseScale = next.hitboxScale;
    this.sprite.setTexture(next.texture);
    this.sprite.setScale(this.baseScale);
    next.onEnter(this);
    this.ctx.onPowerUpChanged(id);
  }

  equipBadge(badge: IBadge) {
    this.badges.push(badge);
    badge.onEquip?.(this);
  }
  clearBadges() {
    for (const b of this.badges) b.onUnequip?.(this);
    this.badges = [];
  }

  // ---------------------------------------------------------------- damage
  hurt() {
    if (this.invulnFrames > 0 || this.dead || this.burrowed) return;
    if (this.powerUp.id !== 'small') {
      this.setPowerUp('small');
      this.invulnFrames = 100;
      this.ctx.audio.play('powerdown');
    } else {
      this.die();
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathTimer = 0;
    this.body.vy = -560;
    this.body.vx = 0;
    this.parachute.setVisible(false);
    this.ctx.audio.play('die');
    this.sprite.setDepth(50);
  }

  respawn(x: number, y: number) {
    this.dead = false;
    this.burrowed = false;
    this.powerUp.onExit(this);
    this.powerUp = createPowerUp('small');
    this.baseScale = 1;
    this.body.w = BASE_W;
    this.body.h = BASE_H;
    this.body.x = x - BASE_W / 2;
    this.body.y = y - BASE_H;
    this.body.vx = 0;
    this.body.vy = 0;
    this.invulnFrames = 90;
    this.sprite.setTexture('mario_small').setScale(1).setAlpha(1).setDepth(20).setAngle(0);
    this.ctx.onPowerUpChanged('small');
  }

  // ---------------------------------------------------------------- fixed-step update
  update(dt: number, input: InputState) {
    const b = this.body;

    if (this.dead) {
      this.deathTimer += dt;
      b.vy = Math.min(b.vy + PHYSICS.GRAVITY_FALLING * dt, PHYSICS.TERMINAL_VELOCITY);
      b.y += b.vy * dt;
      this.sprite.angle += 540 * dt;
      if (this.deathTimer > 1.6) this.ctx.onPlayerDied();
      this.syncSprite();
      return;
    }

    if (this.invulnFrames > 0) this.invulnFrames--;
    this.prevVy = b.vy;
    this.wasOnGround = b.onGround;

    // ---- power-up may take over the whole step (e.g. burrowed drill)
    if (input.actionPressed) this.powerUp.onAction(this, input);
    const handled = this.powerUp.onUpdate(this, dt, input);
    if (handled) {
      this.coyoteFrames = 0;
      this.jumpBufferFrames = 0;
      this.syncSprite();
      return;
    }

    // ---- horizontal kinematics
    const dir = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const maxSpeed = input.sprint ? PHYSICS.SPRINT_SPEED : PHYSICS.RUN_SPEED;
    const target = dir * maxSpeed;
    if (dir !== 0) this.facing = dir as 1 | -1;

    if (b.onGround) {
      if (dir === 0) {
        b.vx = approach(b.vx, 0, PHYSICS.GROUND_FRICTION * dt);
      } else if (Math.sign(b.vx) !== 0 && Math.sign(b.vx) !== dir) {
        // skidding: decelerate with friction before reversing
        b.vx = approach(b.vx, target, PHYSICS.GROUND_FRICTION * dt);
        if (Math.abs(b.vx) > 120 && Math.random() < 0.4) this.ctx.spawnDust(b.x + b.w / 2, b.y + b.h, 0xdddddd);
      } else if (Math.abs(b.vx) > maxSpeed) {
        // releasing sprint: bleed excess speed with friction
        b.vx = approach(b.vx, target, PHYSICS.GROUND_FRICTION * dt);
      } else {
        b.vx = approach(b.vx, target, PHYSICS.GROUND_ACCEL * dt);
      }
    } else {
      if (dir !== 0) b.vx = approach(b.vx, target, PHYSICS.AIR_ACCEL * dt);
      // no air friction — classic momentum retention
    }

    // ---- coyote time & jump buffer (frame counters at 60 Hz)
    if (b.onGround) this.coyoteFrames = PHYSICS.COYOTE_FRAMES;
    else if (this.coyoteFrames > 0) this.coyoteFrames--;

    if (input.jumpPressed) this.jumpBufferFrames = PHYSICS.JUMP_BUFFER_FRAMES;
    else if (this.jumpBufferFrames > 0) this.jumpBufferFrames--;

    if (this.jumpBufferFrames > 0 && this.coyoteFrames > 0) {
      this.jump(input);
    }

    // ---- variable-height gravity
    if (b.vy >= 0 || !input.jumpHeld) this.isJumping = false;
    const g = this.isJumping ? PHYSICS.GRAVITY_RISING : PHYSICS.GRAVITY_FALLING;
    b.vy = Math.min(b.vy + g * dt, PHYSICS.TERMINAL_VELOCITY);

    // ---- badge hooks (may clamp velocity — e.g. Parachute Cap)
    for (const badge of this.badges) badge.onUpdate?.(this, dt, input);

    // ---- integrate & resolve
    this.ctx.world.moveAndCollide(b, dt);

    if (b.hitCeiling) {
      this.isJumping = false;
      for (const badge of this.badges) badge.onCollision?.(this, 'ceiling');
      // strike the block closest to the head's centre
      const cx = b.x + b.w / 2;
      let best = b.ceilingTiles[0];
      let bestD = Infinity;
      for (const t of b.ceilingTiles) {
        const d = Math.abs(t.col * 32 + 16 - cx);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      if (best) this.ctx.onBlockHit(best.col, best.row, this.ctx.world.get(best.col, best.row), this.powerUp.id !== 'small');
    }
    if (b.hitWall !== 0) for (const badge of this.badges) badge.onCollision?.(this, 'wall', b.hitWall);

    // ---- landing
    if (b.onGround && !this.wasOnGround) {
      for (const badge of this.badges) badge.onCollision?.(this, 'ground');
      if (this.prevVy > PHYSICS.HARD_LANDING_VY) {
        this.squashStretch(1.3, 0.7);
        for (let i = 0; i < 4; i++) this.ctx.spawnDust(b.x + Math.random() * b.w, b.y + b.h, 0xdddddd);
      } else if (this.prevVy > 200) {
        this.squashStretch(1.12, 0.88);
      }
    }

    this.runAnimT += Math.abs(b.vx) * dt * 0.06;
    this.syncSprite();
  }

  /** Executes the jump: -620 px/s launch, squash-and-stretch, badge hook. */
  private jump(input: InputState) {
    const b = this.body;
    b.vy = PHYSICS.JUMP_VELOCITY;
    b.onGround = false;
    this.isJumping = true;
    this.coyoteFrames = 0;
    this.jumpBufferFrames = 0;
    this.squashStretch(0.8, 1.3);
    this.ctx.audio.play('jump');
    for (const badge of this.badges) badge.onJump?.(this, input);
  }

  /** Bounce off an enemy after a stomp. Holding jump gives extra height. */
  bounce(input?: InputState) {
    this.body.vy = input?.jumpHeld ? -520 : -360;
    this.isJumping = !!input?.jumpHeld;
    this.squashStretch(0.85, 1.2);
  }

  // ---------------------------------------------------------------- visuals
  /** Tween scale from (sx, sy) back to rest — feet-anchored via origin (0.5, 1). */
  squashStretch(sx: number, sy: number) {
    const s = this.baseScale;
    this.ctx.scene.tweens.killTweensOf(this.sprite);
    this.ctx.scene.tweens.add({
      targets: this.sprite,
      scaleX: { from: s * sx, to: s },
      scaleY: { from: s * sy, to: s },
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  flashTint(color: number) {
    this.sprite.setTint(color);
    this.ctx.scene.time.delayedCall(180, () => this.sprite.clearTint());
  }

  onGlideStart() {
    this.gliding = true;
    this.parachute.setVisible(true);
    this.parachute.setScale(0.2);
    this.ctx.scene.tweens.add({ targets: this.parachute, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
    this.ctx.audio.play('glide');
  }
  onGlideEnd() {
    this.gliding = false;
    this.parachute.setVisible(false);
  }

  private syncSprite() {
    const b = this.body;
    this.sprite.x = b.x + b.w / 2;
    this.sprite.y = b.y + b.h;
    this.sprite.setFlipX(this.facing < 0);
    // subtle run bob
    if (b.onGround && Math.abs(b.vx) > 30 && !this.dead) this.sprite.y -= Math.abs(Math.sin(this.runAnimT)) * 2;
    // invulnerability blink
    if (this.invulnFrames > 0 && !this.burrowed) this.sprite.setAlpha(Math.floor(this.invulnFrames / 4) % 2 === 0 ? 1 : 0.3);
    else if (!this.burrowed) this.sprite.setAlpha(1);
    if (this.gliding) {
      this.parachute.x = this.sprite.x + Math.sin(this.ctx.scene.time.now / 200) * 3;
      this.parachute.y = b.y - 2;
    }
    // overlays
    this.gfx.clear();
    this.powerUp.render?.(this.gfx, this);
  }

  get centerX() {
    return this.body.x + this.body.w / 2;
  }
  get centerY() {
    return this.body.y + this.body.h / 2;
  }
}

function approach(current: number, target: number, maxDelta: number) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

import type { InputState } from '../config/Constants';
import type { PlayerController } from '../player/PlayerController';
import type { IBadge, CollisionKind } from './IBadge';

/**
 * Parachute Cap: holding jump while falling caps downward velocity at 120 px/s.
 */
export class ParachuteCapBadge implements IBadge {
  readonly id = 'parachute-cap';
  readonly name = 'Parachute Cap';
  readonly description = 'Hold JUMP while falling to glide (fall speed capped at 120 px/s).';
  static readonly GLIDE_CAP = 120;

  gliding = false;

  onUpdate(player: PlayerController, _dt: number, input: InputState) {
    const b = player.body;
    const wantGlide = !b.onGround && b.vy > 0 && input.jumpHeld && !player.isJumping && !player.burrowed;
    if (wantGlide) {
      if (b.vy > ParachuteCapBadge.GLIDE_CAP) b.vy = ParachuteCapBadge.GLIDE_CAP;
      if (!this.gliding) player.onGlideStart();
      this.gliding = true;
    } else if (this.gliding) {
      this.gliding = false;
      player.onGlideEnd();
    }
  }

  onCollision(player: PlayerController, kind: CollisionKind) {
    if (kind === 'ground' && this.gliding) {
      this.gliding = false;
      player.onGlideEnd();
    }
  }

  onUnequip(player: PlayerController) {
    if (this.gliding) player.onGlideEnd();
    this.gliding = false;
  }
}

/**
 * Crouching High Jump: hold DOWN while grounded for 20 frames, then jump for a
 * boosted launch. Demonstrates the onJump hook.
 */
export class CrouchingHighJumpBadge implements IBadge {
  readonly id = 'crouch-high-jump';
  readonly name = 'Crouching High Jump';
  readonly description = 'Hold DOWN for a moment, then JUMP for a super-charged leap.';
  private charge = 0;

  onUpdate(player: PlayerController, _dt: number, input: InputState) {
    if (player.body.onGround && input.down && Math.abs(player.body.vx) < 20) this.charge = Math.min(this.charge + 1, 20);
    else if (!player.body.onGround) {
      /* keep charge until jump resolves */
    } else this.charge = 0;
  }

  onJump(player: PlayerController) {
    if (this.charge >= 20) {
      player.body.vy *= 1.45;
      player.flashTint(0x9be7ff);
    }
    this.charge = 0;
  }
}

export const ALL_BADGES: (() => IBadge)[] = [() => new ParachuteCapBadge(), () => new CrouchingHighJumpBadge()];

import type { InputState } from '../config/Constants';
import type { PlayerController } from '../player/PlayerController';

export type CollisionKind = 'ground' | 'ceiling' | 'wall' | 'enemy' | 'item';

/**
 * Extensible badge contract. Every hook is optional so badges only opt in to
 * the lifecycle points they care about.
 */
export interface IBadge {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  onEquip?(player: PlayerController): void;
  onUnequip?(player: PlayerController): void;

  /** Fired when the player leaves the ground via a jump. */
  onJump?(player: PlayerController, input: InputState): void;

  /**
   * Fired every fixed step *after* gravity but *before* the body is integrated,
   * so the badge may clamp or redirect velocity.
   */
  onUpdate?(player: PlayerController, dt: number, input: InputState): void;

  /** Fired when the kinematic solver reports a contact. */
  onCollision?(player: PlayerController, kind: CollisionKind, data?: unknown): void;
}

import Phaser from 'phaser';
import type { InputState } from '../config/Constants';

/**
 * Samples raw keyboard state once per render frame and exposes a per-fixed-step
 * snapshot. Edge events (JustDown) are latched so they are never lost when
 * several fixed steps run inside a single render frame.
 */
export class InputManager {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private pendingJump = false;
  private pendingAction = false;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.keys = kb.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      j: Phaser.Input.Keyboard.KeyCodes.J,
      z: Phaser.Input.Keyboard.KeyCodes.Z,
      k: Phaser.Input.Keyboard.KeyCodes.K,
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    // prevent page scroll on game keys
    kb.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);
  }

  /** Call once per render frame, before running fixed steps. */
  pollFrame() {
    const JD = Phaser.Input.Keyboard.JustDown;
    if (JD(this.keys.space) || JD(this.keys.w)) this.pendingJump = true;
    if (JD(this.keys.z) || JD(this.keys.k)) this.pendingAction = true;
  }

  /** Build a snapshot for one fixed step; edge flags are consumed. */
  snapshot(): InputState {
    const k = this.keys;
    const s: InputState = {
      left: k.left.isDown || k.a.isDown,
      right: k.right.isDown || k.d.isDown,
      up: k.up.isDown,
      down: k.down.isDown || k.s.isDown,
      sprint: k.shift.isDown || k.j.isDown,
      jumpHeld: k.space.isDown || k.w.isDown,
      jumpPressed: this.pendingJump,
      actionPressed: this.pendingAction,
      actionHeld: k.z.isDown || k.k.isDown,
    };
    this.pendingJump = false;
    this.pendingAction = false;
    return s;
  }
}

import Phaser from 'phaser';
import { WONDER } from '../config/Constants';
import type { World } from '../world/World';
import type { AudioManager } from '../audio/AudioManager';
import { WonderPostFX } from './WonderPostFX';

export type WonderState = 'idle' | 'freeze' | 'active' | 'ending';

/**
 * Orchestrates the Wonder Flower event:
 *   1. touch flower → 200 ms hard freeze of the simulation
 *   2. chromatic-aberration / palette-shift post-FX ramps in
 *   3. BGM tempo & timbre shift
 *   4. terrain mutation: per-column sine displacement of all tiles/pipes
 *   5. touching the Wonder Seed reverses everything smoothly
 */
export class WonderManager extends Phaser.Events.EventEmitter {
  state: WonderState = 'idle';
  private freezeMs = 0;
  private fx: WonderPostFX | null = null;
  private fxProxy = { intensity: 0 };
  private waveProxy = { amount: 0 };
  private elapsed = 0;

  constructor(
    private scene: Phaser.Scene,
    private world: World,
    private audio: AudioManager
  ) {
    super();
    const renderer = scene.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      if (!renderer.pipelines.postPipelineClasses.has(WonderPostFX.KEY)) {
        renderer.pipelines.addPostPipeline(WonderPostFX.KEY, WonderPostFX);
      }
    }
  }

  get isActive() {
    return this.state === 'active' || this.state === 'freeze';
  }
  get isFrozen() {
    return this.state === 'freeze';
  }
  get elapsedSeconds() {
    return this.elapsed;
  }

  // ---------------------------------------------------------------- start
  start() {
    if (this.state !== 'idle') return;
    this.state = 'freeze';
    this.freezeMs = WONDER.FREEZE_MS;
    this.elapsed = 0;

    const cam = this.scene.cameras.main;
    // attach post-fx
    if (this.scene.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      cam.setPostPipeline(WonderPostFX);
      const p = cam.getPostPipeline(WonderPostFX);
      this.fx = (Array.isArray(p) ? p[0] : p) as WonderPostFX;
      this.fx.intensity = 0;
    }

    cam.flash(220, 255, 255, 255);
    this.audio.play('wonder');
    this.emit('start');
  }

  private activate() {
    this.state = 'active';
    const cam = this.scene.cameras.main;
    cam.shake(350, 0.006);
    cam.zoomTo(1.06, 250, 'Quad.easeOut', false, (_c, progress) => {
      if (progress === 1) cam.zoomTo(1, 500, 'Sine.easeInOut');
    });

    // shader ramp
    this.scene.tweens.killTweensOf(this.fxProxy);
    this.scene.tweens.add({
      targets: this.fxProxy,
      intensity: 1,
      duration: 900,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        if (this.fx) this.fx.intensity = this.fxProxy.intensity;
      },
    });

    // terrain mutation ramp
    this.scene.tweens.killTweensOf(this.waveProxy);
    this.scene.tweens.add({
      targets: this.waveProxy,
      amount: 1,
      duration: 1200,
      ease: 'Sine.easeInOut',
      onUpdate: () => (this.world.waveAmount = this.waveProxy.amount),
    });

    // BGM tempo shift
    this.audio.setWonder(true);
    this.audio.setTempo(WONDER.BGM_TEMPO_WONDER);
    this.emit('active');
  }

  // ---------------------------------------------------------------- end
  end() {
    if (this.state !== 'active') return;
    this.state = 'ending';
    this.audio.play('wonderEnd');
    this.audio.setWonder(false);
    this.audio.setTempo(WONDER.BGM_TEMPO_NORMAL);
    const cam = this.scene.cameras.main;
    cam.flash(300, 255, 255, 255);

    this.scene.tweens.killTweensOf(this.fxProxy);
    this.scene.tweens.add({
      targets: this.fxProxy,
      intensity: 0,
      duration: 800,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        if (this.fx) this.fx.intensity = this.fxProxy.intensity;
      },
      onComplete: () => {
        cam.removePostPipeline(WonderPostFX.KEY);
        this.fx = null;
        this.state = 'idle';
        this.emit('end');
      },
    });
    this.scene.tweens.killTweensOf(this.waveProxy);
    this.scene.tweens.add({
      targets: this.waveProxy,
      amount: 0,
      duration: 900,
      ease: 'Sine.easeInOut',
      onUpdate: () => (this.world.waveAmount = this.waveProxy.amount),
    });
  }

  /** Real-time update (called every render frame, independent of the fixed loop). */
  update(deltaMs: number) {
    if (this.state === 'freeze') {
      this.freezeMs -= deltaMs;
      if (this.freezeMs <= 0) this.activate();
    }
    if (this.state === 'active') this.elapsed += deltaMs / 1000;
  }

  /** Hard reset (used on respawn). */
  reset() {
    this.scene.tweens.killTweensOf(this.fxProxy);
    this.scene.tweens.killTweensOf(this.waveProxy);
    this.fxProxy.intensity = 0;
    this.waveProxy.amount = 0;
    this.world.waveAmount = 0;
    this.scene.cameras.main.removePostPipeline(WonderPostFX.KEY);
    this.fx = null;
    this.audio.setWonder(false);
    this.audio.setTempo(WONDER.BGM_TEMPO_NORMAL);
    this.state = 'idle';
    this.emit('end');
  }
}

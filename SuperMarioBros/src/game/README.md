# Wonder Platformer — Phase 1 & 2 architecture

```
src/game/
├── GameConfig.ts              Phaser.Game factory (WebGL, 960×540, FIT scaling)
├── config/Constants.ts        Kinematic constants (60 Hz), tile IDs, KinematicBody, InputState
├── input/InputManager.ts      Latches JustDown edges so no press is lost across fixed steps
├── world/World.ts             Tile grid, wave-displaced collision solver, level authoring helpers
├── player/PlayerController.ts Kinematic controller: accel/friction/skid, variable jump,
│                              coyote time, jump buffer, squash & stretch, badge + power-up hooks
├── badges/IBadge.ts           Badge lifecycle contract (onJump / onUpdate / onCollision …)
├── badges/Badges.ts           ParachuteCapBadge (120 px/s glide cap), CrouchingHighJumpBadge
├── powerups/PowerUps.ts       IPowerUp + Small / Elephant (trunk whip) / Drill (burrow) states
├── wonder/WonderPostFX.ts     GLSL PostFXPipeline: chromatic aberration, hue shift, vignette
├── wonder/WonderManager.ts    Freeze → shader ramp → BGM tempo shift → terrain wave → seed restore
├── entities/Entities.ts       Enemy (Goombrat) and Item (fruits, coins, flower, seed, flag)
├── audio/AudioManager.ts      Web Audio step-sequencer BGM (live tempo) + synthesized SFX
└── scenes/
    ├── BootScene.ts           Procedural texture generation (no external assets)
    ├── GameScene.ts           Fixed-timestep loop, level layout, collisions, PlayerContext
    └── UIScene.ts             HUD + toasts
```

## Fixed timestep
`GameScene.update` accumulates render delta (clamped to 100 ms) and runs
`fixedStep(1/60)` until drained. All gameplay integrates with `dt = 1/60`;
tweens/camera FX run on the render clock. The Wonder freeze simply skips
fixed steps for 200 ms of wall-clock time.

## Dynamic hitboxes during Wonder
`World.columnOffset(col) = sin(col·32·0.05 + t·3)·16·waveAmount`.
Every collision query converts world Y to tile row **after** subtracting the
column's offset, so pipes/terrain collide exactly where they are drawn.
Bodies auto-step ledges ≤ 26 px and snap to ground within 24 px so they ride
the wave instead of snagging or bouncing.

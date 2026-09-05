# Project Progress & TODO

This document tracks the ongoing development of the SuperMarioBros project, outlining what has been completed (Phase 1 & 2) and what remains to be developed.

## Completed (Phase 1 & 2)

### Architecture & Setup
- [x] Initial project structure using Phaser 3.90 + TypeScript within a React/Vite shell.
- [x] Game Config implementation (WebGL/AUTO, 960x540, FIT).
- [x] Centralized constants (kinematics, tile IDs, states).
- [x] Boot, Game, and UI scene scaffolding.

### Core Mechanics & Physics
- [x] **InputManager**: Latches key edges to ensure presses survive multi-step frames.
- [x] **PlayerController**: Custom kinematic controller featuring:
  - 1/60s fixed integration step.
  - Run/Sprint (280/420), acceleration (1200), friction & skid (1400).
  - Variable gravity (1400 vs 2200) based on jump hold.
  - Coyote time (6 frames) and jump buffer (5 frames).
  - Visual squash-and-stretch tweens anchored to feet.
- [x] **World & Collision**:
  - Wavy terrain hitboxes using column offset `sin(x*0.05 + t*3)*16`.
  - Custom wave-aware AABB solver.
  - Auto-stepping over ≤26px ledges and snapping to ground within 24px.

### Power-Ups & Badges
- [x] **Power-Ups State Machine**:
  - Small Form.
  - Elephant Form: Scales hitbox 1.5x, trunk sweep arc to break bricks and launch enemies.
  - Drill Form: Burrow into floors and ceilings (invulnerability, travel through terrain, erupt mechanics).
- [x] **Badges System**:
  - Badge contract (`IBadge.ts`).
  - Parachute Cap: Clamps `vy` to 120.
  - Crouching High Jump.

### World Events & Audio
- [x] **Wonder Effects**:
  - Freeze mechanics (fixed steps skipped).
  - GLSL PostFX (chromatic aberration, hue shift, vignette).
  - BGM tempo shifts (128 -> 168 BPM) and synth layers.
  - Wonder Seed logic to smoothly reverse effects.
- [x] **Audio**: Web Audio step-sequencer BGM with live tempo + synth SFX.
- [x] **Extras**: 5-layer parallax, items (fruits, coins, flower, seed, checkpoint, flag), debug UI.

---

## To Develop (Next Phases)

### Additional Content
- [ ] Add more enemy varieties and specific enemy behaviors.
- [ ] Design and implement additional levels/stages.
- [ ] Implement a world map / level selection screen.
- [ ] Add boss encounters and custom boss logic.

### Gameplay Enhancements
- [ ] Introduce new power-ups (e.g., Fire Flower, Bubble, etc.).
- [ ] Implement additional badges with unique gameplay mechanics.
- [ ] Refine scoring system and add collectable coin tracking.
- [ ] Add persistent save state/progress tracking.

### UI & Polish
- [ ] Develop a main menu and pause screen.
- [ ] Polish game over and level complete sequences.
- [ ] Optimize mobile touch controls or gamepad support.
- [ ] Refine audio assets and expand the procedural chiptune system.

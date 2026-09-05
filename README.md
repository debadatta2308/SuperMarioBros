# SuperMarioBros

A highly advanced clone of the classic Super Mario Bros style mechanics, complete with modern features, built using Phaser 3.90 and TypeScript inside a React/Vite shell.

## Features

*   **Kinematic Player Controller**: Highly tuned physics including precise acceleration, friction, jumping mechanics (jump buffer, coyote time), variable gravity, and squash-and-stretch visual feedback.
*   **Dynamic Hitboxes & World**: Features a wave-aware AABB solver allowing for wavy terrain and pipes, auto-stepping over small ledges, and precise ground-snapping.
*   **Wonder Effects**: A powerful `WonderManager` controlling screen freezes, shader ramps (GLSL PostFXPipeline with chromatic aberration, hue shift, vignette), background music tempo adjustments, and terrain waves. 
*   **Power-Ups System**: Features state machine-driven power-ups including Small, Elephant (with a trunk sweep to break bricks and launch enemies), and Drill (burrow into floors and ceilings).
*   **Badges System**: Equipable badges altering mechanics, such as the Parachute Cap (clamping fall velocity) and Crouching High Jump.
*   **Extras**: 5-layer parallax scrolling, procedural chiptune audio step-sequencer, checkpoints, goal flags, and on-screen physics readouts.

## Prerequisites

*   Node.js (LTS version recommended)
*   npm (comes with Node.js)

## Installation

1. Clone this repository.
2. Navigate into the nested project directory (where `package.json` is located):
   ```bash
   cd SuperMarioBros
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```

## How to Run

To start the development server, run:

```bash
npm run dev
```

This will launch the game locally via Vite. The console will display the local URL (usually `http://localhost:5173`) where you can play the game.

## Controls & Debug Keys

*   **Movement**: Arrow Keys / WASD
*   **Jump**: Up Arrow / W / Space
*   **Crouch/Burrow Down (Drill)**: Down Arrow / S
*   **Burrow Up (Drill)**: Up Arrow / W (while against the ceiling)
*   **Action (Elephant Trunk)**: `Z` or `K`
*   **Cycle Badges**: `B`
*   **Debug Power-Up Hotkeys**: `1`, `2`, `3`
*   **Restart**: `R`
*   **Mute Audio**: `M` (Click game area first to unlock audio context)

import Phaser from 'phaser';

/**
 * Full-screen post-process applied to the main camera during a Wonder event.
 *   - radial chromatic aberration (RGB split grows with distance from centre)
 *   - continuous hue rotation ("palette shift") blended by intensity
 *   - horizontal sine wobble and a pulsing vignette
 * `uIntensity` is tweened 0→1 by the WonderManager so the effect eases in/out.
 */
const FRAG = /* glsl */ `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uIntensity;
uniform float uTime;
uniform vec2  uResolution;

varying vec2 outTexCoord;

// Rotate colour around the luminance axis (Rodrigues rotation on the RGB cube diagonal)
vec3 hueShift(vec3 color, float angle) {
  const vec3 k = vec3(0.57735, 0.57735, 0.57735);
  float c = cos(angle);
  float s = sin(angle);
  return color * c + cross(k, color) * s + k * dot(k, color) * (1.0 - c);
}

void main() {
  vec2 uv = outTexCoord;
  vec2 centred = uv - 0.5;
  float dist = length(centred);
  vec2 dir = dist > 0.0001 ? centred / dist : vec2(0.0);

  // horizontal wobble
  float wobble = sin(uTime * 3.0 + uv.y * 24.0) * 0.0025 * uIntensity;
  uv.x += wobble;

  // chromatic aberration
  float ab = uIntensity * (0.003 + 0.014 * dist);
  float r = texture2D(uMainSampler, uv + dir * ab).r;
  float g = texture2D(uMainSampler, uv).g;
  float b = texture2D(uMainSampler, uv - dir * ab).b;
  vec3 col = vec3(r, g, b);

  // palette shift: slow rotating hue + brightness lift
  float angle = (uTime * 0.9 + dist * 2.0) ;
  vec3 shifted = hueShift(col, angle);
  col = mix(col, shifted, uIntensity * 0.8);
  col = mix(col, col * 1.15 + 0.03, uIntensity);

  // pulsing vignette
  float pulse = 0.5 + 0.5 * sin(uTime * 6.0);
  float vig = 1.0 - smoothstep(0.45, 0.85, dist) * uIntensity * (0.45 + 0.2 * pulse);
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class WonderPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  static readonly KEY = 'WonderPostFX';
  intensity = 0;
  private t = 0;

  constructor(game: Phaser.Game) {
    super({ game, name: WonderPostFX.KEY, fragShader: FRAG });
  }

  onPreRender() {
    this.t = this.game.loop.time / 1000;
    this.set1f('uIntensity', this.intensity);
    this.set1f('uTime', this.t);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
  }
}

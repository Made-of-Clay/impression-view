# Implementation Plan: Real-Time Painterly Shader with Webcam Support

Based on Tutorial.md and Transcript.md, this plan outlines the full implementation of a Three.js post-processing shader that transforms video or rendered scenes into animated painterly strokes.

## Phase 0: Webcam Setup (NEW - Requirement)

- Initialize `VideoTexture` from `navigator.mediaDevices.getUserMedia()`
- Configure texture with `flipY = true` (webcam default orientation)
- Set autoUpdate = false for manual control
- Wire webcam feed into Three.js scene as `tSource` uniform
- Fallback: static test pattern if webcam unavailable
- Performance: cap at 640x480 resolution for realtime frame rates
- Handle user permission gracefully (denial state)

## Phase 1: Foundation (Tutorial.md Steps 1-3)

- **Step 1**: Set up `WebGLRenderTarget` + `EffectComposer` to render scene/video to `tSource` texture
    - Create render target with appropriate size and depth buffer settings
    - Configure EffectComposer with fullscreen quad pass
- **Step 2**: Implement basic procedural Voronoi in GLSL (per Tutorial.md §2)
    - Hash function: `float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`
    - Per-cell point generation with time animation
    - 9-neighbor evaluation (cell + 8 neighbors) for continuous field
    - Each pixel only evaluates 9 candidate strokes for performance
- **Step 3**: Add time animation via `randomPoint(cell, time)` (per Tutorial.md §3)
    ```glsl
    vec2 randomPoint(vec2 cell, float time) {
        vec2 p = vec2(hash(cell), hash(cell + 42.0));
        return p + 0.2 * sin(time + p * 6.28318);
    }
    ```
    - Strokes shift over time continuously
    - Canvas repaints itself each frame

## Phase 2: Stroke Direction (Tutorial.md Steps 4-6)

- **Step 4**: Image gradient calculation (per Tutorial.md §4)
    - Convert to grayscale: `float luminance(vec3 color) { return dot(color, vec3(0.299, 0.587, 0.114)); }`
    - Sample neighbors: left/right/up/down with step dx, dy
    - Compute gradient: `vec2 gradient = vec2(right - left, up - down)`
    - Stroke direction perpendicular to gradient:
        ```glsl
        vec2 strokeDir = normalize(vec2(-gradient.y, gradient.x));
        ```
- **Step 5**: Rotate strokes using angle from gradient (per Tutorial.md §5)
    - `float angle = atan(strokeDir.y, strokeDir.x);`
    - Rotation matrix: `mat2 rotate(float a) { ... }`
    - Apply: `localUv = rotate(angle) * localUv;`
- **Step 6**: Blur gradient for smooth flow (per Tutorial.md §6)
    - Use mipmap level: `vec4 blurred = textureLod(tSource, uv, 3.0);`
    - Calculate gradient from blurred version
    - Prevents stroke direction flicker from small changes

## Phase 3: Stroke Shape (Tutorial.md Steps 7-8)

- **Step 7**: Replace circles with stretched rectangles (per Tutorial.md §7)
    - `vec2 p = localUv; p.x *= strokeAspectRatio;`
    - Brush mask from texture: `float mask = texture(tBrush, brushUv).r;`
    - Threshold: `mask = smoothstep(0.4, 0.7, mask);`
    - Brush textures: noise, scratched metal, fabric, hand-painted grayscale
- **Step 8**: Add procedural variation per Voronoi cell (per Tutorial.md §8)
    - Per-cell random parameters: `float length = mix(0.8, 1.2, random1);`
    - `float width = mix(0.8, 1.2, random2);`
    - `float curve = random3;`
    - Vary: length, width, curvature, texture offset, opacity, rotation
    - Strokes look like consistent brush work by a hurried human

## Phase 4: Multi-Layer Detail (Tutorial-md Steps 9-10)

- **Step 9**: Paint in layers (per Tutorial.md §9)
    - Layer 1: large strokes
    - Layer 2: medium strokes
    - Layer 3: small strokes
    - Layer 4: tiny detail strokes
    - Accumulate: `color = paintLayer(largeGrid, color); color = paintLayer(mediumGrid, color);`
- **Step 10**: Detect high-detail areas (per Tutorial.md §10)
    - Gradient magnitude: `float detail = length(gradient);`
    - Threshold: `float detailMask = smoothstep(lowThreshold, highThreshold, detail);`
    - Low-detail → large strokes, High-detail → small strokes
    - **Critical**: Calculate detail decision for each Voronoi neighbor, not just final pixel
    - Use lower-resolution gradient for natural transitions

## Phase 5: Color & Impasto (Tutorial.md Steps 11-15)

- **Step 11**: Color manipulation (per Tutorial.md §11)
    - Sample source color: `vec3 color = texture(tSource, strokeSampleUv).rgb;`
    - Controls: increase saturation, contrast, hue shift, complementary colors, palette quantization
    - Simple palette function for controlled variation
- **Step 12**: 3D LUT color grading (per Tutorial.md §12)
    - LUT remaps RGB → different color space
    - Useful for emotional palettes
    - Three.js: 3D LUT as texture-based lookup
    - Reference: Three.js color management manual
- **Step 13**: Impasto height map (per Tutorial.md §13)
    - Reuse brush mask: `float height = texture(tBrush, brushUv).r;`
    - SDF rectangle to reduce height near stroke edges
    - Thick center, tapered edges
    - Combine: `height *= strokeMask; height *= edgeFalloff;`
- **Step 14**: Normals from height (per Tutorial.md §14)
    - Neighborhood samples: `float hx = heightAt(uv + vec2(dx, 0.0)) - heightAt(uv - vec2(dx, 0.0));`
    - `float hy = heightAt(uv + vec2(0.0, dy)) - heightAt(uv - vec2(0.0, dy));`
    - Normal: `vec3 normal = normalize(vec3(-hx, -hy, 1.0));`
    - Same gradient technique as earlier
- **Step 15**: Lighting (per Tutorial.md §15)
    - Diffuse: `float diffuse = max(dot(normal, lightDir), 0.0);`
    - Specular: `vec3 halfDir = normalize(lightDir + viewDir);`
    - `float specular = pow(max(dot(normal, halfDir), 0.0), shininess);`
    - Flat shader now has simulated raised paint catching light

## Phase 6: Temporal Effects (Tutorial.md Steps 16-18)

- **Step 16**: Motion detection (per Tutorial.md §16)
    - Compare frames: `vec3 current = texture(tCurrent, uv).rgb;`
    - `vec3 previous = texture(tPrevious, uv).rgb;`
    - `float motion = length(current - previous);`
    - Threshold: `float motionMask = step(motionThreshold, motion);`
    - Repaint primarily where movement occurs
    - Ideal for: webcams, static backgrounds, green-screen, still game environments
- **Step 17**: Motion ghosting (per Tutorial.md §17)
    - Keep history: `ghost = max(currentMotion, previousGhost * decay);`
    - Concept: detected → strong mask → weaker mask → weaker mask → gone
    - Gives algorithm several frames to repaint changed regions
    - Especially useful: webcam in empty room, green-screen effects
- **Step 18**: Directional paint blending (per Tutorial.md §18)
    - Keep previous painted frame: `vec3 oldPaint = texture(tPreviousPaint, uv).rgb;`
    - Mix: `vec3 newColor = mix(strokeColor, oldPaint, paintBlendAmount);`
    - Better results: sample along stroke direction AND perpendicular
    - Creates illusion: paint remains on brush, smears along stroke, adjacent strokes share pigment
    - Sample: `texture(tPreviousPaint, uv + strokeDir * distance)`

## Core Architecture

- Modular GLSL functions (per Tutorial.md §522-520):
    - `vec2 gradient(vec2 uv);`
    - `vec2 strokeDirection(vec2 uv);`
    - `float strokeMask(vec2 localUv, vec2 cell, float angle);`
    - `float detailAmount(vec2 uv);`
    - `vec3 sampleStrokeColor(vec2 uv);`
    - `vec3 applyColorStyle(vec3 color);`
    - `float strokeHeight(vec2 uv);`
    - `vec3 heightNormal(vec2 uv);`
    - `vec3 lightPaint(vec3 color, vec3 normal);`
    - `vec3 paintLayer(vec2 uv, float gridScale, vec3 previousColor);`

## Main Shader Loop (per Tutorial.md §524-542)

```glsl
void main() {
    vec3 color = texture(tPreviousPaint, vUv).rgb;
    color = paintLayer(vUv, 8.0, color);
    color = paintLayer(vUv, 16.0, color);
    color = paintLayer(vUv, 32.0, color);
    color = applyColorStyle(color);
    vec3 normal = heightNormal(vUv);
    color = lightPaint(color, normal);
    gl_FragColor = vec4(color, 1.0);
}
```

## Recommended Build Order (per Tutorial.md §544-563)

1. Source texture → colored circles
2. Circles → animated Voronoi
3. Add stretched strokes
4. Add gradient-based rotation
5. Blur/mipmap the direction field
6. Add textured brush masks
7. Add multi-scale layers
8. Add detail masking
9. Add color manipulation/LUTs
10. Add height maps
11. Add lighting
12. Add previous-frame accumulation
13. Add motion detection and ghosting
14. Add directional paint blending

## Key Insight (Tutorial.md §563)

| What          | Decides               |
| ------------- | --------------------- |
| Voronoi field | where strokes are     |
| gradients     | which way they go     |
| detail        | how large they are    |
| temp buffers  | when/how they repaint |

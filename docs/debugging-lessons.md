# Debugging Lessons

## Three.js ShaderMaterial gotchas

- **Never name custom functions the same as Three.js built-ins.** `luminance`, `saturation`, `toneMapping`, etc. are auto-prepended to your fragment shader. A collision silently breaks compilation — the only signal is `THREE.WebGLProgram: Shader Error` in console, followed by `useProgram: program not valid` / `drawElements: no valid shader program` warnings.

- **`textureLod(sampler, uv, lod)` requires 3 args; `texture2D(sampler, uv)` takes 2.** Replacing one with the other without adjusting arg count breaks GLSL. Both become `texture()` in WebGL2 via Three.js auto-conversion, but `texture()` only takes 2 args.

- **Standard renderer setup:** Don't manually create a canvas. Use `new WebGLRenderer({...})`, call `renderer.setSize()`, append `renderer.domElement`.

- **`video.play()` rejects on autoplay policy** even with a valid webcam stream. `VideoTexture` reads frames from the element directly, so fire play without await and catch silently: `video.play().catch(() => {})`.

- **`ShaderMaterial` defaults to front-face only.** Use `side: DoubleSide` for rotating objects where back face becomes visible.

## Playwright for WebGL debugging

The two WebGL `INVALID_OPERATION` warnings are **symptoms, not causes**. The actual shader error is logged by Three.js as `THREE.WebGLProgram: Shader Error` and is only visible in a real browser console. Playwright captures it:

```js
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({/* ... */});
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("console", (msg) => console.log(`[${msg.type()}] ${msg.text()}`));
await page.goto(server.resolvedUrls.local[0], { waitUntil: "networkidle" });
// ... screenshot, cleanup
```

## Voronoi shader pitfalls

- **Soft masks make strokes invisible.** A common mistake: `mix(prev, strokeColor, mask * 0.5)` with a gradual smoothstep. The stroke blends too smoothly into neighboring pixels and disappears. Use a sharp radius (`smoothstep(radius - 0.08, radius, dist)`) and full opacity blend to create visible cell boundaries.

- **Mixing with source color undoes Voronoi.** `mix(voronoiColor, sourceColor, 0.5)` every frame reconstructs the original image — the strokes vanish. Keep temporal blends subtle (5-10%) just to reduce flicker, not to composite.

- **Per-cell tint is needed for variation.** Without per-cell random color modulation, adjacent Voronoi cells sample similar source colors and look like a smooth gradient. A small `hash(cell)`-based tint (`0.85–1.15` range) makes each stroke visually distinct.

- **Grid scale controls stroke size.** `paintLayer(uv, 8.0, color)` = large strokes, `16.0` = medium, `32.0` = small. Layer them large-to-small so fine detail paints over broad strokes.

- **The Voronoi distance field IS the brush shape.** Each pixel finds its nearest Voronoi point; the distance `minDist` determines whether the pixel is inside the stroke (mask=1) or outside (mask=0). The `smoothstep` radius controls the hard/soft edge of the painted patch.

## Feature layer architecture

- **Use `bool` uniforms for feature toggles.** GLSL `if (uFeature)` compiles both branches but the GPU skips the disabled one. Clean way to isolate effects without commenting code.

- **Name layers with numeric prefixes** (`L1 Voronoi`, `L2 Stroke Direction`...) so the GUI panel sorts them in implementation order. Makes it easy to A/B test any single layer.

- **Default to only the base layer on.** Starting with everything off except the foundation lets you verify each layer independently as you build. Toggling layers on one at a time catches interactions early.

- **lil-gui `onChange` writes directly to `uniform.value`.** No intermediate state — the uniform IS the source of truth. The GUI object (`features`) is just a plain object lil-gui mutates; the callback pushes the value into the shader uniform.

- **`as const` on label/uniform arrays** lets TypeScript infer literal types in the loop, avoiding `string` vs specific key errors when indexing `shaderMaterial.uniforms`.

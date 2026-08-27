# Debugging Lessons

## Three.js ShaderMaterial gotchas

- **Never name custom functions the same as Three.js built-ins.** `luminance`, `saturation`, `toneMapping`, etc. are auto-prepended to your fragment shader. A collision silently breaks compilation — the only signal is `THREE.WebGLProgram: Shader Error` in console, followed by `useProgram: program not valid` / `drawElements: no valid shader program` warnings.

- **`textureLod(sampler, uv, lod)` requires 3 args; `texture2D(sampler, uv)` takes 2.** Replacing one with the other without adjusting arg count breaks GLSL. Both become `texture()` in WebGL2 via Three.js auto-conversion, but `texture()` only takes 2 args.

- **Standard renderer setup:** Don't manually create a canvas. Use `new WebGLRenderer({...})`, call `renderer.setSize()`, append `renderer.domElement`.

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

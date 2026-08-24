# Three.js Tutorial: Realtime Moving-Painting Shader

[Source Transcript](./Transcript.md)

## Goal

Build a fullscreen post-processing shader that turns video or a rendered Three.js scene into animated painterly strokes.

Main ideas:

1. Procedural Voronoi strokes
2. Stroke direction from image gradients
3. Multiple levels of detail
4. Painterly color grading
5. Impasto height + lighting
6. Temporal accumulation, motion detection, and blending

Useful Three.js reference: [Three.js documentation](https://threejs.org/docs/) and [Three.js examples](https://threejs.org/examples/).

## 1. Render the Source to a Texture

Your shader needs the previous scene/video as a texture.

```glsl
uniform sampler2D tSource;
uniform vec2 uResolution;

vec4 source = texture(tSource, vUv);
```

In Three.js, this is typically done with…

* `WebGLRenderTarget`
* `EffectComposer`
* a fullscreen post-processing pass

For video, use `VideoTexture`.

[VideoTexture docs](https://threejs.org/docs/?utm_source=chatgpt.com#api/en/textures/VideoTexture)

## 2. Start With Random Paint Strokes

The naive approach:

* Generate random circles.
* Sample the source color beneath each circle.
* Accumulate circles over time.

The problem: drawing thousands of individual strokes is expensive.

Instead, use **procedural Voronoi**.

Each fragment checks nearby Voronoi cells and determines which animated point is closest.

```glsl
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
```

For each cell:

* Generate one pseudo-random stroke position.
* Animate that position with time.
* Check the current cell plus its 8 neighbors.
* Use the nearest point as the current stroke.

That gives an effectively continuous field while each pixel only evaluates nine candidate strokes.

## 3. Animate the Voronoi Strokes

Add time to the point-generation function:

```glsl
vec2 randomPoint(vec2 cell, float time) {
    vec2 p = vec2(
        hash(cell),
        hash(cell + 42.0)
    );

    return p + 0.2 * sin(time + p * 6.28318);
}
```

The results:

* Strokes shift over time.
* The canvas continuously repaints.
* You avoid explicitly drawing thousands of objects.

# Stroke Direction

## 4. Calculate the Image Gradient

Painting strokes should generally follow the structure of the image.

Convert the sampled image to grayscale:

```glsl
float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}
```

Sample neighboring pixels:

```glsl
float left  = luminance(texture(tSource, uv - vec2(dx, 0.0)).rgb);
float right = luminance(texture(tSource, uv + vec2(dx, 0.0)).rgb);

float down = luminance(texture(tSource, uv - vec2(0.0, dy)).rgb);
float up   = luminance(texture(tSource, uv + vec2(0.0, dy)).rgb);

vec2 gradient = vec2(right - left, up - down);
```

The gradient points across the strongest brightness change.

The painting direction should be **perpendicular**:

```glsl
vec2 strokeDir = normalize(vec2(
    -gradient.y,
     gradient.x
));
```

## 5. Rotate Each Stroke

Convert the direction into an angle:

```glsl
float angle = atan(strokeDir.y, strokeDir.x);
```

Then rotate local stroke coordinates:

```glsl
mat2 rotate(float a) {
    float c = cos(a);
    float s = sin(a);

    return mat2(
        c, -s,
        s,  c
    );
}
```

```glsl
localUv = rotate(angle) * localUv;
```

Now strokes flow along image contours instead of remaining vertically aligned.

## 6. Blur the Gradient

Raw gradients are noisy.

Small changes cause stroke directions to flicker.

A cheap solution is sampling a lower mip level:

```glsl
vec4 blurred = textureLod(tSource, uv, 3.0);
```

Calculate the gradient from that blurred version.

Conceptually:

> Blur the image → calculate the gradient → use that direction for strokes.

This produces smoother, more flowing brush directions.

# Building a Better Stroke

## 7. Replace Circles With Textured Rectangles

Start with a stretched rectangle.

```glsl
vec2 p = localUv;

p.x *= strokeAspectRatio;
```

Use a texture as an irregular paint mask:

```glsl
float mask = texture(tBrush, brushUv).r;
```

Then threshold it:

```glsl
mask = smoothstep(0.4, 0.7, mask);
```

The brush texture can be:

* Noise
* Scratched metal
* Fabric
* A hand-painted grayscale brush texture

Add procedural distortion so every stroke is slightly different.

## 8. Add Stroke Variation

Useful random parameters per Voronoi cell:

```glsl
float length = mix(0.8, 1.2, random1);
float width  = mix(0.8, 1.2, random2);
float curve  = random3;
```

Use them to vary:

* Length
* Width
* Curvature
* Texture offset
* Opacity
* Rotation

Avoid completely random strokes. They should look like they were made with a consistent brush by a hurried human.

# Multiple Levels of Detail

## 9. Paint in Layers

A single large Voronoi grid loses detail.

A single tiny grid is expensive and visually flat.

Instead, paint several layers:

```
Layer 1: large strokes
Layer 2: medium strokes
Layer 3: small strokes
Layer 4: tiny detail strokes
```

Conceptually:

```glsl
color = paintLayer(largeGrid, color);
color = paintLayer(mediumGrid, color);
color = paintLayer(smallGrid, color);
```

But don't paint every layer everywhere.

## 10. Detect High-Detail Areas

Use gradient magnitude:

```glsl
float detail = length(gradient);
```

Threshold it:

```glsl
float detailMask = smoothstep(
    lowThreshold,
    highThreshold,
    detail
);
```

Then:

* Low-detail areas → large strokes.
* High-detail areas → small strokes.

Important: calculate the detail decision for **each Voronoi neighbor**, not just the final pixel. Otherwise neighboring Voronoi regions can produce visible discontinuities.

A lower-resolution gradient helps spread the detail regions and creates more natural transitions.

# Color

## 11. Don't Always Use Exact Source Colors

Sample the source color:

```glsl
vec3 color = texture(tSource, strokeSampleUv).rgb;
```

Then modify it.

Possible controls:

* Increase saturation.
* Increase contrast.
* Shift hues.
* Push complementary colors.
* Quantize to a limited palette.

A simple palette-style function can produce controlled variation.

## 12. Support LUT Color Grading

A LUT remaps input RGB colors into a different color space.

```
source color
    ↓
LUT lookup
    ↓
painterly color
```

This is useful for giving the entire scene a particular emotional palette.

For Three.js, a 3D LUT can be represented as a texture-based lookup depending on the implementation.

[Three.js color management manual](https://threejs.org/manual/en/color-management.html?utm_source=chatgpt.com)

# Impasto

## 13. Turn the Brush Into a Height Map

Reuse the brush mask:

```glsl
float height = texture(tBrush, brushUv).r;
```

Add a rectangular SDF to reduce height near the stroke edges.

This makes the center thick while the edges taper down.

Conceptually:

```
       thick paint
     ╱──────────╲
____╱            ╲____ canvas
```

Combine:

```glsl
height *= strokeMask;
height *= edgeFalloff;
```

## 14. Calculate Normals From Height

Use neighboring height samples:

```glsl
float hx = heightAt(uv + vec2(dx, 0.0))
         - heightAt(uv - vec2(dx, 0.0));

float hy = heightAt(uv + vec2(0.0, dy))
         - heightAt(uv - vec2(0.0, dy));
```

Create a normal:

```glsl
vec3 normal = normalize(vec3(-hx, -hy, 1.0));
```

This is essentially the same gradient idea used earlier.

## 15. Add Lighting

Use standard diffuse lighting:

```glsl
float diffuse = max(dot(normal, lightDir), 0.0);
```

Then optionally add specular:

```glsl
vec3 halfDir = normalize(lightDir + viewDir);

float specular = pow(
    max(dot(normal, halfDir), 0.0),
    shininess
);
```

Now your flat fullscreen shader has simulated raised paint catching light.

# Temporal Effects

## 16. Detect Motion

Compare the current frame with the previous frame:

```glsl
vec3 current = texture(tCurrent, uv).rgb;
vec3 previous = texture(tPrevious, uv).rgb;

float motion = length(current - previous);
```

Threshold it:

```glsl
float motionMask = step(motionThreshold, motion);
```

Use this to repaint primarily where movement occurs.

This works especially well for:

* Webcams
* Static backgrounds
* Green-screen scenes
* Mostly still game environments

## 17. Add Motion Ghosting

A one-frame motion mask disappears too quickly.

Keep some history:

```glsl
ghost = max(currentMotion, previousGhost * decay);
```

Conceptually:

```
motion detected
      ↓
strong mask
      ↓
weaker mask
      ↓
weaker mask
      ↓
gone
```

This gives the painterly algorithm several frames to repaint changed regions.

# Paint Blending

## 18. Blend With the Previous Canvas

Keep the previous painted frame:

```glsl
vec3 oldPaint = texture(tPreviousPaint, uv).rgb;
```

Mix some of it into the new stroke:

```glsl
vec3 newColor = mix(
    strokeColor,
    oldPaint,
    paintBlendAmount
);
```

For better results, sample along:

* The stroke direction.
* The perpendicular direction.

```glsl
vec3 along = texture(
    tPreviousPaint,
    uv + strokeDir * distance
).rgb;
```

This creates the illusion that:

* Paint remains on the brush.
* Paint smears along the stroke.
* Adjacent strokes share pigment.

# Suggested Shader Architecture

Split the implementation into functions:

```glsl
vec2 gradient(vec2 uv);
vec2 strokeDirection(vec2 uv);

float strokeMask(
    vec2 localUv,
    vec2 cell,
    float angle
);

float detailAmount(vec2 uv);

vec3 sampleStrokeColor(vec2 uv);

vec3 applyColorStyle(vec3 color);

float strokeHeight(vec2 uv);

vec3 heightNormal(vec2 uv);

vec3 lightPaint(
    vec3 color,
    vec3 normal
);

vec3 paintLayer(
    vec2 uv,
    float gridScale,
    vec3 previousColor
);
```

Then:

```glsl
void main() {

    vec3 color = texture(tPreviousPaint, vUv).rgb;

    color = paintLayer(vUv, 8.0,  color);
    color = paintLayer(vUv, 16.0, color);
    color = paintLayer(vUv, 32.0, color);

    // Color grading
    color = applyColorStyle(color);

    // Impasto lighting
    vec3 normal = heightNormal(vUv);
    color = lightPaint(color, normal);

    gl_FragColor = vec4(color, 1.0);
}
```

## Recommended Build Order

Don't build everything at once.

1. Source texture → colored circles.
2. Circles → animated Voronoi.
3. Add stretched strokes.
4. Add gradient-based rotation.
5. Blur/mipmap the direction field.
6. Add textured brush masks.
7. Add multi-scale layers.
8. Add detail masking.
9. Add color manipulation/LUTs.
10. Add height maps.
11. Add lighting.
12. Add previous-frame accumulation.
13. Add motion detection and ghosting.
14. Add directional paint blending.

**Core idea:** treat the effect less like rendering a filter and more like running a tiny, procedural painter every frame. The Voronoi field decides *where strokes are*, gradients decide *which way they go*, detail decides *how large they are*, and temporal buffers decide *when and how they repaint*.

| What          | Decides               |
| ------------- | --------------------- |
| Voronoi field | where strokes are     |
| gradients     | which way they go     |
| detail        | how large they are    |
| temp buffers  | when/how they repaint |

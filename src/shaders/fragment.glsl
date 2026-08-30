precision highp float;
varying vec2 vUv;
uniform sampler2D tSource;
uniform vec2 uResolution;
uniform bool uVoronoi;
uniform bool uStrokeDirection;
uniform bool uColorGrade;
uniform bool uImpasto;
uniform bool uTemporal;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 randomPoint(vec2 cell) {
  return vec2(hash(cell), hash(cell + 42.0));
}

mat2 rotate(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

float getLuminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

vec2 computeGradient(vec2 uv) {
  vec2 texel = 1.0 / uResolution;
  float lumLeft  = getLuminance(textureLod(tSource, uv + vec2(-texel.x * 4.0, 0.0), 3.0).rgb);
  float lumRight = getLuminance(textureLod(tSource, uv + vec2( texel.x * 4.0, 0.0), 3.0).rgb);
  float lumUp    = getLuminance(textureLod(tSource, uv + vec2(0.0,  texel.y * 4.0), 3.0).rgb);
  float lumDown  = getLuminance(textureLod(tSource, uv + vec2(0.0, -texel.y * 4.0), 3.0).rgb);
  vec2 grad = vec2(lumRight - lumLeft, lumUp - lumDown);
  return normalize(vec2(-grad.y, grad.x) + 0.0001);
}

vec3 paintLayer(vec2 uv, float gridScale, vec3 previousColor, float strokeAngle) {
  vec2 scaledUv = uv * gridScale;
  vec2 n = floor(scaledUv);
  vec2 f = fract(scaledUv);

  float f1 = 1e10;
  float f2 = 1e10;
  vec2 closestCell = vec2(0.0);

  // Find nearest and second-nearest feature points
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 neighbor = vec2(float(i), float(j));
      vec2 cellId = n + neighbor;
      vec2 point = randomPoint(cellId);
      vec2 diff = neighbor + point - f;
      float d = length(diff);

      if (d < f1) {
        f2 = f1;
        f1 = d;
        closestCell = cellId;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }

  // Feature point position in UV space
  vec2 featurePointUV = (closestCell + randomPoint(closestCell)) / gridScale;

  // Sample source texture at the feature point
  vec3 strokeColor = texture2D(tSource, featurePointUV).rgb;

  // Cell edge detection: F2 - F1 = distance to nearest boundary
  float edgeDist = f2 - f1;

  // Edge mask: cells are fully colored, edges get subtle darkening
  float edgeMask = smoothstep(0.0, 0.12, edgeDist);

  // Cell color with edge darkening for visible stroke outlines
  vec3 result = strokeColor * mix(0.65, 1.0, edgeMask);

  // Blend: each layer fully replaces previous where cells exist
  float blendStrength = 0.85 + 0.15 * hash(closestCell + 300.0);
  return mix(previousColor, result, blendStrength);
}

void main() {
  vec3 sourceColor = texture2D(tSource, vUv).rgb;

  // Compute stroke direction once per pixel
  float strokeAngle = 0.0;
  if (uStrokeDirection) {
    vec2 grad = computeGradient(vUv);
    strokeAngle = atan(grad.y, grad.x);
  }

  vec3 color = sourceColor;

  // Layer 1: Voronoi strokes
  if (uVoronoi) {
    color = paintLayer(vUv, 8.0, color, strokeAngle);
    color = paintLayer(vUv, 16.0, color, strokeAngle);
    color = paintLayer(vUv, 32.0, color, strokeAngle);
  }

  // Layer 3: Color grading
  if (uColorGrade) {
    float l = getLuminance(color);
    color = mix(vec3(l), color, 1.3);
  }

  // Layer 4: Impasto height (reuse stroke angle)
  if (uImpasto) {
    vec2 localUv = rotate(strokeAngle) * (vUv - 0.5) + 0.5;
    localUv.x *= 1.2;
    float brushMask = hash(floor(localUv * 64.0));
    brushMask = smoothstep(0.3, 0.7, brushMask);
    float h = brushMask;
    h *= 1.0 - abs(localUv.x - 0.5) * 2.0;
    color += h * 0.08;
  }

  // Layer 5: Temporal blend
  if (uTemporal) {
    color = mix(color, sourceColor, 0.1);
  }

  gl_FragColor = vec4(color, 1.0);
}

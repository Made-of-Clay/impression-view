import * as THREE from 'three';
import {
    Mesh,
    PlaneGeometry,
    ShaderMaterial,
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    Color,
    Vector2,
} from 'three';
import { initWebcam, stopWebcam } from './webcam';
import { getGui } from './getGui';
import './style.css';

const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color(0x0a0a0f);
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

const vertexShader = `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSource;
uniform vec2 uResolution;
uniform float uTime;
uniform bool uVoronoi;
uniform bool uStrokeDirection;
uniform bool uColorGrade;
uniform bool uImpasto;
uniform bool uTemporal;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 randomPoint(vec2 cell, float time) {
  vec2 p = vec2(hash(cell), hash(cell + 42.0));
  return p + 0.2 * sin(time + p * 6.28318);
}

mat2 rotate(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

float getLuminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

vec3 paintLayer(vec2 uv, float gridScale, vec3 previousColor) {
  vec2 scaledUv = uv * gridScale;
  vec2 cell = floor(scaledUv);
  vec2 localFract = fract(scaledUv);

  float minDist = 1e10;
  vec3 strokeColor = vec3(0.0);
  vec2 strokeUv = vec2(0.0);

  for (int ix = -1; ix <= 1; ix++) {
    for (int iy = -1; iy <= 1; iy++) {
      vec2 neighbor = vec2(float(ix), float(iy));
      vec2 cellId = cell + neighbor;
      vec2 point = randomPoint(cellId, uTime);
      vec2 diff = neighbor + point - localFract;
      float d = length(diff);
      if (d < minDist) {
        minDist = d;
        strokeUv = (cellId + point) / gridScale;
        strokeColor = texture2D(tSource, strokeUv).rgb;
      }
    }
  }

  // Per-cell random tint for visible variation
  float cellHash = hash(cell);
  vec3 tint = mix(vec3(0.85, 0.85, 0.85), vec3(1.15, 1.15, 1.15), cellHash);
  strokeColor *= tint;

  // Sharp stroke mask with clear boundaries
  float radius = 0.45 + 0.05 * hash(cell + 100.0);
  float mask = 1.0 - smoothstep(radius - 0.08, radius, minDist);
  return mix(previousColor, strokeColor, mask);
}

void main() {
  vec3 sourceColor = texture2D(tSource, vUv).rgb;
  vec2 texel = 1.0 / uResolution;

  vec3 color = sourceColor;

  // Layer 1: Voronoi strokes
  if (uVoronoi) {
    color = paintLayer(vUv, 8.0, color);
    color = paintLayer(vUv, 16.0, color);
    color = paintLayer(vUv, 32.0, color);
  }

  // Layer 2: Stroke direction from gradients
  vec2 dirBlur = vec2(1.0, 0.0);
  if (uStrokeDirection) {
    float lumLeftBlur  = getLuminance(textureLod(tSource, vUv + vec2(-texel.x * 4.0, 0.0), 3.0).rgb);
    float lumRightBlur = getLuminance(textureLod(tSource, vUv + vec2( texel.x * 4.0, 0.0), 3.0).rgb);
    float lumUpBlur    = getLuminance(textureLod(tSource, vUv + vec2(0.0,  texel.y * 4.0), 3.0).rgb);
    float lumDownBlur  = getLuminance(textureLod(tSource, vUv + vec2(0.0, -texel.y * 4.0), 3.0).rgb);
    vec2 gradBlur = vec2(lumRightBlur - lumLeftBlur, lumUpBlur - lumDownBlur);
    dirBlur = normalize(vec2(-gradBlur.y, gradBlur.x) + 0.0001);
  }
  float angleBlur = atan(dirBlur.y, dirBlur.x);

  // Layer 3: Color grading
  if (uColorGrade) {
    float l = getLuminance(color);
    color = mix(vec3(l), color, 1.3);
  }

  // Layer 4: Impasto height
  if (uImpasto) {
    vec2 localUv = rotate(angleBlur) * (vUv - 0.5) + 0.5;
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
`;

// Create a default white texture for when no webcam is available
const defaultTexture = new THREE.DataTexture(
    new Uint8Array([255, 255, 255, 255]), // 1x1 pixel, RGBA
    1,
    1,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
);
defaultTexture.needsUpdate = true;

const shaderMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
        tSource: { value: defaultTexture },
        uResolution: { value: new Vector2() },
        uTime: { value: 0 },
        uVoronoi: { value: true },
        uStrokeDirection: { value: false },
        uColorGrade: { value: false },
        uImpasto: { value: false },
        uTemporal: { value: false },
    },
    side: THREE.DoubleSide,
});

// Add a plane with the shader material
const plane = new Mesh(new PlaneGeometry(2, 2), shaderMaterial);
plane.position.z = -1;
scene.add(plane);

// GUI
const gui = getGui();
const features = {
    'L1 Voronoi': true,
    'L2 Stroke Direction': false,
    'L3 Color Grade': false,
    'L4 Impasto': false,
    'L5 Temporal': false,
};
const featureUniforms = [
    ['L1 Voronoi', 'uVoronoi'],
    ['L2 Stroke Direction', 'uStrokeDirection'],
    ['L3 Color Grade', 'uColorGrade'],
    ['L4 Impasto', 'uImpasto'],
    ['L5 Temporal', 'uTemporal'],
] as const;
const folder = gui.addFolder('Feature Layers');
for (const [label, uniform] of featureUniforms) {
    folder.add(features, label).onChange((v: boolean) => {
        shaderMaterial.uniforms[uniform].value = v;
    });
}

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

let currentTexture: THREE.Texture = defaultTexture;

async function init() {
    try {
        currentTexture = await initWebcam({
            width: 640,
            height: 480,
            flipY: true,
        });
        shaderMaterial.uniforms.tSource.value = currentTexture;
        console.log('Webcam texture initialized');
    } catch (err) {
        console.error('Failed to initialize webcam:', err);
        shaderMaterial.uniforms.tSource.value = defaultTexture;
    }
}

function animate(time: number) {
    requestAnimationFrame(animate);

    if (currentTexture instanceof THREE.VideoTexture) {
        currentTexture.update();
    }

    shaderMaterial.uniforms.uTime.value = time * 0.001;

    shaderMaterial.uniforms.uResolution.value.set(
        renderer.domElement.clientWidth,
        renderer.domElement.clientHeight,
    );

    renderer.render(scene, camera);
}

window.addEventListener('beforeunload', () => {
    stopWebcam(currentTexture);
});

init().then(() => {
    animate(0);
});

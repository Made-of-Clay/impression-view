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

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float getLuminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

vec3 paintLayer(vec3 previousColor, vec2 uv, float gridScale) {
  vec2 cell = floor(uv * gridScale);
  float h = hash(cell) * 0.1;
  vec2 offset = vec2(h, h + 0.42);
  vec3 sampleColor = texture2D(tSource, uv + offset).rgb;
  return mix(previousColor, sampleColor, 0.3);
}

void main() {
  vec3 sourceColor = texture2D(tSource, vUv).rgb;

  vec3 color = sourceColor;

  // Phase 2: Stroke direction from gradients
  float left = texture2D(tSource, vUv + vec2(-1.0/ uResolution.x, 0.0)).r;
  float right = texture2D(tSource, vUv + vec2(1.0/ uResolution.x, 0.0)).r;
  float up = texture2D(tSource, vUv + vec2(0.0, 1.0/ uResolution.y)).r;
  float down = texture2D(tSource, vUv + vec2(0.0, -1.0/ uResolution.y)).r;
  vec2 grad = vec2(right - left, up - down);
  vec2 dir = normalize(vec2(-grad.y, grad.x));

  // Phase 3: Stroke shape with rectangle and brush mask
  vec2 localUv = vUv;
  localUv.x *= 1.2;
  float brushMask = texture2D(tSource, localUv * 4.0).r;
  brushMask = smoothstep(0.4, 0.7, brushMask);

  // Phase 4: Multi-layer detail (simplified)
  color = paintLayer(color, localUv, 8.0);
  color = paintLayer(color, localUv, 16.0);
  color = paintLayer(color, localUv, 32.0);

  // Phase 5: Color manipulation
  float sat = 1.2;
  float l = getLuminance(color);
  float m = max(max(color.r, color.g), color.b);
  float n = min(min(color.r, color.g), color.b);
  float range = m - n;
  float mid = (m + n) / 2.0;
  float delta = range / (1.0 - abs(2.0 * l - 1.0) + 0.001);
  float nmid = mid + (color.r - l) * (sat - 1.0);
  color.g = nmid;
  color.b = nmid;
  color = color - l;
  color = color * 1.1;
  color = color + l;

  // Phase 5: Impasto
  float height = texture2D(tSource, localUv * 4.0).r;
  height = smoothstep(0.3, 0.8, height);
  height *= 1.0 - abs(localUv.x - 0.5) * 2.0;
  color += height * 0.1;

  // Phase 6: Temporal accumulation (simple mix with previous)
  float blend = 0.5;
  color = mix(color, sourceColor, blend);

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
    },
    side: THREE.DoubleSide,
});

// Add a plane with the shader material
const plane = new Mesh(new PlaneGeometry(2, 2), shaderMaterial);
plane.position.z = -1;
scene.add(plane);

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

let lastTime = 0;
function animate(time: number) {
    requestAnimationFrame(animate);
    const delta = time - lastTime;
    lastTime = time;

    if (currentTexture instanceof THREE.VideoTexture) {
        currentTexture.update();
    }

    shaderMaterial.uniforms.uTime.value = time * 0.001;

    shaderMaterial.uniforms.uResolution.value.set(
        renderer.domElement.clientWidth,
        renderer.domElement.clientHeight,
    );

    plane.rotation.y += delta * 0.001;

    renderer.render(scene, camera);
}

window.addEventListener('beforeunload', () => {
    stopWebcam(currentTexture);
});

init().then(() => {
    animate(0);
});

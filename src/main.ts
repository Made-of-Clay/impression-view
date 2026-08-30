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
import vertexShader from './shaders/vertex.glsl?raw';
import fragmentShader from './shaders/fragment.glsl?raw';

const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color(0x0a0a0f);
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

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

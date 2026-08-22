import {
  BoxGeometry,
  Mesh,
  Timer,
  MeshLambertMaterial,
  PCFSoftShadowMap,
  WebGLRenderer,
} from 'three';
import Stats from 'stats.js';
import './style.css';
import { addLights } from './addLights';
import { addHelpers } from './addHelpers';
import { getScene } from './getScene';
import { ProjectCamera } from './ProjectCamera';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
const scene = getScene();

/*
-- Example Usage --
const loadingManager = getLoadingManager();
const cheese: Promise<GLTF> = new Promise((resolve, reject) => {
    const loader = new GLTFLoader(loadingManager);
    loader.load('/models/cheese.glb', resolve, undefined, reject);
});
cheese.then((gltf) => scene.add(gltf.scene)).catch(console.error);
*/

addLights();

// Dummy Object
// TODO remove this object
scene.add(
  new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshLambertMaterial({ color: 'white' }),
  ),
);

const camera = new ProjectCamera(canvas);
scene.add(camera.instance);

addHelpers();

// ===== 📈 STATS & CLOCK =====
const stats = new Stats();
document.body.appendChild(stats.dom);

const timer = new Timer();
timer.connect(document);

function tick(timestamp: number) {
  requestAnimationFrame(tick);

  stats.begin();

  timer.update(timestamp);
  const delta = timer.getDelta();
  console.log('delta', delta);

  camera.tick(renderer);

  renderer.render(scene, camera.instance);
  stats.end();
}

tick(0);

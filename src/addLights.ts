import { AmbientLight, PointLight, PointLightHelper } from 'three'
import { getGui } from './getGui'
import { getScene } from './getScene';

export function addLights() {
    const gui = getGui();
    const lightsFolder = gui.addFolder('Lights');

    const ambientLight = new AmbientLight('white', 0.25);

    lightsFolder.add(ambientLight, 'visible').name('Ambient Light');

    const pointLight = new PointLight('white', 20, 100);
    pointLight.position.set(2, 3, 2.25);
    pointLight.castShadow = true;
    pointLight.shadow.radius = 4;
    pointLight.shadow.camera.near = 0.1;
    pointLight.shadow.camera.far = 1000;
    pointLight.shadow.mapSize.width = 2048;
    pointLight.shadow.mapSize.height = 2048;

    lightsFolder.add(pointLight, 'visible').name('Point Light');

    const pointLightHelper = new PointLightHelper(pointLight, 0.25, 'orange');
    // pointLightHelper.visible = false;
    lightsFolder.add(pointLightHelper, 'visible').name('Point Light Helper');

    const scene = getScene();
    scene.add(ambientLight, pointLight, pointLightHelper);
}

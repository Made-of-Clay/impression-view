import { AxesHelper, GridHelper } from 'three';
import { getScene } from './getScene';
import { getGui } from './getGui';

export function addHelpers() {
    const scene = getScene();
    const gui = getGui();
    
    const axesHelper = new AxesHelper(4);
    axesHelper.visible = false;
    scene.add(axesHelper);
    
    const gridHelper = new GridHelper(20, 20, 'teal', 'darkgray');
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const helpersFolder = gui.addFolder('Helpers')
    helpersFolder.add(axesHelper, 'visible').name('axes')
}


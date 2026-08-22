import { PerspectiveCamera, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { getGui } from './getGui';
import { resizeRendererToDisplaySize } from './helpers/responsiveness';
import GUI from 'lil-gui';

export class ProjectCamera {
    instance: PerspectiveCamera;
    #canvas: HTMLCanvasElement;
    #cameraControls: OrbitControls
    #cameraFolder: GUI;

    constructor(canvas: HTMLCanvasElement) {
        this.#canvas = canvas;
        this.instance = new PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        this.instance.position.set(2, 2.5, 5.25);
        this.#cameraControls = new OrbitControls(this.instance, canvas);
        this.#cameraControls.enableDamping = true;

        const gui = getGui();
        // might add camera controls to set position better for each spot
        this.#cameraFolder = gui.addFolder('Camera');
    }

    tick(renderer: WebGLRenderer) {
        if (resizeRendererToDisplaySize(renderer)) {;
            this.instance.aspect = this.#canvas.clientWidth / this.#canvas.clientHeight;
            this.instance.updateProjectionMatrix();
        };

        this.#cameraControls.update();
    }
}

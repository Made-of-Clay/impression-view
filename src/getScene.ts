import { Scene } from 'three';

let scene: Scene;

export function getScene() {
    if (!scene)
        scene = new Scene();

    return scene;
}

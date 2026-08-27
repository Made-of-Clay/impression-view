import GUI from 'lil-gui';

let gui: GUI;

export function getGui() {
    if (!gui) gui = new GUI({ title: '🐞 Debug GUI', width: 300 });

    return gui;
}

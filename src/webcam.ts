import * as THREE from 'three';

export interface WebcamConfig {
    width: number;
    height: number;
    flipY: boolean;
}

const defaultConfig: WebcamConfig = {
    width: 640,
    height: 480,
    flipY: true,
};

function createTestPattern(width: number, height: number): THREE.DataTexture {
    const size = width * height * 4;
    const data = new Uint8Array(size);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;

            const stripe = Math.floor(x / 40) % 3;
            if (stripe === 0) {
                data[i] = 255;
                data[i + 1] = 100;
                data[i + 2] = 100;
            } else if (stripe === 1) {
                data[i] = 100;
                data[i + 1] = 255;
                data[i + 2] = 100;
            } else {
                data[i] = 100;
                data[i + 1] = 100;
                data[i + 2] = 255;
            }
            data[i + 3] = 255;
        }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
}

export async function initWebcam(config: Partial<WebcamConfig> = {}): Promise<THREE.Texture> {
    const cfg = { ...defaultConfig, ...config };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('Webcam not supported, using test pattern');
        return createTestPattern(cfg.width, cfg.height);
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: cfg.width },
                height: { ideal: cfg.height },
                facingMode: 'user',
            },
            audio: false,
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.playsInline = true;

        video.play().catch(() => {});

        const texture = new THREE.VideoTexture(video);
        texture.flipY = cfg.flipY;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        console.log('Webcam initialized successfully');
        return texture;
    } catch (err) {
        console.warn('Webcam access denied or error:', err);
        return createTestPattern(cfg.width, cfg.height);
    }
}

export function stopWebcam(texture: THREE.Texture): void {
    if (texture instanceof THREE.VideoTexture) {
        const video = texture.image;
        if (video && video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach((track: MediaStreamTrack) => track.stop());
        }
    }
}

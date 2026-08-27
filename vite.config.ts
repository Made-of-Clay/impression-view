/// <reference types="vite/client" />
import { defineConfig } from 'vite';

const certPath = '/tmp/localhost.crt';
const keyPath = '/tmp/localhost.key';

export default defineConfig({
    server: {
        host: true,
    },
    build: {
        target: 'esnext',
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        return 'vendor';
                    }
                    return undefined;
                },
            },
        },
        chunkSizeWarningLimit: 1000,
    },
    esbuild: {
        supported: {
            'top-level-await': true,
        },
    },
});

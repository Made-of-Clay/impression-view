import { LoadingManager } from 'three';

export function getLoadingManager(): LoadingManager {
    return new LoadingManager(
        () => console.log('Finished Loading'),
        (url, loaded, total) => console.log(`Loading: ${url} (${loaded}/${total})`),
        console.error,
    );
}

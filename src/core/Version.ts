/** Human-readable release and the build stamp baked in by Vite (the deploy writes the same stamp to version.json). */
declare const __BUILD_ID__: string | undefined;

export const VERSION = '12.0';
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

// Auto-discovers all .json animation files in this directory via Vite's import.meta.glob.
// To add a new loading animation, just drop a JSON file here (array of ASCII frame strings).

const modules = import.meta.glob<string[]>('./*.json', { eager: true, import: 'default' });

const animations: string[][] = Object.values(modules);

export default animations;

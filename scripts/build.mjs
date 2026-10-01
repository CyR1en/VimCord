import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build, context } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const options = {
    absWorkingDir: root,
    entryPoints: ['src/index.js'],
    outfile: 'VimCord.plugin.js',
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'chrome108',
    loader: { '.css': 'text' },
    minify: false,
    sourcemap: false,
    legalComments: 'inline',
    banner: {
        js: `/**
 * @name VimCord
 * @description ${pkg.description}
 * @author CyR1en
 * @authorLink https://github.com/CyR1en
 * @version ${pkg.version}
 * @source https://github.com/CyR1en/VimCord
 */\n// Generated from src/ by npm run build. Edit the source files, not this bundle.`,
    },
    footer: { js: 'module.exports = module.exports.default;' },
    logLevel: 'info',
};

if (process.argv.includes('--watch')) {
    const builder = await context(options);
    await builder.watch();
} else {
    await build(options);
}

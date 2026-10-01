import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/index.js', import.meta.url))],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    loader: { '.css': 'text' },
});

function createPlugin(t, saved = {}) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
        runScripts: 'outside-only',
        pretendToBeVisual: true,
    });
    const { window } = dom;
    const data = structuredClone(saved);
    const storage = {
        load: (name, key) => structuredClone(data[key]),
        save: (name, key, value) => {
            data[key] = structuredClone(value);
        },
    };
    let confirmation;
    window.BdApi = {
        Data: storage,
        DOM: { addStyle() {}, removeStyle() {} },
        UI: {
            showConfirmationModal(title, description, options) {
                confirmation = options;
            },
        },
    };
    const context = dom.getInternalVMContext();
    context.module = { exports: {} };
    new Script(bundle.outputFiles[0].text).runInContext(context);
    const plugin = new context.module.exports.default();
    t.after(() => {
        plugin.stop();
        plugin.settingsPanel?.dispose();
        window.close();
    });

    return {
        plugin,
        window,
        data,
        storage,
        get confirmation() {
            return confirmation;
        },
        openPanel() {
            const panel = plugin.getSettingsPanel();
            window.document.body.append(panel);
            return panel;
        },
        key(target, key, options = {}) {
            const event = new window.KeyboardEvent('keydown', {
                key,
                bubbles: true,
                cancelable: true,
                ...options,
            });
            target.dispatchEvent(event);
            return event;
        },
    };
}

test('settings open while disabled and persist edits without starting the plugin', (t) => {
    const app = createPlugin(t, {
        settings: { scrollAmount: 175 },
        keybinds: { hint: 'x' },
    });
    const panel = app.openPanel();
    const input = panel.querySelector('input[type="number"]');
    assert.equal(input.value, '175');
    assert.equal(panel.querySelector('[data-action="hint"]').textContent, 'x');
    assert.equal(panel.querySelectorAll('[data-action]').length, 8);

    input.value = '250';
    input.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    assert.equal(app.plugin.settings.scrollAmount, 250);
    assert.equal(app.data.settings.scrollAmount, 250);
    assert.equal(app.data.settings.keybinds.hint, 'x');
});

test('remapped navigation uses saved scroll distance and pane-relative half pages', (t) => {
    const app = createPlugin(t, {
        settings: { scrollAmount: 125, keybinds: { scrollDown: 'q' } },
    });
    app.plugin.start();
    const scrolls = [];
    const moves = [];
    app.plugin.panes.scroll = (amount) => scrolls.push(amount);
    app.plugin.panes.move = (direction) => moves.push(direction);
    Object.defineProperty(app.plugin.panes, 'pageSize', { value: 600 });
    const target = app.window.document.body;

    assert.equal(app.key(target, 'j').defaultPrevented, false);
    assert.equal(app.key(target, 'q').defaultPrevented, true);
    app.key(target, 'q', { repeat: true });
    app.key(target, 'k');
    app.key(target, 'D');
    app.key(target, 'U');
    app.key(target, 'h');
    app.key(target, 'l');
    assert.deepEqual(scrolls, [125, 125, -125, 300, -300]);
    assert.deepEqual(moves, [-1, 1]);
    assert.equal(app.key(target, 'q', { ctrlKey: true }).defaultPrevented, false);
    assert.equal(app.key(target, 'q', { isComposing: true }).defaultPrevented, false);
    assert.equal(scrolls.length, 5);
});

test('settings controls bypass navigation and capture reports conflicts before saving', (t) => {
    const app = createPlugin(t);
    app.plugin.start();
    const panel = app.openPanel();
    const scrolls = [];
    app.plugin.panes.scroll = (amount) => scrolls.push(amount);
    const input = panel.querySelector('input[type="number"]');
    input.focus();
    assert.equal(app.key(input, 'j').defaultPrevented, false);

    const button = panel.querySelector('[data-action="hint"]');
    button.click();
    app.key(button, 'D', { shiftKey: true });
    assert.equal(app.plugin.settings.keybinds.hint, 'f');
    assert.ok(panel.querySelector('[role="status"]').textContent.length > 0);
    assert.deepEqual(scrolls, []);

    button.click();
    app.key(button, 'x');
    assert.equal(app.plugin.settings.keybinds.hint, 'x');
    assert.equal(app.data.settings.keybinds.hint, 'x');
    assert.deepEqual(scrolls, []);
    app.plugin.setMode('normal');
    app.plugin.hints.start = () => true;
    assert.equal(app.key(app.window.document.body, 'f').defaultPrevented, false);
    app.key(app.window.document.body, 'x');
    assert.equal(app.plugin.mode, 'hint');
});

test('capture ignores composition, pure modifiers, and held keys and rejects chords', (t) => {
    const app = createPlugin(t);
    const panel = app.openPanel();
    const button = panel.querySelector('[data-action="hint"]');
    button.click();
    app.key(button, 'Shift');
    app.key(button, 'x', { isComposing: true });
    app.key(button, 'x', { repeat: true });
    assert.equal(app.plugin.settings.keybinds.hint, 'f');
    app.key(button, 'x', { ctrlKey: true });
    assert.equal(app.plugin.settings.keybinds.hint, 'f');
    assert.ok(panel.querySelector('[role="status"]').textContent.length > 0);
    button.click();
    app.key(button, ' ');
    assert.equal(app.plugin.settings.keybinds.hint, ' ');
    assert.equal(button.textContent, 'Space');
});

test('Escape, Tab, blur, removal, and stop leave no active global capture', (t) => {
    const app = createPlugin(t);
    app.plugin.start();
    const panel = app.openPanel();
    const button = panel.querySelector('[data-action="hint"]');
    const input = panel.querySelector('input[type="number"]');
    for (const key of ['Escape', 'Tab']) {
        button.click();
        const event = app.key(button, key);
        if (key === 'Tab') {
            assert.equal(event.defaultPrevented, false);
        }
        app.key(button, 'x');
        assert.equal(app.plugin.settings.keybinds.hint, 'f');
    }

    button.click();
    input.focus();
    assert.equal(app.key(input, 'x').defaultPrevented, false);
    assert.equal(app.plugin.settings.keybinds.hint, 'f');
    button.click();
    panel.remove();
    assert.equal(app.key(app.window.document.body, 'x').defaultPrevented, false);
    assert.equal(app.plugin.settings.keybinds.hint, 'f');

    app.window.document.body.append(panel);
    button.click();
    app.plugin.stop();
    assert.equal(app.key(button, 'x').defaultPrevented, false);
    assert.equal(app.plugin.settings.keybinds.hint, 'f');
    button.click();
    app.key(button, 'x');
    assert.equal(app.plugin.settings.keybinds.hint, 'x');
});

test('replacing the settings panel disposes the previous capture', (t) => {
    const app = createPlugin(t);
    const oldPanel = app.openPanel();
    const oldButton = oldPanel.querySelector('[data-action="hint"]');
    oldButton.click();
    const newPanel = app.openPanel();
    app.key(oldButton, 'x');
    oldButton.click();
    app.key(oldButton, 'x');
    assert.equal(app.plugin.settings.keybinds.hint, 'f');
    const button = newPanel.querySelector('[data-action="hint"]');
    button.click();
    app.key(button, 'x');
    assert.equal(app.plugin.settings.keybinds.hint, 'x');
});

test('failed saves are visible and reset persists defaults after confirmation', (t) => {
    const app = createPlugin(t, {
        settings: { scrollAmount: 200, keybinds: { hint: 'x' } },
    });
    const panel = app.openPanel();
    const input = panel.querySelector('input[type="number"]');
    const save = app.storage.save;
    app.storage.save = () => {
        throw new Error('Storage unavailable');
    };
    input.value = '300';
    input.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    assert.equal(app.plugin.settings.scrollAmount, 200);
    assert.equal(input.value, '200');
    assert.ok(panel.querySelector('[role="status"]').textContent.length > 0);

    app.storage.save = save;
    const reset = [...panel.querySelectorAll('button')].find(
        (button) => button.textContent === 'Reset to defaults',
    );
    reset.click();
    assert.equal(app.plugin.settings.keybinds.hint, 'x');
    app.confirmation.onConfirm();
    assert.equal(app.plugin.settings.keybinds.hint, 'f');
    assert.equal(app.plugin.settings.scrollAmount, 80);
    assert.equal(input.value, '80');
    assert.equal(app.data.settings.keybinds.hint, 'f');
});

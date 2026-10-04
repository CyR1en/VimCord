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
    assert.equal(panel.querySelectorAll('[data-action]').length, 24);

    input.value = '250';
    input.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    assert.equal(app.plugin.settings.scrollAmount, 250);
    assert.equal(app.data.settings.scrollAmount, 250);
    assert.equal(app.data.settings.keybinds.hint, 'x');
    const toggle = panel.querySelector('[role="switch"]');
    toggle.click();
    assert.equal(app.data.settings.showFocusOutline, false);
    assert.equal(app.openPanel().querySelector('[role="switch"]').checked, false);
});

test('new preferences and the marks manager work while VimCord is disabled', (t) => {
    const app = createPlugin(t, { marks: { a: '/channels/10/20' } });
    const panel = app.openPanel();
    for (const [key, expected] of [
        ['showSequenceHints', false],
        ['rangeCopyAuthors', false],
        ['rangeCopyTimestamps', true],
    ]) {
        panel.querySelector(`[id$="-${key}"]`).click();
        assert.equal(app.data.settings[key], expected);
    }
    [...panel.querySelectorAll('button')]
        .find((button) => button.textContent === 'Manage saved marks')
        .click();
    assert.ok(app.plugin.marksPanel.root);
    assert.match(app.plugin.marksPanel.root.textContent, /Unavailable channel/);
    assert.ok(app.plugin.marksPanel.root.querySelector('style').textContent);
    app.key(app.window.document.activeElement, 'Escape');
    assert.equal(app.plugin.marksPanel.root, null);
    assert.equal(app.plugin.running, undefined);
});

test('fade delay is available only with the outline enabled and preserves its saved value', (t) => {
    const app = createPlugin(t, {
        settings: { showFocusOutline: false, focusOutlineFadeDelay: 4.5 },
    });
    const panel = app.openPanel();
    const toggle = panel.querySelector('[role="switch"]');
    const delay = panel.querySelector('input[id$="-fade-delay"]');
    assert.equal(delay.disabled, true);
    assert.equal(delay.parentElement.hidden, true);
    assert.equal(delay.value, '4.5');
    toggle.click();
    assert.equal(delay.disabled, false);
    assert.equal(delay.parentElement.hidden, false);
    delay.value = '7';
    delay.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    assert.equal(app.data.settings.focusOutlineFadeDelay, 7);
    delay.value = '';
    delay.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    assert.match(panel.querySelector('[role="status"]').textContent, /number of seconds/);
    assert.equal(delay.value, '7');
    toggle.click();
    toggle.click();
    assert.equal(delay.value, '7');
    const reopened = app.openPanel();
    assert.equal(reopened.querySelector('input[id$="-fade-delay"]').value, '7');

    const reset = [...reopened.querySelectorAll('button')].find(
        (button) => button.textContent === 'Reset to defaults',
    );
    reset.click();
    app.confirmation.onConfirm();
    assert.equal(app.data.settings.focusOutlineFadeDelay, 3);
    assert.equal(reopened.querySelector('input[id$="-fade-delay"]').value, '3');
});

test('hint scope is configurable in the settings panel and survives reopening', (t) => {
    const app = createPlugin(t);
    const panel = app.openPanel();
    const toggle = panel.querySelector('input[id$="-hints-pane"]');
    assert.equal(toggle.checked, true);
    toggle.click();
    assert.equal(app.data.settings.hintsCurrentPane, false);
    assert.equal(app.openPanel().querySelector('input[id$="-hints-pane"]').checked, false);
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

    assert.equal(app.key(target, 'j').defaultPrevented, true);
    assert.deepEqual(scrolls, []);
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
    assert.equal(app.key(target, 'q', { isComposing: true }).defaultPrevented, true);
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
    assert.equal(app.key(app.window.document.body, 'f').defaultPrevented, true);
    assert.equal(app.plugin.mode, 'normal');
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
        settings: { scrollAmount: 200, keybinds: { hint: 'x' }, showFocusOutline: false },
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

    const toggle = panel.querySelector('[role="switch"]');
    toggle.click();
    assert.equal(toggle.checked, false);
    assert.equal(app.plugin.settings.showFocusOutline, false);
    assert.match(panel.querySelector('[role="status"]').textContent, /Storage unavailable/);

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
    assert.equal(toggle.checked, true);
    assert.equal(app.data.settings.showFocusOutline, true);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_KEYBINDS, DEFAULT_SCROLL_AMOUNT, PluginSettings } from '../src/settings.js';

function memoryStorage(initial = {}) {
    const data = structuredClone(initial);
    const writes = [];
    return {
        data,
        writes,
        load(plugin, key) {
            assert.equal(plugin, 'VimCord');
            return structuredClone(data[key]);
        },
        save(plugin, key, value) {
            assert.equal(plugin, 'VimCord');
            writes.push({ key, value: structuredClone(value) });
            data[key] = structuredClone(value);
        },
    };
}

test('defaults dispatch exact keys, plus uppercase half-page aliases', () => {
    const settings = new PluginSettings(memoryStorage());
    assert.equal(settings.scrollAmount, DEFAULT_SCROLL_AMOUNT);
    assert.deepEqual(settings.keybinds, DEFAULT_KEYBINDS);
    assert.equal(settings.actionForKey('f'), 'hint');
    assert.equal(settings.actionForKey('F'), undefined);
    assert.equal(settings.actionForKey('d'), 'halfPageDown');
    assert.equal(settings.actionForKey('D'), 'halfPageDown');
    assert.equal(settings.actionForKey('U'), 'halfPageUp');
    assert.equal(settings.actionForKey('Escape'), undefined);
    assert.equal(settings.actionForKey('v'), undefined);
    assert.ok(Object.isFrozen(settings.keybinds));
});

test('loads legacy preferences, ignores removed actions, and preserves valid swaps', () => {
    const settings = new PluginSettings(
        memoryStorage({
            settings: { scrollAmount: 125 },
            keybinds: { hint: 'i', insert: 'f', visualCaret: 'v', unknown: 'x' },
        }),
    );
    assert.equal(settings.scrollAmount, 125);
    assert.equal(settings.actionForKey('i'), 'hint');
    assert.equal(settings.actionForKey('f'), 'insert');
    assert.equal(settings.actionForKey('v'), undefined);
    assert.equal(settings.actionForKey('x'), undefined);
    assert.deepEqual(Object.keys(settings.keybinds), Object.keys(DEFAULT_KEYBINDS));
});

test('malformed persisted values safely fall back to defaults', () => {
    for (const value of [null, [], false, '', ' ', 'invalid', Infinity, NaN, {}]) {
        const settings = new PluginSettings(
            memoryStorage({
                settings: { scrollAmount: value },
                keybinds: { halfPageDown: null, hint: '\n' },
            }),
        );
        assert.equal(settings.scrollAmount, DEFAULT_SCROLL_AMOUNT);
        assert.equal(settings.actionForKey('D'), 'halfPageDown');
        assert.equal(settings.actionForKey('f'), 'hint');
    }
    for (const value of [null, [], 'invalid', 42]) {
        const settings = new PluginSettings(memoryStorage({ settings: value, keybinds: value }));
        assert.deepEqual(settings.keybinds, DEFAULT_KEYBINDS);
    }
    for (const value of [null, [], false, '', 'invalid', Infinity, NaN, {}]) {
        const settings = new PluginSettings(memoryStorage({ keybinds: { halfPageDown: value } }));
        assert.equal(settings.actionForKey('D'), 'halfPageDown');
    }
});

test('persisted direct and uppercase-alias collisions reset the entire keymap', () => {
    for (const keybinds of [{ hint: 'j' }, { hint: 'D' }, { halfPageDown: 'z', insert: 'Z' }]) {
        const settings = new PluginSettings(memoryStorage({ settings: { keybinds } }));
        assert.deepEqual(settings.keybinds, DEFAULT_KEYBINDS);
    }
});

test('scroll amounts round and clamp without accepting empty or nonnumeric values', () => {
    const storage = memoryStorage();
    const settings = new PluginSettings(storage);
    for (const [raw, expected] of [
        ['120.6', 121],
        [1, 10],
        [1001, 1000],
    ]) {
        assert.equal(settings.setScrollAmount(raw), expected);
        assert.equal(settings.scrollAmount, expected);
    }
    for (const raw of ['', ' ', null, true, {}, [], 'invalid', Infinity, NaN]) {
        assert.throws(() => settings.setScrollAmount(raw), /number of pixels/);
        assert.equal(settings.scrollAmount, 1000);
    }
    assert.equal(storage.writes.length, 3);
});

test('remapping rejects direct and alias conflicts without changing state or storage', () => {
    const storage = memoryStorage();
    const settings = new PluginSettings(storage);
    assert.throws(() => settings.setKeybind('hint', 'j'), /already used for: Scroll down/);
    assert.throws(() => settings.setKeybind('hint', 'D'), /already used for: Half page down/);
    settings.setKeybind('hint', 'Z');
    assert.throws(() => settings.setKeybind('halfPageDown', 'z'), /Hint mode/);
    assert.equal(settings.keybinds.hint, 'Z');
    assert.equal(settings.keybinds.halfPageDown, 'd');
    assert.equal(storage.writes.length, 1);
});

test('keybinds require one visible character, allow Space, and ignore old aliases after remap', () => {
    const storage = memoryStorage();
    const settings = new PluginSettings(storage);
    for (const key of ['', null, 1, '\n', '\t', '\u200b', '\u0301', 'Escape', 'ab']) {
        assert.throws(() => settings.setKeybind('hint', key), /visible character/);
    }
    assert.throws(() => settings.setKeybind('visualCaret', 'v'), /Unknown VimCord action/);
    settings.setKeybind('hint', ' ');
    assert.equal(settings.actionForKey(' '), 'hint');
    assert.equal(settings.actionForKey('f'), undefined);
    settings.setKeybind('halfPageDown', 'z');
    assert.equal(settings.actionForKey('z'), 'halfPageDown');
    assert.equal(settings.actionForKey('Z'), 'halfPageDown');
    assert.equal(settings.actionForKey('D'), undefined);
    settings.setKeybind('halfPageDown', 'ß');
    assert.equal(settings.actionForKey('ß'), 'halfPageDown');
    assert.equal(settings.actionForKey('SS'), undefined);
    settings.setKeybind('hint', '😀');
    assert.equal(settings.actionForKey('😀'), 'hint');
});

test('remap and reset persist one complete snapshot that takes precedence over legacy data', () => {
    const storage = memoryStorage({ keybinds: { hint: 'x' } });
    const settings = new PluginSettings(storage);
    settings.setKeybind('hint', 'q');
    settings.setScrollAmount(160);
    const reloaded = new PluginSettings(storage);
    assert.equal(reloaded.keybinds.hint, 'q');
    assert.equal(reloaded.scrollAmount, 160);
    const beforeReset = storage.writes.length;
    reloaded.reset();
    assert.equal(storage.writes.length, beforeReset + 1);
    assert.equal(storage.writes.at(-1).key, 'settings');
    assert.deepEqual(storage.writes.at(-1).value, {
        scrollAmount: DEFAULT_SCROLL_AMOUNT,
        keybinds: DEFAULT_KEYBINDS,
    });
    const afterReset = new PluginSettings(storage);
    assert.deepEqual(afterReset.keybinds, DEFAULT_KEYBINDS);
    assert.equal(afterReset.scrollAmount, DEFAULT_SCROLL_AMOUNT);
});

test('failed saves leave runtime state and persisted snapshot unchanged', () => {
    const storage = memoryStorage();
    const settings = new PluginSettings(storage);
    settings.setKeybind('hint', 'x');
    settings.setScrollAmount(160);
    const saved = structuredClone(storage.data);
    storage.save = () => {
        throw new Error('disk is full');
    };
    for (const update of [
        () => settings.setKeybind('hint', 'q'),
        () => settings.setScrollAmount(240),
        () => settings.reset(),
    ]) {
        assert.throws(update, /Failed to save VimCord settings: disk is full/);
        assert.equal(settings.keybinds.hint, 'x');
        assert.equal(settings.scrollAmount, 160);
        assert.deepEqual(storage.data, saved);
    }
});

test('load failures use defaults and log errors without throwing', (context) => {
    const errors = context.mock.method(console, 'error', () => {});
    const settings = new PluginSettings({
        load() {
            throw new Error('cannot read configuration');
        },
    });
    assert.deepEqual(settings.keybinds, DEFAULT_KEYBINDS);
    assert.equal(settings.scrollAmount, DEFAULT_SCROLL_AMOUNT);
    assert.equal(errors.mock.calls.length, 2);
});

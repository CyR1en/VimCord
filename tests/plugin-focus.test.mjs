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

function createApp(t) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
        runScripts: 'outside-only',
        pretendToBeVisual: true,
    });
    const { window } = dom;
    const { document } = window;
    window.BdApi = {
        Data: { load() {} },
        DOM: { addStyle() {}, removeStyle() {} },
    };
    const context = dom.getInternalVMContext();
    context.module = { exports: {} };
    new Script(bundle.outputFiles[0].text).runInContext(context);
    const plugin = new context.module.exports.default();
    const server = document.createElement('button');
    const chat = document.createElement('main');
    document.body.append(server, chat);
    const createComposer = () => {
        const editor = document.createElement('div');
        editor.contentEditable = 'true';
        editor.tabIndex = 0;
        editor.setAttribute('contenteditable', 'true');
        editor.setAttribute('data-slate-editor', 'true');
        Object.defineProperty(editor, 'isContentEditable', { value: true });
        return editor;
    };
    let composer = createComposer();
    chat.append(composer);
    server.addEventListener('click', () => {
        composer = createComposer();
        chat.replaceChildren(composer);
        composer.focus();
        plugin.onSwitch();
    });
    const key = (value, options = {}) => {
        const event = new window.KeyboardEvent('keydown', {
            key: value,
            bubbles: true,
            cancelable: true,
            ...options,
        });
        document.activeElement.dispatchEvent(event);
        return event;
    };
    plugin.start();
    t.after(() => {
        plugin.stop();
        window.close();
    });
    return {
        window,
        document,
        plugin,
        chat,
        server,
        key,
        settleFocus: () => new Promise((resolve) => window.setTimeout(resolve, 0)),
        get composer() {
            return composer;
        },
    };
}

test('Normal mode rejects text when Discord focuses the composer during an unbound key', async (t) => {
    const app = createApp(t);
    app.document.addEventListener('keydown', () => app.composer.focus());

    const event = app.key('x');
    if (!event.defaultPrevented && app.document.activeElement === app.composer) {
        const input = new app.window.InputEvent('beforeinput', {
            inputType: 'insertText',
            data: 'x',
            bubbles: true,
            cancelable: true,
        });
        if (app.composer.dispatchEvent(input)) {
            app.composer.textContent += input.data;
        }
    }
    await app.settleFocus();

    assert.equal(app.plugin.mode, 'normal');
    assert.equal(app.composer.textContent, '');
});

test('Normal mode blocks character, dead-key, and composition input before Discord handles it', (t) => {
    const app = createApp(t);
    const forwarded = [];
    app.document.addEventListener('keydown', (event) => forwarded.push(event.key));
    for (const [key, options] of [
        ['x', {}],
        ['X', { shiftKey: true }],
        [' ', {}],
        ['😀', {}],
        ['Dead', { altKey: true }],
        ['é', { altKey: true }],
        ['Process', { isComposing: true }],
    ]) {
        assert.equal(app.key(key, options).defaultPrevented, true, key);
    }
    assert.deepEqual(forwarded, []);
    assert.equal(app.plugin.mode, 'normal');
});

test('Normal mode blocks a document paste that Discord would forward into the composer', async (t) => {
    const app = createApp(t);
    app.composer.textContent = 'Existing draft';
    app.document.addEventListener('paste', () => {
        app.composer.focus();
        app.composer.textContent += 'x';
    });
    const paste = new app.window.Event('paste', { bubbles: true, cancelable: true });
    app.document.body.dispatchEvent(paste);
    await app.settleFocus();

    assert.equal(app.plugin.mode, 'normal');
    assert.equal(app.composer.textContent, 'Existing draft');
    assert.equal(paste.defaultPrevented, true);

    app.key('i');
    const insertPaste = new app.window.Event('paste', { bubbles: true, cancelable: true });
    app.document.body.dispatchEvent(insertPaste);
    assert.equal(insertPaste.defaultPrevented, false);
    assert.equal(app.composer.textContent, 'Existing draftx');
});

test('a composer awaiting blur cannot edit or submit a draft in Normal mode', async (t) => {
    const app = createApp(t);
    app.server.click();
    app.composer.textContent = 'Existing draft';
    const forwarded = [];
    for (const type of ['beforeinput', 'paste', 'cut']) {
        app.chat.addEventListener(type, () => forwarded.push(type));
        const event = new app.window.Event(type, { bubbles: true, cancelable: true });
        app.composer.dispatchEvent(event);
        assert.equal(event.defaultPrevented, true, type);
    }
    for (const [key, options] of [
        ['Enter', {}],
        ['Enter', { metaKey: true }],
        ['Backspace', {}],
        ['Delete', {}],
        ['v', { metaKey: true }],
        ['x', { ctrlKey: true }],
        ['z', { metaKey: true }],
        ['Z', { metaKey: true, shiftKey: true }],
        ['y', { ctrlKey: true }],
    ]) {
        assert.equal(app.key(key, options).defaultPrevented, true, key);
    }
    assert.equal(app.key('c', { metaKey: true }).defaultPrevented, false);
    assert.equal(app.key('k', { metaKey: true }).defaultPrevented, false);
    assert.deepEqual(forwarded, []);
    assert.equal(app.composer.textContent, 'Existing draft');
    await app.settleFocus();
});

test('input guards allow Insert mode, other fields, and normal input after disabling VimCord', (t) => {
    const app = createApp(t);
    app.key('i');
    app.composer.focus();
    assert.equal(app.plugin.mode, 'insert');
    for (const [key, options] of [
        ['x', {}],
        ['Dead', { altKey: true }],
        ['Process', { isComposing: true }],
        ['v', { metaKey: true }],
    ]) {
        assert.equal(app.key(key, options).defaultPrevented, false, key);
    }
    for (const type of ['beforeinput', 'paste', 'cut']) {
        const event = new app.window.Event(type, { bubbles: true, cancelable: true });
        app.composer.dispatchEvent(event);
        assert.equal(event.defaultPrevented, false, type);
    }

    app.key('Escape');
    const search = app.document.createElement('input');
    search.type = 'search';
    app.document.body.append(search);
    const input = new app.window.InputEvent('beforeinput', {
        inputType: 'insertText',
        data: 'x',
        bubbles: true,
        cancelable: true,
    });
    search.dispatchEvent(input);
    assert.equal(input.defaultPrevented, false);
    const searchPaste = new app.window.Event('paste', { bubbles: true, cancelable: true });
    search.dispatchEvent(searchPaste);
    assert.equal(searchPaste.defaultPrevented, false);
    app.plugin.stop();
    app.composer.focus();
    assert.equal(app.key('x').defaultPrevented, false);
    const paste = new app.window.Event('paste', { bubbles: true, cancelable: true });
    app.composer.dispatchEvent(paste);
    assert.equal(paste.defaultPrevented, false);
});

test('server navigation finishes composer focus handlers before VimCord blurs it', async (t) => {
    const app = createApp(t);
    const events = [];
    app.chat.addEventListener('focusin', () => events.push('focusin'));
    app.chat.addEventListener('focusout', () => events.push('focusout'));

    app.server.click();
    assert.deepEqual(events, ['focusin']);
    assert.equal(app.document.activeElement, app.composer);
    await app.settleFocus();

    assert.deepEqual(events, ['focusin', 'focusout']);
    assert.equal(app.document.activeElement, app.document.body);
    assert.equal(app.plugin.mode, 'normal');
});

test('entering Insert mode before deferred blur keeps the composer focused', async (t) => {
    const app = createApp(t);
    app.server.click();
    app.key('i');
    await app.settleFocus();

    assert.equal(app.plugin.mode, 'insert');
    assert.equal(app.document.activeElement, app.composer);
});

test('clicks and Tab still enter Insert mode and keep the composer focused', async (t) => {
    const app = createApp(t);
    app.composer.dispatchEvent(new app.window.MouseEvent('pointerdown', { bubbles: true }));
    app.composer.focus();
    await app.settleFocus();

    assert.equal(app.plugin.mode, 'insert');
    assert.equal(app.document.activeElement, app.composer);

    app.key('Escape');
    app.key('Tab');
    app.composer.focus();
    await app.settleFocus();

    assert.equal(app.plugin.mode, 'insert');
    assert.equal(app.document.activeElement, app.composer);
});

test('pending focus cleanup cannot blur after the plugin stops or restarts', async (t) => {
    const app = createApp(t);
    app.server.click();
    app.plugin.stop();
    await app.settleFocus();
    assert.equal(app.document.activeElement, app.composer);

    app.plugin.start();
    app.key('Escape');
    app.server.click();
    app.plugin.stop();
    app.plugin.start();
    await app.settleFocus();
    assert.equal(app.document.activeElement, app.composer);
    assert.equal(app.plugin.mode, 'insert');
});

test('rapid server switches only blur the current connected composer', async (t) => {
    const app = createApp(t);
    app.server.click();
    const oldComposer = app.composer;
    let staleBlur = false;
    oldComposer.blur = () => {
        staleBlur = true;
    };
    app.server.click();
    await app.settleFocus();

    assert.equal(staleBlur, false);
    assert.equal(app.document.activeElement, app.document.body);
    assert.equal(app.plugin.mode, 'normal');
});

test('deferred blur leaves a subsequently focused search input alone', async (t) => {
    const app = createApp(t);
    const search = app.document.createElement('input');
    search.type = 'search';
    app.document.body.append(search);
    app.server.click();
    search.focus();
    await app.settleFocus();

    assert.equal(app.document.activeElement, search);
    assert.equal(app.plugin.mode, 'insert');
});

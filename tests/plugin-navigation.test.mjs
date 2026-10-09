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

function createApp(t, saved = {}) {
    const dom = new JSDOM(
        `<!doctype html><html><body>
        <nav id="channels" style="overflow-y:auto" data-box="10,40,180,450">
            <a href="/channels/10/20" data-box="20,60,120,30">Channel</a>
        </nav>
        <main id="chat" style="overflow-y:auto" data-box="210,40,700,450">
            <ol data-list-id="chat-messages" data-box="210,40,700,450">
                ${[1, 2, 3, 4, 5]
                    .map(
                        (id) => `<li id="chat-messages-20-${id}">
                    <div role="article" tabindex="-1" data-box="220,${60 + id * 60},650,50">
                        <div id="message-content-${id}">Message ${id}</div>
                    </div></li>`,
                    )
                    .join('')}
            </ol>
            <button data-box="230,410,100,30">Chat control</button>
        </main>
        <div contenteditable="true" data-slate-editor="true" tabindex="0" data-box="210,510,700,60">Existing draft</div>
    </body></html>`,
        {
            url: 'https://discord.com/channels/10/20',
            runScripts: 'outside-only',
            pretendToBeVisual: true,
        },
    );
    const { window } = dom;
    const { document } = window;
    const data = structuredClone(saved);
    const navigations = [];
    const toasts = [];
    const copies = [];
    const storage = {
        load: (name, key) => structuredClone(data[key]),
        save: (name, key, value) => {
            data[key] = structuredClone(value);
        },
    };
    window.BdApi = {
        Data: storage,
        DOM: { addStyle() {}, removeStyle() {} },
        UI: {
            showToast(message) {
                toasts.push(message);
            },
        },
        Webpack: { getByStrings: () => (path) => navigations.push(path) },
    };
    Object.defineProperty(window.navigator, 'clipboard', {
        value: {
            async writeText(text) {
                copies.push(text);
            },
        },
    });
    const prototype = window.HTMLElement.prototype;
    prototype.getBoundingClientRect = function () {
        const [x, y, width, height] = (this.dataset.box || '0,0,20,18').split(',').map(Number);
        return { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height };
    };
    prototype.scrollBy = function ({ top }) {
        this.scrollTop += top;
    };
    prototype.scrollTo = function ({ top }) {
        this.scrollTop = top;
    };
    prototype.scrollIntoView = function () {};
    document.elementFromPoint = (x, y) =>
        [...document.querySelectorAll('[data-box]')].reverse().find((e) => {
            const r = e.getBoundingClientRect();
            return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        });
    const chat = document.getElementById('chat');
    Object.defineProperties(chat, { clientHeight: { value: 450 }, scrollHeight: { value: 2000 } });
    const composer = document.querySelector('[contenteditable]');
    Object.defineProperty(composer, 'isContentEditable', { value: true });
    const context = dom.getInternalVMContext();
    context.module = { exports: {} };
    new Script(bundle.outputFiles[0].text).runInContext(context);
    const plugin = new context.module.exports.default();
    plugin.start();
    t.after(() => {
        plugin.stop();
        plugin.settingsPanel?.dispose();
        window.close();
    });
    const key = (key, options = {}) => {
        const event = new window.KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
            ...options,
        });
        document.activeElement.dispatchEvent(event);
        return event;
    };
    const keys = (sequence) => [...sequence].forEach((value) => key(value));
    return {
        plugin,
        document,
        window,
        key,
        keys,
        composer,
        chat,
        data,
        navigations,
        toasts,
        copies,
        storage,
    };
}

test('counts use configured motions, are bounded, and clear on cancellation and navigation', (t) => {
    const app = createApp(t, { settings: { scrollAmount: 100, keybinds: { scrollDown: 'x' } } });
    app.keys('5x');
    assert.equal(app.chat.scrollTop, 500);
    app.keys('3k');
    assert.equal(app.chat.scrollTop, 200);
    app.keys('2d');
    assert.equal(app.chat.scrollTop, 650);
    app.keys('5');
    app.key('Escape');
    app.key('x');
    assert.equal(app.chat.scrollTop, 750);
    app.key('9');
    app.plugin.onSwitch();
    app.key('x');
    assert.equal(app.chat.scrollTop, 850);
    app.keys('9999x');
    assert.equal(app.chat.scrollTop, 100750);
    app.key('5');
    app.key('5', { repeat: true });
    app.key('x');
    assert.equal(app.chat.scrollTop, 101250);
    app.key('2');
    assert.equal(app.key('Tab').defaultPrevented, false);
    app.key('x');
    assert.equal(app.chat.scrollTop, 101350);
    app.key('2');
    app.key('Shift', { shiftKey: true });
    app.key('D', { shiftKey: true });
    assert.equal(app.chat.scrollTop, 101800);
    assert.equal(app.composer.textContent, 'Existing draft');
});

test('G uses native jump-to-present for the selected chat and keeps other panes local', (t) => {
    const app = createApp(t);
    const jumps = [];
    app.window.BdApi.Webpack.getByKeys = () => ({ jumpToPresent: (...args) => jumps.push(args) });
    app.keys('vG');
    assert.deepEqual(jumps, [['20', 50]]);
    assert.equal(app.plugin.mode, 'normal');
    assert.equal(app.document.querySelector('.vimcord-message-selected'), null);
    app.key('h');
    app.key('G');
    assert.equal(jumps.length, 1);
    assert.equal(app.composer.textContent, 'Existing draft');
});

test('G falls back to the loaded bottom and clears Message and Range selection', (t) => {
    const app = createApp(t);
    app.window.BdApi.Webpack.getByKeys = () => ({});
    for (const modeKey of ['v', 'V']) {
        app.key(modeKey);
        app.key('k');
        app.chat.scrollTop = 200;
        app.key('G');
        assert.equal(app.plugin.mode, 'normal');
        assert.equal(app.chat.scrollTop, app.chat.scrollHeight);
        assert.equal(app.plugin.messages.selected, null);
        assert.equal(app.document.querySelector('.vimcord-message-in-range'), null);
    }
    assert.equal(app.composer.textContent, 'Existing draft');
});

test('copy preserves line breaks and emoji labels without copying message metadata', async (t) => {
    const app = createApp(t);
    app.document.getElementById('message-content-5').innerHTML =
        'Hello<br><img alt=":wave:"> friend';
    app.keys('vy');
    await Promise.resolve();
    assert.deepEqual(app.copies, ['Hello\n:wave: friend']);
});

test('copy separates paragraphs and list items while preserving inline text', async (t) => {
    const app = createApp(t);
    const content = app.document.getElementById('message-content-5');
    const markup =
        '<p>First <strong>paragraph</strong>.</p><p>Second paragraph.</p>' +
        '<ul><li>First <em>item</em><ul><li>Nested item</li></ul></li><li>Second item</li></ul>';
    content.innerHTML = markup;
    app.keys('vy');
    await Promise.resolve();
    assert.deepEqual(app.copies, [
        'First paragraph.\n\nSecond paragraph.\n\nFirst item\nNested item\nSecond item',
    ]);
    assert.equal(content.innerHTML, markup);
});

test('range copy preserves block boundaries, explicit blank lines, and code whitespace', async (t) => {
    const app = createApp(t);
    app.plugin.settings.setPreference('rangeCopyAuthors', false);
    app.document.getElementById('message-content-4').innerHTML =
        '<div>First line<br><br><img alt=":wave:"> last line</div><div>Next line</div>';
    app.document.getElementById('message-content-5').innerHTML =
        '<h2>Heading</h2><blockquote>Quoted text</blockquote>' +
        '<pre><code>  first\n\n    second\n</code></pre>';
    app.keys('Vky');
    await Promise.resolve();
    assert.deepEqual(app.copies, [
        'First line\n\n:wave: last line\nNext line\n\nHeading\nQuoted text\n  first\n\n    second\n',
    ]);
});

test('entering Message mode selects a visible row within the scroller clipping boundary', (t) => {
    const app = createApp(t);
    app.document.querySelector('#message-content-5').parentElement.dataset.box = '220,510,650,50';
    app.key('v');
    assert.equal(app.plugin.messages.rowId, 'chat-messages-20-4');
    assert.equal(app.composer.textContent, 'Existing draft');
});

test('letter remaps for Help leave hint labels available and expose the fixed fallback', (t) => {
    const app = createApp(t, { settings: { keybinds: { help: 'x' } } });
    app.key('f');
    app.key('?');
    assert.ok(app.plugin.help.root);
    assert.match(app.plugin.help.root.textContent, /\?Show contextual help/);
    app.key('Escape');
    assert.equal(app.plugin.mode, 'hint');
    app.key('x');
    assert.equal(app.plugin.help.root, null);
});

test('top requires the whole remapped sequence and bottom jumps the selected pane', (t) => {
    const app = createApp(t, { settings: { keybinds: { jumpTop: 'q' } } });
    app.chat.scrollTop = 600;
    app.key('q');
    assert.equal(app.chat.scrollTop, 600);
    assert.equal(app.plugin.indicator.commandLabel.textContent, 'q');
    app.key('q', { repeat: true });
    assert.equal(app.chat.scrollTop, 600);
    app.key('q');
    assert.equal(app.chat.scrollTop, 0);
    app.key('G');
    assert.equal(app.chat.scrollTop, 2000);
    app.keys('qi');
    assert.equal(app.plugin.mode, 'normal');
    assert.equal(app.plugin.commands.label, '');
});

test('message selection moves by count, copies only content, blocks edits, and cleans up', async (t) => {
    const app = createApp(t);
    app.key('v');
    assert.equal(app.plugin.mode, 'visual');
    assert.equal(app.plugin.messages.rowId, 'chat-messages-20-5');
    app.keys('2k');
    assert.equal(app.plugin.messages.rowId, 'chat-messages-20-3');
    assert.equal(app.document.querySelectorAll('.vimcord-message-selected').length, 1);
    app.key('y');
    await Promise.resolve();
    assert.deepEqual(app.copies, ['Message 3']);
    for (const value of ['x', 'Backspace', 'Delete', 'Enter']) {
        assert.equal(app.key(value).defaultPrevented, true);
    }
    const paste = new app.window.Event('paste', { bubbles: true, cancelable: true });
    app.document.body.dispatchEvent(paste);
    assert.equal(paste.defaultPrevented, true);
    app.keys('gg');
    assert.equal(app.plugin.messages.rowId, 'chat-messages-20-1');
    app.key('G');
    assert.equal(app.plugin.mode, 'normal');
    assert.equal(app.chat.scrollTop, app.chat.scrollHeight);
    app.key('Escape');
    assert.equal(app.plugin.mode, 'normal');
    assert.equal(app.document.querySelector('.vimcord-message-selected'), null);
    app.keys('vx');
    app.plugin.stop();
    assert.equal(app.document.querySelector('.vimcord-message-selected'), null);
    assert.equal(app.composer.textContent, 'Existing draft');
});

test('reply uses the focused native message action and permits Insert without changing the draft', (t) => {
    const app = createApp(t);
    let replyTarget;
    let keyboardNavigation = false;
    app.document.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
            keyboardNavigation = true;
        }
    });
    app.chat.addEventListener('keydown', (event) => {
        if (keyboardNavigation && event.key === 'r' && event.target.matches('[role="article"]')) {
            replyTarget = event.target;
            event.preventDefault();
            app.composer.focus();
        }
    });
    app.keys('vkr');
    assert.equal(replyTarget.closest('li').id, 'chat-messages-20-4');
    assert.equal(app.plugin.mode, 'insert');
    assert.equal(app.document.activeElement, app.composer);
    assert.equal(app.composer.textContent, 'Existing draft');
    assert.equal(app.key('x').defaultPrevented, false);
    app.key('Escape');
    assert.equal(app.plugin.mode, 'normal');
});

test('message rerenders preserve identity; removal, dialogs and channel changes cancel selection', (t) => {
    const app = createApp(t);
    app.keys('vk');
    const selected = app.plugin.messages.selected;
    const replacement = selected.cloneNode(true);
    selected.replaceWith(replacement);
    app.plugin.refresh();
    assert.equal(app.plugin.messages.selected, replacement);
    replacement.closest('li').remove();
    app.plugin.refresh();
    assert.equal(app.plugin.mode, 'normal');
    app.key('v');
    app.plugin.onSwitch();
    assert.equal(app.plugin.mode, 'normal');
    app.key('v');
    const dialog = app.document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    app.document.body.append(dialog);
    app.plugin.refresh();
    assert.equal(app.plugin.mode, 'normal');
    app.key('v');
    assert.equal(app.plugin.mode, 'normal');
});

test('marks persist channel and DM routes, replace by letter, and reject unsafe stored paths', (t) => {
    const app = createApp(t, {
        marks: { x: 'https://example.com', y: '/channels/@me/42', z: '/settings' },
    });
    app.keys('ma');
    assert.deepEqual(app.data.marks, { a: '/channels/10/20', y: '/channels/@me/42' });
    app.window.history.replaceState(null, '', '/channels/@me/99');
    app.keys('mb');
    app.key('m');
    app.key('Shift', { shiftKey: true });
    app.key('C', { shiftKey: true });
    assert.equal(app.data.marks.c, '/channels/@me/99');
    app.keys("'a");
    assert.deepEqual(app.navigations, ['/channels/10/20']);
    app.keys('ma');
    app.keys("'a");
    assert.equal(app.navigations.at(-1), '/channels/@me/99');
    app.keys("'x");
    assert.match(app.toasts.at(-1), /has not been set/);
    app.key('m');
    app.key('Escape');
    app.key('d');
    assert.equal(app.data.marks.d, undefined);
    app.plugin.stop();
    app.plugin.start();
    app.keys("'b");
    assert.equal(app.navigations.at(-1), '/channels/@me/99');
    app.storage.save = () => {
        throw new Error('disk full');
    };
    app.keys('md');
    assert.equal(app.plugin.marks.marks.d, undefined);
    assert.match(app.toasts.at(-1), /disk full/);
});

test('scoped hints select only the pane; all hints and foreground dialogs respect their boundary', (t) => {
    const app = createApp(t);
    app.key('f');
    assert.equal(app.plugin.mode, 'hint');
    assert.ok(app.plugin.hints.entries.length > 0);
    assert.ok(app.plugin.hints.entries.every((entry) => app.chat.contains(entry.element)));
    app.key('Escape');
    app.key('F');
    assert.ok(app.plugin.hints.entries.some((entry) => entry.element.closest('#channels')));
    app.key('Escape');
    app.plugin.settings.setHintsCurrentPane(false);
    app.key('f');
    assert.ok(app.plugin.hints.entries.some((entry) => entry.element.closest('#channels')));
    app.key('Escape');
    const dialog = app.document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = '<button data-box="500,50,150,30">Dialog action</button>';
    app.document.body.append(dialog);
    app.key('F');
    assert.ok(app.plugin.hints.entries.length > 0);
    assert.ok(app.plugin.hints.entries.every((entry) => dialog.contains(entry.element)));
});

test('help reflects remaps and mode, traps keys and closes cleanly without changing selection', (t) => {
    const app = createApp(t, {
        settings: { keybinds: { scrollDown: 'x', jumpTop: 'q', copyMessage: 'c' } },
    });
    app.key('?');
    let help = app.document.querySelector('[data-vimcord="help"]');
    assert.match(help.textContent, /Normal/);
    assert.match(help.textContent, /q q/);
    assert.doesNotMatch(help.textContent, /Copy selected message/);
    app.key('x');
    assert.equal(app.chat.scrollTop, 0);
    app.key('Tab');
    assert.equal(app.document.activeElement, help.querySelector('button'));
    app.key('Escape');
    assert.equal(app.document.querySelector('[data-vimcord="help"]'), null);
    app.key('v');
    const selected = app.plugin.messages.selected;
    app.key('?');
    help = app.document.querySelector('[data-vimcord="help"]');
    assert.match(help.textContent, /Message selection/);
    assert.match(help.textContent, /Copy selected message/);
    assert.match(help.textContent, /Next message/);
    assert.ok([...help.querySelectorAll('kbd')].some((key) => key.textContent === 'c'));
    app.key('Escape');
    assert.equal(app.plugin.mode, 'visual');
    assert.equal(app.document.activeElement, selected);
    app.key('?');
    app.plugin.stop();
    assert.equal(app.document.querySelector('[data-vimcord="help"]'), null);
});

test('ranges extend and shrink, copy chronologically with metadata, and preserve the endpoint when toggled', async (t) => {
    const app = createApp(t);
    for (const id of [1, 2, 3, 4, 5]) {
        const article = app.document.getElementById(`message-content-${id}`).parentElement;
        article.insertAdjacentHTML(
            'afterbegin',
            `<span id="message-username-${id}">Author ${id}</span><time datetime="2026-10-04T12:00:00Z"></time>`,
        );
    }
    app.keys('vV2k');
    assert.equal(app.plugin.mode, 'range');
    assert.equal(app.plugin.indicator.targetLabel.textContent, '3 selected');
    assert.equal(app.document.querySelectorAll('.vimcord-message-in-range').length, 3);
    app.key('y');
    await Promise.resolve();
    assert.equal(
        app.copies.at(-1),
        'Author 3\nMessage 3\n\nAuthor 4\nMessage 4\n\nAuthor 5\nMessage 5',
    );
    app.key('j');
    assert.equal(app.document.querySelectorAll('.vimcord-message-in-range').length, 2);
    app.plugin.settings.setPreference('rangeCopyAuthors', false);
    app.plugin.settings.setPreference('rangeCopyTimestamps', true);
    app.key('y');
    await Promise.resolve();
    assert.equal(
        app.copies.at(-1),
        '[2026-10-04T12:00:00.000Z]\nMessage 4\n\n[2026-10-04T12:00:00.000Z]\nMessage 5',
    );
    app.key('V');
    assert.equal(app.plugin.mode, 'visual');
    assert.equal(app.plugin.messages.rowId, 'chat-messages-20-4');
    assert.equal(app.document.querySelectorAll('.vimcord-message-in-range').length, 0);
    app.key('y');
    await Promise.resolve();
    assert.equal(app.copies.at(-1), 'Message 4');
    app.keys('V?');
    assert.match(app.plugin.help.root.textContent, /chronological order/);
    assert.doesNotMatch(app.plugin.help.root.textContent, /Edit selected message/);
    app.key('Escape');
    app.key('Escape');
    assert.equal(app.plugin.mode, 'normal');
    assert.equal(app.document.querySelectorAll('.vimcord-message-in-range').length, 0);
});

test('range selection handles grouped authors, attachment-only rows, and a disappearing anchor', async (t) => {
    const app = createApp(t);
    const earlier = app.document.getElementById('message-content-4').parentElement;
    earlier.insertAdjacentHTML('afterbegin', '<span id="message-username-4">Grouped author</span>');
    const last = app.document.getElementById('message-content-5');
    last.textContent = '';
    last.parentElement.setAttribute('aria-labelledby', 'message-username-4 message-content-5');
    app.keys('Vky');
    await Promise.resolve();
    assert.equal(
        app.copies.at(-1),
        'Grouped author\nMessage 4\n\nGrouped author\n[No text content]',
    );
    app.document.getElementById('chat-messages-20-5').remove();
    app.plugin.refresh();
    assert.equal(app.plugin.mode, 'normal');
    assert.equal(app.document.querySelectorAll('.vimcord-message-in-range').length, 0);
    assert.equal(app.composer.textContent, 'Existing draft');
});

test('message links support servers and DMs; edit and reaction use native focused shortcuts', async (t) => {
    const app = createApp(t);
    app.keys('vY');
    await Promise.resolve();
    assert.equal(app.copies.at(-1), 'https://discord.com/channels/10/20/5');
    app.window.history.replaceState(null, '', '/channels/@me/20');
    app.key('Y');
    await Promise.resolve();
    assert.equal(app.copies.at(-1), 'https://discord.com/channels/@me/20/5');
    const native = [];
    app.chat.addEventListener('keydown', (event) => {
        native.push([event.key, event.shiftKey, event.target.closest('li')?.id]);
        if (event.key === 'e') {
            app.composer.focus();
        }
    });
    app.key('+', { shiftKey: true });
    assert.deepEqual(native.at(-1), ['+', true, 'chat-messages-20-5']);
    app.key('e');
    assert.deepEqual(native.at(-1), ['e', false, 'chat-messages-20-5']);
    assert.equal(app.plugin.mode, 'insert');
    assert.equal(app.composer.textContent, 'Existing draft');
});

test('Escape reaches a native reaction picker opened by VimCord and closes it in Normal mode', (t) => {
    const app = createApp(t);
    let picker;
    let escaped = false;
    app.chat.addEventListener('keydown', (event) => {
        if (event.key !== '+') {
            return;
        }
        picker = app.document.createElement('div');
        picker.setAttribute('role', 'dialog');
        picker.innerHTML = '<input placeholder="Find the perfect reaction">';
        picker.addEventListener('keydown', (key) => {
            if (key.key === 'Escape' && !key.defaultPrevented) {
                escaped = true;
                picker.remove();
            }
        });
        app.document.body.append(picker);
        picker.querySelector('input').focus();
    });
    app.keys('v+');
    assert.equal(app.plugin.mode, 'insert');
    app.key('Escape');
    assert.equal(escaped, true);
    assert.equal(picker.isConnected, false);
    assert.equal(app.plugin.mode, 'normal');
    assert.equal(app.composer.textContent, 'Existing draft');
});

test('Escape reaches native dialogs and menus after canceling an unfinished command', (t) => {
    const app = createApp(t);
    for (const role of ['dialog', 'menu']) {
        const overlay = app.document.createElement('section');
        overlay.setAttribute('role', role);
        overlay.innerHTML = '<button>Close</button>';
        app.document.body.append(overlay);
        app.plugin.refresh();
        overlay.querySelector('button').focus();
        overlay.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !event.defaultPrevented) {
                overlay.remove();
            }
        });
        app.key('2');
        assert.equal(app.key('Escape').defaultPrevented, true);
        assert.equal(app.plugin.commands.label, '');
        assert.equal(overlay.isConnected, true);
        assert.equal(app.key('Escape').defaultPrevented, false);
        assert.equal(overlay.isConnected, false);
        assert.equal(app.plugin.mode, 'normal');
    }
    assert.equal(app.composer.textContent, 'Existing draft');
});

test('marks manager resolves names, contains input, rejects collisions, and supports remove and undo', (t) => {
    const app = createApp(t, { marks: { b: '/channels/@me/30', a: '/channels/10/20' } });
    app.window.BdApi.Webpack.getStore = (name) =>
        ({
            ChannelStore: {
                getChannel: (id) => (id === '20' ? { name: 'general' } : { recipients: ['40'] }),
            },
            GuildStore: { getGuild: () => ({ name: 'Example server' }) },
            UserStore: { getUser: () => ({ globalName: 'DM friend' }) },
        })[name];
    app.key('M');
    const panel = app.plugin.marksPanel;
    assert.match(panel.root.textContent, /#generalExample server/);
    assert.match(panel.root.textContent, /DM friendDirect message/);
    assert.deepEqual(
        [...panel.list.children].map((row) => row.dataset.mark),
        ['a', 'b'],
    );
    panel.root.querySelector('[data-mark="a"] [data-control="change"]').click();
    panel.renameInput.value = 'b';
    app.key('Enter');
    assert.match(panel.status.textContent, /already used/);
    panel.renameInput.value = '7';
    app.key('Enter');
    assert.match(panel.status.textContent, /one letter/);
    panel.renameInput.value = 'C';
    const paste = new app.window.Event('paste', { bubbles: true, cancelable: true });
    panel.renameInput.dispatchEvent(paste);
    assert.equal(paste.defaultPrevented, false);
    app.key('Enter');
    assert.equal(app.data.marks.c, '/channels/10/20');
    assert.equal(app.data.marks.a, undefined);
    panel.root.querySelector('[data-mark="c"] [data-control="remove"]').click();
    assert.equal(app.data.marks.c, undefined);
    panel.undo.click();
    assert.equal(app.data.marks.c, '/channels/10/20');
    panel.closeButton.focus();
    app.key('Tab', { shiftKey: true });
    assert.equal(
        app.document.activeElement,
        panel.root.querySelector('[data-mark="c"] [data-control="remove"]'),
    );
    assert.equal(app.key('x').defaultPrevented, true);
    assert.equal(app.composer.textContent, 'Existing draft');
    panel.root.querySelector('[data-mark="b"] [data-control="open"]').click();
    assert.equal(app.navigations.at(-1), '/channels/@me/30');
    assert.equal(panel.root, null);
    app.key('M');
    app.storage.save = () => {
        throw new Error('disk full');
    };
    panel.root.querySelector('[data-mark="b"] [data-control="remove"]').click();
    assert.match(panel.status.textContent, /disk full/);
    assert.ok(app.plugin.marks.marks.b);
    app.key('Escape');
    assert.equal(panel.root, null);
});

test('sequence hints follow remaps, delay until a pause, and disappear on completion or disabling', (t) => {
    const app = createApp(t, {
        settings: { keybinds: { jumpTop: 'q', manageMarks: 'B' } },
        marks: { a: '/channels/10/20' },
    });
    const timers = new Map();
    let serial = 0;
    app.window.setTimeout = (callback, delay) => {
        timers.set(++serial, { callback, delay });
        return serial;
    };
    app.window.clearTimeout = (id) => timers.delete(id);
    const show = () => [...timers.values()].find((timer) => timer.delay === 400)?.callback();
    app.key('q');
    assert.equal(app.plugin.sequenceHints.root, null);
    show();
    assert.match(app.plugin.sequenceHints.root.textContent, /q Go to top/);
    app.key('q');
    assert.equal(app.plugin.sequenceHints.root, null);
    app.key("'");
    show();
    assert.match(app.plugin.sequenceHints.root.textContent, /Jump to mark/);
    assert.match(app.plugin.sequenceHints.root.textContent, /B to manage/);
    app.plugin.settings.setPreference('showSequenceHints', false);
    app.plugin.updateIndicator();
    assert.equal(app.plugin.sequenceHints.root, null);
    app.key('Escape');
    app.key('m');
    assert.equal(app.plugin.sequenceHints.signature, '');
    app.plugin.stop();
    assert.equal(app.document.querySelector('[data-vimcord="sequence-hints"]'), null);
});

test('scrolling cancels an unloaded same-channel restore and keeps recording the reading position', (t) => {
    const app = createApp(t);
    app.chat.scrollTop = 200;
    app.plugin.history.update();
    app.plugin.history.beforeJump();
    app.chat.scrollTop = 900;
    app.plugin.history.update();
    const saved = structuredClone(app.plugin.history.entries[0]);
    app.document.getElementById(saved.anchorId).remove();

    app.key('H');
    assert.ok(app.plugin.history.pending);
    app.key('j');
    assert.equal(app.plugin.history.pending, null);
    assert.equal(app.chat.scrollTop, 980);
    assert.equal(app.plugin.history.cursor, 1);
    assert.equal(app.plugin.history.entries.length, 2);
    assert.equal(app.plugin.history.entries[1].scrollTop, 980);
    assert.deepEqual(structuredClone(app.plugin.history.entries[0]), saved);

    app.chat.scrollTop = 1100;
    app.plugin.refresh();
    assert.equal(app.plugin.history.entries[1].scrollTop, 1100);
});

for (const direction of ['back', 'forward']) {
    test(`counted history ${direction} continues from the pending stop with remapped keys`, (t) => {
        const app = createApp(t, {
            settings: { keybinds: { historyBack: 'b', historyForward: 'n' } },
        });
        const switchChannel = (channel) => {
            app.window.history.replaceState(null, '', `/channels/10/${channel}`);
            for (const row of app.chat.querySelectorAll('li')) {
                row.id = `chat-messages-${channel}-${row.id.split('-').at(-1)}`;
            }
            app.plugin.onSwitch();
            app.plugin.refresh();
        };
        for (const channel of [30, 40, 50]) {
            switchChannel(channel);
        }
        if (direction === 'forward') {
            app.keys('3b');
            switchChannel(20);
        }
        const key = direction === 'back' ? 'b' : 'n';
        const target = direction === 'back' ? '/channels/10/20/1' : '/channels/10/50/1';
        const cursor = app.plugin.history.cursor;

        app.key(key);
        const pending = app.plugin.history.pending;
        assert.ok(pending);
        app.key('2');
        assert.equal(app.plugin.history.pending, pending);
        app.key(key);
        assert.equal(app.navigations.at(-1), target);
        assert.equal(app.plugin.history.cursor, cursor);

        const scrollTop = app.chat.scrollTop;
        app.keys('2j');
        assert.equal(app.plugin.history.pending, null);
        assert.equal(app.chat.scrollTop, scrollTop + 160);
    });
}

test('reading history restores channel and selected message, ignores stale rows, and branches after going back', (t) => {
    const app = createApp(t);
    const switchChannel = (channel) => {
        app.window.history.replaceState(null, '', `/channels/10/${channel}`);
        app.plugin.onSwitch();
        app.plugin.refresh();
        for (const row of app.chat.querySelectorAll('li')) {
            row.id = `chat-messages-${channel}-${row.id.split('-').at(-1)}`;
        }
        app.plugin.refresh();
    };
    app.keys('v2k');
    switchChannel(30);
    assert.equal(app.plugin.history.entries.length, 2);
    assert.equal(app.plugin.history.entries[0].selectedId, 'chat-messages-20-3');
    app.key('H');
    assert.equal(app.navigations.at(-1), '/channels/10/20/1');
    switchChannel(20);
    assert.equal(app.plugin.mode, 'visual');
    assert.equal(app.plugin.messages.rowId, 'chat-messages-20-3');
    assert.equal(app.plugin.history.entries.length, 2);
    app.plugin.onSwitch();
    app.plugin.refresh();
    assert.equal(app.plugin.messages.rowId, 'chat-messages-20-3');
    app.key('L');
    switchChannel(30);
    assert.equal(app.plugin.history.cursor, 1);
    app.key('H');
    switchChannel(20);
    switchChannel(40);
    assert.equal(app.plugin.history.entries.length, 2);
    assert.equal(app.plugin.history.entries.at(-1).path, '/channels/10/40');
    app.key('L');
    assert.match(app.toasts.at(-1), /No later/);
    app.plugin.stop();
    assert.equal(app.plugin.history.pending, null);
});

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

function createApp(t, markup, settings = {}) {
    const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
        runScripts: 'outside-only',
        pretendToBeVisual: true,
    });
    const { window } = dom;
    const { document } = window;
    const timers = new Map();
    let now = 0;
    let nextTimer = 0;
    window.setTimeout = (callback, delay) => {
        const timer = ++nextTimer;
        timers.set(timer, { callback, due: now + delay });
        return timer;
    };
    window.clearTimeout = (timer) => timers.delete(timer);
    const frames = new Map();
    let nextFrame = 0;
    window.requestAnimationFrame = (callback) => {
        const frame = ++nextFrame;
        frames.set(frame, callback);
        return frame;
    };
    window.cancelAnimationFrame = (frame) => frames.delete(frame);
    window.ResizeObserver = class {
        constructor(callback) {
            this.callback = callback;
            this.observed = new Set();
        }
        observe(element) {
            this.observed.add(element);
        }
        unobserve(element) {
            this.observed.delete(element);
        }
        disconnect() {
            this.observed.clear();
        }
    };
    const bounds = (element) => {
        if (element.classList.contains('vimcord-hint')) {
            return [10, 10, 18, 18];
        }
        return JSON.parse(element.dataset.bounds || '[0, 0, 800, 600]');
    };
    window.HTMLElement.prototype.getBoundingClientRect = function () {
        const [left, top, width, height] = bounds(this);
        return { left, top, width, height, right: left + width, bottom: top + height };
    };
    for (const [property, index] of [
        ['clientWidth', 2],
        ['clientHeight', 3],
    ]) {
        Object.defineProperty(window.HTMLElement.prototype, property, {
            get() {
                return bounds(this)[index];
            },
        });
    }
    Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', {
        get() {
            return Number(this.dataset.scrollHeight || bounds(this)[3]);
        },
    });
    window.HTMLElement.prototype.scrollBy = function ({ top }) {
        this.scrollTop += top;
    };
    window.HTMLElement.prototype.scrollTo = function ({ top }) {
        this.scrollTop = top;
    };
    window.BdApi = {
        Data: { load: () => settings, save() {} },
        DOM: {
            addStyle(name, css) {
                const style = document.createElement('style');
                style.id = name;
                style.textContent = css;
                document.head.append(style);
            },
            removeStyle(name) {
                document.getElementById(name)?.remove();
            },
        },
    };
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
    return {
        window,
        document,
        plugin,
        frames,
        timers,
        advanceTime(milliseconds) {
            now += milliseconds;
            for (const [timer, { callback, due }] of timers) {
                if (due <= now) {
                    timers.delete(timer);
                    callback();
                }
            }
        },
        key(key, target = document.activeElement) {
            target.dispatchEvent(
                new window.KeyboardEvent('keydown', {
                    key,
                    bubbles: true,
                    cancelable: true,
                }),
            );
        },
        async refreshFrames() {
            await Promise.resolve();
            const callbacks = [...frames.values()];
            frames.clear();
            for (const callback of callbacks) {
                callback();
            }
        },
    };
}

const settingsMarkup = `
    <div class="standardSidebarView_test">
        <aside class="sidebarRegion_test">
            <div class="scroller_test" id="sidebar" style="overflow-y: auto"
                 data-bounds="[0, 0, 180, 500]">
                <nav role="tablist">
                    <button role="tab" aria-selected="true">Plugins</button>
                </nav>
            </div>
        </aside>
        <main class="contentRegion_test">
            <h1>Plugins</h1>
            <div class="scroller_test" id="plugins" style="overflow-y: auto"
                 data-bounds="[200, 40, 580, 480]">
                <input type="search" aria-label="Search plugins" data-bounds="[220, 60, 300, 32]">
                <label for="distance">Scroll amount</label>
                <input id="distance" type="number" data-bounds="[220, 140, 100, 32]">
            </div>
        </main>
    </div>`;

const friendsMarkup = `
    <nav data-list-id="private-channels" style="overflow-y:auto" data-bounds="[0,0,200,600]"></nav>
    <div data-list-id="people" id="friends" style="overflow-y:auto" data-bounds="[220,0,500,600]"></div>
    <div class="nowPlayingColumn_test" id="activity-column" data-bounds="[750,0,250,600]">
        <aside>
            <div class="scroller_test" id="activity" style="overflow-y:scroll"
                data-scroll-height="1200" data-bounds="[750,0,250,600]">
                <h2>Active Now</h2>
            </div>
        </aside>
    </div>`;

test('Active Now is selectable to the right of Friends and uses the actual inner scroller', async (t) => {
    const app = createApp(t, friendsMarkup);
    app.key('l');
    assert.equal(app.plugin.panes.label, 'Friends');
    app.key('l');
    assert.equal(app.plugin.panes.label, 'Active Now');
    assert.equal(app.plugin.indicator.targetLabel.textContent, 'Active Now');
    const activity = app.document.getElementById('activity');
    assert.equal(app.plugin.panes.active.element, activity);
    app.key('j');
    assert.equal(activity.scrollTop, 80);
    assert.equal(app.document.getElementById('friends').scrollTop, 0);
    app.key('d');
    assert.equal(activity.scrollTop, 380);
    app.key('g');
    app.key('g');
    assert.equal(activity.scrollTop, 0);
    app.key('G');
    assert.equal(activity.scrollTop, 1200);
    app.key('h');
    assert.equal(app.plugin.panes.label, 'Friends');

    app.key('l');
    app.document.getElementById('activity-column').hidden = true;
    await app.refreshFrames();
    assert.ok(!app.plugin.panes.panes.some((pane) => pane.key === 'activeNow'));
    assert.equal(app.plugin.panes.label, 'Friends');
    app.document.getElementById('activity-column').hidden = false;
    await app.refreshFrames();
    app.key('l');
    assert.equal(app.plugin.panes.label, 'Active Now');
});

test('generic discovery finds unlabeled-class panels and excludes nested content, wrappers and controls', (t) => {
    const app = createApp(
        t,
        `
        <div style="overflow-y:auto" data-scroll-height="2000" data-bounds="[0,0,1000,600]">
            <div data-list-id="chat-messages" style="overflow-y:auto" data-bounds="[0,0,500,600]">
                <div role="article"><pre style="overflow-y:auto" data-scroll-height="900" data-bounds="[10,50,400,300]"></pre></div>
            </div>
            <section>
                <h2>Saved items</h2>
                <div id="saved" style="overflow-y:auto" data-scroll-height="1500" data-bounds="[600,0,400,600]">
                    <div id="nested" style="overflow-y:auto" data-scroll-height="900" data-bounds="[600,20,300,200]"></div>
                </div>
            </section>
        </div>
        <textarea style="overflow-y:auto" data-scroll-height="900" data-bounds="[0,0,300,200]"></textarea>
        <div class="channelTextArea_test"><div style="overflow-y:auto" data-scroll-height="900" data-bounds="[0,0,300,200]"></div></div>
        <div data-vimcord="test" style="overflow-y:auto" data-scroll-height="900" data-bounds="[0,0,300,200]"></div>
        <div role="menu" style="overflow-y:auto" data-scroll-height="900" data-bounds="[0,0,300,200]"></div>
        <div id="tiny" style="overflow-y:auto" data-scroll-height="900" data-bounds="[0,0,80,60]"></div>
        <div hidden style="overflow-y:auto" data-scroll-height="900" data-bounds="[0,0,300,200]"></div>
        <div style="overflow-y:hidden" data-bounds="[0,0,200,80]">
            <div id="clipped" style="overflow-y:auto" data-scroll-height="900" data-bounds="[0,0,300,300]"></div>
        </div>`,
    );
    assert.deepEqual(
        Array.from(app.plugin.panes.panes, (pane) => pane.label),
        ['Messages', 'Saved items'],
    );
    app.key('l');
    assert.equal(app.plugin.panes.active.element.id, 'saved');
    app.key('j');
    assert.equal(app.document.getElementById('saved').scrollTop, 80);
    assert.equal(app.document.getElementById('nested').scrollTop, 0);
});

test('generic panes track content growth, attribute changes and removal without rescanning unchanged branches', async (t) => {
    const app = createApp(
        t,
        `
        <div data-list-id="chat-messages" style="overflow-y:auto" data-bounds="[0,0,500,600]"></div>
        <section aria-label="Activity feed">
            <div id="feed" style="overflow-y:auto" data-bounds="[600,0,300,500]"></div>
        </section>`,
    );
    const discovery = app.plugin.panes.scrollPanels;
    const scanned = [];
    const scan = discovery.scan.bind(discovery);
    discovery.scan = (root) => {
        scanned.push(root);
        scan(root);
    };
    app.plugin.refresh();
    assert.equal(scanned.length, 0);
    const feed = app.document.getElementById('feed');
    feed.dataset.scrollHeight = '1000';
    const content = app.document.createElement('div');
    feed.append(content);
    await app.refreshFrames();
    assert.equal(app.plugin.panes.panes.length, 2);
    assert.deepEqual(scanned, [content]);
    app.key('l');
    assert.equal(app.plugin.panes.label, 'Activity feed');
    app.plugin.refresh();
    assert.equal(scanned.length, 1);

    feed.parentElement.removeAttribute('aria-label');
    const heading = app.document.createElement('h2');
    heading.textContent = 'Activity feed';
    feed.parentElement.prepend(heading);
    await app.refreshFrames();
    heading.firstChild.data = 'Recent activity';
    await app.refreshFrames();
    assert.equal(app.plugin.panes.label, 'Recent activity');

    const replacement = feed.cloneNode(true);
    feed.replaceWith(replacement);
    await app.refreshFrames();
    assert.equal(app.plugin.panes.active.element, replacement);
    assert.equal(app.plugin.panes.label, 'Recent activity');
    replacement.style.overflowY = 'hidden';
    await app.refreshFrames();
    assert.equal(app.plugin.panes.label, 'Messages');
    assert.equal(app.plugin.panes.panes.length, 1);
    replacement.style.overflowY = 'auto';
    await app.refreshFrames();
    assert.equal(app.plugin.panes.panes.length, 2);
    replacement.remove();
    await app.refreshFrames();
    assert.equal(app.plugin.panes.panes.length, 1);
    app.plugin.stop();
    assert.equal(discovery.candidates.size, 0);
    assert.equal(discovery.dirtyRoots.size, 0);
});

test('all added panels in one mutation batch are indexed in spatial order and dialogs isolate discovery', async (t) => {
    const app = createApp(
        t,
        '<div data-list-id="chat-messages" style="overflow-y:auto" data-bounds="[0,0,300,500]"></div>',
    );
    for (const [name, left] of [
        ['Right', 650],
        ['Middle', 320],
    ]) {
        const panel = app.document.createElement('section');
        panel.setAttribute('aria-label', name);
        panel.style.overflowY = 'auto';
        panel.dataset.scrollHeight = '900';
        panel.dataset.bounds = JSON.stringify([left, 0, 250, 500]);
        app.document.body.append(panel);
    }
    await app.refreshFrames();
    assert.deepEqual(
        Array.from(app.plugin.panes.panes, (pane) => pane.label),
        ['Messages', 'Middle', 'Right'],
    );
    app.key('l');
    assert.equal(app.plugin.panes.label, 'Middle');
    const dialog = app.document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML =
        '<div aria-label="Dialog results" style="overflow-y:auto" data-scroll-height="900" data-bounds="[200,50,500,400]"></div>';
    app.document.body.append(dialog);
    await app.refreshFrames();
    assert.equal(app.plugin.panes.panes.length, 1);
    assert.equal(app.plugin.panes.label, 'Dialog results');
    app.key('h');
    assert.equal(app.plugin.panes.label, 'Dialog results');
    dialog.remove();
    await app.refreshFrames();
    assert.equal(app.plugin.panes.label, 'Middle');
});

test('settings panes have meaningful names and navigation moves the outline', (t) => {
    const app = createApp(t, settingsMarkup);
    const indicator = app.plugin.indicator;
    assert.equal(indicator.targetLabel.textContent, 'Plugins');
    assert.equal(indicator.outline.hidden, false);
    assert.equal(indicator.outline.style.left, '200px');
    assert.equal(indicator.outline.style.width, '580px');

    app.key('h');
    assert.equal(indicator.targetLabel.textContent, 'Settings sidebar');
    assert.equal(indicator.outline.style.left, '0px');
    assert.equal(indicator.outline.style.width, '180px');
    app.key('l');
    assert.equal(indicator.targetLabel.textContent, 'Plugins');
    assert.equal(indicator.badge.getAttribute('role'), 'status');
});

test('badge docks in the available user panel and follows panel and dialog replacements', async (t) => {
    const app = createApp(
        t,
        `
        <section class="panels_hidden" hidden></section>
        <section class="panels_test"><button>User settings</button></section>
        <div data-list-id="chat-messages" style="overflow-y:auto"></div>`,
    );
    const indicator = app.plugin.indicator;
    const panel = app.document.querySelector('.panels_test');
    assert.equal(indicator.badge.parentElement, panel);
    assert.equal(app.window.getComputedStyle(indicator.badge).position, 'static');
    assert.equal(indicator.element.parentElement, app.document.body);
    assert.equal(panel.querySelector('button').textContent, 'User settings');

    const dialog = app.document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', 'Settings');
    dialog.className = 'scroller_test';
    dialog.style.overflowY = 'auto';
    app.document.body.append(dialog);
    await app.refreshFrames();
    assert.equal(indicator.badge.parentElement, indicator.element);
    assert.equal(indicator.element.parentElement, dialog);
    assert.equal(indicator.badge.classList.contains('is-floating'), true);

    dialog.remove();
    await app.refreshFrames();
    assert.equal(indicator.badge.parentElement, panel);
    panel.remove();
    await app.refreshFrames();
    assert.equal(indicator.badge.parentElement, indicator.element);

    const replacement = app.document.createElement('section');
    replacement.className = 'panels_replacement';
    app.document.body.append(replacement);
    await app.refreshFrames();
    assert.equal(indicator.badge.parentElement, replacement);
    assert.equal(app.document.querySelectorAll('[data-vimcord="badge"]').length, 1);
    app.plugin.stop();
    assert.equal(app.document.querySelector('[data-vimcord]'), null);
    assert.equal(replacement.childElementCount, 0);
});

test('outline fades after three seconds without being revived by scrolling or refreshes', async (t) => {
    const app = createApp(t, settingsMarkup);
    const indicator = app.plugin.indicator;
    const opacity = () => app.window.getComputedStyle(indicator.outline).opacity;
    assert.equal(opacity(), '1');
    app.advanceTime(2900);
    app.plugin.refresh();
    app.document.querySelector('#plugins').dispatchEvent(new app.window.Event('scroll'));
    await app.refreshFrames();
    assert.equal(opacity(), '1');
    app.advanceTime(100);
    assert.equal(opacity(), '0');

    app.plugin.panes.active.element.scrollBy = () => {};
    app.key('j');
    app.plugin.refresh();
    assert.equal(opacity(), '0');
    assert.equal(app.timers.size, 0);
    app.key('h');
    assert.equal(opacity(), '1');
    app.advanceTime(3000);
    assert.equal(opacity(), '0');
    app.document.querySelector('input[type="search"]').focus();
    assert.equal(opacity(), '1');
    app.plugin.stop();
    assert.equal(app.timers.size, 0);
});

test('the outline uses the saved delay and immediately replaces its timer when the delay changes', (t) => {
    const app = createApp(t, settingsMarkup, { focusOutlineFadeDelay: 1.5 });
    const opacity = () => app.window.getComputedStyle(app.plugin.indicator.outline).opacity;
    app.advanceTime(1499);
    assert.equal(opacity(), '1');
    app.advanceTime(1);
    assert.equal(opacity(), '0');
    app.key('h');
    app.advanceTime(500);

    const panel = app.plugin.getSettingsPanel();
    app.document.querySelector('#plugins').append(panel);
    const delay = panel.querySelector('input[id$="-fade-delay"]');
    delay.value = '4.5';
    delay.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    assert.equal(app.timers.size, 1);
    app.advanceTime(1000);
    assert.equal(opacity(), '1');
    app.advanceTime(3499);
    assert.equal(opacity(), '1');
    app.advanceTime(1);
    assert.equal(opacity(), '0');
});

test('the focus outline toggle applies immediately while the badge stays available', (t) => {
    const app = createApp(t, settingsMarkup, { showFocusOutline: false });
    const indicator = app.plugin.indicator;
    assert.equal(indicator.outline.hidden, true);
    assert.equal(app.timers.size, 0);
    const panel = app.plugin.getSettingsPanel();
    app.document.querySelector('#plugins').append(panel);
    const toggle = panel.querySelector('[role="switch"]');
    assert.equal(toggle.checked, false);
    toggle.click();
    assert.equal(app.plugin.settings.showFocusOutline, true);
    assert.equal(indicator.outline.hidden, false);
    assert.equal(app.window.getComputedStyle(indicator.outline).opacity, '1');
    toggle.click();
    assert.equal(app.plugin.settings.showFocusOutline, false);
    assert.equal(indicator.outline.hidden, true);
    assert.equal(indicator.badge.isConnected, true);
    assert.equal(app.timers.size, 0);
    app.key('h');
    assert.equal(indicator.outline.hidden, true);
});

test('settings dialog distinguishes its named sidebar from the page title', (t) => {
    const app = createApp(
        t,
        `
        <div role="dialog" aria-labelledby="page-title">
            <h1 id="page-title">Plugins</h1>
            <aside aria-labelledby="sidebar-title">
                <h2 id="sidebar-title">Settings sidebar</h2>
                <nav aria-label="Settings pages">
                    <div class="navScroller_test" style="overflow-y:scroll"
                         data-bounds="[0, 0, 180, 500]"></div>
                </nav>
            </aside>
            <div class="scroller_test" style="overflow-y:scroll"
                 data-bounds="[200, 40, 580, 480]"></div>
        </div>`,
    );
    assert.equal(app.plugin.indicator.targetLabel.textContent, 'Plugins');
    app.key('h');
    assert.equal(app.plugin.indicator.targetLabel.textContent, 'Settings sidebar');
    app.key('l');
    assert.equal(app.plugin.indicator.targetLabel.textContent, 'Plugins');
});

test('Insert tracks the actual field across focus changes and clears stale field names', async (t) => {
    const app = createApp(t, settingsMarkup);
    const indicator = app.plugin.indicator;
    const search = app.document.querySelector('input[type="search"]');
    search.value = 'a private search';
    search.focus();
    assert.equal(indicator.modeLabel.textContent, 'Insert');
    assert.equal(indicator.targetLabel.textContent, 'Search plugins');
    assert.equal(indicator.outline.style.width, '300px');
    assert.ok(!indicator.label.textContent.includes(search.value));

    app.document.querySelector('#distance').focus();
    assert.equal(indicator.targetLabel.textContent, 'Scroll amount');
    assert.equal(indicator.outline.style.width, '100px');
    app.document.activeElement.blur();
    await app.refreshFrames();
    assert.equal(indicator.targetLabel.textContent, 'No text field');
    assert.equal(indicator.outline.hidden, true);
    app.key('Escape');
    assert.equal(indicator.targetLabel.textContent, 'Plugins');
    assert.equal(indicator.outline.hidden, false);
});

test('generic dialogs use their accessible name and Hint hides the pane outline', (t) => {
    const app = createApp(
        t,
        `
        <div role="dialog" aria-labelledby="title" class="scroller_test" style="overflow-y:auto">
            <h2 id="title">Invite friends</h2>
            <button data-bounds="[10, 10, 80, 24]">Copy invite</button>
        </div>`,
    );
    const indicator = app.plugin.indicator;
    assert.equal(indicator.targetLabel.textContent, 'Invite friends');
    app.document.elementFromPoint = () => app.document.querySelector('button');
    app.key('f');
    assert.equal(indicator.modeLabel.textContent, 'Hint');
    assert.equal(indicator.targetLabel.textContent, 'Choose a control');
    assert.equal(indicator.outline.hidden, true);
    assert.equal(indicator.shortcuts.textContent, 'Esc cancel');
    app.key('Escape');
    assert.equal(indicator.outline.hidden, false);
});

test('changing settings content updates the name without a route event', async (t) => {
    const app = createApp(t, settingsMarkup);
    app.document.querySelector('[role="tab"]').textContent = 'Themes';
    app.document.querySelector('h1').textContent = 'Themes';
    await app.refreshFrames();
    assert.equal(app.plugin.indicator.targetLabel.textContent, 'Themes');
});

test('key reminders use configured bindings and update immediately after a remap', (t) => {
    const app = createApp(t, settingsMarkup, { keybinds: { scrollDown: 'q' } });
    const indicator = app.plugin.indicator;
    assert.deepEqual(
        [...indicator.shortcuts.querySelectorAll('kbd')].map((el) => el.textContent),
        ['q', 'k'],
    );
    const panel = app.plugin.getSettingsPanel();
    app.document.querySelector('#plugins').append(panel);
    const binding = panel.querySelector('[data-action="scrollDown"]');
    binding.click();
    app.key(' ', binding);
    assert.deepEqual(
        [...indicator.shortcuts.querySelectorAll('kbd')].map((el) => el.textContent),
        ['Space', 'k'],
    );
});

test('resize and scroll reposition a clipped outline and stop cleans up all observers', async (t) => {
    const app = createApp(t, settingsMarkup);
    const indicator = app.plugin.indicator;
    const pane = app.document.querySelector('#plugins');
    const region = app.document.querySelector('main');
    region.style.overflowY = 'hidden';
    region.dataset.bounds = '[200, 40, 580, 220]';
    pane.dataset.bounds = '[200, -20, 580, 480]';
    region.dispatchEvent(new app.window.Event('scroll'));
    indicator.resizeObserver.callback();
    await app.refreshFrames();
    assert.equal(indicator.outline.style.top, '40px');
    assert.equal(indicator.outline.style.height, '220px');

    pane.dataset.bounds = '[200, 40, 400, 480]';
    indicator.resizeObserver.callback();
    await app.refreshFrames();
    assert.equal(indicator.outline.style.width, '400px');
    assert.ok(indicator.resizeObserver.observed.has(pane));
    indicator.resizeObserver.callback();
    app.plugin.stop();
    assert.equal(indicator.resizeObserver.observed.size, 0);
    assert.equal(app.document.querySelector('[data-vimcord]'), null);
    assert.equal(app.frames.size, 0);
    region.dispatchEvent(new app.window.Event('scroll'));
    assert.equal(app.frames.size, 0);
    assert.equal(pane.className, 'scroller_test');
});

test('closing a dialog restores the chat outline without leaving an overlay behind', async (t) => {
    const app = createApp(
        t,
        `
        <div data-list-id="chat-messages" style="overflow-y:auto" data-bounds="[200, 0, 580, 500]"></div>
        <div role="dialog" aria-label="Preferences" class="scroller_test" style="overflow-y:auto"></div>`,
    );
    assert.equal(app.plugin.indicator.targetLabel.textContent, 'Preferences');
    app.document.querySelector('[role="dialog"]').remove();
    await app.refreshFrames();
    assert.equal(app.plugin.indicator.targetLabel.textContent, 'Messages');
    assert.equal(app.document.querySelectorAll('[data-vimcord="indicator"]').length, 1);
    assert.equal(app.plugin.indicator.element.parentElement, app.document.body);
});

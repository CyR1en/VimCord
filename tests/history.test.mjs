import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReadingHistory } from '../src/history.js';

function fixture(t) {
    let current = {
        path: '/channels/10/20',
        anchorId: 'chat-messages-20-1',
        selectedId: null,
        offset: -20,
        scrollTop: 200,
    };
    let available = true;
    const routes = [];
    const notices = [];
    const history = new ReadingHistory({
        capture: () => current && { ...current },
        restore: (position) => {
            if (!available) {
                return false;
            }
            current = { ...position };
            return true;
        },
        navigate: (path) => routes.push(path),
        notify: (message) => notices.push(message),
    });
    t.after(() => history.stop());
    history.update();
    return {
        history,
        routes,
        notices,
        set(position) {
            current = { ...current, ...position };
        },
        missing() {
            available = false;
        },
        get current() {
            return current;
        },
    };
}

test('history records jumps, restores pixel offsets, and keeps ordinary reading within a stop', (t) => {
    const app = fixture(t);
    app.set({ offset: -10, scrollTop: 210 });
    app.history.update();
    assert.equal(app.history.entries.length, 1);
    app.history.beforeJump();
    app.set({
        anchorId: 'chat-messages-20-9',
        offset: 0,
        scrollTop: 900,
        selectedId: 'chat-messages-20-10',
    });
    app.history.update();
    assert.equal(app.history.entries.length, 2);
    app.history.go(-1);
    assert.equal(app.current.scrollTop, 210);
    assert.equal(app.current.offset, -10);
    app.history.go(1);
    assert.equal(app.current.selectedId, 'chat-messages-20-10');
    assert.equal(app.routes.length, 0);
    app.history.go(-999);
    assert.equal(app.history.cursor, 0);
    app.history.go(-1);
    assert.match(app.notices.at(-1), /No earlier/);
});

test('history bounds its session and drops forward entries only on a new destination', (t) => {
    const app = fixture(t);
    for (let channel = 21; channel < 80; channel++) {
        app.set({ path: `/channels/10/${channel}`, anchorId: `chat-messages-${channel}-1` });
        app.history.update();
    }
    assert.equal(app.history.entries.length, 50);
    app.history.go(-2);
    const target = app.history.pending;
    app.set(target);
    app.history.update();
    app.set({ scrollTop: 500 });
    app.history.update();
    assert.equal(app.history.entries.length, 50);
    app.set({ path: '/channels/10/99', anchorId: 'chat-messages-99-1' });
    app.history.update();
    assert.equal(app.history.entries.length, 49);
    assert.equal(app.history.cursor, 48);
});

test('missing history messages time out and stop cancels pending work', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const app = fixture(t);
    app.set({ path: '/channels/10/30', anchorId: 'chat-messages-30-2' });
    app.history.update();
    app.missing();
    app.history.go(-1);
    assert.equal(app.routes.at(-1), '/channels/10/20/1');
    app.set({ path: '/channels/10/20' });
    app.history.update();
    assert.ok(app.history.pending);
    t.mock.timers.tick(4000);
    assert.equal(app.history.pending, null);
    assert.equal(app.history.cursor, 1);
    assert.match(app.notices.at(-1), /unavailable/);
    app.history.go(-1);
    assert.ok(app.history.pending);
    app.history.stop();
    t.mock.timers.tick(4000);
    assert.equal(app.notices.length, 1);
    assert.equal(app.history.pending, null);
});

test('a failed native navigation preserves the history cursor', (t) => {
    const app = fixture(t);
    app.set({ path: '/channels/10/30' });
    app.history.update();
    app.history.navigate = () => {
        throw new Error('Unavailable');
    };
    assert.throws(() => app.history.go(-1), /Unavailable/);
    assert.equal(app.history.cursor, 1);
    assert.equal(app.history.pending, null);
});

test('timed-out history restores preserve the previous cursor and saved positions', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const app = fixture(t);
    for (const scrollTop of [500, 900]) {
        app.history.beforeJump();
        app.set({ scrollTop, anchorId: `chat-messages-20-${scrollTop}` });
        app.history.update();
    }
    const saved = structuredClone(app.history.entries);
    app.missing();
    app.history.go(-1);
    t.mock.timers.tick(4000);
    app.history.update();
    assert.deepEqual(app.history.entries, saved);
    assert.equal(app.history.cursor, 2);
    assert.equal(app.history.pending, null);
    app.history.go(-1);
    assert.equal(app.history.pending.scrollTop, 500);
});

test('repeated pending history jumps return to the last confirmed stop on timeout or cancellation', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const app = fixture(t);
    for (const scrollTop of [500, 900]) {
        app.history.beforeJump();
        app.set({ scrollTop, anchorId: `chat-messages-20-${scrollTop}` });
        app.history.update();
    }
    const saved = structuredClone(app.history.entries);
    app.missing();
    app.history.go(-1);
    app.history.go(-1);
    assert.equal(app.history.pending.scrollTop, 200);
    t.mock.timers.tick(4000);
    app.history.update();
    assert.deepEqual(app.history.entries, saved);
    assert.equal(app.history.cursor, 2);
    app.history.go(-1);
    app.history.cancelPending();
    app.history.update();
    assert.deepEqual(app.history.entries, saved);
    assert.equal(app.history.cursor, 2);
    t.mock.timers.tick(4000);
    assert.equal(app.notices.length, 1);
});

for (const outcome of ['timeout', 'cancellation']) {
    test(`ordinary reading resumes after a same-channel restore ${outcome}`, (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const app = fixture(t);
        for (const scrollTop of [500, 900]) {
            app.history.beforeJump();
            app.set({ scrollTop, anchorId: `chat-messages-20-${scrollTop}` });
            app.history.update();
        }
        const saved = structuredClone(app.history.entries);
        app.missing();
        app.history.go(-1);
        if (outcome === 'timeout') {
            t.mock.timers.tick(4000);
        } else {
            app.history.cancelPending();
        }
        assert.equal(app.history.pending, null);

        app.set({ scrollTop: 980, anchorId: 'chat-messages-20-980' });
        app.history.update();
        assert.equal(app.history.cursor, 2);
        assert.equal(app.history.entries.length, 3);
        assert.deepEqual(app.history.entries[2], app.current);
        assert.deepEqual(app.history.entries.slice(0, 2), saved.slice(0, 2));
        app.history.go(-1);
        assert.equal(app.history.pending.scrollTop, 500);
    });
}

for (const outcome of ['timeout', 'cancellation', 'early cancellation']) {
    test(`a cross-channel restore ${outcome} preserves forward history after the channel changes`, (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const app = fixture(t);
        for (const channel of [30, 40]) {
            app.set({ path: `/channels/10/${channel}`, anchorId: `chat-messages-${channel}-1` });
            app.history.update();
        }
        app.history.go(-1);
        app.set(app.history.pending);
        app.history.update();
        const saved = structuredClone(app.history.entries);
        const restore = app.history.restore;
        app.history.restore = () => false;

        app.history.go(-1);
        if (outcome === 'early cancellation') {
            app.history.cancelPending();
            app.history.update();
        }
        app.set({ path: '/channels/10/20', anchorId: 'chat-messages-20-99' });
        app.history.update();
        if (outcome === 'timeout') {
            t.mock.timers.tick(4000);
        } else {
            app.history.cancelPending();
        }
        app.history.update();
        app.set({ scrollTop: 500 });
        app.history.update();
        assert.equal(app.history.pending, null);
        assert.equal(app.history.cursor, 1);
        assert.deepEqual(app.history.entries, saved);

        app.history.go(1);
        assert.equal(app.routes.at(-1), '/channels/10/40/1');
        app.history.restore = restore;
        app.set(app.history.pending);
        app.history.update();
        app.set({ scrollTop: 600 });
        app.history.update();
        assert.equal(app.history.cursor, 2);
        assert.equal(app.history.entries.length, 3);
        assert.equal(app.history.entries[2].scrollTop, 600);
        assert.deepEqual(app.history.entries.slice(0, 2), saved.slice(0, 2));
    });
}

test('leaving a canceled destination resumes ordinary channel history', (t) => {
    const app = fixture(t);
    app.set({ path: '/channels/10/30', anchorId: 'chat-messages-30-1' });
    app.history.update();
    const saved = structuredClone(app.history.entries);
    app.missing();
    app.history.go(-1);
    app.set({ path: '/channels/10/20', anchorId: 'chat-messages-20-99' });
    app.history.cancelPending();
    app.history.update();
    assert.deepEqual(app.history.entries, saved);

    app.set(saved[1]);
    app.history.update();
    app.set({ path: '/channels/10/20', anchorId: 'chat-messages-20-99' });
    app.history.update();
    assert.equal(app.history.cursor, 2);
    assert.equal(app.history.entries[2].anchorId, 'chat-messages-20-99');
    assert.deepEqual(app.history.entries.slice(0, 2), saved);
});

test('an explicit jump resumes recording within a canceled destination', (t) => {
    const app = fixture(t);
    for (const channel of [30, 40]) {
        app.set({ path: `/channels/10/${channel}`, anchorId: `chat-messages-${channel}-1` });
        app.history.update();
    }
    app.history.go(-1);
    app.set(app.history.pending);
    app.history.update();
    const saved = structuredClone(app.history.entries);
    app.missing();
    app.history.go(-1);
    app.set({ path: '/channels/10/20', anchorId: 'chat-messages-20-99' });
    app.history.cancelPending();
    app.history.update();
    assert.deepEqual(app.history.entries, saved);

    app.history.beforeJump();
    app.set({ anchorId: 'chat-messages-20-100', scrollTop: 900 });
    app.history.update();
    assert.equal(app.history.cursor, 3);
    assert.equal(app.history.entries.length, 4);
    assert.deepEqual(app.history.entries.slice(0, 2), saved.slice(0, 2));
    assert.equal(app.history.entries[2].anchorId, 'chat-messages-20-99');
    assert.equal(app.history.entries[3].anchorId, 'chat-messages-20-100');
});

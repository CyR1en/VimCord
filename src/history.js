const CHANNEL_PATH = /^\/channels\/(?:@me|\d+)\/\d+$/;

export function captureReadingPosition(panes, messages) {
    const path = window.location.pathname.split('/').slice(0, 4).join('/');
    const pane = panes.panes.find((candidate) => candidate.key === 'chat');
    if (panes.dialog || !pane?.element.isConnected || !CHANNEL_PATH.test(path)) {
        return null;
    }
    const channel = path.split('/')[3];
    const articles = [...pane.element.querySelectorAll('[id^="chat-messages-"] [role="article"]')];
    if (
        articles.some(
            (article) =>
                !article
                    .closest('[id^="chat-messages-"]')
                    .id.startsWith(`chat-messages-${channel}-`),
        )
    ) {
        return null;
    }
    const bounds = pane.element.getBoundingClientRect();
    const anchor = articles.find((article) => {
        const rect = article.getBoundingClientRect();
        return rect.height > 0 && rect.bottom > bounds.top && rect.top < bounds.bottom;
    });
    return {
        path,
        anchorId: anchor?.closest('[id^="chat-messages-"]').id || null,
        offset: anchor ? anchor.getBoundingClientRect().top - bounds.top : 0,
        scrollTop: pane.element.scrollTop,
        selectedId: pane.element.contains(messages.selected) ? messages.rowId : null,
    };
}

function samePosition(first, second) {
    return (
        first.path === second.path &&
        first.anchorId === second.anchorId &&
        first.selectedId === second.selectedId &&
        Math.abs(first.offset - second.offset) < 2 &&
        Math.abs(first.scrollTop - second.scrollTop) < 2
    );
}

// Ordinary reading updates the current stop; only jumps add another stop.
export class ReadingHistory {
    constructor({ capture, restore, navigate, notify }) {
        this.capture = capture;
        this.restore = restore;
        this.navigate = navigate;
        this.notify = notify;
        this.entries = [];
        this.cursor = -1;
        this.pending = null;
        this.pendingCursor = null;
        this.canceledPaths = new Set();
        this.lastPath = null;
        this.restored = null;
        this.jumpFrom = null;
    }

    update() {
        const position = this.capture();
        if (!position) {
            return;
        }
        const previousPath = this.lastPath;
        this.lastPath = position.path;
        if (this.pending) {
            if (position.path === this.pending.path && this.restore(this.pending)) {
                this.restored = this.pending;
                this.cursor = this.pendingCursor;
                this.cancelPending();
                this.canceledPaths.clear();
                this.entries[this.cursor] = this.capture() || position;
            }
            return;
        }
        // Canceled cross-channel routes can still load after their restore has been abandoned.
        if (this.canceledPaths.has(position.path)) {
            return;
        }
        if (position.path !== previousPath) {
            this.canceledPaths.clear();
        }
        const current = this.entries[this.cursor];
        if (
            !current ||
            current.path !== position.path ||
            (this.jumpFrom && !samePosition(this.jumpFrom, position))
        ) {
            this.entries.splice(this.cursor + 1);
            this.entries.push(position);
            if (this.entries.length > 50) {
                this.entries.shift();
            }
            this.cursor = this.entries.length - 1;
            this.clearJump();
        } else {
            this.entries[this.cursor] = position;
        }
    }

    beforeJump() {
        this.restored = null;
        this.cancelPending();
        this.canceledPaths.clear();
        this.update();
        this.clearJump();
        this.jumpFrom = this.entries[this.cursor] || null;
        this.jumpTimer = setTimeout(() => {
            this.update();
            this.clearJump();
        }, 2000);
    }

    go(amount) {
        this.restored = null;
        if (!this.pending) {
            this.update();
        }
        this.clearJump();
        const from = this.pendingCursor ?? this.cursor;
        const next = Math.max(0, Math.min(this.entries.length - 1, from + amount));
        if (next === from || !this.entries[next]) {
            this.notify(amount < 0 ? 'No earlier reading position.' : 'No later reading position.');
            return;
        }
        this.cancelPending();
        // Repeated jumps follow the requested stop; only a successful restore moves the cursor.
        this.pendingCursor = next;
        this.pending = this.entries[next];
        try {
            if (this.capture()?.path === this.pending.path && this.restore(this.pending)) {
                this.restored = this.pending;
                this.cursor = next;
                this.cancelPending();
                this.canceledPaths.clear();
                return;
            }
            const target = this.pending;
            const messageId = target.anchorId?.split('-').at(-1);
            this.navigate(messageId ? `${target.path}/${messageId}` : target.path);
            this.restoreTimer = setTimeout(() => {
                this.cancelPending();
                this.notify(
                    'That reading position could not be restored. The message may be unavailable.',
                );
            }, 4000);
        } catch (error) {
            this.cancelPending();
            throw error;
        }
    }

    clearJump() {
        clearTimeout(this.jumpTimer);
        this.jumpTimer = null;
        this.jumpFrom = null;
    }

    cancelPending() {
        // Keep recording ordinary reading in the last successfully visited channel.
        if (this.pending && this.pending.path !== this.entries[this.cursor]?.path) {
            this.canceledPaths.add(this.pending.path);
        }
        clearTimeout(this.restoreTimer);
        this.restoreTimer = null;
        this.pending = null;
        this.pendingCursor = null;
    }

    stop() {
        this.restored = null;
        this.clearJump();
        this.cancelPending();
        this.canceledPaths.clear();
        this.lastPath = null;
    }
}

// Counts and prefixes belong to one command and never survive a mode or focus change.
export class CommandSequence {
    constructor() {
        this.reset();
    }

    reset() {
        this.count = '';
        this.prefix = null;
        this.prefixKey = '';
    }

    get label() {
        return this.count + this.prefixKey;
    }

    feed(key, action, repeat = false) {
        if (this.prefix) {
            if (repeat) {
                return null;
            }
            const prefix = this.prefix;
            const count = Number(this.count) || 1;
            this.reset();
            if (prefix === 'jumpTop') {
                return action === prefix ? { action: prefix, count } : null;
            }
            return /^[a-z]$/i.test(key)
                ? { action: prefix, mark: key.toLowerCase(), count: 1 }
                : null;
        }
        if (/^[0-9]$/.test(key)) {
            if (!repeat && (key !== '0' || this.count)) {
                this.count = String(Math.min(999, Number(this.count + key)));
            }
            return null;
        }
        if (['jumpTop', 'setMark', 'jumpMark'].includes(action)) {
            if (!repeat) {
                this.prefix = action;
                this.prefixKey = key;
            }
            return null;
        }
        const count = Number(this.count) || 1;
        this.reset();
        return action ? { action, count } : null;
    }
}

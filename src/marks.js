const CHANNEL_PATH = /^\/channels\/(?:@me|\d+)\/\d+$/;

function markLetter(value) {
    const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!/^[a-z]$/.test(key)) {
        throw new Error('Choose one letter from a to z.');
    }
    return key;
}

export function destinationName(path) {
    const [, , guildId, channelId] = path.split('/');
    const channel = BdApi.Webpack?.getStore?.('ChannelStore')?.getChannel(channelId);
    if (guildId !== '@me') {
        const guild = BdApi.Webpack?.getStore?.('GuildStore')?.getGuild(guildId);
        return {
            name: channel?.name ? `#${channel.name}` : 'Unavailable channel',
            detail: guild?.name || 'Server channel',
        };
    }
    const users = BdApi.Webpack?.getStore?.('UserStore');
    const recipients = (channel?.recipients || [])
        .map((id) => users?.getUser(id))
        .filter(Boolean)
        .map((user) => user.globalName || user.username);
    return {
        name: channel?.name || recipients.join(', ') || 'Unavailable conversation',
        detail: channel?.type === 3 ? 'Group DM' : 'Direct message',
    };
}

export function navigateTo(path) {
    const navigate = BdApi.Webpack?.getByStrings('transitionTo -', { searchExports: true });
    if (typeof navigate !== 'function') {
        throw new Error('Discord navigation is unavailable. Try the Quick Switcher.');
    }
    navigate(path);
}

export class ChannelMarks {
    constructor(storage = BdApi.Data) {
        this.storage = storage;
        this.marks = {};
        try {
            const saved = storage.load('VimCord', 'marks');
            for (const [key, path] of Object.entries(saved || {})) {
                if (/^[a-z]$/.test(key) && typeof path === 'string' && CHANNEL_PATH.test(path)) {
                    this.marks[key] = path;
                }
            }
        } catch (error) {
            console.error('[VimCord] Failed to load channel marks', error);
        }
    }

    save(key) {
        key = markLetter(key);
        const path = window.location.pathname.split('/').slice(0, 4).join('/');
        if (!CHANNEL_PATH.test(path)) {
            throw new Error('Open a channel or DM before setting a mark.');
        }
        this.persist({ ...this.marks, [key]: path });
    }

    persist(next) {
        this.storage.save('VimCord', 'marks', next);
        this.marks = next;
    }

    entries() {
        return Object.entries(this.marks)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, path]) => ({ key, path, ...destinationName(path) }));
    }

    rename(from, value) {
        const key = markLetter(value);
        if (!this.marks[from]) {
            throw new Error('That mark no longer exists.');
        }
        if (key === from) {
            return key;
        }
        if (this.marks[key]) {
            throw new Error(`Mark “${key}” is already used. Choose another letter.`);
        }
        const next = { ...this.marks, [key]: this.marks[from] };
        delete next[from];
        this.persist(next);
        return key;
    }

    remove(key) {
        const path = this.marks[key];
        if (!path) {
            throw new Error('That mark no longer exists.');
        }
        const next = { ...this.marks };
        delete next[key];
        this.persist(next);
        return { key, path };
    }

    restore({ key, path }) {
        if (this.marks[key]) {
            throw new Error(`Mark “${key}” is already used.`);
        }
        this.persist({ ...this.marks, [key]: path });
    }

    jump(key) {
        const path = this.marks[key];
        if (!path) {
            throw new Error(`Mark “${key}” has not been set.`);
        }
        navigateTo(path);
    }
}

import { activeDialog, isVisible } from './dom.js';

const MESSAGE_LIST = '[data-list-id="chat-messages"]';
const MESSAGE_ROW = '[id^="chat-messages-"]';

function messageText(article) {
    const copy = article.querySelector('[id^="message-content-"]')?.cloneNode(true);
    for (const image of copy?.querySelectorAll('img[alt]') || []) {
        image.replaceWith(document.createTextNode(image.alt));
    }
    for (const br of copy?.querySelectorAll('br') || []) {
        br.replaceWith(document.createTextNode('\n'));
    }
    return copy?.textContent || '';
}

function messageAuthor(article) {
    const ids = (article.getAttribute('aria-labelledby') || '').split(/\s+/);
    const reference = ids.find((id) => id.startsWith('message-username-'));
    const name = reference && document.getElementById(reference)?.textContent;
    if (name) {
        return name.trim();
    }
    for (let row = article.closest(MESSAGE_ROW); row; row = row.previousElementSibling) {
        const author = row.querySelector('[id^="message-username-"], [class*="username_"]');
        if (author?.textContent.trim()) {
            return author.textContent.trim();
        }
    }
    return 'Unknown author';
}

export class MessageSelection {
    constructor() {
        this.list = null;
        this.selected = null;
        this.rowId = null;
        this.rangeAnchorId = null;
        this.highlighted = new Set();
    }

    rows() {
        if (!this.list?.isConnected) {
            return [];
        }
        return [...this.list.querySelectorAll(MESSAGE_ROW)]
            .map((row) => row.querySelector('[role="article"]'))
            .filter(
                (article) =>
                    article &&
                    !article.closest('[hidden], [inert], [aria-hidden="true"]') &&
                    article.getBoundingClientRect().height > 0,
            );
    }

    visibleRows(rows) {
        let top = 0;
        let bottom = window.innerHeight;
        for (
            let parent = this.list;
            parent && parent !== document.body;
            parent = parent.parentElement
        ) {
            if (/^(auto|scroll|overlay|hidden|clip)$/.test(getComputedStyle(parent).overflowY)) {
                const rect = parent.getBoundingClientRect();
                top = Math.max(top, rect.top);
                bottom = Math.min(bottom, rect.bottom);
            }
        }
        return rows.filter((row) => {
            const rect = row.getBoundingClientRect();
            return isVisible(row) && rect.bottom > top && rect.top < bottom;
        });
    }

    start(pane, beforeSelect = () => {}) {
        this.stop();
        if (activeDialog()) {
            return false;
        }
        this.list = [...document.querySelectorAll(MESSAGE_LIST)].find(
            (list) => isVisible(list) && (!pane || pane.contains(list) || list.contains(pane)),
        );
        if (!this.list) {
            this.list = [...document.querySelectorAll(MESSAGE_LIST)].find(isVisible);
        }
        const rows = this.rows();
        const focused = rows.find((row) => row.contains(document.activeElement));
        const visible = this.visibleRows(rows);
        const selected = focused || visible.at(-1);
        if (!selected) {
            return false;
        }
        beforeSelect();
        return this.select(selected);
    }

    select(article, scroll = true) {
        if (!article?.isConnected) {
            return false;
        }
        this.selected?.classList.remove('vimcord-message-selected');
        this.selected = article;
        this.rowId = article.closest(MESSAGE_ROW)?.id;
        article.classList.add('vimcord-message-selected');
        article.focus({ preventScroll: true });
        if (scroll) {
            article.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        }
        this.paintRange();
        return true;
    }

    refresh() {
        if (
            activeDialog() ||
            !this.list?.isConnected ||
            (this.rangeAnchorId && !this.list.contains(document.getElementById(this.rangeAnchorId)))
        ) {
            return false;
        }
        if (this.selected?.isConnected) {
            this.paintRange();
            return true;
        }
        const article = document.getElementById(this.rowId)?.querySelector('[role="article"]');
        return !!article && this.list.contains(article) && this.select(article);
    }

    move(amount) {
        if (!this.refresh()) {
            return false;
        }
        const rows = this.rows();
        const index = rows.indexOf(this.selected);
        return this.select(rows[Math.max(0, Math.min(rows.length - 1, index + amount))]);
    }

    jump(edge) {
        const rows = this.rows();
        return this.select(edge === 'top' ? rows[0] : rows.at(-1));
    }

    setRange(enabled) {
        this.rangeAnchorId = enabled ? this.rowId : null;
        this.paintRange();
    }

    selectedRows() {
        if (!this.rangeAnchorId) {
            return this.selected ? [this.selected] : [];
        }
        const rows = this.rows();
        const anchor = rows.findIndex((row) => row.closest(MESSAGE_ROW).id === this.rangeAnchorId);
        const end = rows.indexOf(this.selected);
        if (anchor < 0 || end < 0) {
            return [];
        }
        return rows.slice(Math.min(anchor, end), Math.max(anchor, end) + 1);
    }

    paintRange() {
        for (const row of this.highlighted) {
            row.classList.remove('vimcord-message-in-range');
        }
        this.highlighted.clear();
        if (this.rangeAnchorId) {
            for (const row of this.selectedRows()) {
                row.classList.add('vimcord-message-in-range');
                this.highlighted.add(row);
            }
        }
    }

    async copy({ authors = true, timestamps = false } = {}) {
        if (!this.refresh()) {
            throw new Error('That message is no longer available. Select a message again.');
        }
        let text = messageText(this.selected);
        if (this.rangeAnchorId) {
            text = this.selectedRows()
                .map((row) => {
                    const header = [];
                    if (authors) {
                        header.push(messageAuthor(row));
                    }
                    const date = row.querySelector('time[datetime]')?.getAttribute('datetime');
                    if (timestamps && date && Number.isFinite(Date.parse(date))) {
                        header.push(`[${new Date(date).toISOString()}]`);
                    }
                    const content = messageText(row) || '[No text content]';
                    return header.length ? `${header.join(' ')}\n${content}` : content;
                })
                .join('\n\n');
        }
        if (!text) {
            throw new Error('This message has no text to copy.');
        }
        await navigator.clipboard.writeText(text);
    }

    async copyLink() {
        if (!this.refresh()) {
            throw new Error('That message is no longer available.');
        }
        const ids = this.rowId?.match(/^chat-messages-(\d+)-(\d+)$/);
        const guild = window.location.pathname.split('/')[2];
        if (!ids || !/^(?:@me|\d+)$/.test(guild)) {
            throw new Error('A link is unavailable for this message.');
        }
        await navigator.clipboard.writeText(
            `https://discord.com/channels/${guild}/${ids[1]}/${ids[2]}`,
        );
    }

    stop() {
        this.rangeAnchorId = null;
        this.paintRange();
        this.selected?.classList.remove('vimcord-message-selected');
        if (this.selected === document.activeElement) {
            this.selected.blur();
        }
        this.selected = null;
        this.list = null;
        this.rowId = null;
    }
}

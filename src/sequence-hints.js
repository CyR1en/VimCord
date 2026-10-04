function element(tag, text, className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
}

export class SequenceHints {
    constructor() {
        this.root = null;
        this.signature = '';
    }

    update({ enabled, commands, marks, keybinds, badge }) {
        const signature = enabled && commands.prefix ? commands.prefix + commands.label : '';
        if (signature === this.signature) {
            if (this.root) {
                this.position(badge);
            }
            return;
        }
        this.stop();
        this.signature = signature;
        if (!signature) {
            return;
        }
        this.timer = setTimeout(() => {
            this.timer = null;
            const root = element('div', '', 'vimcord-sequence-hints');
            root.dataset.vimcord = 'sequence-hints';
            root.setAttribute('role', 'status');
            root.setAttribute('aria-live', 'polite');
            const prefix = commands.prefix;
            if (prefix === 'jumpTop') {
                root.append(element('kbd', keybinds.jumpTop), ' Go to top');
            } else {
                root.append(
                    element('strong', prefix === 'setMark' ? 'Set mark · a–z' : 'Jump to mark'),
                );
                const entries = marks.entries();
                for (const entry of entries.slice(0, 8)) {
                    const row = element('div', '', 'vimcord-sequence-row');
                    row.append(
                        element('kbd', entry.key),
                        element('span', `${entry.name} · ${entry.detail}`),
                    );
                    root.append(row);
                }
                let note = 'No saved marks yet.';
                if (prefix === 'setMark') {
                    note = 'Any letter saves here. Used letters replace their mark.';
                } else if (entries.length) {
                    note = 'Press a saved letter to jump.';
                }
                if (entries.length > 8) {
                    note += ` ${entries.length - 8} more saved.`;
                }
                if (keybinds.manageMarks) {
                    note += ` Esc, then ${keybinds.manageMarks} to manage.`;
                }
                root.append(element('small', note));
            }
            this.root = root;
            document.body.append(root);
            this.position(badge);
        }, 400);
    }

    position(badge) {
        const rect = badge.getBoundingClientRect();
        const width = Math.max(
            1,
            Math.min(
                badge.classList.contains('is-docked') ? rect.width : 280,
                window.innerWidth - 16,
            ),
        );
        Object.assign(this.root.style, {
            width: `${width}px`,
            left: `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`,
            bottom: `${Math.max(8, window.innerHeight - rect.top + 8)}px`,
            maxHeight: `${Math.max(0, rect.top - 16)}px`,
        });
    }

    stop() {
        clearTimeout(this.timer);
        this.timer = null;
        this.root?.remove();
        this.root = null;
        this.signature = '';
    }
}

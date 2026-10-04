import { editableTarget, elementLabel, isComposer, isVisible } from './dom.js';

const MODE_LABELS = {
    normal: 'Normal',
    insert: 'Insert',
    hint: 'Hint',
    visual: 'Message',
    range: 'Range',
};
export const USER_PANEL_SELECTOR = 'section[class*="panels_"]';

function setText(element, text) {
    if (element.textContent !== text) {
        element.textContent = text;
    }
}

function editorLabel(editor) {
    if (!editor) {
        return 'No text field';
    }
    return (
        elementLabel(editor) ||
        editor.getAttribute('placeholder')?.trim() ||
        (isComposer(editor) ? 'Message editor' : 'Text input')
    );
}

export class ModeIndicator {
    constructor() {
        this.element = document.createElement('div');
        this.element.dataset.vimcord = 'indicator';
        this.element.className = 'vimcord-indicator-layer';
        this.outline = document.createElement('div');
        this.outline.className = 'vimcord-pane-outline';
        this.outline.setAttribute('aria-hidden', 'true');
        this.outline.hidden = true;

        this.badge = document.createElement('div');
        this.badge.dataset.vimcord = 'badge';
        this.badge.className = 'vim-indicator-container vimcord-indicator-container';
        this.badge.setAttribute('role', 'status');
        this.badge.setAttribute('aria-live', 'polite');
        this.badge.setAttribute('aria-atomic', 'true');
        this.label = document.createElement('span');
        this.label.className = 'vim-indicator vimcord-indicator';
        this.modeLabel = document.createElement('span');
        this.modeLabel.className = 'vimcord-mode';
        this.targetLabel = document.createElement('span');
        this.targetLabel.className = 'vimcord-target';
        this.label.append(this.modeLabel, ' ', this.targetLabel);
        this.shortcuts = document.createElement('span');
        this.shortcuts.className = 'vimcord-shortcuts';
        this.shortcuts.setAttribute('aria-hidden', 'true');
        this.commandLabel = document.createElement('kbd');
        this.commandLabel.className = 'vimcord-command';
        this.commandLabel.hidden = true;
        this.badge.append(this.label, this.commandLabel, this.shortcuts);
        this.element.append(this.outline, this.badge);

        this.target = null;
        this.frame = null;
        this.fadeTimer = null;
        this.showFocusOutline = true;
        this.shortcutSignature = '';
        this.events = new AbortController();
        this.resizeObserver =
            typeof ResizeObserver === 'function'
                ? new ResizeObserver(() => this.schedulePosition())
                : null;
        this.resizeObserver?.observe(this.element);
        window.addEventListener('scroll', () => this.schedulePosition(), {
            capture: true,
            passive: true,
            signal: this.events.signal,
        });
    }

    update({
        mode,
        pane,
        dialog = null,
        keybinds,
        showFocusOutline = true,
        focusOutlineFadeDelay,
        selectedMessage = null,
        rangeCount = 0,
        command = '',
    }) {
        const parent = dialog || document.body;
        if (this.element.parentElement !== parent) {
            parent.append(this.element);
        }
        const panel = [...document.querySelectorAll(USER_PANEL_SELECTOR)].find(
            (candidate) => (!dialog || dialog.contains(candidate)) && isVisible(candidate),
        );
        const badgeParent = panel || this.element;
        if (this.badge.parentElement !== badgeParent) {
            badgeParent.append(this.badge);
        }
        this.badge.classList.toggle('is-docked', !!panel);
        this.badge.classList.toggle('is-floating', !panel);
        let target = null;
        let label = pane?.label || 'No scrollable pane';
        if (mode === 'normal') {
            target = pane?.element || null;
        } else if (mode === 'insert') {
            const editor = editableTarget(document.activeElement);
            target = editor && (!dialog || dialog.contains(editor)) ? editor : null;
            label = editorLabel(target);
        } else if (mode === 'hint') {
            label = 'Choose a control';
        } else if (mode === 'visual' || mode === 'range') {
            target = selectedMessage;
            label = mode === 'range' ? `${rangeCount} selected` : 'Selected message';
        }

        const focusChanged =
            this.target !== target ||
            this.element.dataset.mode !== mode ||
            this.targetLabel.textContent !== label ||
            this.showFocusOutline !== showFocusOutline ||
            this.focusOutlineFadeDelay !== focusOutlineFadeDelay;
        this.element.dataset.mode = mode;
        this.badge.dataset.mode = mode;
        this.showFocusOutline = showFocusOutline;
        this.focusOutlineFadeDelay = focusOutlineFadeDelay;
        setText(this.modeLabel, MODE_LABELS[mode]);
        setText(this.targetLabel, label);
        setText(this.commandLabel, command);
        this.commandLabel.hidden = !command;
        this.updateShortcuts(mode, pane, keybinds);
        if (this.target !== target) {
            if (this.target) {
                this.resizeObserver?.unobserve(this.target);
            }
            this.target = target;
            if (target) {
                this.resizeObserver?.observe(target);
            }
        }
        if (focusChanged) {
            this.revealOutline();
        }
        this.position();
    }

    revealOutline() {
        clearTimeout(this.fadeTimer);
        this.fadeTimer = null;
        const visible = this.showFocusOutline && !!this.target;
        this.outline.classList.toggle('is-visible', visible);
        if (visible) {
            this.fadeTimer = setTimeout(() => {
                this.fadeTimer = null;
                this.outline.classList.remove('is-visible');
            }, this.focusOutlineFadeDelay * 1000);
        }
    }

    updateShortcuts(mode, pane, keybinds) {
        let keys = ['Esc'];
        let action = mode === 'hint' ? 'cancel' : 'normal';
        if (mode === 'normal') {
            keys = pane ? [keybinds.scrollDown, keybinds.scrollUp] : [];
            action = pane ? 'scroll' : '';
        } else if (mode === 'visual' || mode === 'range') {
            keys = [keybinds.scrollDown, keybinds.scrollUp];
            action = mode === 'range' ? 'extend' : 'select';
        }
        keys = keys.filter(Boolean);
        const signature = JSON.stringify([keys, action]);
        if (this.shortcutSignature === signature) {
            return;
        }
        this.shortcutSignature = signature;
        const labels = keys.map((key) => {
            const element = document.createElement('kbd');
            element.textContent = key === ' ' ? 'Space' : key;
            return element;
        });
        this.shortcuts.replaceChildren(...labels, action ? ` ${action}` : '');
        this.shortcuts.hidden = !keys.length;
    }

    schedulePosition() {
        if (
            this.events.signal.aborted ||
            this.frame !== null ||
            !this.outline.classList.contains('is-visible')
        ) {
            return;
        }
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            this.position();
        });
    }

    position() {
        if (this.events.signal.aborted || !this.showFocusOutline || !isVisible(this.target)) {
            this.outline.hidden = true;
            return;
        }
        const rect = this.target.getBoundingClientRect();
        const layer = this.element.getBoundingClientRect();
        let left = Math.max(0, layer.left, rect.left);
        let top = Math.max(0, layer.top, rect.top);
        let right = Math.min(window.innerWidth, layer.right, rect.right);
        let bottom = Math.min(window.innerHeight, layer.bottom, rect.bottom);
        // A nested scroller can be partly clipped by another scrolling surface.
        for (
            let ancestor = this.target.parentElement;
            ancestor && ancestor !== document.body;
            ancestor = ancestor.parentElement
        ) {
            const style = getComputedStyle(ancestor);
            const clipsX = /^(auto|scroll|hidden|clip|overlay)$/.test(style.overflowX);
            const clipsY = /^(auto|scroll|hidden|clip|overlay)$/.test(style.overflowY);
            if (!clipsX && !clipsY) {
                continue;
            }
            const bounds = ancestor.getBoundingClientRect();
            if (clipsX) {
                left = Math.max(left, bounds.left);
                right = Math.min(right, bounds.right);
            }
            if (clipsY) {
                top = Math.max(top, bounds.top);
                bottom = Math.min(bottom, bounds.bottom);
            }
        }
        if (right <= left || bottom <= top) {
            this.outline.hidden = true;
            return;
        }
        // Dialog transforms can make a fixed layer use local, scaled coordinates.
        const scaleX = layer.width / (this.element.clientWidth || layer.width);
        const scaleY = layer.height / (this.element.clientHeight || layer.height);
        Object.assign(this.outline.style, {
            left: `${(left - layer.left) / scaleX}px`,
            top: `${(top - layer.top) / scaleY}px`,
            width: `${(right - left) / scaleX}px`,
            height: `${(bottom - top) / scaleY}px`,
        });
        this.outline.hidden = false;
    }

    stop() {
        this.events.abort();
        this.resizeObserver?.disconnect();
        clearTimeout(this.fadeTimer);
        this.fadeTimer = null;
        if (this.frame !== null) {
            cancelAnimationFrame(this.frame);
        }
        this.frame = null;
        this.target = null;
        this.badge.remove();
        this.element.remove();
    }
}

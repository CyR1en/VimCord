import { editableTarget, findPreferredInput, isComposer, OWNED_SELECTOR } from './dom.js';
import { HintSession } from './hints.js';
import { ModeIndicator, USER_PANEL_SELECTOR } from './indicator.js';
import { PaneManager, paneMutationRelevant } from './panes.js';
import styles from './styles.css';

export default class VimCord {
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.mode = 'normal';
        this.frame = null;
        this.allowInputFocusUntil = 0;
        this.events = new AbortController();
        this.panes = new PaneManager();
        this.indicator = new ModeIndicator();
        this.hints = new HintSession({
            onSelect: (element) => this.activate(element),
            onCancel: () => this.setMode('normal'),
        });

        try {
            BdApi.DOM.addStyle('VimCord', styles);
            const capture = { capture: true, signal: this.events.signal };
            document.addEventListener('keydown', (event) => this.onKeyDown(event), capture);
            document.addEventListener('focusin', (event) => this.onFocus(event), capture);
            document.addEventListener(
                'pointerdown',
                (event) => {
                    const target = event.target instanceof Element ? event.target : null;
                    const editor =
                        editableTarget(target) || editableTarget(target?.closest('label')?.control);
                    this.allowInputFocusUntil = editor ? performance.now() + 500 : 0;
                },
                capture,
            );
            window.addEventListener('resize', () => this.scheduleRefresh(), {
                signal: this.events.signal,
            });

            this.observer = new MutationObserver((records) => this.onMutations(records));
            this.observer.observe(document.body, { childList: true, subtree: true });
            this.refresh();
            const editor = editableTarget(document.activeElement);
            if (editor) {
                this.setMode('insert');
            }
        } catch (error) {
            this.stop();
            throw error;
        }
    }

    stop() {
        this.running = false;
        this.events?.abort();
        this.observer?.disconnect();
        if (this.frame !== null && this.frame !== undefined) {
            cancelAnimationFrame(this.frame);
        }
        this.hints?.stop();
        this.panes?.stop();
        this.indicator?.stop();
        BdApi.DOM.removeStyle('VimCord');
        this.events = null;
        this.observer = null;
        this.hints = null;
        this.panes = null;
        this.indicator = null;
        this.frame = null;
        this.mode = 'normal';
        this.allowInputFocusUntil = 0;
    }

    onSwitch() {
        if (!this.running) {
            return;
        }
        if (this.mode === 'hint') {
            this.setMode('normal');
        }
        this.scheduleRefresh();
    }

    onMutations(records) {
        if (!this.running) {
            return;
        }
        if (!this.indicator.element.isConnected) {
            this.scheduleRefresh();
            return;
        }
        for (const record of records) {
            if (record.target instanceof Element && record.target.closest(OWNED_SELECTOR)) {
                continue;
            }
            const changed = [...record.addedNodes, ...record.removedNodes];
            if (
                changed.length &&
                changed.every((node) => node instanceof Element && node.matches(OWNED_SELECTOR))
            ) {
                continue;
            }
            if (
                paneMutationRelevant(record) ||
                changed.some(
                    (node) =>
                        node instanceof Element &&
                        (node.matches(USER_PANEL_SELECTOR) ||
                            node.querySelector(USER_PANEL_SELECTOR)),
                )
            ) {
                this.scheduleRefresh();
                return;
            }
        }
    }

    scheduleRefresh() {
        if (!this.running || this.frame !== null) {
            return;
        }
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            if (this.running) {
                this.refresh();
            }
        });
    }

    refresh() {
        this.panes.refresh();
        this.indicator.update(this.mode, this.panes.label, this.panes.dialog);
    }

    setMode(mode) {
        if (!this.running || this.mode === mode) {
            return;
        }
        if (this.mode === 'hint') {
            this.hints.stop();
        }
        this.mode = mode;
        if (mode === 'hint' && !this.hints.start()) {
            this.mode = 'normal';
        }
        this.indicator.update(this.mode, this.panes.label, this.panes.dialog);
    }

    onFocus(event) {
        const editor = editableTarget(event.target);
        if (!editor || this.mode === 'insert') {
            return;
        }
        // Discord automatically focuses its composer on navigation and unhandled keys.
        // Explicit clicks, Tab, i, and hints still let the user enter an editor.
        if (isComposer(editor) && performance.now() > this.allowInputFocusUntil) {
            editor.blur();
            return;
        }
        this.setMode('insert');
    }

    activate(element) {
        if (!element.isConnected) {
            this.setMode('normal');
            return;
        }
        const editor = editableTarget(element);
        this.setMode(editor ? 'insert' : 'normal');
        if (editor) {
            editor.focus({ preventScroll: true });
        } else if (typeof element.click === 'function') {
            element.click();
        } else {
            element.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
            );
        }
    }

    onKeyDown(event) {
        if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
            return;
        }
        if (event.key === 'Tab') {
            this.allowInputFocusUntil = performance.now() + 500;
        }

        if (this.mode === 'insert') {
            if (event.key !== 'Escape') {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.allowInputFocusUntil = 0;
            this.setMode('normal');
            editableTarget(document.activeElement)?.blur();
            return;
        }

        if (this.mode === 'hint') {
            if (
                /^[a-z]$/i.test(event.key) ||
                ['Escape', 'Enter', 'Backspace'].includes(event.key)
            ) {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (!event.repeat) {
                    this.hints.handleKey(event);
                }
            }
            return;
        }

        if (!['f', 'h', 'j', 'k', 'l', 'd', 'D', 'u', 'U', 'i'].includes(event.key)) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();

        switch (event.key) {
            case 'f':
                if (!event.repeat) {
                    this.setMode('hint');
                }
                break;
            case 'i': {
                if (event.repeat) {
                    break;
                }
                const editor = findPreferredInput();
                this.setMode('insert');
                editor?.focus({ preventScroll: true });
                break;
            }
            case 'h':
                this.panes.move(-1);
                break;
            case 'l':
                this.panes.move(1);
                break;
            case 'j':
                this.panes.scroll(80);
                break;
            case 'k':
                this.panes.scroll(-80);
                break;
            case 'd':
            case 'D':
                this.panes.scroll(this.panes.pageSize / 2);
                break;
            case 'u':
            case 'U':
                this.panes.scroll(-this.panes.pageSize / 2);
                break;
        }
        this.indicator.update(this.mode, this.panes.label, this.panes.dialog);
    }
}

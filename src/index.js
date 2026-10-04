import { editableTarget, findPreferredInput, isComposer, OWNED_SELECTOR } from './dom.js';
import { CommandSequence } from './commands.js';
import { ContextHelp } from './help.js';
import { HintSession } from './hints.js';
import { captureReadingPosition, ReadingHistory } from './history.js';
import { ModeIndicator, USER_PANEL_SELECTOR } from './indicator.js';
import { PaneManager } from './panes.js';
import { ChannelMarks, navigateTo } from './marks.js';
import { MarksPanel } from './marks-panel.js';
import { MessageSelection } from './messages.js';
import { PluginSettings } from './settings.js';
import { SettingsPanel } from './settings-panel.js';
import { SequenceHints } from './sequence-hints.js';
import styles from './styles.css';

function isTextEntryKey(event) {
    return (
        [...event.key].length === 1 ||
        event.isComposing ||
        event.keyCode === 229 ||
        ['Dead', 'Process', 'Unidentified'].includes(event.key)
    );
}

function isMessageMode(mode) {
    return mode === 'visual' || mode === 'range';
}

export default class VimCord {
    constructor() {
        this.settings = new PluginSettings();
        this.settingsPanel = null;
    }

    getSettingsPanel() {
        this.settingsPanel?.dispose();
        this.settingsPanel = new SettingsPanel(
            this.settings,
            () => {
                this.commands?.reset();
                this.help?.close();
                this.updateIndicator();
            },
            () => this.openMarks(),
        );
        return this.settingsPanel.element;
    }

    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.mode = 'normal';
        this.frame = null;
        this.allowInputFocusUntil = 0;
        this.nativeMessageAction = null;
        this.events = new AbortController();
        this.panes = new PaneManager();
        this.commands = new CommandSequence();
        this.messages = new MessageSelection();
        this.marksPanel?.close(false);
        this.marks = new ChannelMarks();
        this.marksPanel = null;
        this.help = new ContextHelp();
        this.nativeKeys = new WeakSet();
        this.indicator = new ModeIndicator();
        this.sequenceHints = new SequenceHints();
        this.history = new ReadingHistory({
            capture: () => captureReadingPosition(this.panes, this.messages),
            restore: (position) => this.restoreReadingPosition(position),
            navigate: (path) => {
                this.setMode('normal');
                navigateTo(path);
            },
            notify: (message) => this.notify(message),
        });
        this.hints = new HintSession({
            onSelect: (element) => this.activate(element),
            onCancel: () => this.setMode('normal'),
        });

        try {
            BdApi.DOM.addStyle('VimCord', styles);
            const capture = { capture: true, signal: this.events.signal };
            document.addEventListener('keydown', (event) => this.onKeyDown(event), capture);
            for (const type of ['beforeinput', 'paste', 'cut']) {
                document.addEventListener(type, (event) => this.onComposerInput(event), capture);
            }
            document.addEventListener('focusin', (event) => this.onFocus(event), capture);
            document.addEventListener('focusout', () => this.scheduleRefresh(), capture);
            document.addEventListener(
                'pointerdown',
                (event) => {
                    const target = event.target instanceof Element ? event.target : null;
                    if (target?.closest(OWNED_SELECTOR)) {
                        return;
                    }
                    this.history.cancelPending();
                    this.history.restored = null;
                    this.history.clearJump();
                    this.history.update();
                    this.commands.reset();
                    if (isMessageMode(this.mode)) {
                        this.setMode('normal');
                    }
                    this.updateIndicator();
                    const editor =
                        editableTarget(target) || editableTarget(target?.closest('label')?.control);
                    this.allowInputFocusUntil = editor ? performance.now() + 500 : 0;
                },
                capture,
            );
            window.addEventListener(
                'resize',
                () => {
                    this.panes.invalidate();
                    this.scheduleRefresh();
                },
                {
                    signal: this.events.signal,
                },
            );
            document.addEventListener(
                'scroll',
                (event) => {
                    if (
                        this.panes.panes.some(
                            (pane) => pane.key === 'chat' && pane.element === event.target,
                        )
                    ) {
                        this.scheduleRefresh();
                    }
                },
                { capture: true, passive: true, signal: this.events.signal },
            );
            window.addEventListener(
                'blur',
                () => {
                    this.commands.reset();
                    this.updateIndicator();
                },
                { signal: this.events.signal },
            );

            this.observer = new MutationObserver((records) => this.onMutations(records));
            this.observer.observe(document.body, {
                childList: true,
                characterData: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    'class',
                    'style',
                    'hidden',
                    'inert',
                    'aria-hidden',
                    'role',
                    'aria-label',
                    'aria-labelledby',
                ],
            });
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
        this.settingsPanel?.cancelCapture();
        this.events?.abort();
        this.observer?.disconnect();
        if (this.frame !== null && this.frame !== undefined) {
            cancelAnimationFrame(this.frame);
        }
        this.hints?.stop();
        this.help?.close(false);
        this.marksPanel?.close(false);
        this.history?.stop();
        this.sequenceHints?.stop();
        this.messages?.stop();
        this.commands?.reset();
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
        this.nativeMessageAction = null;
    }

    onSwitch() {
        if (!this.running) {
            return;
        }
        this.panes.invalidate();
        this.help?.close(false);
        this.marksPanel?.close(false);
        this.nativeMessageAction = null;
        this.commands.reset();
        const restored = this.history.restored;
        const restoredSelection =
            restored?.selectedId &&
            restored.path === window.location.pathname.split('/').slice(0, 4).join('/') &&
            this.messages.rowId === restored.selectedId &&
            this.messages.selected?.isConnected;
        // Discord can deliver its route callback after the target messages have rendered.
        if (this.mode === 'hint' || (isMessageMode(this.mode) && !restoredSelection)) {
            this.setMode('normal');
        }
        this.scheduleRefresh();
    }

    onMutations(records) {
        if (!this.running) {
            return;
        }
        if (
            (isMessageMode(this.mode) &&
                (!this.messages.selected?.isConnected ||
                    (this.messages.rangeAnchorId &&
                        !document.getElementById(this.messages.rangeAnchorId)))) ||
            this.history.pending
        ) {
            this.scheduleRefresh();
        }
        if (!this.indicator.element.isConnected || !this.indicator.badge.isConnected) {
            this.scheduleRefresh();
        }
        for (const record of records) {
            const target =
                record.target instanceof Element ? record.target : record.target.parentElement;
            if (target?.closest(OWNED_SELECTOR)) {
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
                this.panes.onMutation(record) ||
                changed.some(
                    (node) =>
                        node instanceof Element &&
                        (node.matches(USER_PANEL_SELECTOR) ||
                            node.querySelector(USER_PANEL_SELECTOR)),
                )
            ) {
                this.scheduleRefresh();
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
        const previousDialog = this.panes.dialog;
        this.panes.refresh();
        if (this.panes.dialog !== previousDialog) {
            this.commands.reset();
            this.help.close(false);
            this.marksPanel?.close(false);
        }
        if (isMessageMode(this.mode) && !this.messages.refresh()) {
            this.setMode('normal');
        }
        this.history.update();
        this.updateIndicator();
    }

    updateIndicator() {
        if (this.running) {
            this.indicator.update({
                mode: this.mode,
                pane: this.panes.active,
                dialog: this.panes.dialog,
                keybinds: this.settings.keybinds,
                showFocusOutline: this.settings.showFocusOutline,
                focusOutlineFadeDelay: this.settings.focusOutlineFadeDelay,
                selectedMessage: this.messages.selected,
                rangeCount: this.mode === 'range' ? this.messages.selectedRows().length : 0,
                command: this.commands.label,
            });
            this.sequenceHints.update({
                enabled: this.settings.preference('showSequenceHints'),
                commands: this.commands,
                marks: this.marks,
                keybinds: this.settings.keybinds,
                badge: this.indicator.badge,
            });
        }
    }

    setMode(mode, hintScope = document) {
        if (!this.running || this.mode === mode) {
            return;
        }
        if (this.mode === 'hint') {
            this.hints.stop();
        }
        const wasMessageMode = isMessageMode(this.mode);
        if (wasMessageMode && !isMessageMode(mode)) {
            this.messages.stop();
        }
        this.commands.reset();
        this.mode = mode;
        if (mode === 'hint' && !this.hints.start(hintScope)) {
            this.mode = 'normal';
        }
        if (isMessageMode(mode) && !wasMessageMode) {
            this.panes.refresh();
            if (
                this.messages.start(this.panes.active?.element, () => {
                    // Enable Discord's message shortcuts without a browser Tab traversal.
                    this.dispatchNativeKey(document.body, 'Tab', 'Tab', 9);
                })
            ) {
                const chat = this.panes.panes.find((pane) =>
                    pane.element.contains(this.messages.list),
                );
                if (chat) {
                    this.panes.active = chat;
                }
            } else {
                this.mode = 'normal';
                this.notify('No messages are available to select.');
            }
        }
        if (isMessageMode(this.mode)) {
            this.messages.setRange(this.mode === 'range');
        }
        this.updateIndicator();
    }

    onFocus(event) {
        if (!event.target?.closest?.(OWNED_SELECTOR)) {
            this.commands.reset();
        }
        if (this.mode === 'insert') {
            this.updateIndicator();
            return;
        }
        const editor = editableTarget(event.target);
        if (!editor) {
            this.updateIndicator();
            return;
        }
        if (this.nativeMessageAction && performance.now() <= this.allowInputFocusUntil) {
            this.nativeMessageAction.editor = editor;
        }
        // Discord automatically focuses its composer on navigation and unhandled keys.
        // Explicit clicks, Tab, i, and hints still let the user enter an editor.
        if (isComposer(editor) && performance.now() > this.allowInputFocusUntil) {
            const { signal } = this.events;
            // An immediate blur sends focusout to Discord before its focusin handler runs.
            setTimeout(() => {
                if (
                    !signal.aborted &&
                    this.mode !== 'insert' &&
                    editor.isConnected &&
                    document.activeElement === editor &&
                    performance.now() > this.allowInputFocusUntil
                ) {
                    editor.blur();
                }
            }, 0);
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
        if (!editor) {
            this.history.beforeJump();
        }
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

    onComposerInput(event) {
        if (this.mode === 'insert' || this.marksPanel?.root) {
            return;
        }
        const editor = editableTarget(event.target);
        // Discord also forwards pastes from outside an editor straight into the composer.
        if (isComposer(editor) || (event.type === 'paste' && !editor)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }

    onKeyDown(event) {
        if (this.nativeKeys.has(event)) {
            return;
        }
        if (this.marksPanel?.root) {
            return;
        }
        if (event.target instanceof Element && event.target.closest('[data-vimcord-settings]')) {
            return;
        }
        if (this.help.root) {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.help.handleKey(event, this.settings.helpKeyForMode(this.mode));
            return;
        }
        if (this.mode !== 'insert') {
            const composerEdit =
                isComposer(event.target) &&
                (['Enter', 'Backspace', 'Delete'].includes(event.key) ||
                    ((event.ctrlKey || event.metaKey) && /^[vxzy]$/i.test(event.key)));
            const composedText =
                !event.metaKey &&
                (!event.ctrlKey || event.getModifierState('AltGraph')) &&
                (event.altKey || event.isComposing || event.keyCode === 229) &&
                isTextEntryKey(event);
            if (composerEdit || composedText) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
        }
        if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
            this.commands.reset();
            this.updateIndicator();
            return;
        }
        if (event.key === 'Shift' || event.key === 'CapsLock') {
            return;
        }
        if (event.key === 'Tab') {
            this.allowInputFocusUntil = performance.now() + 500;
            this.commands.reset();
        }

        if (this.mode === 'insert') {
            if (event.key !== 'Escape') {
                return;
            }
            const editor = editableTarget(event.target);
            if (editor && this.nativeMessageAction?.editor === editor) {
                // Let Discord dismiss the native editor or picker opened by this action.
                this.nativeMessageAction = null;
                this.allowInputFocusUntil = 0;
                this.setMode('normal');
                const { signal } = this.events;
                setTimeout(() => {
                    if (
                        !signal.aborted &&
                        this.mode === 'normal' &&
                        document.activeElement === editor
                    ) {
                        editor.blur();
                    }
                }, 0);
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
            if (event.key === this.settings.helpKeyForMode('hint')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (!event.repeat) {
                    this.help.show(this.mode, this.settings);
                }
                return;
            }
            if (
                /^[a-z]$/i.test(event.key) ||
                ['Escape', 'Enter', 'Backspace'].includes(event.key)
            ) {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (!event.repeat) {
                    this.hints.handleKey(event);
                }
            } else if (isTextEntryKey(event)) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (this.commands.label) {
                this.commands.reset();
            } else {
                this.setMode('normal');
            }
            this.updateIndicator();
            return;
        }
        const action = this.settings.actionForKey(event.key, this.mode);
        if (!['historyBack', 'historyForward'].includes(action)) {
            this.history.cancelPending();
            this.history.restored = null;
        }
        const hasPrefix = !!this.commands.label;
        const command = this.commands.feed(event.key, action, event.repeat);
        if (!command) {
            // Stop Discord's type-to-focus handler before it can insert into the composer.
            // Deferring blur preserves focus event order, but cannot prevent that first edit.
            if (
                isTextEntryKey(event) ||
                hasPrefix ||
                (isMessageMode(this.mode) && event.key !== 'Tab')
            ) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
            this.updateIndicator();
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();

        this.runCommand(command, event);
        this.history.update();
        this.updateIndicator();
    }

    notify(message, type = 'info') {
        if (this.running) {
            BdApi.UI?.showToast?.(message, { type });
        }
    }

    runCommand({ action, count, mark }, event) {
        switch (action) {
            case 'hint':
            case 'hintAll':
                if (!event.repeat) {
                    this.panes.refresh();
                    let scope = this.panes.dialog || document;
                    if (action === 'hint' && this.settings.hintsCurrentPane) {
                        scope = this.panes.active?.element || scope;
                    }
                    this.setMode('hint', scope);
                }
                break;
            case 'insert': {
                if (event.repeat) {
                    break;
                }
                const editor = findPreferredInput();
                this.setMode('insert');
                editor?.focus({ preventScroll: true });
                break;
            }
            case 'paneLeft':
                this.setMode('normal');
                this.panes.move(-count);
                break;
            case 'paneRight':
                this.setMode('normal');
                this.panes.move(count);
                break;
            case 'scrollDown':
                if (isMessageMode(this.mode)) {
                    if (!this.messages.move(count)) {
                        this.setMode('normal');
                    }
                } else {
                    this.panes.scroll(this.settings.scrollAmount * count);
                }
                break;
            case 'scrollUp':
                if (isMessageMode(this.mode)) {
                    if (!this.messages.move(-count)) {
                        this.setMode('normal');
                    }
                } else {
                    this.panes.scroll(-this.settings.scrollAmount * count);
                }
                break;
            case 'halfPageDown':
                this.panes.scroll((this.panes.pageSize * count) / 2);
                break;
            case 'halfPageUp':
                this.panes.scroll((-this.panes.pageSize * count) / 2);
                break;
            case 'jumpTop':
            case 'jumpBottom': {
                if (this.panes.active?.key === 'chat') {
                    this.history.beforeJump();
                }
                const edge = action === 'jumpTop' ? 'top' : 'bottom';
                if (edge === 'bottom' && this.jumpToLatest()) {
                    break;
                }
                if (isMessageMode(this.mode)) {
                    this.messages.jump(edge);
                } else {
                    this.panes.jump(edge);
                }
                break;
            }
            case 'visual':
                if (!event.repeat) {
                    this.setMode(isMessageMode(this.mode) ? 'normal' : 'visual');
                }
                break;
            case 'range':
                if (!event.repeat) {
                    this.setMode(this.mode === 'range' ? 'visual' : 'range');
                }
                break;
            case 'copyMessage':
                if (!event.repeat) {
                    const range = this.mode === 'range';
                    this.messages
                        .copy({
                            authors: this.settings.preference('rangeCopyAuthors'),
                            timestamps: this.settings.preference('rangeCopyTimestamps'),
                        })
                        .then(
                            () => this.notify(range ? 'Message range copied.' : 'Message copied.'),
                            (error) => this.notify(error.message, 'error'),
                        );
                }
                break;
            case 'replyMessage':
            case 'editMessage':
            case 'reactMessage':
                if (!event.repeat) {
                    this.messageAction(action);
                }
                break;
            case 'copyMessageLink':
                if (!event.repeat) {
                    this.messages.copyLink().then(
                        () => this.notify('Message link copied.'),
                        (error) => this.notify(error.message, 'error'),
                    );
                }
                break;
            case 'historyBack':
            case 'historyForward':
                try {
                    this.history.go(action === 'historyBack' ? -count : count);
                } catch (error) {
                    this.notify(error.message, 'error');
                }
                break;
            case 'manageMarks':
                if (!event.repeat) {
                    this.openMarks();
                }
                break;
            case 'setMark':
            case 'jumpMark':
                try {
                    if (action === 'setMark') {
                        this.marks.save(mark);
                        this.notify(`Channel saved to mark “${mark}”.`);
                    } else {
                        this.history.beforeJump();
                        this.marks.jump(mark);
                        this.setMode('normal');
                    }
                } catch (error) {
                    this.history.clearJump();
                    this.notify(error.message, 'error');
                }
                break;
            case 'help':
                if (!event.repeat) {
                    this.help.show(this.mode, this.settings);
                }
                break;
        }
    }

    messageAction(action) {
        if (!this.messages.refresh()) {
            this.setMode('normal');
            return;
        }
        const selected = this.messages.selected;
        selected.focus({ preventScroll: true });
        this.nativeMessageAction = { action, editor: null };
        this.allowInputFocusUntil = performance.now() + 500;
        const shortcuts = {
            replyMessage: ['r', 'KeyR', 82],
            editMessage: ['e', 'KeyE', 69],
            reactMessage: ['+', 'Equal', 187, { shiftKey: true }],
        };
        this.dispatchNativeKey(selected, ...shortcuts[action]);
        const { signal } = this.events;
        setTimeout(() => {
            if (
                !signal.aborted &&
                this.mode === 'visual' &&
                this.messages.selected === selected &&
                action !== 'reactMessage'
            ) {
                this.allowInputFocusUntil = 0;
                this.nativeMessageAction = null;
                this.notify(
                    action === 'editMessage'
                        ? 'Editing is only available for your own editable messages.'
                        : 'Reply is unavailable for this message.',
                );
            }
        }, 300);
    }

    dispatchNativeKey(target, key, code, keyCode, options = {}) {
        const event = new KeyboardEvent('keydown', {
            ...options,
            key,
            code,
            keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
        });
        this.nativeKeys.add(event);
        target.dispatchEvent(event);
    }

    openMarks() {
        if (this.running) {
            this.history.update();
            this.help.close(false);
            this.setMode('normal');
            this.commands.reset();
            this.updateIndicator();
        }
        this.marks ??= new ChannelMarks();
        this.marksPanel ??= new MarksPanel(this.marks, (key) => {
            if (this.running) {
                this.history.beforeJump();
            }
            this.marks.jump(key);
        });
        this.marksPanel.show(this.settings.keybinds);
    }

    restoreReadingPosition(position) {
        const pane = this.panes.panes.find((candidate) => candidate.key === 'chat');
        if (this.panes.dialog || !pane?.element.isConnected) {
            return false;
        }
        const article = (id) => document.getElementById(id)?.querySelector('[role="article"]');
        const anchor = position.anchorId ? article(position.anchorId) : null;
        const selected = position.selectedId ? article(position.selectedId) : null;
        if (
            (position.anchorId && !pane.element.contains(anchor)) ||
            (position.selectedId && !pane.element.contains(selected))
        ) {
            return false;
        }
        this.setMode('normal');
        this.panes.active = pane;
        const restoreScroll = () => {
            const top = anchor
                ? pane.element.scrollTop +
                  anchor.getBoundingClientRect().top -
                  pane.element.getBoundingClientRect().top -
                  position.offset
                : position.scrollTop;
            pane.element.scrollTo({ top, behavior: 'instant' });
        };
        restoreScroll();
        if (selected) {
            this.setMode('visual');
            this.messages.select(selected, false);
            restoreScroll();
        }
        return true;
    }

    jumpToLatest() {
        if (this.panes.active?.key !== 'chat' || this.panes.dialog) {
            return false;
        }
        const row = this.panes.active.element.querySelector('[id^="chat-messages-"]');
        const channelId = row?.id.match(/^chat-messages-(\d+)-/)?.[1];
        const actions = BdApi.Webpack?.getByKeys?.('jumpToPresent');
        if (!channelId || typeof actions?.jumpToPresent !== 'function') {
            return false;
        }
        this.setMode('normal');
        actions.jumpToPresent(channelId, 50);
        return true;
    }
}

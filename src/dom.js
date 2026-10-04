export const OWNED_SELECTOR = '[data-vimcord]';
export const DIALOG_SELECTOR =
    '[role="dialog"], [aria-modal="true"], dialog[open], [class*="standardSidebarView_"]';

const EDITABLE_SELECTOR = 'input, textarea, [contenteditable], [role="textbox"]';
const NON_TEXT_INPUTS = new Set([
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
]);

export function elementLabel(element) {
    if (!element) {
        return '';
    }
    const labelledBy = (element.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => element.ownerDocument.getElementById(id)?.textContent || '')
        .join(' ')
        .trim();
    const label =
        labelledBy ||
        element.getAttribute('aria-label') ||
        [...(element.labels || [])].map((node) => node.textContent).join(' ');
    return label.replace(/\s+/g, ' ').trim();
}

export function editableTarget(element) {
    const target = element?.nodeType === 1 ? element : element?.parentElement;
    const editor = target?.closest?.(EDITABLE_SELECTOR);
    if (
        !editor ||
        editor.closest(`${OWNED_SELECTOR}, [inert], [aria-disabled="true"], [aria-readonly="true"]`)
    ) {
        return null;
    }
    if (editor.matches(':disabled') || editor.readOnly) {
        return null;
    }
    if (editor.tagName === 'INPUT' && NON_TEXT_INPUTS.has(editor.type)) {
        return null;
    }
    if (editor.tagName !== 'INPUT' && editor.tagName !== 'TEXTAREA' && !editor.isContentEditable) {
        return null;
    }
    return editor;
}

export function isVisible(element) {
    if (!element?.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]')) {
        return false;
    }
    const rect = element.getBoundingClientRect();
    if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= window.innerHeight ||
        rect.left >= window.innerWidth
    ) {
        return false;
    }
    const style = getComputedStyle(element);
    return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.visibility !== 'collapse' &&
        style.opacity !== '0'
    );
}

export function activeDialog(root = document) {
    const dialogs = [...root.querySelectorAll(DIALOG_SELECTOR)];
    if (root.matches?.(DIALOG_SELECTOR)) {
        dialogs.unshift(root);
    }
    let active = null;
    let highestZ = -Infinity;
    for (const dialog of dialogs) {
        if (dialog.closest(OWNED_SELECTOR) || !isVisible(dialog)) {
            continue;
        }
        const zIndex = Number.parseInt(getComputedStyle(dialog).zIndex, 10) || 0;
        if (zIndex >= highestZ || active?.contains(dialog)) {
            active = dialog;
            highestZ = zIndex;
        }
    }
    return active;
}

export function isComposer(element) {
    const editor = editableTarget(element);
    if (!editor || editor.closest(DIALOG_SELECTOR)) {
        return false;
    }
    if (
        editor.matches('input[type="search"]') ||
        editor.closest('[role="search"], [class*="searchBar_"], [class*="search_"]')
    ) {
        return false;
    }
    if (editor.matches('[data-slate-editor="true"]')) {
        return true;
    }
    return !!editor.closest(
        '[class*="channelTextArea_"], [class*="chatContent_"] form, [class*="chat_"] form',
    );
}

export function findPreferredInput(root = document) {
    const scope = activeDialog(root) || root;
    const candidates = [...scope.querySelectorAll(EDITABLE_SELECTOR)];
    if (scope.matches?.(EDITABLE_SELECTOR)) {
        candidates.unshift(scope);
    }
    let preferred = null;
    let bestScore = -1;
    const visited = new Set();
    for (const candidate of candidates) {
        const editor = editableTarget(candidate);
        if (!editor || visited.has(editor)) {
            continue;
        }
        visited.add(editor);
        if (!isVisible(editor)) {
            continue;
        }
        const composerBonus = isComposer(editor) ? 100 : 0;
        const autofocusBonus = editor.hasAttribute('autofocus') ? 40 : 0;
        let editorTypeScore = 0;
        if (editor.isContentEditable) {
            editorTypeScore = 30;
        } else if (editor.tagName === 'TEXTAREA') {
            editorTypeScore = 20;
        } else if (editor.tagName === 'INPUT') {
            editorTypeScore = 10;
        }
        const score = composerBonus + autofocusBonus + editorTypeScore;
        if (score > bestScore) {
            preferred = editor;
            bestScore = score;
        }
    }
    return preferred;
}

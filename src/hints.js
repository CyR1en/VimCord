import { OWNED_SELECTOR } from './dom.js';
import { layoutHints } from './hint-layout.js';

const HINT_ALPHABET = 'ASDFGHJKLQWERTYUIOPZXCVBNM';
const CLICKABLE_SELECTOR = [
    'button',
    'a[href]',
    'input:not([type="hidden"])',
    'textarea',
    'select',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="tab"]',
    '[role="treeitem"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="option"]',
    '[role="combobox"]',
    '[role="textbox"]',
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[contenteditable="plaintext-only"]',
    '[tabindex]:not([tabindex="-1"])',
    '[class*="clickable_"]',
    '[class*="clickTrapContainer_"]',
    '[class*="folderButtonInner_"]',
    '[class*="backdrop_"]',
].join(',');

const EXCLUDED_SELECTOR = [
    OWNED_SELECTOR,
    '[hidden]',
    '[aria-hidden="true"]',
    '[inert]',
    '[aria-disabled="true"]',
    '[role="separator"]',
    '[class*="sidebarResizeHandle_"]',
    'button:disabled',
].join(',');

const POINT_FRACTIONS = [
    [0.5, 0.5],
    [0.2, 0.2],
    [0.8, 0.2],
    [0.2, 0.8],
    [0.8, 0.8],
    [0.5, 0.2],
    [0.5, 0.8],
    [0.2, 0.5],
    [0.8, 0.5],
];

const generateHintLabels = (count) => {
    if (count <= 0) {
        return [];
    }
    const alphabet = [...HINT_ALPHABET];
    const labels = [];
    let level = alphabet;
    let remaining = count;

    while (remaining > level.length) {
        const expansions = Math.min(
            level.length,
            Math.ceil((remaining - level.length) / (alphabet.length - 1)),
        );
        const keep = level.length - expansions;
        labels.push(...level.slice(0, keep));
        remaining -= keep;
        level = level.slice(keep).flatMap((prefix) => alphabet.map((char) => prefix + char));
    }

    labels.push(...level.slice(0, remaining));
    return labels;
};

const measureTarget = (element, viewport) => {
    if (
        !element.isConnected ||
        element.closest(EXCLUDED_SELECTOR) ||
        element.matches(':disabled')
    ) {
        return null;
    }

    const style = window.getComputedStyle(element);
    if (
        style.visibility !== 'visible' ||
        style.display === 'none' ||
        style.opacity === '0' ||
        style.pointerEvents === 'none'
    ) {
        return null;
    }

    const rect = element.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(viewport.width, rect.right);
    const bottom = Math.min(viewport.height, rect.bottom);
    if (right <= left || bottom <= top) {
        return null;
    }

    let anchor = null;
    for (const [fx, fy] of POINT_FRACTIONS) {
        const x = left + (right - left) * fx;
        const y = top + (bottom - top) * fy;
        const hit = document.elementFromPoint(x, y);
        if (hit && element.contains(hit)) {
            anchor = { x, y };
            break;
        }
    }
    if (!anchor) {
        return null;
    }

    const parsedZ = Number.parseInt(style.zIndex, 10);
    const z = Number.isFinite(parsedZ) ? parsedZ : 0;
    const area = (right - left) * (bottom - top);
    const distance = Math.hypot(
        (left + right - viewport.width) / 2,
        (top + bottom - viewport.height) / 2,
    );
    return { element, anchor, score: z * 1e9 + area * 1e3 - distance };
};

const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const createConnector = (anchor, box) => {
    const endX = Math.max(box.left, Math.min(anchor.x, box.left + box.width));
    const endY = Math.max(box.top, Math.min(anchor.y, box.top + box.height));
    if (Math.hypot(endX - anchor.x, endY - anchor.y) < 3) {
        return null;
    }

    const group = document.createElementNS(SVG_NAMESPACE, 'g');
    group.classList.add('vimcord-hint-connector');
    const line = document.createElementNS(SVG_NAMESPACE, 'line');
    line.setAttribute('x1', anchor.x);
    line.setAttribute('y1', anchor.y);
    line.setAttribute('x2', endX);
    line.setAttribute('y2', endY);
    const dot = document.createElementNS(SVG_NAMESPACE, 'circle');
    dot.setAttribute('cx', anchor.x);
    dot.setAttribute('cy', anchor.y);
    dot.setAttribute('r', '1.5');
    group.append(line, dot);
    return group;
};

export class HintSession {
    constructor({ onSelect, onCancel }) {
        this.onSelect = onSelect;
        this.onCancel = onCancel;
        this.root = null;
        this.entries = [];
        this.matches = [];
        this.labels = new Map();
        this.prefix = '';
        this.cancelForViewport = () => this.cancel();
        this.cancelForPointer = (event) => {
            if (event.isTrusted) {
                this.cancel();
            }
        };
    }

    get active() {
        return this.root !== null;
    }

    start() {
        this.stop();
        const viewport = viewportSize();
        const targets = [];
        for (const element of document.querySelectorAll(CLICKABLE_SELECTOR)) {
            const target = measureTarget(element, viewport);
            if (target) {
                targets.push(target);
            }
        }
        targets.sort((a, b) => b.score - a.score);
        if (targets.length === 0) {
            return false;
        }

        const labels = generateHintLabels(targets.length);
        const root = document.createElement('div');
        root.dataset.vimcord = 'hints';
        root.className = 'vimcord-hints';
        root.setAttribute('aria-hidden', 'true');
        Object.assign(root.style, {
            position: 'fixed',
            inset: '0',
            pointerEvents: 'none',
            zIndex: '2147483647',
            visibility: 'hidden',
        });

        const fragment = document.createDocumentFragment();
        this.entries = targets.map((target, index) => {
            const label = labels[index];
            const overlay = document.createElement('div');
            overlay.className = 'vimcord-hint is-match';
            overlay.textContent = label;
            Object.assign(overlay.style, {
                position: 'absolute',
                left: `${target.anchor.x}px`,
                top: `${target.anchor.y}px`,
                pointerEvents: 'none',
            });
            fragment.appendChild(overlay);
            const entry = {
                element: target.element,
                label,
                overlay,
                connector: null,
                visible: true,
            };
            this.labels.set(label, entry);
            return entry;
        });

        root.appendChild(fragment);
        this.root = root;
        document.body.appendChild(root);

        // Insert once, read all border boxes together, then write the completed layout.
        const boxes = this.entries.map((entry) => entry.overlay.getBoundingClientRect());
        const placements = layoutHints(boxes, viewport);
        const connectors = document.createElementNS(SVG_NAMESPACE, 'svg');
        connectors.classList.add('vimcord-hint-connectors');
        connectors.setAttribute('width', viewport.width);
        connectors.setAttribute('height', viewport.height);
        this.entries = this.entries.filter((entry, index) => {
            const placement = placements[index];
            if (!placement) {
                entry.overlay.remove();
                this.labels.delete(entry.label);
                return false;
            }
            const anchor = targets[index].anchor;
            entry.overlay.style.left = `${anchor.x + placement.left - boxes[index].left}px`;
            entry.overlay.style.top = `${anchor.y + placement.top - boxes[index].top}px`;
            entry.connector = createConnector(anchor, placement);
            if (entry.connector) {
                connectors.appendChild(entry.connector);
            }
            return true;
        });
        if (this.entries.length === 0) {
            this.stop();
            return false;
        }
        if (connectors.childElementCount) {
            root.prepend(connectors);
        }
        this.matches = this.entries;
        root.style.visibility = '';
        window.addEventListener('scroll', this.cancelForViewport, { capture: true, passive: true });
        window.addEventListener('resize', this.cancelForViewport, { passive: true });
        window.addEventListener('pointerdown', this.cancelForPointer, {
            capture: true,
            passive: true,
        });
        window.addEventListener('wheel', this.cancelForPointer, { capture: true, passive: true });
        return true;
    }

    handleKey(event) {
        if (!this.active) {
            return false;
        }
        if (event.key === 'Escape') {
            this.cancel();
            return true;
        }
        if (event.key === 'Backspace') {
            this.updatePrefix(this.prefix.slice(0, -1));
            return true;
        }
        if (event.key === 'Enter') {
            const exact = this.labels.get(this.prefix);
            if (exact || this.matches.length === 1) {
                this.select(exact || this.matches[0]);
            }
            return true;
        }
        if (!/^[a-z]$/i.test(event.key)) {
            return false;
        }

        const prefix = this.prefix + event.key.toUpperCase();
        if (this.updatePrefix(prefix)) {
            const exact = this.labels.get(prefix);
            if (exact) {
                this.select(exact);
            }
        }
        return true;
    }

    updatePrefix(prefix) {
        const candidates = prefix.length > this.prefix.length ? this.matches : this.entries;
        const matches = candidates.filter((entry) => entry.label.startsWith(prefix));
        if (matches.length === 0) {
            return false;
        }

        for (const entry of this.matches) {
            if (!entry.label.startsWith(prefix)) {
                entry.visible = false;
                entry.overlay.hidden = true;
                entry.overlay.classList.add('is-hidden');
                entry.overlay.classList.remove('is-match', 'is-exact');
                entry.connector?.classList.add('is-hidden');
            }
        }
        for (const entry of matches) {
            if (!entry.visible) {
                entry.visible = true;
                entry.overlay.hidden = false;
                entry.overlay.classList.remove('is-hidden');
                entry.overlay.classList.add('is-match');
                entry.connector?.classList.remove('is-hidden');
            }
            entry.overlay.classList.toggle('is-exact', entry.label === prefix);
        }
        this.prefix = prefix;
        this.matches = matches;
        return true;
    }

    select(entry) {
        const target = measureTarget(entry.element, viewportSize());
        if (!target) {
            this.cancel();
            return;
        }
        const element = entry.element;
        this.stop();
        this.onSelect(element);
    }

    cancel() {
        if (!this.active) {
            return;
        }
        this.stop();
        this.onCancel();
    }

    stop() {
        window.removeEventListener('scroll', this.cancelForViewport, true);
        window.removeEventListener('resize', this.cancelForViewport);
        window.removeEventListener('pointerdown', this.cancelForPointer, true);
        window.removeEventListener('wheel', this.cancelForPointer, true);
        this.root?.remove();
        this.root = null;
        this.entries = [];
        this.matches = [];
        this.labels.clear();
        this.prefix = '';
    }
}

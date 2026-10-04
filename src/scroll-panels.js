import { isVisible, OWNED_SELECTOR } from './dom.js';

const EXCLUDED = `${OWNED_SELECTOR}, input, textarea, select, button, svg, [contenteditable],
    [role="textbox"], [role="button"], [role="combobox"], [class*="channelTextArea_"],
    [role="article"], [role="menu"], [role="tooltip"], pre, code`;
const HEADING = 'h1, h2, h3, [role="heading"]';

function excluded(element) {
    return !!element.closest(EXCLUDED);
}

export function isScrollSurface(element) {
    return /^(auto|scroll|overlay)$/.test(getComputedStyle(element).overflowY);
}

function hasPanelArea(element) {
    const rect = element.getBoundingClientRect();
    let left = Math.max(0, rect.left);
    let right = Math.min(window.innerWidth, rect.right);
    let top = Math.max(0, rect.top);
    let bottom = Math.min(window.innerHeight, rect.bottom);
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const bounds = parent.getBoundingClientRect();
        if (/^(auto|scroll|overlay|hidden|clip)$/.test(style.overflowX)) {
            left = Math.max(left, bounds.left);
            right = Math.min(right, bounds.right);
        }
        if (/^(auto|scroll|overlay|hidden|clip)$/.test(style.overflowY)) {
            top = Math.max(top, bounds.top);
            bottom = Math.min(bottom, bounds.bottom);
        }
    }
    return right - left >= 120 && bottom - top >= 100;
}

// Index CSS scroll containers once, then inspect only changed DOM branches.
// Keep empty containers in the index so later content growth needs no full scan.
export class ScrollPanels {
    constructor() {
        this.candidates = new Set();
        this.dirtyRoots = new Set([document.body]);
    }

    invalidate(root = document.body) {
        if (!(root instanceof Element) || excluded(root)) {
            return false;
        }
        for (const pending of this.dirtyRoots) {
            if (pending.contains(root)) {
                return true;
            }
            if (root.contains(pending)) {
                this.dirtyRoots.delete(pending);
            }
        }
        this.dirtyRoots.add(root);
        return true;
    }

    onMutation(record) {
        const target =
            record.target instanceof Element ? record.target : record.target.parentElement;
        if (!(target instanceof Element) || excluded(target)) {
            return false;
        }
        if (record.type === 'attributes') {
            return this.invalidate(target);
        }
        let changed = false;
        for (const node of record.addedNodes) {
            changed = this.invalidate(node) || changed;
        }
        return (
            changed ||
            [...record.removedNodes].some((node) => node instanceof Element && !excluded(node)) ||
            !!target.closest(HEADING) ||
            [...this.candidates].some((candidate) => candidate.contains(target))
        );
    }

    scan(root) {
        const visit = (element) => {
            if (isScrollSurface(element)) {
                this.candidates.add(element);
            } else {
                this.candidates.delete(element);
            }
        };
        if (!root.isConnected || excluded(root)) {
            return;
        }
        visit(root);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
            acceptNode: (element) =>
                element.matches(EXCLUDED) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
        });
        while (walker.nextNode()) {
            visit(walker.currentNode);
        }
    }

    discover(scope, knownElements) {
        for (const root of this.dirtyRoots) {
            this.scan(root);
        }
        this.dirtyRoots.clear();
        const eligible = [];
        for (const element of this.candidates) {
            if (!element.isConnected) {
                this.candidates.delete(element);
                continue;
            }
            if (
                !scope.contains(element) ||
                excluded(element) ||
                !isVisible(element) ||
                element.scrollHeight <= element.clientHeight + 1 ||
                !isScrollSurface(element) ||
                !hasPanelArea(element) ||
                knownElements.some((known) => known.contains(element) || element.contains(known))
            ) {
                continue;
            }
            eligible.push(element);
        }
        return eligible.filter(
            (element) => !eligible.some((parent) => parent !== element && parent.contains(element)),
        );
    }

    stop() {
        this.candidates.clear();
        this.dirtyRoots.clear();
    }
}

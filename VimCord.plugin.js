/**
 * @name VimCord
 * @description Plugin that allows keyboard navigation for Discord.
 * @author CyR1en
 * @authorLink https://github.com/cyr1en
 * @version 0.1.2
 */

/* -------------------- CLASS/SELECTOR CONSTANTS -------------------- */
const REF_ELEM = {
    userArea: 'section.panels_c48ade[aria-label="User area"]'
};

const REF_HINTS = {
    clickable: [
        'button:not([aria-hidden="true"])',
        'a[href]:not([aria-hidden="true"])',
        '[role="button"]:not([aria-hidden="true"])',
        '.clickable__91a9d:not([aria-hidden="true"])',
        '.item__133bf:not([aria-hidden="true"])',
        '.wrapper__6e9f8:not([aria-hidden="true"])',
        '.folderButtonInner__48112:not([aria-hidden="true"])',
        '.channelMention.wrapper_f61d60.interactive:not([aria-hidden="true"])',
        '.backdrop__78332.withLayer__78332:not([aria-hidden="true"])',
        '.inputDefault_f525d3.input_f525d3F:not([aria-hidden="true"])',
        '.checkbox_f525d3.box_f525d3:not([aria-hidden="true"])'
    ].join(', '),
    ignore: [
        'span.chipletContainerInner__10651.clanTag__5d473',
        'svg.premiumIcon__5d473.icon__5d473',
        'button:has(svg.premiumIcon__5d473.icon__5d473)',
        'a:has(svg.premiumIcon__5d473.icon__5d473)',
        '[role="button"]:has(svg.premiumIcon__5d473.icon__5d473)',
        '.sidebarResizeHandle_c48ade',
        '.title_c38106'
    ],
    fuzzyIgnoreEnabled: true,
    fuzzyIgnoreClassSubstrings: [
        'clanTag__',
        'chipletContainerInner__',
        'premiumIcon__',
        'icon__5d473'
    ],
    fuzzyIncludeEnabled: true,
    fuzzyIncludeClassSubstrings: [
        'clickable__',
        'clickTrapContainer_',
        'input_',
        'backdrop_'
    ]
};

const REF_SCROLL = {
    serverList: 'div.stack_dbd263.scroller_ef3116.scrollerBase_d125d2, div.scroller_ef3116.scrollerBase_d125d2',
    channelList: 'div#channels.scroller__629e4, div.scroller__629e4',
    dmList: 'div.scroller__99e7c',
    channel: 'div.scroller__36d07',
    friendsList: 'div.peopleList__5ec2f'
};

/* -------------------- KNOWN INPUTS -------------------- */
const REF_INPUTS = {
    selectors: [
        '[contenteditable="true"][data-slate-editor="true"]',
        'textarea',
        'input[type="text"]',
        '.searchBar__97492 .public-DraftEditor-content[contenteditable="true"][role="combobox"]',
        '.DraftEditor-root .public-DraftEditor-content[contenteditable="true"]'
    ],
    ariaLabels: [
        'Search',
        'Quick switcher'
    ],
    attributeMatchers: [
        { attr: 'role', value: 'combobox' },
        { attr: 'contenteditable', value: 'true' }
    ]
};

const findKnownInputs = () => {
    const bySelectors = REF_INPUTS.selectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
    const genericCE = Array.from(document.querySelectorAll('[contenteditable="true"], [role="combobox"]'));
    const byAria = genericCE.filter(el => {
        const aria = (el.getAttribute('aria-label') || '').trim();
        return aria && REF_INPUTS.ariaLabels.some(lbl => aria.toLowerCase() === lbl.toLowerCase());
    });
    const byAttrs = genericCE.filter(el => {
        return REF_INPUTS.attributeMatchers.every(m => (el.getAttribute(m.attr) || '') === m.value);
    });
    return Array.from(new Set([...bySelectors, ...byAria, ...byAttrs]));
};

const isKnownInput = (el) => {
    if (!el) return false;
    if (REF_INPUTS.selectors.some(sel => { try { return el.matches(sel); } catch { return false; } })) return true;
    const aria = (el.getAttribute('aria-label') || '').trim();
    if (aria && REF_INPUTS.ariaLabels.some(lbl => aria.toLowerCase() === lbl.toLowerCase())) return true;
    return !!REF_INPUTS.attributeMatchers.every(m => (el.getAttribute(m.attr) || '') === m.value);
};

const isChannelComposer = (el) => {
    if (!el) return false;
    if (el.matches?.('[contenteditable="true"][data-slate-editor="true"]')) return true;
    if (el.matches?.('textarea, input[type="text"]')) {
        const container = el.closest?.('form, div');
        const isSearch = el.getAttribute('aria-label')?.toLowerCase() === 'search';
        return !isSearch && !!container;
    }
    return false;
};

/* -------------------- STATE -------------------- */
let currentMode = "normal";
let keyListener = null;
let modeIndicatorEl = null;
let modeContainerEl = null;
let panelObserver = null;
let suppressAutoInsertUntil = 0;
let hintExitHandlersAttached = false;
let styleNode = null;
const SUPPRESS_MS_AFTER_ESCAPE = 300;

/* -------------------- STYLE INJECTION -------------------- */
const injectDefaultStyles = () => {
    if (styleNode) return;
    styleNode = document.createElement('style');
    styleNode.id = 'vimcord-default-styles';
    styleNode.textContent = `
        /* Indicator container and text */
        .vimcord-indicator-container {
          width: 100%;
          padding: 4px 8px;
          box-sizing: border-box;
          font-size: 12px;
          font-weight: 600;
          border-top: 1px solid var(--vimcord-indicator-border, rgba(255,255,255,0.05));
          background: var(--vimcord-indicator-bg, var(--background-secondary));
          color: var(--vimcord-indicator-fg, #ffffff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vimcord-indicator {
          font-family: var(--vimcord-font, inherit);
        }

        /* Hint overlay */
        .vimcord-hint {
          position: absolute;
          background: var(--vimcord-hint-bg, #ffd700);
          color: var(--vimcord-hint-fg, #000);
          border: 1px solid var(--vimcord-hint-border, #333);
          border-radius: var(--vimcord-hint-radius, 4px);
          padding: var(--vimcord-hint-padding, 2px 5px);
          font-weight: 700;
          font-size: var(--vimcord-hint-size, 12px);
          z-index: 2147483647;
          pointer-events: none;
          user-select: none;
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
        .vimcord-hint.is-hidden { display: none; }
        .vimcord-hint.is-match { opacity: 1; }
        .vimcord-hint:not(.is-match) { opacity: 0.35; }
        .vimcord-hint.is-exact { transform: translate(-50%, -50%) scale(1.06); }`;
    document.head.appendChild(styleNode);
};

const removeDefaultStyles = () => {
    if (styleNode) {
        try { styleNode.remove(); } catch {}
        styleNode = null;
    }
};



/* -------------------- INDICATOR -------------------- */
const findUserAreaSection = () => document.querySelector(REF_ELEM.userArea);


const createModeContainer = () => {
    const container = document.createElement("div");
    container.className = "vim-indicator-container vimcord-indicator-container";
    return container;
};

const createOrGetModeIndicator = () => {
    // Always ensure we have a single indicator element with a stable class
    if (modeIndicatorEl && document.body.contains(modeIndicatorEl)) return modeIndicatorEl;
    modeIndicatorEl = document.createElement("span");
    modeIndicatorEl.className = "vim-indicator vimcord-indicator";
    return modeIndicatorEl;
};

const attachIndicatorToUserArea = () => {
    const area = findUserAreaSection();
    if (!area) return;

    const existingInArea = area.querySelector(".vim-indicator-container");
    if (existingInArea) {
        modeContainerEl = existingInArea;
        if (!modeContainerEl.classList.contains('vimcord-indicator-container')) {
            modeContainerEl.classList.add('vimcord-indicator-container');
        }
    } else if (!modeContainerEl || !area.contains(modeContainerEl)) {
        modeContainerEl = createModeContainer();
        area.appendChild(modeContainerEl);
    }

    const indicator = createOrGetModeIndicator();
    const existingIndicator = modeContainerEl.querySelector(".vim-indicator");
    if (!existingIndicator) {
        modeContainerEl.appendChild(indicator);
    } else if (existingIndicator !== indicator) {
        existingIndicator.replaceWith(indicator);
    }
};

const observeUserArea = () => {
    const root = document.querySelector("#app-mount") || document.body;
    if (!root) return;
    if (panelObserver) panelObserver.disconnect();
    panelObserver = new MutationObserver(() => {
        attachIndicatorToUserArea();
        updateModeIndicator(currentMode);
        refreshScrollablePanes();
        refreshComposerFocusControl(); // keep patched after DOM updates
    });
    panelObserver.observe(root, { childList: true, subtree: true });
    attachIndicatorToUserArea();
    updateModeIndicator(currentMode);
};

const disconnectUserAreaObserver = () => {
    if (panelObserver) { panelObserver.disconnect(); panelObserver = null; }
};

/* -------------------- CHANNEL COMPOSER FOCUS CONTROL -------------------- */
let composerFocusPatched = new WeakSet();
let composerOriginalFocus = new WeakMap();

const patchComposerFocus = (el) => {
    if (!el || composerFocusPatched.has(el)) return;
    const orig = el.focus;
    if (typeof orig !== 'function') return;

    composerOriginalFocus.set(el, orig);

    el.focus = function(...args) {
        if (currentMode === 'normal') {
            return;
        }
        return orig.apply(this, args);
    };

    composerFocusPatched.add(el);
};

const unpatchComposerFocus = (el) => {
    if (!el) return;
    if (!composerFocusPatched.has(el)) return;
    const orig = composerOriginalFocus.get(el);
    if (orig) {
        el.focus = orig;
        composerOriginalFocus.delete(el);
    }
    composerFocusPatched.delete(el);
};

const refreshComposerFocusControl = () => {
    const candidates = Array.from(document.querySelectorAll('[contenteditable="true"][data-slate-editor="true"], textarea, input[type="text"]'));
    for (const el of candidates) {
        if (!isChannelComposer(el)) continue;
        if (currentMode === 'normal') {
            patchComposerFocus(el);
            if (document.activeElement === el) {
                try { el.blur(); } catch {}
            }
        } else {
            unpatchComposerFocus(el);
        }
    }
};

/* -------------------- SCROLL PANE MANAGER -------------------- */
let scrollPanes = [];
let activePaneIndex = 0;
let paneObserver = null;

const isScrollableY = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    return (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflow)) && el.scrollHeight > el.clientHeight;
};

const discoverScrollablePanes = () => {
    const panes = [];
    const server = document.querySelector(REF_SCROLL.serverList);
    if (server && isScrollableY(server)) panes.push(server);
    const channelList = document.querySelector(REF_SCROLL.channelList);
    const dmList = document.querySelector(REF_SCROLL.dmList);
    const friendsList = document.querySelector(REF_SCROLL.friendsList);
    if (channelList && isScrollableY(channelList)) panes.push(channelList);
    else if (dmList && isScrollableY(dmList)) panes.push(dmList);
    else if (friendsList && isScrollableY(friendsList)) panes.push(friendsList);
    const channel = document.querySelector(REF_SCROLL.channel);
    if (channel && isScrollableY(channel)) panes.push(channel);
    return panes;
};

const clampActiveIndex = () => {
    if (scrollPanes.length === 0) { activePaneIndex = -1; return; }
    if (activePaneIndex < 0) activePaneIndex = 0;
    if (activePaneIndex >= scrollPanes.length) activePaneIndex = scrollPanes.length - 1;
};

const getPaneLabel = (index) => {
    if (!scrollPanes[index]) return "";
    const el = scrollPanes[index];
    if (el.matches(REF_SCROLL.serverList)) return "Server List";
    if (el.matches(REF_SCROLL.channelList)) return "Channel List";
    if (el.matches(REF_SCROLL.dmList)) return "DM List";
    if (el.matches(REF_SCROLL.friendsList)) return "Friends List";
    if (el.matches(REF_SCROLL.channel)) return "Channel";
    return "Unknown";
};

const refreshScrollablePanes = () => {
    const oldActive = scrollPanes[activePaneIndex];
    scrollPanes = discoverScrollablePanes();
    if (oldActive) {
        const idx = scrollPanes.findIndex(el => el === oldActive);
        activePaneIndex = idx !== -1 ? idx : Math.min(1, scrollPanes.length - 1);
    } else {
        activePaneIndex = Math.min(1, scrollPanes.length - 1);
    }
    clampActiveIndex();
    updateModeIndicator(currentMode);
};

const scrollActivePane = (deltaY) => {
    if (activePaneIndex < 0 || activePaneIndex >= scrollPanes.length) return;
    const el = scrollPanes[activePaneIndex];
    if (!el) return;
    try { el.scrollBy({ top: deltaY, behavior: "smooth" }); }
    catch { el.scrollTop += deltaY; }
};

const moveActivePane = (dir) => {
    if (scrollPanes.length === 0) return;
    if (dir === "left") activePaneIndex = Math.max(0, activePaneIndex - 1);
    else if (dir === "right") activePaneIndex = Math.min(scrollPanes.length - 1, activePaneIndex + 1);
    updateModeIndicator(currentMode);
};

const observePanes = () => {
    const root = document.querySelector("#app-mount") || document.body;
    if (!root) return;
    if (paneObserver) paneObserver.disconnect();
    paneObserver = new MutationObserver(() => {
        refreshScrollablePanes();
        refreshComposerFocusControl();
    });
    paneObserver.observe(root, { childList: true, subtree: true });
    refreshScrollablePanes();
};

const disconnectPaneObserver = () => {
    if (paneObserver) { paneObserver.disconnect(); paneObserver = null; }
};

/* -------------------- MODE INDICATOR + FOCUS LABEL -------------------- */
const updateModeIndicator = (mode) => {
    attachIndicatorToUserArea();
    if (!modeIndicatorEl) return;
    let modeText = "";
    switch (mode) {
        case "normal": modeText = "Normal"; break;
        case "hint": modeText = "Hint"; break;
        case "insert": modeText = "Insert"; break;
        case "visual-caret": modeText = "Visual Caret"; break;
        case "visual-range": modeText = "Visual Range"; break;
    }
    const focusLabel = getPaneLabel(activePaneIndex);
    modeIndicatorEl.textContent = `${modeText}${focusLabel ? ` | Focus: ${focusLabel}` : ""}`;
};

/* -------------------- MODE SWITCH -------------------- */
const setMode = (mode) => {
    cleanupMode(currentMode);
    currentMode = mode;
    initMode(currentMode);
    updateModeIndicator(currentMode);
    refreshComposerFocusControl();
};

const cleanupMode = (mode) => {
    if (mode === "hint") {
        cleanupHintMode();
        detachHintExitHandlers();
    }
};

const initMode = (mode) => {
    if (mode === "hint") {
        triggerScan();
        attachHintExitHandlers();
    }
};

/* -------------------- MODE HANDLERS -------------------- */
const normalModeHandler = (e) => {
    switch (e.key) {
        case "f": setMode("hint"); break;
        case "h": moveActivePane("left"); break;
        case "l": moveActivePane("right"); break;
        case "j": scrollActivePane(80); break;
        case "k": scrollActivePane(-80); break;
        case "d":
        case "D": scrollActivePane(window.innerHeight / 2); break;
        case "u":
        case "U": scrollActivePane(-window.innerHeight / 2); break;
        case "v": setMode("visual-caret"); break;
        case "i":
            setMode("insert");
        {
            const input = findKnownInputs()[0];
            if (input) { try { input.focus(); } catch {} }
        }
            break;
    }
};
const visualCaretHandler = (e) => e.key === "Escape" ? setMode("normal") : normalModeHandler(e);
const insertModeHandler = (e) => {
    if (e.key === "Escape") {
        suppressAutoInsertUntil = Date.now() + SUPPRESS_MS_AFTER_ESCAPE;

        const active = document.activeElement;
        if (active && typeof active.blur === "function") {
            try { active.blur(); } catch {}
        }

        setMode("normal");
    }
};

const hintModeHandler = (e) => handleHintKey(e);

/* -------------------- KEY DISPATCH -------------------- */
const keyDispatch = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    if (currentMode !== "insert") { e.preventDefault(); e.stopImmediatePropagation(); }
    if (currentMode === "normal") normalModeHandler(e);
    else if (currentMode.startsWith("visual")) visualCaretHandler(e);
    else if (currentMode === "hint") hintModeHandler(e);
    else if (currentMode === "insert") insertModeHandler(e);
};

/* -------------------- HINT MODE W/ OCCLUSION + IGNORE + FUZZY INCLUDE -------------------- */
let hintOverlays = [], hintMap = new Map(), clickableElements = [], typedSequence = "";
let hintOverlayMap = new Map();
let hintAutoSelectTimer = null;
let maxHintLabelLength = 0;
const HINT_AUTOCOMPLETE_DELAY = 5000;

const withClickThroughAtPoint = (el, clientX, clientY, fn) => {
    const disabled = [];
    const isAncestor = (n, t) => {
        while (n) { if (n === t) return true; n = n.parentElement; }
        return false;
    };

    // Collect a small stack of blocking elements at the point (up to depth N)
    const maxLayers = 6;
    for (let i = 0; i < maxLayers; i++) {
        const top = document.elementFromPoint(clientX, clientY);
        if (!top) break;
        if (isAncestor(top, el) || top === el) break;

        const cs = getComputedStyle(top);
        if (cs.pointerEvents !== 'none') {
            const prev = top.style.pointerEvents;
            top.style.pointerEvents = 'none';
            disabled.push({ node: top, prev });
        } else {
            const prevVis = top.style.visibility;
            top.style.visibility = 'hidden';
            disabled.push({ node: top, prev: prevVis, prop: 'visibility' });
        }
    }

    let result;
    try { result = fn(); } finally {
        for (let i = disabled.length - 1; i >= 0; i--) {
            const { node, prev, prop } = disabled[i];
            if (prop === 'visibility') node.style.visibility = prev;
            else node.style.pointerEvents = prev;
        }
    }
    return result;
};

const dispatchSequenceOnElement = (el, clientX, clientY) => {
    if (!el) return false;
    const view = window;
    const base = {
        clientX, clientY,
        bubbles: true,
        cancelable: true,
        composed: true,
        view
    };

    // Hover/enter
    el.dispatchEvent(new PointerEvent('pointerover', { pointerId: 1, pointerType: 'mouse', ...base }));
    el.dispatchEvent(new MouseEvent('mouseover', base));
    el.dispatchEvent(new PointerEvent('pointerenter', { pointerId: 1, pointerType: 'mouse', ...base, bubbles: false }));
    el.dispatchEvent(new MouseEvent('mouseenter', { ...base, bubbles: false }));

    // Move
    el.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', ...base }));
    el.dispatchEvent(new MouseEvent('mousemove', base));

    // Down
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, ...base }));
    el.dispatchEvent(new MouseEvent('mousedown', { button: 0, buttons: 1, ...base }));

    // Up
    el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 0, ...base }));
    el.dispatchEvent(new MouseEvent('mouseup', { button: 0, buttons: 0, ...base }));

    // Click
    return el.dispatchEvent(new MouseEvent('click', {button: 0, buttons: 0, ...base}));
};



const findActionableAncestor = (el) => {
    return el.closest?.('button, a[href], [role="button"], [tabindex]:not([tabindex="-1"])') || el;
};

const robustClick = (el) => {
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const anchor = findUncoveredAnchor(el) || center;

    if (isKnownInput(el)) {
        try { el.focus?.(); } catch {}
    }

    // Strategy 1: dispatch sequence directly on the element
    const s1 = dispatchSequenceOnElement(el, anchor.x, anchor.y);
    if (s1) return true;

    // Strategy 2: try click-through by disabling blockers at that point
    const s2 = withClickThroughAtPoint(el, anchor.x, anchor.y, () => {
        // Attempt elementFromPoint now that blockers are temporarily disabled
        return dispatchRealisticClickAtPoint(anchor.x, anchor.y);
    });
    if (s2) return true;

    // Strategy 3: naive elementFromPoint at anchor without modifications
    const s3 = dispatchRealisticClickAtPoint(anchor.x, anchor.y);
    if (s3) return true;

    // Strategy 4: actionable ancestor .click()
    const act = findActionableAncestor(el);
    try {
        act.click?.();
        return true;
    } catch {
        return false;
    }
};

const isNonOccluding = (node) => {
    if (!node) return false;
    const cs = getComputedStyle(node);
    return cs.pointerEvents === 'none';
};

const topChainHas = (start, target) => {
    let n = start;
    while (n) {
        if (n === target) return true;
        n = n.parentElement;
    }
    return false;
};


const hitTestIncludes = (el, x, y) => {
    let top = document.elementFromPoint(x, y);

    if (!top) return false;
    if (topChainHas(top, el)) return true;

    let t = top;
    while (t && t !== document.body) {
        if (!isNonOccluding(t)) return false;
        t = t.parentElement;
    }
    return true;
};

const hasAnyUncoveredPoint = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const cols = Math.min(6, Math.max(2, Math.ceil(rect.width / 100)));
    const rows = Math.min(6, Math.max(2, Math.ceil(rect.height / 100)));

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = rect.left + (rect.width  * (c + 0.5)) / cols;
            const y = rect.top  + (rect.height * (r + 0.5)) / rows;

            if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;

            if (hitTestIncludes(el, x, y)) return true;
        }
    }
    return false;
};

const findUncoveredAnchor = (el) => {
    const rect = el.getBoundingClientRect();
    const cols = Math.min(6, Math.max(2, Math.ceil(rect.width / 100)));
    const rows = Math.min(6, Math.max(2, Math.ceil(rect.height / 100)));

    const candidates = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = rect.left + (rect.width  * (c + 0.5)) / cols;
            const y = rect.top  + (rect.height * (r + 0.5)) / rows;
            candidates.push({x, y});
        }
    }

    candidates.sort((a, b) => {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy);
    });

    for (const p of candidates) {
        if (p.x < 0 || p.y < 0 || p.x > window.innerWidth || p.y > window.innerHeight) continue;
        if (hitTestIncludes(el, p.x, p.y)) return p;
    }
    return null;
};

const dispatchRealisticClickAtPoint = (clientX, clientY) => {
    const target = document.elementFromPoint(clientX, clientY);
    if (!target) return false;

    const common = {
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        // Left button
        button: 0,
        buttons: 1,
    };

    const peDown = new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', ...common });
    target.dispatchEvent(peDown);

    const md = new MouseEvent('mousedown', common);
    target.dispatchEvent(md);

    const peUp = new PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse', ...common });
    target.dispatchEvent(peUp);

    const mu = new MouseEvent('mouseup', { ...common, buttons: 0 });
    target.dispatchEvent(mu);

    const clickEv = new MouseEvent('click', { ...common, buttons: 0 });
    return target.dispatchEvent(clickEv);
};

const shouldIgnoreBySelectors = (el) => {
    return REF_HINTS.ignore.some(sel => {
        try { return el.matches?.(sel); } catch { return false; }
    });
};

const shouldIgnoreBySelectorsInAncestors = (el) => {
    let cur = el.parentElement;
    while (cur) {
        if (shouldIgnoreBySelectors(cur)) return true;
        cur = cur.parentElement;
    }
    return false;
};

const classListString = (node) => {
    if (!node) return '';
    if (typeof node.className === 'string') return node.className;
    if (node.classList && node.classList.value) return node.classList.value;
    return '';
};

const shouldIgnoreByFuzzy = (el) => {
    if (!REF_HINTS.fuzzyIgnoreEnabled) return false;
    const check = (node) => {
        const cls = classListString(node);
        if (!cls) return false;
        return REF_HINTS.fuzzyIgnoreClassSubstrings.some(sub => cls.includes(sub));
    };
    if (check(el)) return true;
    let cur = el.parentElement;
    while (cur) {
        if (check(cur)) return true;
        cur = cur.parentElement;
    }
    return false;
};

const shouldIgnoreForHints = (el) => {
    if (shouldIgnoreBySelectors(el)) return true;
    if (shouldIgnoreBySelectorsInAncestors(el)) return true;
    return shouldIgnoreByFuzzy(el);
};

const collectFuzzyIncludeElements = () => {
    if (!REF_HINTS.fuzzyIncludeEnabled) return [];
    const all = Array.from(document.querySelectorAll('body *'));
    return all.filter(node => {
        const cls = classListString(node);
        if (!cls) return false;
        return REF_HINTS.fuzzyIncludeClassSubstrings.some(sub => cls.includes(sub));
    });
};

const triggerScan = () => {
    cleanupHintMode();
    clickableElements = getClickableElements();
    const hintChars = 'ASDFGHJKLQWERTYUIOPZXCVBNM';
    const labels = generateHintLabels(clickableElements.length, hintChars);
    maxHintLabelLength = labels.reduce((m, l) => Math.max(m, l.length), 0) || 0;
    console.log('Max label length: ', maxHintLabelLength);
    const hints = clickableElements.map((el, i) => ({ label: labels[i], rect: el.getBoundingClientRect() }));
    showHints(hints);
    typedSequence = "";
};


const zIndexInt = (el) => {
    const z = getComputedStyle(el).zIndex;
    const zi = parseInt(z, 10);
    return Number.isFinite(zi) ? zi : 0;
};

const viewportDistanceScore = (el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const vx = window.innerWidth / 2;
    const vy = window.innerHeight / 2;
    // smaller distance = better (we'll invert in the final score)
    return Math.hypot(cx - vx, cy - vy);
};

const visibleArea = (el) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, r.width) * Math.max(0, r.height);
};

// Higher score = higher priority (shorter labels)
const elementPriorityScore = (el) => {
    const z = zIndexInt(el);
    const area = visibleArea(el);
    const dist = viewportDistanceScore(el);
    return z * 1e9 + area * 1e3 - dist;
};

const sortByPriority = (elements) => {
    return [...elements].sort((a, b) => elementPriorityScore(b) - elementPriorityScore(a));
};

const getClickableElements = () => {
    const selectorCandidates = Array.from(document.querySelectorAll(REF_HINTS.clickable));
    const fuzzyCandidates = collectFuzzyIncludeElements();
    const knownInputs = findKnownInputs();
    const merged = Array.from(new Set([...selectorCandidates, ...fuzzyCandidates, ...knownInputs]));
    const filtered = [];
    for (const el of merged) {
        if (!el) continue;
        if (el.offsetParent === null) continue;

        const style = window.getComputedStyle(el);
        if (style.visibility === "hidden" || style.pointerEvents === "none") continue;

        if (shouldIgnoreForHints(el)) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) continue;

        if (hasAnyUncoveredPoint(el)) filtered.push(el);
    }

    // Foreground-first ordering for shorter labels
    return sortByPriority(filtered);
};

const generateHintLabels = (count, chars) => {
    const labels = [];
    let length = 1;
    while (labels.length < count) {
        generateLabelsRecursive("", length, chars, labels, count);
        length++;
    }
    return labels;
};

const generateLabelsRecursive = (prefix, depth, chars, labels, count) => {
    for (let i = 0; i < chars.length && labels.length < count; i++) {
        const newLabel = prefix + chars[i];
        if (depth === 1) labels.push(newLabel);
        else generateLabelsRecursive(newLabel, depth - 1, chars, labels, count);
    }
};

const showHints = (hints) => {
    const frag = document.createDocumentFragment();
    hintMap.clear();
    hintOverlayMap.clear();
    hintOverlays = [];


    hints.forEach((hint, i) => {
        const el = clickableElements[i];
        if (!el || shouldIgnoreForHints(el)) return;

        const anchor = findUncoveredAnchor(el);
        if (!anchor) return;

        const overlay = document.createElement('div');
        overlay.textContent = hint.label;
        overlay.className = 'vimcord-hint';
        // Only positional styles here; appearance is fully in CSS
        overlay.style.left = `${anchor.x + window.scrollX}px`;
        overlay.style.top = `${anchor.y + window.scrollY}px`;

        frag.appendChild(overlay);
        hintOverlays.push(overlay);
        hintMap.set(hint.label, el);
        hintOverlayMap.set(hint.label, overlay);
    });

    if (frag.childNodes.length) document.body.appendChild(frag);
};

const updateHintOverlaysForPrefix = () => {
    const prefix = typedSequence.toUpperCase();
    for (const [label, overlay] of hintOverlayMap.entries()) {
        if (!overlay) continue;
        const isMatch = label.startsWith(prefix) || prefix.length === 0;
        overlay.classList.toggle('is-hidden', !isMatch);
        overlay.classList.toggle('is-match', label.startsWith(prefix));
        overlay.classList.toggle('is-exact', label === prefix && prefix.length > 0);
    }
};

const scheduleHintAutoSelect = () => {
    if (hintAutoSelectTimer) clearTimeout(hintAutoSelectTimer);
    if (!typedSequence) return;

    hintAutoSelectTimer = setTimeout(() => {
        resolveTypedSelection();
    }, HINT_AUTOCOMPLETE_DELAY);
};

const resolveTypedSelection = () => {
    if (hintMap.has(typedSequence)) {
        activateHintByLabel(typedSequence);
        return true;
    }
    const matches = [...hintMap.keys()].filter(label => label.startsWith(typedSequence));
    if (matches.length === 1) {
        activateHintByLabel(matches[0]);
        return true;
    }
    return false;
};

const activateHintByLabel = (label) => {
    const el = hintMap.get(label);
    if (!el || shouldIgnoreForHints(el)) {
        setMode('normal');
        return;
    }

    robustClick(el);

    if (isKnownInput(el)) {
        setMode('insert');
        try { el.focus?.(); } catch {}
        return;
    }

    setMode('normal');
};

const handleHintKey = (e) => {
    if (e.key === "Escape") { setMode("normal"); return; }

    if (e.key === "Backspace") {
        if (typedSequence.length > 0) {
            typedSequence = typedSequence.slice(0, -1);
            updateHintOverlaysForPrefix();
            scheduleHintAutoSelect();
        }
        return;
    }

    if (e.key === "Enter") {
        resolveTypedSelection();
        return;
    }

    if (/^[a-zA-Z]$/.test(e.key)) {
        if (typedSequence.length >= maxHintLabelLength) { return; }

        typedSequence += e.key.toUpperCase();
        updateHintOverlaysForPrefix();

        if (hintMap.has(typedSequence)) {
            const matches = [...hintMap.keys()].filter(label => label.startsWith(typedSequence));
            if (matches.length === 1) {
                activateHintByLabel(typedSequence);
                return;
            }
        }

        scheduleHintAutoSelect();
    }
};

const attachHintExitHandlers = () => {
    if (hintExitHandlersAttached) return;
    hintExitHandlersAttached = true;

    // Reuse the same references so we can remove them later
    if (!attachHintExitHandlers._exitWheel) {
        attachHintExitHandlers._exitWheel = () => setMode("normal");
        attachHintExitHandlers._exitMouseDown = () => setMode("normal");
    }

    window.addEventListener('wheel', attachHintExitHandlers._exitWheel, { passive: true, capture: true });
    window.addEventListener('mousedown', attachHintExitHandlers._exitMouseDown, { capture: true });
};

const detachHintExitHandlers = () => {
    if (!hintExitHandlersAttached) return;
    hintExitHandlersAttached = false;

    // Remove using the same stored references
    if (attachHintExitHandlers._exitWheel) {
        window.removeEventListener('wheel', attachHintExitHandlers._exitWheel, { capture: true });
    }
    if (attachHintExitHandlers._exitMouseDown) {
        window.removeEventListener('mousedown', attachHintExitHandlers._exitMouseDown, { capture: true });
    }
};

const cleanupHintMode = () => {
    if (hintAutoSelectTimer) {
        clearTimeout(hintAutoSelectTimer);
        hintAutoSelectTimer = null;
    }
    hintOverlays.forEach(o => o.remove());
    hintOverlays = [];
    hintMap.clear();
    hintOverlayMap.clear();
    typedSequence = "";
    maxHintLabelLength = 0;
};

/* -------------------- INPUT FOCUS OBSERVER -------------------- */
let inputFocusObserver = null, inputFocusIntervalId = null;
const onFocusChange = () => {
    const now = Date.now();
    if (now < suppressAutoInsertUntil) return;

    const active = document.activeElement;

    if (currentMode === 'normal' && isChannelComposer(active)) {
        try { active.blur(); } catch {}
        return;
    }

    const inKnownInput = isKnownInput(active);
    if (inKnownInput && currentMode !== "insert") {
        setMode("insert");
    }
};

const syncModeWithInputFocus = () => {
    if (inputFocusObserver) inputFocusObserver.disconnect();
    if (inputFocusIntervalId) { clearInterval(inputFocusIntervalId); }
    inputFocusObserver = new MutationObserver(onFocusChange);
    const appRoot = document.querySelector("#app-mount") || document.body;
    if (appRoot) inputFocusObserver.observe(appRoot, { childList: true, subtree: true });
    inputFocusIntervalId = setInterval(onFocusChange, 150);
    window.addEventListener('focus', onFocusChange, true);
    window.addEventListener('blur', onFocusChange, true);
};


const disconnectInputFocusObserver = () => {
    if (inputFocusObserver) { inputFocusObserver.disconnect(); inputFocusObserver = null; }
    if (inputFocusIntervalId) { clearInterval(inputFocusIntervalId); inputFocusIntervalId = null; }
    window.removeEventListener('focus', onFocusChange, true);
    window.removeEventListener('blur', onFocusChange, true);
};


/* -------------------- LIFECYCLE -------------------- */
const start = () => {
    injectDefaultStyles();
    keyListener = (e) => keyDispatch(e);
    document.addEventListener("keydown", keyListener, { capture: true });
    observeUserArea();
    observePanes();
    syncModeWithInputFocus();
    setTimeout(refreshScrollablePanes, 300);
    console.log("[VimLikeDiscord] Started in Normal mode");
};

const stop = () => {
    document.removeEventListener("keydown", keyListener, { capture: true });
    cleanupMode(currentMode);
    disconnectUserAreaObserver();
    disconnectInputFocusObserver();
    disconnectPaneObserver();

    document.querySelectorAll(".vim-indicator-container").forEach(node => {
        try { node.remove(); } catch {}
    });

    if (modeIndicatorEl && modeIndicatorEl.parentNode) {
        try { modeIndicatorEl.remove(); } catch {}
    }

    removeDefaultStyles();

    scrollPanes = []; activePaneIndex = 0;
    modeContainerEl = null;
    modeIndicatorEl = null;

    console.log("[VimLikeDiscord] Stopped");
};


/* -------------------- EXPORT -------------------- */
function VimPlugin() {}
VimPlugin.prototype.start = start;
VimPlugin.prototype.stop = stop;
module.exports = VimPlugin;
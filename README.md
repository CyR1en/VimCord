# VimCord

VimCord is a BetterDiscord plugin that brings Vim-style navigation and link hinting to Discord. Move around with hjkl, focus panes, and click anything using keyboard-driven hint labels.

Note: Visual mode is a work in progress.

## Features

- Normal, Insert, and Hint modes with a subtle mode indicator in the user area
- Keyboard scrolling and pane switching (server list, channel list, DM/friends, chat)
- Robust hinting:
    - Filters visible/clickable elements
    - Handles click traps with a multi-strategy “real click” simulation
    - Live filtering as you type
    - Enter to accept; auto-accept after a short pause
    - Ambiguous exact matches wait (e.g., A vs. AA), unambiguous exact matches activate immediately
- Customizable visuals via BetterDiscord’s Custom CSS

## Installation

1. Install BetterDiscord (if you haven’t already).
2. Download the VimCord.plugin.js file.
3. Place the file into your BetterDiscord plugins folder:
    - Windows: `%AppData%/BetterDiscord/plugins`
    - macOS: `~/Library/Application Support/BetterDiscord/plugins`
    - Linux: `~/.config/BetterDiscord/plugins`
4. In Discord, open User Settings → BetterDiscord → Plugins, and enable VimCord.

## Usage

- Press f to enter hint mode.
- Type the hint label to select. Press Enter to accept or pause briefly to auto-accept when there’s only one candidate (or when your sequence is an exact, unambiguous match).
- `hjkl` to move focus left/right between panes and scroll up/down.
- `i` to go to insert mode and focus an input. Escape to return to normal mode.

Tip: If a hint doesn’t seem clickable due to overlays, VimCord tries multiple strategies to simulate a real user click and click-through overlays.

## Customizing appearance (BetterDiscord Custom CSS)

You can theme the indicator and hint chips using Custom CSS. Paste this into BetterDiscord’s Custom CSS panel:

```css
/* Indicator bar */
.vimcord-indicator-container {
  --vimcord-indicator-bg: #181825;
  --vimcord-indicator-fg: #a6adc8;
  --vimcord-indicator-border: rgba(0,0,0,0);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* Hint chips */
.vimcord-hint {
  --vimcord-hint-bg: #f9e2af;
  --vimcord-hint-fg: #11111b;
  --vimcord-hint-border: rgba(0,0,0,0);
  --vimcord-hint-radius: 6px;
  --vimcord-hint-padding: 3px 6px;
  --vimcord-hint-size: 11px;
  letter-spacing: 0.5px;
}
.vimcord-hint.is-exact {
  box-shadow: 0 0 0 2px #181825 inset;
}
.vimcord-hint:not(.is-match) { opacity: 1; }
```

Available hooks and variables:
- Classes
    - .vimcord-indicator-container
    - .vimcord-indicator
    - .vimcord-hint, .vimcord-hint.is-match, .vimcord-hint.is-exact, .vimcord-hint.is-hidden
- CSS variables
    - Indicator: --vimcord-indicator-bg, --vimcord-indicator-fg, --vimcord-indicator-border, --vimcord-font
    - Hints: --vimcord-hint-bg, --vimcord-hint-fg, --vimcord-hint-border, --vimcord-hint-radius, --vimcord-hint-padding, --vimcord-hint-size

## Keybindings (default)

- Normal mode:
    - f: enter hint mode
    - h/l: move focus left/right across panes
    - j/k: scroll active pane down/up
    - d/u: half-page down/up
    - i: enter insert mode (focus input)
    - Escape: exit to normal mode (from insert/visual/hint)
- Hint mode:
    - Letters: build a label sequence (filtered live)
    - Backspace: remove the last character
    - Enter: accept if exact or only one match
    - Stop typing briefly: auto-accept when unambiguous

## Troubleshooting

- No hints appear: Ensure the target is visible and not covered by other UI. The plugin filters out hidden or out-of-viewport elements.
- Clicking doesn’t work: Some overlays intercept clicks. VimCord tries multiple fallback strategies; report elements that remain problematic.
- Multiple indicators stacked: This should be fixed; if you still see it, try toggling the plugin off and on.

## Roadmap

- Visual mode (in progress)
- Keymap customization
- Per-scope hint alphabets and configurable timeout
- Non-QWERTY layout improvements

## Contributing

Issues and pull requests are welcome. If you propose new selectors or behaviors, include a short description of the UI you’re addressing and steps to reproduce.

<p align="center">
  <img src="media/vimcord-logo-v2.png" alt="VimCord logo" width="144" />
</p>

<h1 align="center">VimCord</h1>

<p align="center">Navigate Discord with Vim keys.</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/CyR1en/VimCord/refs/heads/main/VimCord.plugin.js"><img src="https://img.shields.io/badge/Download-plugin-5865F2?style=flat-square" alt="Download plugin" /></a>
  <a href="https://betterdiscord.app"><img src="https://img.shields.io/badge/BetterDiscord-plugin-3E82E5?style=flat-square" alt="BetterDiscord plugin" /></a>
  <a href="package.json"><img src="https://img.shields.io/github/package-json/v/CyR1en/VimCord?style=flat-square&amp;color=5865F2" alt="Version" /></a>
  <a href="https://github.com/CyR1en/VimCord/issues"><img src="https://img.shields.io/github/issues/CyR1en/VimCord?style=flat-square" alt="Open issues" /></a>
</p>

## Install

1. Install [BetterDiscord](https://docs.betterdiscord.app/users/getting-started/installation).
2. Download [VimCord.plugin.js](https://raw.githubusercontent.com/CyR1en/VimCord/refs/heads/main/VimCord.plugin.js).
3. Open **User Settings → BetterDiscord → Plugins**, click the folder icon, and copy the file there. Enable **VimCord**.

## Get moving

Press `Escape` to enter **Normal** mode and navigate. Press `i` to enter **Insert** mode and type.

| Key        | Action                                                   |
| ---------- | -------------------------------------------------------- |
| `h` / `l`  | Switch panels                                            |
| `j` / `k`  | Scroll down / up                                         |
| `d` / `u`  | Scroll half a page                                       |
| `gg` / `G` | Jump to the top / bottom or latest messages              |
| `f` / `F`  | Show hint labels in the selected panel / across the view |
| `v` / `V`  | Select a message / range; `y` copies the selection       |
| `?`        | Show shortcuts for the current mode                      |

In Hint mode, type a control's label to activate it. Add a count to repeat a movement, like `5j`.

You can also save channel marks, revisit reading positions, reply, edit, and react. See the [full guide](docs/guide.md) for all shortcuts.

## Make it yours

Open **VimCord's plugin settings** to remap keys, adjust scrolling, and toggle the focus outline or change its fade delay. The mode indicator docks beneath your user controls.

---

[Full guide](docs/guide.md) · [Contributing](CONTRIBUTING.md) · [Report a bug](https://github.com/CyR1en/VimCord/issues)

Thanks to [@moistgreen](https://github.com/moistgreen) for the original settings and keybindings contribution in [PR #1](https://github.com/CyR1en/VimCord/pull/1).

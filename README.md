# BMC Edit

A local Business Model Canvas editor with AI coaching — runs entirely on your machine.

## Features

- Classic 9-block BMC grid with rich text editing (bold, highlighting)
- Save/open JSON files locally, recent files list
- PDF export
- AI coaching: Challenge, Ideate, and Educate actions powered by Claude
- 4 built-in coaching personas + create custom ones
- Undo/redo, keyboard shortcuts
- Zero dependencies — Python standard library only

## Install

### Option 1: pip (recommended)

```
pipx install bmc-edit
bmc-edit
```

Or with pip:

```
pip install bmc-edit
bmc-edit
```

### Option 2: Run from source

```
git clone https://github.com/JeanHaiz/bmc-edit.git
cd bmc-edit
python3 bmc_edit/server.py
```

### Option 3: Download binary

Download the latest release for your platform from [GitHub Releases](https://github.com/JeanHaiz/bmc-edit/releases). Double-click to run.

## Usage

Run `bmc-edit` and a browser tab opens automatically at `http://127.0.0.1:8470`.

- **Canvas editing**: Click any cell to add items. Use the floating toolbar for bold and color highlighting.
- **Save/Open**: Use the toolbar buttons or `Cmd/Ctrl+S` / `Cmd/Ctrl+O`.
- **PDF export**: Click the PDF button in the toolbar.
- **AI features**: Click the AI button to open the coaching panel. You'll need a Claude API key.

### Options

```
bmc-edit              # start and open browser
bmc-edit --no-browser # start without opening browser
bmc-edit --help       # show help
```

## AI Setup

AI coaching is optional — the canvas editor works fully without it.

To enable AI features, you need a Claude API key from [console.anthropic.com](https://console.anthropic.com).

The key can be provided in three ways (checked in this order):

1. **File**: `~/.bmc-edit-key` — created automatically when you enter a key in the browser
2. **Environment variable**: `ANTHROPIC_API_KEY`
3. **Browser UI**: Click the AI button and enter your key when prompted

Your API key is stored locally on your machine with restricted file permissions (0600) and is only sent directly to Anthropic's API. It never leaves your machine otherwise.

## Platform Support

- **macOS**: Full support with native file dialogs
- **Linux**: File dialogs via zenity, kdialog, or tkinter
- **Windows**: File dialogs via PowerShell or tkinter

Requires Python 3.10 or later.

## License

MIT

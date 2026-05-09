# BMC Edit

A Business Model Canvas editor with AI coaching — runs entirely in your browser as a static single-page application.

## Features

- Classic 9-block BMC grid with rich text editing (bold, highlighting)
- Save/open JSON files via browser file dialogs, auto-save to localStorage
- PDF export
- AI coaching: Challenge, Ideate, and Educate actions powered by Claude
- 4 built-in coaching personas + create custom ones
- Undo/redo, keyboard shortcuts
- Built with Vite — deploys cleanly to any static host

## Usage

The deployed site can be hosted on any static server (GitHub Pages, Netlify, etc.).

- **Canvas editing**: Click any cell to add items. Use the floating toolbar for bold and color highlighting.
- **Save/Open**: Use the toolbar buttons or `Cmd/Ctrl+S` / `Cmd/Ctrl+O`. On Chrome/Edge, files save in-place via the File System Access API. Other browsers download a JSON file.
- **PDF export**: Click the PDF button in the toolbar.
- **AI features**: Click the AI button to open the coaching panel. Requires the Injinary Wallet extension.

## AI Setup

AI coaching is optional — the canvas editor works fully without it.

To enable AI features, install the [Injinary Wallet](https://chromewebstore.google.com/detail/injinary-wallet/emnpfdhpjmgbdgmbpcbloncillceljgp) browser extension. The wallet manages your AI provider keys and billing — BMC Edit never sees your API key. The integration uses [`@injinary-wallet/sdk`](https://www.npmjs.com/package/@injinary-wallet/sdk).

Once the extension is installed, click the AI button and approve the connection when prompted. That's it.

## Development

```bash
npm install
npm run dev      # local dev server with HMR
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds the project and publishes `dist/` to GitHub Pages. In repo Settings → Pages, set Source to **GitHub Actions**.

The site is served at `https://<user>.github.io/bmc-edit/`. To use a custom domain, change `base` in `vite.config.ts` to `'/'` and add a `CNAME` file under `public/`.

## License

MIT

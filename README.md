# ReproCheck

ReproCheck is an offline browser preflight for a research reproducibility ZIP. It checks whether expected documentation and configuration are present and whether a figure manifest's references point to files in the same archive. It does not execute scripts or establish scientific reproducibility.

## Run

Extract this distribution and open `index.html` in a recent Chrome or Edge browser. No build, credentials or API key is required. If your browser restricts opening local scripts, run `python -m http.server 8000 --bind 127.0.0.1` from this folder and visit `http://127.0.0.1:8000`. The app declares a no-network connection policy and reads the ZIP in browser memory.

1. Choose or drag in a ZIP, or select either built-in synthetic example.
2. Review **Found**, **Missing** and **Needs review**.
3. Download the findings as Markdown or JSON.

## Add figure lineage

At the same level as your README, put `repro-manifest.json` with version `1` and an array of figure rows. The app can download a template. Every row needs three project-relative paths:

```json
{
  "version": 1,
  "figures": [
    {
      "id": "Figure 1",
      "figure": "figures/fig1.svg",
      "data": "data/example.csv",
      "script": "scripts/plot.py"
    }
  ]
}
```

A ZIP can contain a single wrapping directory. Unmapped figure-like files are surfaced as review items when recognized by their path and extension. Configuration detection uses filenames, not configuration semantics. Compressed inputs require a browser implementing `DecompressionStream('deflate-raw')`; encrypted, split, ZIP64, unusual compression formats and non-UTF-8 path encodings are outside the supported subset. Limits: 32 MiB input, 128 MiB declared expansion, 2,000 archive entries, and a 256 KiB manifest. Only the manifest is decompressed; scripts and other files are neither downloaded nor executed by the app.

## Tests

Download the individual synthetic ZIPs from the app or recreate the standalone fixtures with `node examples/extract.cjs`. Run that command once before the tests below.

`node --test tests/*.test.cjs` runs five archive / audit tests and a UI smoke test with a simulated DOM, including rendering, ZIP input and export. A separate real-browser test is in `tests/browser_smoke.py` (Python Playwright and Chromium). Chromium failed to start in the development sandbox, so an actual browser run remains to be verified before recording the demo.


# MediaKit

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Static site](https://img.shields.io/badge/site-static%20HTML%2FJS-3b82f6)
![No uploads](https://img.shields.io/badge/privacy-files%20stay%20on%20device-22c55e)

Free browser-based tools for video, images, network checks and shift time tracking. Everything runs client-side, so video and image files are processed on your device and never uploaded.

**Live demo:** https://YOUR-USERNAME.github.io/mediakit/

![Video converter](docs/screenshots/01-video-converter.png)

## Tools

| Tool | What it does | Built with |
| --- | --- | --- |
| WMV to MP4 | Converts WMV, AVI, MOV, MKV and FLV to H.264/AAC MP4 | ffmpeg.wasm |
| Video compressor | Reduces file size with light, balanced and strong presets | ffmpeg.wasm |
| Image to text | OCR for English and Bangla, with clipboard paste support | Tesseract.js |
| Duty & break time | Calculates total duty, breaks, net working time and overtime, including shifts that cross midnight | Vanilla JavaScript |
| Speed test | Download, upload, ping and jitter, plus your IP address, country and ISP | Cloudflare speed endpoints, ipwho.is |

## Screenshots

| Duty & break calculator | Mobile layout |
| --- | --- |
| ![Duty and break calculator](docs/screenshots/02-duty-break-calculator.png) | ![Mobile view](docs/screenshots/03-mobile.png) |

## Run locally

No build step is needed. Serve the folder with any static server:

```bash
git clone https://github.com/YOUR-USERNAME/mediakit.git
cd mediakit
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy with GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. The site is published at `https://YOUR-USERNAME.github.io/mediakit/` after a minute or two.

## Project structure

```
mediakit/
├── index.html      # Layout and tool panels
├── style.css       # Dark theme and responsive layout
├── app.js          # Logic for all tools
├── favicon.svg
├── docs/screenshots/
├── LICENSE
└── README.md
```

## Limitations

- Video processing uses single-threaded WebAssembly, so large files are slow. Files under 500 MB work best.
- The first video run downloads about 25 MB of converter code. OCR downloads language data on first use.
- Speed test results depend on distance to the nearest Cloudflare server and on browser limits. Treat them as an estimate.
- Country and ISP come from a third-party IP lookup and can be inaccurate, especially behind a VPN.

## Privacy

Files stay in your browser. The speed test contacts Cloudflare, and the IP lookup contacts ipwho.is (with ipapi.co as fallback). No analytics or cookies are used.

## Roadmap

- [ ] MP3 audio extraction
- [ ] Image compressor
- [ ] Save duty calculator presets

## License

[MIT](LICENSE)

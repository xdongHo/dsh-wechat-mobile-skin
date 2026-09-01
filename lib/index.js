/**
 * dsh-wechat-mobile-skin — host half.
 *
 * A zero-dependency DeepSeek Harness host plugin that gives the Web GUI a
 * WeChat-style mobile skin. When a mobile browser opens the GUI it gets a
 * WeChat chat-list (history sessions rendered like WeChat contacts) and a
 * WeChat-style chat page, fixing mobile layout problems. Desktop browsers
 * are completely untouched — everything is gated on a mobile user-agent.
 *
 * Mechanics (both through the supported `webServer` service surface):
 *
 * 1. `webServer.tapIndex(transform)` — injects, on every index.html response
 *    (in memory, the dist file on disk is never modified):
 *      - an upgraded viewport meta (safe-area cover, no user zoom,
 *        `interactive-widget=resizes-content` for Android keyboards);
 *      - a `theme-color` meta matching the WeChat chrome;
 *      - a tiny inline user-agent sniffer that adds the `dsh-wx` +
 *        `wx-mode-list` classes to <html> before first paint (no FOUC);
 *      - `<link>` + `<script defer>` tags pointing at this plugin's assets.
 *
 * 2. `webServer.register({ kind: "prefix" })` — serves `skin.css` / `skin.js`
 *    same-origin under the configured prefix (default
 *    `/dsh-wechat-mobile-skin/`). Files are read per request, so editing the
 *    asset files only needs a page refresh to show up.
 *
 * 3. `/assets/*` cache route — the frontend dist ships content-hashed
 *    filenames (`index-Dqw48FrP.js`) but the stock static server sends no
 *    `Cache-Control`, so every refresh re-downloads ~1.2 MB through the
 *    user's tunnel. This plugin claims the `/assets` prefix and serves the
 *    same files with `Cache-Control: public, max-age=31536000, immutable`,
 *    so repeat visits load instantly from the browser cache. Safe because
 *    every file under dist/assets is content-hashed; index.html itself is
 *    NOT cached (it carries the per-request boot manifest).
 *
 * The client logic is plain DOM + CSS on top of the running React app; see
 * assets/skin.js for the interaction layer and assets/skin.css for the skin.
 *
 * Plain ESM with zero third-party package imports (node: builtins only), so
 * it resolves from any hoisted-profile install position without extra
 * node_modules wiring.
 */

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const name = "wechat-mobile-skin";
const inject = ["webServer"];

/** Marker written into index responses so taps never apply twice. */
const MARK = "<!-- dsh-wechat-mobile-skin -->";

/**
 * Viewport applied by the inline sniffer only when the visitor is mobile —
 * desktop index responses stay byte-for-byte identical to the dist.
 */
const MOBILE_VIEWPORT =
	"width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no, interactive-widget=resizes-content";

/**
 * @param {unknown} config - raw row config (validated by hand).
 * @returns {{enabled: boolean, prefix: string, navTitle: string, forceTablet: boolean}}
 */
function resolveConfig(config) {
	const raw = typeof config === "object" && config !== null ? config : {};
	const bool = (v, d) => (typeof v === "boolean" ? v : d);
	const str = (v, d) =>
		typeof v === "string" && v.trim().length > 0
			? v.trim().replace(/^\/+|\/+$/g, "")
			: d;
	return {
		enabled: bool(raw.enabled, true),
		prefix: str(raw.prefix, "dsh-wechat-mobile-skin"),
		navTitle:
			typeof raw.navTitle === "string" && raw.navTitle.trim().length > 0
				? raw.navTitle.trim()
				: "DeepSeek",
		// Also treat iPad desktop-mode UAs (Macintosh + multi-touch) as mobile.
		forceTablet: bool(raw.forceTablet, true),
	};
}

/**
 * Build the <head> snippet injected into every index response.
 * @param {{prefix: string, navTitle: string, forceTablet: boolean}} settings
 * @returns {string}
 */
function headSnippet(settings) {
	const iPadClause = settings.forceTablet
		? "\n            || (/Macintosh/.test(ua) && mt > 1) /* iPadOS desktop-mode UA */"
		: "";
	const boot = JSON.stringify({ navTitle: settings.navTitle });
	return `${MARK}
    <meta name="theme-color" content="#EDEDED" />
    <script>
      /* dsh-wechat-mobile-skin: mobile UA detect — runs before first paint. */
      (function () {
        try {
          var ua = navigator.userAgent || "";
          var mt = navigator.maxTouchPoints || 0;
          var mobile = /Android|iPhone|iPod|Mobile|Silk|Kindle/i.test(ua)
            || (/iPad/.test(ua))${iPadClause};
          if (mobile) {
            var de = document.documentElement;
            de.classList.add("dsh-wx", "wx-mode-list");
            de.setAttribute("data-wx-mobile", "1");
            var vp = document.querySelector('meta[name="viewport"]');
            if (vp) vp.setAttribute("content", ${JSON.stringify(MOBILE_VIEWPORT)});
          }
        } catch (e) {}
      })();
      window.__DSH_WX_MOBILE_SKIN__ = ${boot};
    </script>
    <link rel="stylesheet" href="/${settings.prefix}/skin.css" />
    <script defer src="/${settings.prefix}/skin.js"></script>`;
}

/** Host plugin body. @param {import("@deepseek-ai/cordis").Context} ctx */
function apply(ctx, config) {
	const settings = resolveConfig(config);
	if (!settings.enabled) return;

	const fileUrl = (file) => new URL(`../assets/${file}`, import.meta.url);

	/** @type {Record<string, {type: string, file: string}>} */
	const assets = {
		"/skin.css": { type: "text/css; charset=utf-8", file: "skin.css" },
		"/skin.js": { type: "text/javascript; charset=utf-8", file: "skin.js" },
	};

	// Resolve the frontend dist's assets directory (content-hashed files).
	let distAssets = null;
	try {
		const require = createRequire(import.meta.url);
		distAssets = join(dirname(require.resolve("@deepseek-ai/dsh-web-frontend/dist/index.html")), "assets");
	} catch {
		distAssets = null; // dist not found → the /assets route just 404s
	}

	/** MIME for cached dist assets. @param {string} ext */
	const distMime = (ext) => ({
		".js": "text/javascript; charset=utf-8",
		".css": "text/css; charset=utf-8",
		".svg": "image/svg+xml",
		".json": "application/json",
		".webmanifest": "application/manifest+json",
		".woff2": "font/woff2",
		".woff": "font/woff",
		".ttf": "font/ttf",
		".png": "image/png",
		".html": "text/html; charset=utf-8",
	})[ext] ?? "application/octet-stream";

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "prefix",
				path: `/${settings.prefix}`,
				handler: async (req, res) => {
					if (req.method !== "GET" && req.method !== "HEAD") {
						res.writeHead(405);
						res.end();
						return;
					}
					const pathname = new URL(req.url ?? "/", "http://x").pathname;
					const asset = assets[pathname.slice(`/${settings.prefix}`.length)];
					if (asset === undefined) {
						res.writeHead(404);
						res.end();
						return;
					}
					try {
						const body = await readFile(fileURLToPath(fileUrl(asset.file)));
						res.writeHead(200, {
							"content-type": asset.type,
							"cache-control": "no-cache",
						});
						res.end(body);
					} catch (error) {
						ctx.logger.warn(
							error instanceof Error ? error : new Error(String(error)),
						);
						res.writeHead(500);
						res.end();
					}
				},
			}),
		"wechat-mobile-skin: assets route",
	);

	// Cache route for the frontend dist's content-hashed files: every file
	// under dist/assets carries a content hash in its name, so an immutable
	// one-year cache is safe and makes repeat visits (new devices, refreshes)
	// skip re-downloading the ~1.2 MB bundle through slow tunnels.
	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "prefix",
				path: "/assets",
				handler: async (req, res) => {
					if (req.method !== "GET" && req.method !== "HEAD") {
						res.writeHead(405);
						res.end();
						return;
					}
					if (!distAssets) {
						res.writeHead(404);
						res.end();
						return;
					}
					let pathname;
					try {
						pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
					} catch {
						res.writeHead(400);
						res.end();
						return;
					}
					const target = resolve(normalize(join(distAssets, pathname.slice("/assets".length))));
					// traversal guard, mirroring the stock static server
					if (target !== distAssets && !target.startsWith(distAssets + sep)) {
						res.writeHead(403);
						res.end();
						return;
					}
					try {
						const body = await readFile(target);
						res.writeHead(200, {
							"content-type": distMime(extname(target)),
							"cache-control": "public, max-age=31536000, immutable",
						});
						res.end(body);
					} catch {
						res.writeHead(404);
						res.end();
					}
				},
			}),
		"wechat-mobile-skin: /assets immutable cache route",
	);

	ctx.effect(
		() =>
			ctx.webServer.tapIndex((html) => {
				if (typeof html !== "string" || html.includes(MARK)) return html;
				// Mobile-only viewport upgrade happens inside the sniff script, so
				// the html body is otherwise untouched.
				return html.replace(/<\/head>/i, `${headSnippet(settings)}</head>`);
			}),
		"wechat-mobile-skin: index tap",
	);
}

export { apply, inject, name };

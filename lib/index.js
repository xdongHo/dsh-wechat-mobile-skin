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
 * The client logic is plain DOM + CSS on top of the running React app; see
 * assets/skin.js for the interaction layer and assets/skin.css for the skin.
 *
 * Plain ESM with zero package imports, so it resolves from any hoisted-profile
 * install position without extra node_modules wiring.
 */

const name = "wechat-mobile-skin";
const inject = ["webServer"];

/** Marker written into index responses so taps never apply twice. */
const MARK = "<!-- dsh-wechat-mobile-skin -->";

/** The stock viewport meta emitted by the shipped frontend dist. */
const STOCK_VIEWPORT =
	'<meta name="viewport" content="width=device-width, initial-scale=1" />';
const UPGRADED_VIEWPORT =
	'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no, interactive-widget=resizes-content" />';

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
						const { readFile } = await import("node:fs/promises");
						const { fileURLToPath } = await import("node:url");
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

	ctx.effect(
		() =>
			ctx.webServer.tapIndex((html) => {
				if (typeof html !== "string" || html.includes(MARK)) return html;
				let out = html;
				if (out.includes(STOCK_VIEWPORT)) {
					out = out.replace(STOCK_VIEWPORT, UPGRADED_VIEWPORT);
				} else if (!/name=["' + "'" + 'viewport"' + "'" + ']/.test(out)) {
					out = out.replace(/<head([^>]*)>/i, "<head" + "$1" + ">" + "\n    " + UPGRADED_VIEWPORT);
				}
				return out.replace(/<\/head>/i, `${headSnippet(settings)}</head>`);
			}),
		"wechat-mobile-skin: index tap",
	);
}

export { apply, inject, name };

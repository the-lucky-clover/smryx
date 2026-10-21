// Produce an independent Apple copy from the current extension, using only Node.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."), apple = path.join(root, "AppleSafari"), output = path.join(apple, "WebExtension");
const folders = ["_locales", "background", "content-script", "popup", "shared", "options", "welcome", "update", "wasm", "js"];
fs.mkdirSync(output, {recursive: true});
for (const folder of folders) fs.cpSync(path.join(root, folder), path.join(output, folder), {recursive: true});
for (const file of fs.readdirSync(root)) if (/\.(js|css|png|svg|wasm)$/.test(file)) fs.copyFileSync(path.join(root, file), path.join(output, file));
fs.cpSync(path.join(apple, "Adapters"), path.join(output, "safari"), {recursive: true});
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
manifest.permissions = manifest.permissions.filter(value => value !== "webRequest");
manifest.permissions.push("nativeMessaging");
delete manifest.optional_permissions;
delete manifest.optional_host_permissions;
manifest.background = {scripts: ["safari/background-compat.js", "shared/remove-legacy-analytics.js", "shared/analytics-config.js", "shared/analytics-schema.js", "background/analytics.js", "background/full-text.js", "background/index.js", "safari/share-background.js"], persistent: false};
manifest.action.default_popup = "popup/index.html";
manifest.content_scripts[0].js.push("safari/share-content.js");
manifest.content_scripts[0].js.push("safari/mobile-viewport.js");
manifest.content_scripts[0].css.push("safari/content-mobile.css");
for (const resources of manifest.web_accessible_resources) {
  delete resources.use_dynamic_url;
  resources.matches = resources.matches.filter(value => !value.startsWith("file:"));
}
fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const workerPath = path.join(output, "background/index.js");
let worker = fs.readFileSync(workerPath, "utf8");
if (!worker.startsWith("importScripts(")) throw Error("Worker bootstrap changed; review the Safari adapter.");
worker = worker.slice(worker.indexOf("\n") + 1);
const start = worker.indexOf("Z.default.webRequest.onBeforeRequest.addListener(");
const ending = '},{urls:["*://*.youtube.com/api/timedtext?*"]});';
const end = worker.indexOf(ending, start);
if (start < 0 || end < start) throw Error("Caption interception changed; review the iOS compatibility patch.");
worker = worker.slice(0, start) + "/* Safari uses content-script caption discovery. */" + worker.slice(end + ending.length);
fs.writeFileSync(workerPath, worker);
// Both toolbar popovers and the in-page share panel remain usable on iPhone.
for (const file of ["popup/index.html", "popup/batch-results.html"]) {
  const target = path.join(output, file);
  const html = fs.readFileSync(target, "utf8").replace(/(<meta name="viewport" content=")[^"]+/, '$1width=device-width, initial-scale=1, viewport-fit=cover').replace("</head>", '<link rel="stylesheet" href="../safari/mobile.css">\n</head>');
  fs.writeFileSync(target, html);
}
const popupHTML = path.join(output, "popup/index.html");
fs.writeFileSync(popupHTML, fs.readFileSync(popupHTML, "utf8").replace('<script src="header.js"', '<script src="../safari/popup-launch.js"></script>\n    <script src="header.js"'));
// No unavailable Chrome screenshot permission is presented in the Apple copy.
const hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "background/index.js"))).digest("hex");
fs.writeFileSync(path.join(apple, "COPY_INFO.json"), JSON.stringify({sourceVersion: manifest.version, sourceWorkerSHA256: hash, platforms: ["macOS 14+", "iOS/iPadOS 17+"], nativeSafariTested: false}, null, 2) + "\n");
console.log("Apple copy prepared at " + output);

// Keep Safari's existing compact default; the larger desktop window is Chrome-only.
const contentFile=path.join(output,'content-script/index.js');
fs.writeFileSync(contentFile,fs.readFileSync(contentFile,'utf8').replace('r.style.width="910px",r.style.height="780px"','r.style.width="700px",r.style.height="600px"'));

const fs = require("node:fs"), path = require("node:path"), {spawnSync} = require("node:child_process");
const root = path.resolve(__dirname, "..");
const files = fs.readdirSync(path.join(root, "tests")).filter(file => /\.test\.(?:cjs|mjs)$/.test(file)).map(file => path.join("tests", file));
const result = spawnSync(process.execPath, ["--test", "--test-isolation=none", ...files], {cwd: root, stdio: "inherit"});
if (result.error) {console.error(result.error.message); process.exitCode = 1;}
else process.exitCode = result.status ?? 1;

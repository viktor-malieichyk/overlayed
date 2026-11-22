import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { argv } from "node:process";

const [installerPath] = argv.slice(2);
if (!installerPath) throw new Error("Pass the path to the signed Windows x64 NSIS installer.");

const config = JSON.parse(
  await readFile(new URL("../apps/desktop/src-tauri/tauri.conf.json", import.meta.url), "utf8")
);
const filename = basename(installerPath);
if (filename !== `Overlayed_${config.version}_x64-setup.exe`) {
  throw new Error(`The installer name must match version ${config.version} in the Tauri configuration.`);
}

const installer = await readFile(installerPath);
if (installer.subarray(0, 2).toString("ascii") !== "MZ") throw new Error("Expected a Windows executable.");

const signature = (await readFile(`${installerPath}.sig`, "utf8")).trim();
if (!/^untrusted comment:/.test(Buffer.from(signature, "base64").toString("utf8"))) {
  throw new Error("Expected a Tauri installer signature.");
}

const [endpoint] = config.plugins.updater.endpoints;
const { origin, pathname } = new URL(endpoint);
const repository = pathname.replace(/\/releases\/latest\/download\/latest\.json$/, "");
if (origin !== "https://github.com" || repository === pathname) {
  throw new Error("Expected a GitHub Releases updater endpoint.");
}

const manifest = {
  version: config.version,
  platforms: {
    "windows-x86_64": {
      signature,
      url: `${origin}${repository}/releases/download/v${config.version}/${filename}`,
    },
  },
};
const output = resolve(dirname(installerPath), "latest.json");
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(output);

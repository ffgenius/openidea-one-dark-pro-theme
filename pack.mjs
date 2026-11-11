import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { blake3 } from "@noble/hashes/blake3.js";
import { zipSync } from "fflate";
import { parse } from "smol-toml";

const projectDir = dirname(fileURLToPath(import.meta.url));
const options = {};

for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (!["--key", "--publisher"].includes(flag) || !value || value.startsWith("--") || flag in options) {
    console.error("Usage: node pack.mjs [--key <key-file> --publisher <publisher-id>]");
    process.exit(1);
  }
  options[flag] = value;
}

if (Boolean(options["--key"]) !== Boolean(options["--publisher"])) {
  throw new Error("--key and --publisher must be provided together.");
}

const manifestBytes = readFileSync(join(projectDir, "plugin.toml"));
const manifest = parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
const { id, version } = manifest;
if (typeof id !== "string" || typeof version !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(id)) {
  throw new Error("Invalid plugin id or version in plugin.toml.");
}

const declared = new Set();
for (const theme of manifest.contributes?.themes ?? []) {
  for (const path of [theme.path, theme["editor-scheme"]].filter(Boolean)) declared.add(path);
}
for (const path of [manifest.icon, manifest["icon-dark"]].filter(Boolean)) declared.add(path);
if (declared.size === 0) throw new Error("plugin.toml does not declare any theme files.");

const files = new Map([["plugin.toml", manifestBytes]]);
function addFile(relativePath) {
  if (typeof relativePath !== "string" || isAbsolute(relativePath) || relativePath.includes("\\")) {
    throw new Error(`Invalid package path: ${relativePath}`);
  }
  const path = resolve(projectDir, relativePath);
  if (!path.startsWith(projectDir + sep)) throw new Error(`Package path leaves the plugin folder: ${relativePath}`);
  files.set(relativePath, readFileSync(path));
}

for (const path of declared) addFile(path);
for (const path of ["LICENSE", "LICENSE.md", "LICENSE.txt", "NOTICE", "NOTICE.md", "COPYING", "README.md"]) {
  if (existsSync(join(projectDir, path))) addFile(path);
}
for (const path of declared) {
  if (path.endsWith(".json")) JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(files.get(path)));
}

if (options["--key"]) {
  const publisher = options["--publisher"];
  if (!id.startsWith(`${publisher}.`)) throw new Error(`Plugin id ${id} must start with ${publisher}. to be signed.`);
  const seedText = readFileSync(resolve(options["--key"]), "utf8").trim();
  const seed = Buffer.from(seedText, "base64");
  if (seed.length !== 32 || seed.toString("base64") !== seedText) throw new Error("Key file must contain a base64-encoded 32-byte seed.");

  const digestParts = [...declared, "plugin.toml"].sort().flatMap((path) => [
    Buffer.from(path), Buffer.from([0]), files.get(path), Buffer.from([0]),
  ]);
  const digest = Buffer.from(blake3(Buffer.concat(digestParts))).toString("hex");
  const privateKey = createPrivateKey({
    key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]),
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32).toString("base64");
  const message = Buffer.from(`openidea-plugin/1\n${id}\n${version}\n${digest}`);
  files.set("SIGNATURE.json", Buffer.from(JSON.stringify({
    publisher,
    key: publicKey,
    signature: sign(null, message, privateKey).toString("base64"),
  }, null, 2)));
}

const name = `${id}-${version}.oiplugin`;
const outputDir = join(projectDir, "dist");
mkdirSync(outputDir, { recursive: true });
const entries = Object.fromEntries([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  .map(([path, bytes]) => [path, [bytes, { mtime: new Date(1980, 0, 1) }]]));
const archive = zipSync(entries, { level: 6 });
writeFileSync(join(outputDir, name), archive);
const checksum = createHash("sha256").update(archive).digest("hex");
writeFileSync(join(outputDir, "SHA256SUMS"), `${checksum}  ${name}\n`, "utf8");
console.log(`Package: ${join(outputDir, name)}${options["--key"] ? ` (signed by ${options["--publisher"]})` : " (unsigned)"}`);
console.log(`SHA-256: ${checksum}`);

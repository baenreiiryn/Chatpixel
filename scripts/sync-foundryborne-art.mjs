import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FOUNDRYBORNE_SOURCE_URL = "https://github.com/Foundryborne/daggerheart";
export const FOUNDRYBORNE_ART_LICENSE = "Darrington Press Community Gaming License (DPCGL)";

const DOMAIN_IMAGE_PREFIX = "systems/daggerheart/assets/icons/domains/domain-card/";
const ALLOWED_DOMAIN_IMAGES = new Set([
  "arcana.png",
  "blade.png",
  "bone.png",
  "codex.png",
  "dread.png",
  "grace.png",
  "midnight.png",
  "sage.png",
  "splendor.png",
  "valor.png",
]);

function readUtf8(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(readUtf8(file));
}

function assertSourceLicensing(sourceRoot) {
  const readmePath = path.join(sourceRoot, "README.md");
  const packLicensePath = path.join(sourceRoot, "src", "packs", "LICENSE");
  const domainNoticePath = path.join(sourceRoot, "assets", "icons", "domains", "LICENSE");
  for (const file of [readmePath, packLicensePath, domainNoticePath]) {
    if (!fs.existsSync(file)) throw new Error(`Foundryborne licensing policy file is missing: ${file}`);
  }

  const readme = readUtf8(readmePath).replace(/\s+/g, " ");
  const packLicense = readUtf8(packLicensePath);
  const domainNotice = readUtf8(domainNoticePath);

  const domainIconsAreDpcgl = /domain icons are licensed under the\s+\[?Darrington Press Community Gaming License/i.test(readme);
  const otherArtIsRestricted = /All other Daggerheart specific content including logos and other images[\s\S]*may not be redistributed or used outside of Foundry Virtual Tabletop/i.test(readme);
  const packNoticeIsDpcgl = /Daggerheart System Reference Document 1\.0/i.test(packLicense)
    && /Critical Role, LLC/i.test(packLicense)
    && /DPCGL/i.test(packLicense);
  const domainTrademarkNotice = /Darrington Press/i.test(domainNotice) && /Critical Role, LLC/i.test(domainNotice);

  if (!domainIconsAreDpcgl || !otherArtIsRestricted || !packNoticeIsDpcgl || !domainTrademarkNotice) {
    throw new Error("Foundryborne licensing policy no longer proves that domain icons are DPCGL-permitted while other Daggerheart art remains restricted.");
  }

  return { packLicense, domainNotice };
}

function repairCommonMojibake(value) {
  return value
    .replaceAll("â€™", "'")
    .replaceAll("â€˜", "'")
    .replaceAll("â€œ", '"')
    .replaceAll("â€", '"')
    .replaceAll("Â", "");
}

export function normalizeSourceArtName(value) {
  return repairCommonMojibake(String(value ?? ""))
    .replace(/[‘’ʼ＇`´]/gu, "'")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "");
}

function domainImageFromPackEntry(entry, file) {
  const image = String(entry.img || "");
  if (!image.startsWith(DOMAIN_IMAGE_PREFIX)) {
    throw new Error(`${file}: ${image || "<missing img>"} is not a permitted domain-card PNG.`);
  }
  const relativeImage = image.slice(DOMAIN_IMAGE_PREFIX.length);
  if (relativeImage.includes("/") || relativeImage.includes("\\") || !ALLOWED_DOMAIN_IMAGES.has(relativeImage)) {
    throw new Error(`${file}: ${image} is not a permitted domain-card PNG.`);
  }
  return relativeImage;
}

export function syncFoundryborneArt({ sourceRoot, publicRoot, manifestPath }) {
  const resolvedSourceRoot = path.resolve(sourceRoot);
  const resolvedPublicRoot = path.resolve(publicRoot);
  const resolvedManifestPath = path.resolve(manifestPath);
  const { packLicense, domainNotice } = assertSourceLicensing(resolvedSourceRoot);
  const packDir = path.join(resolvedSourceRoot, "src", "packs", "domains");
  const sourceDomainImageDir = path.join(resolvedSourceRoot, "assets", "icons", "domains", "domain-card");
  if (!fs.existsSync(packDir)) throw new Error(`Foundryborne domain pack directory is missing: ${packDir}`);

  const entries = [];
  const copiedImages = new Set();
  const normalizedNames = new Set();
  for (const fileName of fs.readdirSync(packDir).filter((name) => name.endsWith(".json")).sort()) {
    const file = path.join(packDir, fileName);
    const data = readJson(file);
    if (data.type !== "domainCard") continue;

    const imageFile = domainImageFromPackEntry(data, fileName);
    const sourceImage = path.join(sourceDomainImageDir, imageFile);
    if (!fs.existsSync(sourceImage)) throw new Error(`${fileName}: permitted domain image is missing: ${sourceImage}`);

    const normalizedName = normalizeSourceArtName(data.name);
    if (!normalizedName) throw new Error(`${fileName}: domain card name is empty after normalization.`);
    if (normalizedNames.has(normalizedName)) throw new Error(`${fileName}: duplicate normalized domain card name: ${normalizedName}`);
    normalizedNames.add(normalizedName);
    copiedImages.add(imageFile);
    entries.push({
      type: "domainCard",
      name: String(data.name),
      normalizedName,
      art: `/compendium/daggerheart/foundryborne/domains/${encodeURIComponent(imageFile)}`,
      artSource: FOUNDRYBORNE_SOURCE_URL,
      artLicense: FOUNDRYBORNE_ART_LICENSE,
      sourcePath: `assets/icons/domains/domain-card/${imageFile}`,
    });
  }

  entries.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName, "en"));

  const manifest = {
    schemaVersion: 1,
    source: {
      name: "Foundryborne Daggerheart",
      url: FOUNDRYBORNE_SOURCE_URL,
      license: FOUNDRYBORNE_ART_LICENSE,
    },
    notices: {
      pack: "/compendium/daggerheart/foundryborne/DAGGERHEART_SRD_LICENSE.txt",
      domainIcons: "/compendium/daggerheart/foundryborne/DOMAIN_ICON_NOTICE.txt",
    },
    entries,
  };

  const outputDomainDir = path.join(resolvedPublicRoot, "domains");
  fs.rmSync(resolvedPublicRoot, { recursive: true, force: true });
  fs.mkdirSync(outputDomainDir, { recursive: true });
  for (const imageFile of [...copiedImages].sort()) {
    fs.copyFileSync(path.join(sourceDomainImageDir, imageFile), path.join(outputDomainDir, imageFile));
  }
  fs.writeFileSync(path.join(resolvedPublicRoot, "DAGGERHEART_SRD_LICENSE.txt"), packLicense, "utf8");
  fs.writeFileSync(path.join(resolvedPublicRoot, "DOMAIN_ICON_NOTICE.txt"), domainNotice, "utf8");
  fs.mkdirSync(path.dirname(resolvedManifestPath), { recursive: true });
  fs.writeFileSync(resolvedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { entries: entries.length, assets: copiedImages.size, manifestPath: resolvedManifestPath, publicRoot: resolvedPublicRoot };
}

function runCli() {
  const root = process.cwd();
  const sourceRoot = process.env.DAGGERHEART_FOUNDRYBORNE
    ? path.resolve(process.env.DAGGERHEART_FOUNDRYBORNE)
    : path.resolve(root, "..", "daggerheart-foundryborne");
  const publicRoot = path.join(root, "public", "compendium", "daggerheart", "foundryborne");
  const manifestPath = path.join(root, "lib", "compendium", "foundryborne-art.manifest.json");
  const result = syncFoundryborneArt({ sourceRoot, publicRoot, manifestPath });
  console.log(JSON.stringify({ sourceRoot, ...result }, null, 2));
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) runCli();

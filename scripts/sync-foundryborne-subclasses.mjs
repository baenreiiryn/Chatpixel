import fs from "node:fs";
import path from "node:path";
import { FOUNDRYBORNE_SOURCE_URL, normalizeSourceArtName } from "./sync-foundryborne-art.mjs";

export const FOUNDRYBORNE_SUBCLASS_LICENSE = "Darrington Press Community Gaming License (DPCGL)";
const VALID_TIERS = new Set(["foundation", "specialization", "mastery"]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assertPackLicense(sourceRoot) {
  const licensePath = path.join(sourceRoot, "src", "packs", "LICENSE");
  if (!fs.existsSync(licensePath)) throw new Error(`Foundryborne pack license is missing: ${licensePath}`);
  const notice = fs.readFileSync(licensePath, "utf8");
  if (!/Daggerheart System Reference Document 1\.0/i.test(notice)
      || !/Critical Role, LLC/i.test(notice)
      || !/DPCGL/i.test(notice)) {
    throw new Error("Foundryborne pack license no longer proves that subclass SRD metadata is DPCGL-permitted.");
  }
}

function referencedItemId(value) {
  return String(value || "").split(".").filter(Boolean).at(-1) || "";
}

export function syncFoundryborneSubclassFeatures({ sourceRoot, manifestPath }) {
  const resolvedSourceRoot = path.resolve(sourceRoot);
  const resolvedManifestPath = path.resolve(manifestPath);
  assertPackLicense(resolvedSourceRoot);

  const packDir = path.join(resolvedSourceRoot, "src", "packs", "subclasses");
  if (!fs.existsSync(packDir)) throw new Error(`Foundryborne subclass pack directory is missing: ${packDir}`);

  const items = fs.readdirSync(packDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => ({ fileName: name, data: readJson(path.join(packDir, name)) }));
  const itemsById = new Map(items.map(({ data }) => [String(data._id || ""), data]));
  const entries = [];

  for (const { fileName, data } of items) {
    if (data.type !== "subclass") continue;
    const parent = String(data.name || "").trim();
    if (!parent) throw new Error(`${fileName}: subclass name is missing.`);
    for (const featureRef of data.system?.features || []) {
      const tier = String(featureRef.type || "");
      if (!VALID_TIERS.has(tier)) throw new Error(`${fileName}: unsupported subclass feature tier ${tier || "<missing>"}.`);
      const itemId = referencedItemId(featureRef.item);
      const feature = itemsById.get(itemId);
      if (!feature || feature.type !== "feature") {
        throw new Error(`${fileName}: subclass feature reference ${itemId || "<missing>"} does not resolve to a feature item.`);
      }
      const name = String(feature.name || "").trim();
      if (!name) throw new Error(`${fileName}: referenced subclass feature ${itemId} has no name.`);
      entries.push({
        type: "subclassFeature",
        name,
        normalizedName: normalizeSourceArtName(name),
        parent,
        normalizedParent: normalizeSourceArtName(parent),
        tier,
      });
    }
  }

  entries.sort((a, b) =>
    a.normalizedParent.localeCompare(b.normalizedParent, "en")
      || a.tier.localeCompare(b.tier, "en")
      || a.normalizedName.localeCompare(b.normalizedName, "en"));

  const manifest = {
    schemaVersion: 1,
    source: {
      name: "Foundryborne Daggerheart subclass metadata",
      url: FOUNDRYBORNE_SOURCE_URL,
      license: FOUNDRYBORNE_SUBCLASS_LICENSE,
    },
    entries,
  };
  fs.mkdirSync(path.dirname(resolvedManifestPath), { recursive: true });
  fs.writeFileSync(resolvedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    entries: entries.length,
    subclasses: new Set(entries.map((entry) => entry.normalizedParent)).size,
    manifestPath: resolvedManifestPath,
  };
}

function runCli() {
  const root = process.cwd();
  const sourceRoot = process.env.DAGGERHEART_FOUNDRYBORNE
    ? path.resolve(process.env.DAGGERHEART_FOUNDRYBORNE)
    : path.resolve(root, "..", "daggerheart-foundryborne");
  const manifestPath = path.join(root, "lib", "compendium", "foundryborne-subclass-features.manifest.json");
  const result = syncFoundryborneSubclassFeatures({ sourceRoot, manifestPath });
  console.log(`Synced ${result.entries} subclass features across ${result.subclasses} subclasses.`);
}

if (import.meta.url === new URL(`file://${process.argv[1]?.replaceAll("\\", "/")}`).href) runCli();

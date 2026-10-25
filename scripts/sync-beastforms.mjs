import fs from "node:fs";
import path from "node:path";

const sourceRoot = process.env.DAGGERHEART_FOUNDRYBORNE_BEASTFORMS || path.resolve("../daggerheart-foundryborne/src/packs/beastforms");
const items = fs.readdirSync(sourceRoot).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(sourceRoot, f), "utf8")));
const features = new Map(items.filter((x) => x.type === "feature").map((x) => [x._id, x.name]));
const carrierCounts = new Map(items.filter((x) => x.type === "feature" && x.name === "Carrier").map((x) => {
  const word = x.system.description.match(/up to (two|three|four)/)?.[1];
  if (!word) throw new Error(`Unknown Carrier capacity: ${x._id}`);
  return [x._id, { two: 2, three: 3, four: 4 }[word]];
}));
const forms = items.filter((x) => x.type === "beastform").map((x) => ({
  name: x.name,
  tier: x.system.tier,
  kind: x.system.beastformType,
  carrierCapacity: x.system.features.map((ref) => carrierCounts.get(ref.split(".").at(-1))).find(Boolean) || null,
  advantages: Object.values(x.system.advantageOn || {}).map((v) => v.value),
  features: x.system.features.map((ref) => {
    const name = features.get(ref.split(".").at(-1));
    if (!name) throw new Error(`Unresolved feature: ${ref}`);
    return name;
  }),
  evolved: x.system.evolved,
  hybrid: x.system.hybrid,
  changes: x.effects.flatMap((e) => e.system?.changes || []),
})).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
if (forms.length !== 24) throw new Error(`Expected 24 beastforms, got ${forms.length}`);
fs.writeFileSync("lib/compendium/beastforms.manifest.json", JSON.stringify({ source: "https://github.com/Foundryborne/daggerheart/tree/main/src/packs/beastforms", forms }, null, 2) + "\n");
console.log(JSON.stringify(forms.map(({ name, kind, evolved, hybrid, advantages }) => ({ name, kind, evolved, hybrid, advantages })), null, 2));

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const payload = JSON.parse(fs.readFileSync(path.join(root, "lib", "compendium", "daggerheart.generated.json"), "utf8"));
const features = payload.entries.filter((entry) => entry.type === "classFeature");

test("every class feature has local artwork", () => {
  assert.equal(features.length, 40);
  for (const feature of features) {
    assert.match(feature.art || "", /^\/compendium\/daggerheart\/class-features\/[a-z0-9-]+\.webp$/);
    const assetPath = path.join(root, "public", feature.art.replace(/^\//, ""));
    assert.equal(fs.existsSync(assetPath), true, `${feature.name} artwork is missing: ${feature.art}`);
    const bytes = fs.readFileSync(assetPath);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${feature.name} artwork is not a RIFF file`);
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${feature.name} artwork is not a WebP file`);
  }
});

test("shared and spelling-variant features resolve to the intended icons", () => {
  const byName = new Map(features.map((feature) => [feature.name, feature]));
  assert.equal(byName.get("Inspiração")?.art, byName.get("Inspiração (Nível 5)")?.art);
  assert.equal(byName.get("Determinação Mortal")?.art, "/compendium/daggerheart/class-features/determinacao-moral.webp");
  assert.equal(byName.get("Ritual Carmessim")?.art, "/compendium/daggerheart/class-features/ritual-carmesin.webp");
});

test("class feature artwork is rendered without cropping", () => {
  const component = fs.readFileSync(path.join(root, "components", "CompendiumArt.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
  assert.match(component, /entry\?\.type === "classFeature" \? "classFeatureIconArt"/);
  assert.match(css, /\.classFeatureIconArt\{object-fit:contain!important;/);
});

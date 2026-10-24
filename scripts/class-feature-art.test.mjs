import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

const root = process.cwd();
const payload = JSON.parse(fs.readFileSync(path.join(root, "lib", "compendium", "daggerheart.generated.json"), "utf8"));
const features = payload.entries.filter((entry) => entry.type === "classFeature");

test("every class feature has distinct 256px WebP artwork with transparent rounded corners", async () => {
  assert.equal(features.length, 42);
  assert.equal(new Set(features.map((feature) => feature.art)).size, 42);
  for (const feature of features) {
    assert.match(feature.art || "", /^\/compendium\/daggerheart\/class-features\/[a-z0-9-]+\.webp$/);
    const assetPath = path.join(root, "public", feature.art.replace(/^\//, ""));
    assert.equal(fs.existsSync(assetPath), true, `${feature.name} artwork is missing: ${feature.art}`);
    const bytes = fs.readFileSync(assetPath);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${feature.name} artwork is not a RIFF file`);
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${feature.name} artwork is not a WebP file`);
    const metadata = await sharp(assetPath).metadata();
    assert.equal(metadata.width, 256, feature.name);
    assert.equal(metadata.height, 256, feature.name);
    assert.equal(metadata.hasAlpha, true, feature.name);
    const { data, info } = await sharp(assetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [x, y] of [[0, 0], [255, 0], [0, 255], [255, 255]]) {
      assert.equal(data[(y * info.width + x) * info.channels + 3], 0, `${feature.name} corner is opaque`);
    }
  }
});

test("level variants and spelling aliases resolve to the intended icons", () => {
  const byName = new Map(features.map((feature) => [feature.name, feature]));
  assert.equal(byName.get("Inspiração (Nível 5)")?.art, "/compendium/daggerheart/class-features/inspiracao-nivel-5.webp");
  assert.notEqual(byName.get("Inspiração")?.art, byName.get("Inspiração (Nível 5)")?.art);
  assert.equal(byName.get("Determinação Mortal")?.art, "/compendium/daggerheart/class-features/determinacao-mortal.webp");
  assert.equal(byName.get("Ritual Carmessim")?.art, "/compendium/daggerheart/class-features/ritual-carmesim.webp");
  assert.equal(byName.get("Auxílio dos Espíritos")?.art, "/compendium/daggerheart/class-features/auxilio-dos-espiritos.webp");
  assert.equal(byName.get("Invocar Entidade")?.art, "/compendium/daggerheart/class-features/invocar-entidade.webp");
});

test("class feature artwork is rendered without cropping", () => {
  const component = fs.readFileSync(path.join(root, "components", "CompendiumArt.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
  assert.match(component, /entry\?\.type === "classFeature" \? "classFeatureIconArt"/);
  assert.match(css, /\.classFeatureIconArt\{object-fit:contain!important;/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

const payload = JSON.parse(fs.readFileSync("lib/compendium/daggerheart.generated.json", "utf8"));
test("all 24 beastforms have unique decodable rounded 256px WebP icons", async () => {
  const forms = payload.entries.filter((e) => e.type === "beastform");
  assert.equal(forms.length, 24);
  assert.equal(new Set(forms.map((e) => e.art)).size, 24);
  for (const form of forms) {
    assert.match(form.art || "", /^\/compendium\/daggerheart\/beastforms\/[a-z0-9-]+\.webp$/);
    const file = path.join("public", form.art);
    const meta = await sharp(file).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.width, 256);
    assert.equal(meta.height, 256);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [x,y] of [[0,0],[255,0],[0,255],[255,255]]) {
      assert.ok(data[(y*info.width+x)*info.channels+3] < 10, `${form.name}: opaque corner`);
    }
  }
});

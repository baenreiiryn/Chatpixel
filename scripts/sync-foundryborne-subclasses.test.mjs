import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { syncFoundryborneSubclassFeatures } from "./sync-foundryborne-subclasses.mjs";

const PACK_NOTICE = `This product includes materials from the
Daggerheart System Reference Document 1.0, ©
Critical Role, LLC. under the terms of the
Darrington Press Community Gaming (DPCGL)
License.`;

function makeFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "foundryborne-subclasses-"));
  const sourceRoot = path.join(base, "source");
  const packDir = path.join(sourceRoot, "src", "packs", "subclasses");
  const manifestPath = path.join(base, "manifest.json");
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, "src", "packs", "LICENSE"), PACK_NOTICE, "utf8");

  const features = [
    ["f1", "Opening Song"],
    ["f2", "Seasoned Voice"],
    ["f3", "Perfect Finale"],
  ];
  for (const [id, name] of features) {
    fs.writeFileSync(path.join(packDir, `feature_${id}.json`), JSON.stringify({ _id: id, type: "feature", name }, null, 2));
  }
  fs.writeFileSync(path.join(packDir, "subclass_test.json"), JSON.stringify({
    _id: "sub1",
    type: "subclass",
    name: "Test Singer",
    system: {
      features: [
        { type: "foundation", item: "Compendium.daggerheart.subclasses.Item.f1" },
        { type: "specialization", item: "Compendium.daggerheart.subclasses.Item.f2" },
        { type: "mastery", item: "Compendium.daggerheart.subclasses.Item.f3" },
      ],
    },
  }, null, 2));
  return { base, sourceRoot, manifestPath };
}

test("subclass metadata sync preserves parent and foundation/specialization/mastery tiers", () => {
  const fixture = makeFixture();
  try {
    const result = syncFoundryborneSubclassFeatures(fixture);
    assert.equal(result.entries, 3);
    assert.equal(result.subclasses, 1);
    const manifest = JSON.parse(fs.readFileSync(fixture.manifestPath, "utf8"));
    assert.deepEqual(
      Object.fromEntries(manifest.entries.map((entry) => [entry.name, [entry.parent, entry.tier]])),
      {
        "Opening Song": ["Test Singer", "foundation"],
        "Seasoned Voice": ["Test Singer", "specialization"],
        "Perfect Finale": ["Test Singer", "mastery"],
      },
    );
  } finally {
    fs.rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("subclass metadata sync rejects unsupported tier labels", () => {
  const fixture = makeFixture();
  try {
    const subclassPath = path.join(fixture.sourceRoot, "src", "packs", "subclasses", "subclass_test.json");
    const subclass = JSON.parse(fs.readFileSync(subclassPath, "utf8"));
    subclass.system.features[1].type = "expert";
    fs.writeFileSync(subclassPath, JSON.stringify(subclass, null, 2));
    assert.throws(() => syncFoundryborneSubclassFeatures(fixture), /unsupported subclass feature tier/i);
  } finally {
    fs.rmSync(fixture.base, { recursive: true, force: true });
  }
});

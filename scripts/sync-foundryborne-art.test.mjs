import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { normalizeSourceArtName, syncFoundryborneArt } from "./sync-foundryborne-art.mjs";

const REQUIRED_README = `
Game system content available in the Daggerheart System Reference Document as well as the domain icons are licensed under the Darrington Press Community Gaming License.
All other Daggerheart specific content including logos and other images are packaged with and provided for use in the daggerheart system and may not be redistributed or used outside of Foundry Virtual Tabletop except as permitted by a separate license agreement between the original copyright owner.
`;

const PACK_NOTICE = `This product includes materials from the
Daggerheart System Reference Document 1.0, ©
Critical Role, LLC. under the terms of the
Darrington Press Community Gaming (DPCGL)
License. More information can be found at
https://www.daggerheart.com/. There are no
previous modifications by others.
`;

const DOMAIN_NOTICE = "Darrington Press™ and the Darrington Press authorized work logo are trademarks of Critical Role, LLC and used with permission.\n";

function makeFixture({ readme = REQUIRED_README, img = "systems/daggerheart/assets/icons/domains/domain-card/blade.png" } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "foundryborne-art-"));
  const sourceRoot = path.join(base, "source");
  const publicRoot = path.join(base, "public");
  const manifestPath = path.join(base, "manifest.json");

  fs.mkdirSync(path.join(sourceRoot, "src", "packs", "domains"), { recursive: true });
  fs.mkdirSync(path.join(sourceRoot, "assets", "icons", "domains", "domain-card"), { recursive: true });
  fs.mkdirSync(path.join(sourceRoot, "assets", "icons", "documents", "items"), { recursive: true });
  fs.mkdirSync(path.join(sourceRoot, "assets", "logos"), { recursive: true });
  fs.mkdirSync(publicRoot, { recursive: true });

  fs.writeFileSync(path.join(sourceRoot, "README.md"), readme, "utf8");
  fs.writeFileSync(path.join(sourceRoot, "src", "packs", "LICENSE"), PACK_NOTICE, "utf8");
  fs.writeFileSync(path.join(sourceRoot, "assets", "icons", "domains", "LICENSE"), DOMAIN_NOTICE, "utf8");
  fs.writeFileSync(path.join(sourceRoot, "assets", "icons", "domains", "domain-card", "blade.png"), "domain-png");
  fs.writeFileSync(path.join(sourceRoot, "assets", "icons", "documents", "items", "LightWheelchair.webp"), "restricted-wheelchair");
  fs.writeFileSync(path.join(sourceRoot, "assets", "logos", "daggerheart.png"), "restricted-logo");
  fs.writeFileSync(path.join(publicRoot, "stale-wheelchair.webp"), "stale-restricted-art");
  fs.writeFileSync(
    path.join(sourceRoot, "src", "packs", "domains", "domainCard_A_Soldier_s_Bond.json"),
    JSON.stringify({ name: "A Soldier's Bond", type: "domainCard", img }, null, 2),
    "utf8",
  );

  return { base, sourceRoot, publicRoot, manifestPath };
}

test("source-art name normalization equates straight, curly, and mojibake apostrophes", () => {
  const expected = "asoldiersbond";
  assert.equal(normalizeSourceArtName("A Soldier's Bond"), expected);
  assert.equal(normalizeSourceArtName("A Soldier’s Bond"), expected);
  assert.equal(normalizeSourceArtName("A Soldierâ€™s Bond"), expected);
});

test("sync copies only licensed domain PNGs and preserves source notices", () => {
  const fixture = makeFixture();
  try {
    const result = syncFoundryborneArt({
      sourceRoot: fixture.sourceRoot,
      publicRoot: fixture.publicRoot,
      manifestPath: fixture.manifestPath,
    });

    assert.equal(result.entries, 1);
    assert.equal(result.assets, 1);
    assert.equal(fs.readFileSync(path.join(fixture.publicRoot, "domains", "blade.png"), "utf8"), "domain-png");
    assert.equal(fs.readFileSync(path.join(fixture.publicRoot, "DAGGERHEART_SRD_LICENSE.txt"), "utf8"), PACK_NOTICE);
    assert.equal(fs.readFileSync(path.join(fixture.publicRoot, "DOMAIN_ICON_NOTICE.txt"), "utf8"), DOMAIN_NOTICE);
    assert.equal(fs.existsSync(path.join(fixture.publicRoot, "LightWheelchair.webp")), false);
    assert.equal(fs.existsSync(path.join(fixture.publicRoot, "daggerheart.png")), false);
    assert.equal(fs.existsSync(path.join(fixture.publicRoot, "stale-wheelchair.webp")), false);

    const manifest = JSON.parse(fs.readFileSync(fixture.manifestPath, "utf8"));
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.source.url, "https://github.com/Foundryborne/daggerheart");
    assert.equal(manifest.source.license, "Darrington Press Community Gaming License (DPCGL)");
    assert.deepEqual(manifest.entries, [{
      type: "domainCard",
      name: "A Soldier's Bond",
      normalizedName: "asoldiersbond",
      art: "/compendium/daggerheart/foundryborne/domains/blade.png",
      artSource: "https://github.com/Foundryborne/daggerheart",
      artLicense: "Darrington Press Community Gaming License (DPCGL)",
      sourcePath: "assets/icons/domains/domain-card/blade.png",
    }]);
  } finally {
    fs.rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("sync refuses source trees whose README no longer grants domain icons under DPCGL", () => {
  const fixture = makeFixture({ readme: "All rights reserved." });
  try {
    assert.throws(
      () => syncFoundryborneArt({
        sourceRoot: fixture.sourceRoot,
        publicRoot: fixture.publicRoot,
        manifestPath: fixture.manifestPath,
      }),
      /licensing policy/i,
    );
    assert.equal(fs.existsSync(fixture.manifestPath), false);
  } finally {
    fs.rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("sync rejects a domain card that points outside the permitted PNG allowlist", () => {
  const fixture = makeFixture({ img: "systems/daggerheart/assets/icons/documents/items/LightWheelchair.webp" });
  try {
    assert.throws(
      () => syncFoundryborneArt({
        sourceRoot: fixture.sourceRoot,
        publicRoot: fixture.publicRoot,
        manifestPath: fixture.manifestPath,
      }),
      /not a permitted domain-card PNG/i,
    );
    assert.equal(fs.existsSync(fixture.manifestPath), false);
  } finally {
    fs.rmSync(fixture.base, { recursive: true, force: true });
  }
});

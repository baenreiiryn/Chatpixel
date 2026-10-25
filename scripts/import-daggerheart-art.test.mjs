import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const generatedPath = path.join(root, "lib", "compendium", "daggerheart.generated.json");

test("importer applies synced Foundryborne domain art and attribution metadata", () => {
  const imported = spawnSync(process.execPath, ["scripts/import-daggerheart-compendium.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(imported.status, 0, imported.stderr || imported.stdout);

  const payload = JSON.parse(fs.readFileSync(generatedPath, "utf8"));
  assert.equal(payload.sources.foundryborne, "https://github.com/Foundryborne/daggerheart");

  const domainCards = payload.entries.filter((entry) => entry.type === "domainCard");
  assert.equal(domainCards.length, 231);
  assert.equal(domainCards.filter((entry) => entry.artSource === "https://github.com/Foundryborne/daggerheart").length, 210);
  assert.equal(domainCards.filter((entry) => !entry.artSource).length, 21);

  const soldier = payload.entries.find((entry) => entry.type === "domainCard" && /Soldier/.test(entry.originalName));
  assert.equal(soldier?.art, "/compendium/daggerheart/foundryborne/domains/blade.png");
  assert.equal(soldier?.artSource, "https://github.com/Foundryborne/daggerheart");
  assert.equal(soldier?.artLicense, "Darrington Press Community Gaming License (DPCGL)");

  const blood = payload.entries.find((entry) => entry.type === "domainCard" && entry.originalName === "Blood Spike");
  assert.equal(blood?.art, "/compendium/daggerheart/domains/blood.png");
  assert.equal(blood?.artSource, undefined);
  assert.equal(blood?.artLicense, undefined);

  const byDomain = Object.groupBy(domainCards, (entry) => entry.domain.toLowerCase());
  assert.equal(Object.keys(byDomain).length, 11);
  for (const [domain, cards] of Object.entries(byDomain)) {
    assert.equal(cards.length, 21, domain);
    assert.equal(new Set(cards.map((entry) => entry.art)).size, 1, domain + " has inconsistent icons");
    assert.ok(cards.every((entry) => entry.art), domain + " is missing its icon");
  }
  assert.ok(byDomain.blood.some((entry) => entry.source === "void-unofficial"));

  for (const entry of payload.entries.filter((item) => item.art)) {
    const relativeArt = decodeURIComponent(entry.art).replace(/^\/+/, "");
    assert.equal(
      fs.existsSync(path.join(root, "public", relativeArt)),
      true,
      `${entry.type} ${entry.originalName || entry.name} references missing art ${entry.art}`,
    );
  }
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const generatedPath = path.join(root, "lib", "compendium", "daggerheart.generated.json");

test("importer publishes translated equipment with stable entry types and descriptions", () => {
  const imported = spawnSync(process.execPath, ["scripts/import-daggerheart-compendium.mjs"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(imported.status, 0, imported.stderr || imported.stdout);

  const payload = JSON.parse(fs.readFileSync(generatedPath, "utf8"));
  const category = payload.categories.find((item) => item.id === "equipment");
  assert.deepEqual(category, {
    id: "equipment",
    name: "Equipamentos",
    icon: "⚔",
    description: "Armas, armaduras, consumíveis e itens de saque",
  });

  const equipment = payload.entries.filter((entry) => entry.category === "equipment");
  assert.equal(equipment.length, 365);
  assert.deepEqual(
    Object.fromEntries(["weapon", "armor", "consumable", "loot"].map((type) => [
      type,
      equipment.filter((entry) => entry.type === type).length,
    ])),
    { weapon: 204, armor: 35, consumable: 61, loot: 65 },
  );

  assert.match(
    equipment.find((entry) => entry.id === "core-weapon-advanced-whip")?.description || "",
    /Alarmante: Marque um Fadiga/,
  );
  assert.equal(
    equipment.find((entry) => entry.id === "core-armor-full-fortified-armor")?.name,
    "Armadura Fortificada",
  );
  assert.equal(
    equipment.find((entry) => entry.id === "core-consumable-major-control-potion")?.name,
    "Poção do Controle Maior",
  );
  assert.equal(
    equipment.find((entry) => entry.id === "core-loot-shard-of-memory")?.name,
    "Fragmento de Memória",
  );
});

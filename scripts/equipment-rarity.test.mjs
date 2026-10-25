import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

test('imported equipment has rarity and usable stats instead of allowing unclassified high-tier gear',()=>{
 const imported=spawnSync(process.execPath,['scripts/import-daggerheart-compendium.mjs'],{encoding:'utf8'});
 assert.equal(imported.status,0,imported.stderr);
 const entries=JSON.parse(fs.readFileSync('lib/compendium/daggerheart.generated.json','utf8')).entries.filter(e=>e.category==='equipment');
 assert.equal(entries.length,365);
 for(const e of entries) assert.ok(['common','uncommon','rare','very-rare'].includes(e.rarity),e.sourceId+' has no rarity');
 const item=id=>entries.find(e=>e.sourceId===id);
 assert.equal(item('Broadsword').rarity,'common');
 assert.equal(item('Improved Longsword').rarity,'uncommon');
 assert.equal(item('Advanced Longsword').rarity,'rare');
 assert.equal(item('Legendary Longsword').rarity,'very-rare');
 assert.equal(item('Small Dagger').weaponSlot,'secondary');
 assert.equal(item('Longsword').hands,2);
 assert.match(item('Glowing Rings').equipmentDetail,/mágico/);
 assert.match(item('Shortstaff').equipmentDetail,/mágico/);
 assert.match(item('Broadsword').equipmentDetail,/físico/);
 for(const e of entries.filter(e=>['weapon','armor'].includes(e.type)&&!e.creationRestricted)) {
  assert.ok(e.equipmentDetail,e.name+' has no equipment stats');
  assert.doesNotMatch(e.equipmentDetail,/undefined|null/);
 }
 assert.match(item('Leather Armor').equipmentDetail,/Limiares 6\/13.*Armadura 3/);
 assert.equal(item('Minor Health Potion').rarity,'common');
 assert.equal(item('Stardrop').rarity,'very-rare');
 assert.ok(item('Bare Bones').creationRestricted);
 assert.ok(item('Lifeblood Talisman (Consumable)').creationRestricted);
});

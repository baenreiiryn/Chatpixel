import assert from 'node:assert/strict';
import test from 'node:test';
import {allowedEquipmentRarities,canChooseStartingEquipment,chooseStartingEquipment,equipmentFitsSlot,startingLoadoutInventory,reconcileStartingLoadout,suggestedStartingLoadout} from '../lib/startingEquipment.ts';
import compendium from '../lib/compendium/daggerheart.generated.json' with {type:'json'};
const item=(id,rarity,type='weapon',extra={})=>({id,sourceId:id,name:id,rarity,type,category:'equipment',description:'Efeito',equipmentDetail:'Dados do equipamento',weaponSlot:'primary',hands:1,...extra});
const entries=[item('common','common'),item('uncommon','uncommon'),item('rare','rare'),item('very-rare','very-rare'),item('legendary','legendary'),item('two-handed','common','weapon',{hands:2}),item('shield','common','weapon',{weaponSlot:'secondary'}),item('armor','common','armor'),item('unknown',undefined),item('derived','common','armor',{creationRestricted:'Requer uma carta'})];
test('each character tier cumulatively permits only the requested rarities',()=>{
 for(const [tier,want] of [[1,['common']],[2,['common','uncommon']],[3,['common','uncommon','rare']],[4,['common','uncommon','rare','very-rare']]]) {
  assert.deepEqual(allowedEquipmentRarities(tier),want);
  assert.deepEqual(entries.slice(0,5).filter(e=>canChooseStartingEquipment(e,tier)).map(e=>e.id),want);
 }
 assert.equal(canChooseStartingEquipment(entries[8],4),false);
 assert.equal(canChooseStartingEquipment(entries[9],4),false);
});
test('selecting a two-handed weapon clears the secondary slot and blocks incompatible choices',()=>{
 const current={primary:'common',secondary:'shield',armor:'armor'};
 const next=chooseStartingEquipment(current,'primary','two-handed',entries,1);
 assert.equal(next.primary,'two-handed');
 assert.equal(next.secondary,undefined);
 assert.equal(chooseStartingEquipment(next,'secondary','shield',entries,1),next);
 assert.equal(chooseStartingEquipment(current,'primary','rare',entries,1),current);
 assert.equal(chooseStartingEquipment(current,'armor','common',entries,1),current);
});
test('lowering the tier removes ineligible equipment while retaining valid choices',()=>{
 assert.deepEqual(reconcileStartingLoadout({primary:'rare',armor:'armor'},entries,1),{armor:'armor'});
});
test('final inventory rejects forged choices and preserves identity, rarity and equipment stats',()=>{
 assert.throws(()=>startingLoadoutInventory({primary:'rare'},entries,1),/patamar|raridade/i);
 assert.throws(()=>startingLoadoutInventory({primary:'missing'},entries,4),/encontrado/i);
 assert.throws(()=>startingLoadoutInventory({armor:'common'},entries,1),/espaço|tipo/i);
 assert.throws(()=>startingLoadoutInventory({primary:'two-handed',secondary:'shield'},entries,1),/mãos/i);
 const [saved]=startingLoadoutInventory({primary:'common'},entries,1);
 assert.equal(saved.sourceId,'common');assert.equal(saved.rarity,'common');
 assert.match(saved.detail,/Dados do equipamento.*Efeito/);
});
test('the initial potion choice is limited to minor healing or stamina at every tier',()=>{
 const catalog=compendium.entries.filter(e=>e.category==='equipment');
 for(const tier of [1,2,3,4]) {
  const available=catalog.filter(e=>equipmentFitsSlot(e,'consumable')&&canChooseStartingEquipment(e,tier));
  assert.deepEqual(available.map(e=>e.sourceId).sort(),['Minor Health Potion','Minor Stamina Potion']);
 }
 const major=catalog.find(e=>e.sourceId==='Major Health Potion'&&e.type==='consumable');
 assert.throws(()=>startingLoadoutInventory({consumable:major.id},catalog,4),/espaço|tipo/);
});
test('switching the starting healing potion to stamina saves exactly one potion with its own artwork',()=>{
 const catalog=compendium.entries.filter(e=>e.category==='equipment');
 const healing=catalog.find(e=>e.sourceId==='Minor Health Potion'&&e.type==='consumable');
 const stamina=catalog.find(e=>e.sourceId==='Minor Stamina Potion'&&e.type==='consumable');
 const initial=suggestedStartingLoadout([{name:healing.name,sourceId:healing.sourceId}],catalog,1);
 assert.equal(initial.consumable,healing.id);
 const selected=chooseStartingEquipment(initial,'consumable',stamina.id,catalog,1);
 const saved=startingLoadoutInventory(selected,catalog,1);
 assert.equal(saved.length,1);assert.equal(saved[0].qty,1);
 assert.equal(saved[0].sourceId,stamina.sourceId);assert.equal(saved[0].art,stamina.art);
 assert.equal(saved.some(e=>e.sourceId===healing.sourceId),false);
 assert.equal(reconcileStartingLoadout(selected,catalog,4).consumable,stamina.id);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {allowedEquipmentRarities,canChooseStartingEquipment,chooseStartingEquipment,startingLoadoutInventory,reconcileStartingLoadout} from '../lib/startingEquipment.ts';
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

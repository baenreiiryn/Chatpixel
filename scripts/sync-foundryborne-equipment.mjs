import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeSourceArtName} from './sync-foundryborne-art.mjs';

const RARITIES=['common','uncommon','rare','very-rare'];
const TRAITS={agility:'Agilidade',strength:'Força',finesse:'Acuidade',instinct:'Instinto',presence:'Presença',knowledge:'Conhecimento',spellcast:'Conjuração'};
const RANGES={melee:'Corpo a Corpo',veryClose:'Muito Próximo',close:'Próximo',far:'Distante',veryFar:'Muito Distante'};
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):e.name.endsWith('.json')?[path.join(dir,e.name)]:[]);
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));

export function syncFoundryborneEquipment({sourceRoot,manifestPath}) {
 const notice=fs.readFileSync(path.join(sourceRoot,'src/packs/LICENSE'),'utf8');
 if(!/DPCGL/.test(notice)||!/Critical Role, LLC/.test(notice)) throw new Error('Missing SRD metadata license.');
 const lootPositions=new Map();
 for(const file of files(path.join(sourceRoot,'src/packs/rolltables'))) {
  const table=read(file);
  const type=/Consumables$/.test(table.name)?'consumable':/Items$/.test(table.name)?'loot':null;
  if(!type) continue;
  for(const result of table.results||[]) {
   const roll=Number(result.range?.[0]);
   if(roll>=1&&roll<=60) lootPositions.set(type+':'+normalizeSourceArtName(result.name),roll);
  }
 }
 const entries=[];
 for(const file of files(path.join(sourceRoot,'src/packs/items'))) {
  const item=read(file);
  if(!['weapon','armor','consumable','loot'].includes(item.type)) continue;
  const system=item.system||{};
  const entry={sourceId:item.name,type:item.type,normalizedName:normalizeSourceArtName(item.name)};
  if(item.type==='weapon'||item.type==='armor') {
   const tier=Number(system.tier);
   if(!Number.isInteger(tier)||tier<1||tier>4) throw new Error('Invalid equipment tier: '+item.name);
   entry.equipmentTier=tier;
   entry.rarity=RARITIES[tier-1];
   entry.rarityBasis='equipment-tier';
   if(item.type==='weapon') {
    entry.weaponSlot=system.secondary?'secondary':'primary';
    entry.hands=system.burden==='twoHanded'?2:1;
    const attack=system.attack||{};
    const damage=attack.damage?.main;
    const value=damage?.value||{};
    const bonus=Number(value.bonus)||0;
    const dice=(value.dice||'')+(bonus>0?'+'+bonus:bonus<0?String(bonus):'');
    const damageType=damage?.type?.some(type=>type==='magic'||type==='magical')?'mágico':'físico';
    entry.equipmentDetail=[TRAITS[attack.roll?.trait]||attack.roll?.trait,RANGES[attack.range]||attack.range,dice?dice+' '+damageType:null,entry.hands===2?'duas mãos':'uma mão',system.secondary?'Secundária':'Primária'].filter(Boolean).join(' · ');
   } else {
    entry.equipmentDetail=`Limiares ${system.baseThresholds?.major}/${system.baseThresholds?.severe} · Armadura ${system.armor?.max}`;
   }
  } else {
   const roll=lootPositions.get(item.type+':'+entry.normalizedName);
   // Ability-created items outside loot tables are classified explicitly below.
   if(!roll) continue;
   entry.lootRoll=roll;
   // Project balance classification: lowest dice band that can reach the result.
   // SRD tables overlap; their upper band is named Very Rare in this project.
   entry.rarity=RARITIES[roll<=24?0:roll<=36?1:roll<=48?2:3];
   entry.rarityBasis='loot-table-band';
  }
  entries.push(entry);
 }
 const elundrian=entries.find(e=>e.sourceId==='Elundrian Chain Armor');
 if(!elundrian) throw new Error('Missing Elundrian armor alias source.');
 entries.push({...elundrian,sourceId:'Elundrian Chain Mail',normalizedName:normalizeSourceArtName('Elundrian Chain Mail')});
 for(const [sourceId,type,creationRestricted] of [
  ['Bare Bones','armor','Requer a carta de domínio Armadura Corporal; não é uma armadura inicial.'],
  ['Lifeblood Talisman (Consumable)','consumable','Criado pela carta de domínio Sangue Vital; não é um consumível inicial.'],
  ['50ft of Rope','loot'],['a harmless spirit trapped inside a glass bottle','loot'],['a pair of mysterious coins','loot'],['Steel Needle','loot'],["Vial Holding a Foe's Blood",'loot'],
 ]) entries.push({sourceId,type,normalizedName:normalizeSourceArtName(sourceId),rarity:'common',rarityBasis:'starting-item',...(creationRestricted?{creationRestricted}: {})});
 const seen=new Set();
 for(const e of entries) {
  const key=e.type+':'+e.normalizedName;
  if(seen.has(key)) throw new Error('Duplicate equipment metadata: '+key);
  seen.add(key);
 }
 entries.sort((a,b)=>(a.type+':'+a.normalizedName).localeCompare(b.type+':'+b.normalizedName,'en'));
 const manifest={schemaVersion:1,source:{url:'https://github.com/Foundryborne/daggerheart',license:'DPCGL'},classification:{weaponAndArmor:'tier 1=common, 2=uncommon, 3=rare, 4=very-rare',loot:'table results 1–24=common, 25–36=uncommon, 37–48=rare, 49–60=very-rare; project classification, not unique official item rarities'},entries};
 fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 return {entries:entries.length,manifestPath};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const root=process.cwd();
 console.log(JSON.stringify(syncFoundryborneEquipment({sourceRoot:process.env.DAGGERHEART_FOUNDRYBORNE||path.resolve(root,'../daggerheart-foundryborne'),manifestPath:path.join(root,'lib/compendium/equipment.manifest.json')})));
}

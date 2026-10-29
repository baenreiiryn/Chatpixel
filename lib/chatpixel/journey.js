import {environments} from './world.js';
export function travelIntent(text){
 const t=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/\b(nao|nunca|talvez|se)\b/.test(t)||/vou (conversar|falar|atacar|perguntar|equipar)/.test(t))return null;
 if(!/\b(vou|vamos|viajo|viajamos|entro|entramos|sigo|seguimos|parto|partimos|caminho|caminhamos|dirijo|rumo)\b/.test(t))return null;
 const destinations={shop:/loja|ferreiro|botica/,village:/cidade|vila|aldeia/,tavern:/taverna|estalagem/,forest:/floresta|bosque/,dungeon:/masmorra/,cave:/caverna|gruta/,castle:/castelo|palacio/,temple:/templo/,market:/mercado|feira/,coast:/praia/,harbor:/porto/,snow:/neve/,mountain:/montanha/,swamp:/pantano/,library:/biblioteca/,camp:/acampamento/,desert:/deserto/,ruins:/ruinas/,cemetery:/cemiterio/};
 const scene=Object.entries(destinations).find(([,pattern])=>pattern.test(t))?.[0];
 return scene?{scene,label:environments[scene]?.name??'Novo local'}:/\b(para|ate|em|no|na|ao|a caminho)\b/.test(t)?{scene:null,label:'Novo local'}:null;
}
export function entranceFor(scene){return ['village','castle','market'].includes(scene)?'gate':['tavern','shop','library','temple'].includes(scene)?'door':['dungeon','cave'].includes(scene)?'arch':'path';}
export const ENTRY_MS=1400,REVEAL_MS=1100;
export const smoothFade=p=>{const v=Math.max(0,Math.min(1,p));return v*v*(3-2*v);};
// The wait phase is unbounded: only a fully validated result opens the entrance.
export function journeyFrame(journey,now){
 const elapsed=Math.max(0,now-journey.started),offset=elapsed*.095;
 if(journey.readyAt===null)return {phase:'walking',offset,playerX:340+Math.min(1,elapsed/700)*100,entranceX:null,fade:0};
 const p=Math.min(1,Math.max(0,(now-journey.readyAt)/ENTRY_MS));
 return {phase:p>=1?'arrived':'entering',offset,playerX:440+Math.max(0,(p-.35)/.65)*430,entranceX:1320-Math.min(1,p/.55)*450,fade:smoothFade((p-.5)/.5)};
}

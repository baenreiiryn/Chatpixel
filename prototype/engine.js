import {validateLayout} from './scenery.js';
import {environments,npcAppearance,validateAppearance} from './world.js';
export const weapons = {sword:'Espada',bow:'Arco',staff:'Cajado'};
export const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function initialState(){return {version:1,scene:'forest',player:{x:340,y:400,weapon:'sword',inventory:['sword','bow','staff']},npcs:[],selected:null,events:[],sequence:0};}
export function validateEvent(e){
 if(!e || typeof e!=='object')throw Error('Evento inválido');
 if(e.type==='spawn'){if(typeof e.name!=='string'||!e.name.trim()||e.name.length>50)throw Error('Nome inválido');if(!['goblin','guard','merchant'].includes(e.kind))throw Error('Tipo de NPC inválido');}
 else if(e.type==='cast'){if(!Array.isArray(e.targets)||e.targets.length>8||e.targets.some(id=>typeof id!=='string'||!id)||new Set(e.targets).size!==e.targets.length)throw Error('Lista de presença inválida');}
 else if(e.type==='equip'){if(!weapons[e.weapon])throw Error('Arma inválida');}
 else if(e.type==='inventory'){if(!weapons[e.weapon]||!['add','remove'].includes(e.action))throw Error('Item inválido');}
 else if(e.type==='move'){if(e.target!==undefined){if(typeof e.target!=='string'||!e.target)throw Error('Destino inválido');}else if(!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<70||e.x>1210||e.y<330||e.y>620)throw Error('Destino fora da área caminhável');}
 else if(e.type==='scene'){if(!Object.hasOwn(environments,e.scene))throw Error('Cenário inválido');}
 else if(['attack','remove','talk'].includes(e.type)){if(typeof e.target!=='string'||!e.target)throw Error('Alvo inválido');}
 else throw Error('Ação não suportada');
 if(e.carry!==undefined&&(e.type!=='scene'||!Array.isArray(e.carry)||e.carry.length>8||e.carry.some(id=>typeof id!=='string'||!id)||new Set(e.carry).size!==e.carry.length))throw Error('Acompanhantes inválidos');
 if(e.layout!==undefined)validateLayout(e.layout);
 if(e.appearance!==undefined)validateAppearance(e.appearance);
 if(e.ref!==undefined&&(typeof e.ref!=='string'||!e.ref||e.ref.length>50))throw Error('Referência inválida');
 if(e.speaker!==undefined&&(typeof e.speaker!=='string'||!e.speaker))throw Error('Falante inválido');
 if(e.weapon!==undefined&&!weapons[e.weapon])throw Error('Arma inválida');
 if(e.message!==undefined&&(typeof e.message!=='string'||e.message.length>180))throw Error('Fala inválida');
 if(e.location!==undefined&&(typeof e.location!=='string'||e.location.length>60))throw Error('Local inválido');
 return e;
}
export function applyEvent(state,event){
 const e={...validateEvent(event)};
 const resolve=target=>state.npcs.find(n=>n.id===target||n.ref===target);
 if(e.target&&resolve(e.target))e.target=resolve(e.target).id;
 if(e.speaker&&e.speaker!=='player'){const n=resolve(e.speaker);if(!n)throw Error('Falante não está na cena.');e.speaker=n.id;}
 if(e.type==='spawn'&&e.ref&&state.npcs.some(n=>n.ref===e.ref||n.id===e.ref))throw Error('Referência de NPC já utilizada.');
 if(e.type==='cast'||e.type==='scene'){const refs=e.type==='cast'?e.targets:e.carry??[];const ids=refs.map(ref=>{const n=resolve(ref);if(!n)throw Error('Personagem da lista de presença não está na cena: '+ref);return n.id;});if(new Set(ids).size!==ids.length)throw Error('Personagem duplicado na presença');if(e.type==='cast')e.targets=ids;else e.carry=ids;}
 const inventory=state.player.inventory??Object.keys(weapons);
 if((e.type==='equip'||e.type==='attack')&&e.weapon&&!inventory.includes(e.weapon))throw Error('Você não possui '+weapons[e.weapon]+' no inventário.');
 if(['attack','talk','remove'].includes(e.type)||(e.type==='move'&&e.target)){if(!state.npcs.some(n=>n.id===e.target))throw Error('Escolha um NPC presente na cena.');}
 state.player.inventory=inventory;
 if(e.type==='attack'&&e.weapon)state.player.weapon=e.weapon;
 if(e.type==='spawn'){
  if(state.npcs.length>=8)throw Error('Limite de 8 NPCs. Remova um para continuar.');
  const id=`npc-${++state.sequence}`; const i=Array.from({length:8},(_,i)=>i).find(i=>!state.npcs.some(n=>n.x===640+(i%3)*150&&n.y===330+Math.floor(i/3)*140));
  state.npcs.push({id,name:e.name.trim(),kind:e.kind,x:640+(i%3)*150,y:330+Math.floor(i/3)*140,hits:0,ref:e.ref??id,appearance:npcAppearance(e.kind,e.appearance)});state.selected=id;e.target=id;
 }else if(e.type==='equip')state.player.weapon=e.weapon;
 else if(e.type==='inventory'){state.player.inventory=e.action==='add'?[...new Set([...inventory,e.weapon])]:inventory.filter(w=>w!==e.weapon);if(!state.player.inventory.includes(state.player.weapon))state.player.weapon=state.player.inventory[0]??null;}
 else if(e.type==='scene'){state.npcs=state.npcs.filter(n=>e.carry.includes(n.id));state.selected=state.npcs[0]?.id??null;state.player.x=340;state.player.y=400;state.dialogue=null;state.encounter=(state.encounter??0)+1;state.scene=e.scene;state.location=e.location??null;state.layout=e.layout??null;}
 else if(e.type==='cast'){state.npcs=state.npcs.filter(n=>e.targets.includes(n.id));if(!state.npcs.some(n=>n.id===state.selected))state.selected=state.npcs[0]?.id??null;if(state.dialogue&&(!state.npcs.some(n=>n.id===state.dialogue.target)||state.dialogue.speaker!=='player'&&!state.npcs.some(n=>n.id===state.dialogue.speaker)))state.dialogue=null;}
 else if(e.type==='move'){const n=state.npcs.find(n=>n.id===e.target);state.player.x=n?Math.max(70,n.x-85):e.x;state.player.y=n?n.y:e.y;state.dialogue=null;}
 else {const npc=state.npcs.find(n=>n.id===e.target);if(!npc)throw Error('Escolha um NPC presente na cena.');
  state.selected=npc.id;
  if(e.type==='attack'){if(!state.player.weapon)throw Error('Nenhuma arma disponível.');npc.hits++;state.dialogue=null;}
  if(e.type==='talk'){const speaker=e.speaker??'player';if(speaker==='player'){state.player.x=Math.max(70,npc.x-85);state.player.y=npc.y;}state.dialogue={target:npc.id,speaker,message:e.message||'Uma conversa começa.'};e.speaker=speaker;}
  if(e.type==='remove'){state.npcs=state.npcs.filter(n=>n.id!==npc.id);state.selected=state.npcs[0]?.id??null;}
 }
 state.events.push({...e,number:state.events.length+1});state.events=state.events.slice(-100);return e;
}
export function interpretLocal(text,role,state){
 const t=normalize(text);if(/\b(nao|nunca|talvez|se)\b/.test(t))throw Error('Modo local: use uma ação afirmativa simples por mensagem.');
 const sceneWords={shop:/loja|ferreiro|botica/,tavern:/taverna|estalagem/,castle:/castelo|palacio/,cave:/caverna|gruta/,desert:/deserto/,coast:/praia|litoral/,harbor:/porto|doca/,swamp:/pantano|brejo/,mountain:/montanha|pico/,snow:/neve|nevado/,ruins:/ruina/,temple:/templo|santuario/,cemetery:/cemiterio/,library:/biblioteca/,market:/mercado|feira/,camp:/acampamento/};
 const destination=Object.entries(sceneWords).find(([,re])=>re.test(t))?.[0];if(destination&&/vou|vamos|entro|entramos|chego|estamos|viajo/.test(t))return [{type:'scene',scene:destination}];
 const weapon=/arco/.test(t)?'bow':/cajado|bastao/.test(t)?'staff':/espada/.test(t)?'sword':null;
 const target=state.npcs.find(n=>t.includes(normalize(n.name)))?.id??state.selected;
 if(role==='player'){
  if(/atac|golpe|disparo|disparar|flecha|lanco.*magia/.test(t))return [{type:'attack',target,...(weapon?{weapon}:{})}];
  if(/equip|empunh|troco|trocar/.test(t)&&weapon)return [{type:'equip',weapon}];
  if(/convers|falo|falar/.test(t))return [{type:'talk',target,message:text.slice(0,180)}];
  if(/vou|caminh|ando|ir |entro|viajo|aproxim/.test(t)){const scene=/vila|taverna|aldeia/.test(t)?'village':/masmorra|caverna/.test(t)?'dungeon':/floresta|clareira/.test(t)?'forest':null;if(scene)return [{type:'scene',scene}];if(target&&state.npcs.some(n=>t.includes(normalize(n.name))))return [{type:'move',target}];if(/direita/.test(t))return [{type:'move',x:Math.min(1210,state.player.x+160),y:state.player.y}];if(/esquerda/.test(t))return [{type:'move',x:Math.max(70,state.player.x-160),y:state.player.y}];}
 }else{
  if(/masmorra|caverna/.test(t))return [{type:'scene',scene:'dungeon'}];
  if(/vila|aldeia/.test(t))return [{type:'scene',scene:'village'}];
  if(/voltamos.*clareira|entramos.*floresta/.test(t))return [{type:'scene',scene:'forest'}];
  if(/desaparece|vai embora|sai da cena/.test(t))return [{type:'remove',target}];
  if(/aparec|surg|chega|entra/.test(t)){
   const kind=/goblin/.test(t)?'goblin':/mercador|mercadora/.test(t)?'merchant':'guard';
   const name=text.match(/chamad[oa]\s+([\p{L}\d_-]+(?:\s+[A-ZÀ-Ý][\p{L}\d_-]+)?)/u)?.[1]??({goblin:'Goblin',merchant:'Mercador',guard:'Guarda'}[kind]);
   return [{type:'spawn',kind,name}];
  }
 }
 throw Error('Não reconheci a ação. Experimente os exemplos abaixo. Com GPT conectado, a interpretação é livre.');
}

export function finalizeTurn(data){
 if(!data||typeof data.narration!=='string'||data.narration.length>4000||!Array.isArray(data.events)||data.events.length>11)throw Error('Resposta do mestre inválida');
 validateEvent({type:'cast',targets:data.visibleNpcs});
 for(const event of data.events){validateEvent(event);if(event.type==='cast')throw Error('Presença deve ser informada em visibleNpcs');}
 return {...data,events:[...data.events,{type:'cast',targets:data.visibleNpcs}]};
}

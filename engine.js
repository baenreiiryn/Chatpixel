export const weapons = {sword:'Espada',bow:'Arco',staff:'Cajado'};
export const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function initialState(){return {version:1,scene:'forest',player:{x:340,y:400,weapon:'sword'},npcs:[],selected:null,events:[],sequence:0};}
export function validateEvent(e){
 if(!e || typeof e!=='object')throw Error('Evento inválido');
 if(e.type==='spawn'){if(typeof e.name!=='string'||!e.name.trim()||e.name.length>50)throw Error('Nome inválido');if(!['goblin','guard','merchant'].includes(e.kind))throw Error('Tipo de NPC inválido');}
 else if(e.type==='equip'){if(!weapons[e.weapon])throw Error('Arma inválida');}
 else if(e.type==='scene'){if(!['forest','dungeon','village'].includes(e.scene))throw Error('Cenário inválido');}
 else if(['attack','remove','talk'].includes(e.type)){if(typeof e.target!=='string'||!e.target)throw Error('Alvo inválido');}
 else throw Error('Ação não suportada');
 return e;
}
export function applyEvent(state,event){
 const e=validateEvent(event);
 if(e.type==='spawn'){
  if(state.npcs.length>=8)throw Error('Limite de 8 NPCs. Remova um para continuar.');
  const id=`npc-${++state.sequence}`; const i=Array.from({length:8},(_,i)=>i).find(i=>!state.npcs.some(n=>n.x===640+(i%3)*150&&n.y===330+Math.floor(i/3)*100));
  state.npcs.push({id,name:e.name.trim(),kind:e.kind,x:640+(i%3)*150,y:330+Math.floor(i/3)*100,hits:0});state.selected=id;
 }else if(e.type==='equip')state.player.weapon=e.weapon;
 else if(e.type==='scene')state.scene=e.scene;
 else {const npc=state.npcs.find(n=>n.id===e.target);if(!npc)throw Error('Escolha um NPC presente na cena.');
  state.selected=npc.id;
  if(e.type==='attack')npc.hits++;
  if(e.type==='remove'){state.npcs=state.npcs.filter(n=>n.id!==npc.id);state.selected=state.npcs[0]?.id??null;}
 }
 state.events.push({...e,number:state.events.length+1});state.events=state.events.slice(-100);return e;
}
export function interpretLocal(text,role,state){
 const t=normalize(text);if(/\b(nao|nunca|talvez|se)\b/.test(t))throw Error('Modo local: use uma ação afirmativa simples por mensagem.');
 const weapon=/arco/.test(t)?'bow':/cajado|bastao/.test(t)?'staff':/espada/.test(t)?'sword':null;
 const target=state.npcs.find(n=>t.includes(normalize(n.name)))?.id??state.selected;
 if(role==='player'){
  if(/atac|golpe|disparo|disparar|flecha|lanco.*magia/.test(t))return [{type:'attack',target}];
  if(/equip|empunh|troco|trocar/.test(t)&&weapon)return [{type:'equip',weapon}];
  if(/convers|falo|falar/.test(t))return [{type:'talk',target}];
 }else{
  if(/masmorra|caverna/.test(t))return [{type:'scene',scene:'dungeon'}];
  if(/vila|taverna|aldeia/.test(t))return [{type:'scene',scene:'village'}];
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

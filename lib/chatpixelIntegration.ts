import type { GameState } from './game';
import {initialState,applyEvent,finalizeTurn,type PixelState,type PixelEvent} from './chatpixel/engine.js';
import {environments,appearanceOptions} from './chatpixel/world.js';

export type PixelVisual = {revision:number;state:PixelState;before:PixelState;batch:PixelEvent[];npcLooks?:Record<string,{name:string;kind:string;appearance?:Record<string,string>}>};
export function visualWeapon(name:string):string|null {
 const value=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/arco|besta|bow|crossbow/.test(value))return 'bow';
 if(/cajado|bastao|varinha|staff|wand/.test(value))return 'staff';
 if(/espada|rapieira|adaga|machado|martelo|lanca|foice|sword|dagger|axe|spear/.test(value))return 'sword';
 return null;
}
export function pixelStateFor(state:GameState):PixelState {
 const pixel=structuredClone(state.pixelVisual?.state??initialState());
 const inventory=[...new Set(state.inventory.filter(item=>item.qty>0).map(item=>visualWeapon(item.name)).filter((x):x is string=>x!==null))];
 pixel.player.inventory=inventory;pixel.player.name=state.character.name;
 if(!pixel.player.weapon||!inventory.includes(pixel.player.weapon))pixel.player.weapon=inventory[0]??null;
 return pixel;
}
export function executePixelScene(state:GameState,args:Record<string,unknown>):{state:GameState;result:unknown}{
 try{
  if(args.narration!==undefined && (typeof args.narration!=='string'||args.narration.length>12000))throw Error('Narração visual inválida.');
  const npcLooks={...state.pixelVisual?.npcLooks};
  for(const npc of state.pixelVisual?.state.npcs??[])npcLooks[npc.ref??npc.id]={name:npc.name,kind:npc.kind,appearance:npc.appearance};
  const events=(args.events as PixelEvent[]).map(event=>{
   const known=typeof event.ref==='string'?npcLooks[event.ref]:undefined;
   return event.type==='spawn'&&known?{...event,appearance:{...known.appearance,...event.appearance as Record<string,string>|undefined}}:event;
  }),visibleNpcs=args.visibleNpcs as string[];
  const turn=finalizeTurn({narration:'',events,visibleNpcs});
  if(events.some(event=>event.type==='inventory'))throw Error('O inventário é controlado pela ficha OracleRPG.');
  const before=pixelStateFor(state),next=structuredClone(before);
  for(const event of turn.events)applyEvent(next,event);
  for(const npc of next.npcs)npcLooks[npc.ref??npc.id]={name:npc.name,kind:npc.kind,appearance:npc.appearance};
  const revision=(state.pixelVisual?.revision??0)+1;
  return {state:{...state,pixelVisual:{revision,state:next,before,batch:turn.events,npcLooks}},result:{ok:true,revision,scene:next.scene,visibleNpcs:next.npcs.map(n=>({id:n.id,ref:n.ref,name:n.name}))}};
 }catch(error){return {state,result:{ok:false,error:error instanceof Error?error.message:'Composição visual inválida'}};}
}
export const pixelSceneTool={
 name:'scene_render',
 description:'Atualiza a referência visual Chatpixel da sessão. Reproduza somente o que o chat estabeleceu; não resolva regras, dano ou rolagens aqui. visibleNpcs é a lista completa de IDs/ref fisicamente presentes ao final.',
 inputSchema:{type:'object',properties:{narration:{type:'string',maxLength:12000,description:'Narração final do mestre no chat, junto com a cena. Emita em uma chamada visual final após resolver ferramentas mecânicas; evita nova consulta só para narrar.'},events:{type:'array',maxItems:11,items:{type:'object',properties:{type:{type:'string',enum:['scene','spawn','move','talk','attack','equip','remove']},target:{type:'string'},speaker:{type:'string'},message:{type:'string',maxLength:180},scene:{type:'string',enum:Object.keys(environments)},location:{type:'string',maxLength:60},ref:{type:'string'},name:{type:'string',maxLength:50},kind:{type:'string',enum:['goblin','guard','merchant']},weapon:{type:'string',enum:['sword','bow','staff']},x:{type:'number'},y:{type:'number'},carry:{type:'array',items:{type:'string'}},appearance:{type:'object'},layout:{type:'object'}},required:['type'],additionalProperties:false}},visibleNpcs:{type:'array',maxItems:8,uniqueItems:true,items:{type:'string'}}},required:['events','visibleNpcs'],additionalProperties:false}
};
export function pixelInstructions(){return [
 'CHATPIXEL É SOMENTE A REFERÊNCIA VISUAL DESTE CHAT. Use scene_render para reproduzir a cena e as ações confirmadas; a narração continua no chat normal. Não crie outra história ou outra resposta em JSON. Ferramentas de ficha e dados continuam sendo a fonte das regras. Não anime acerto, dano ou morte antes de resolver os dados. Pode mostrar aproximação/preparação antes do teste.',
 'RAPIDEZ: finalize com uma chamada scene_render contendo narration (texto final completo do mestre) e os eventos juntos; não precisa de outra mensagem ou consulta para narrar. Se precisa alterar ficha ou resolver regras, faça essas ferramentas antes e só finalize após seus resultados. scene_set pode vir junto de scene_render na mesma chamada para atualizar o nome do local. Envie a composição na primeira resposta assim que os fatos estiverem definidos. Antes da narração final chame scene_render, até se só mudou a fala. events aceita até 11 eventos; visibleNpcs lista TODOS e SOMENTE os NPCs fisicamente presentes ao final. Não confunda o cadastro global de NPCs ou memórias com presença. Citar um NPC não o coloca na cena. É permitido events:[] para só confirmar presença.',
 'ATUALIZAÇÃO INCREMENTAL: envie somente eventos que mudaram. Não reconstrua cenário nem repita spawn de NPC presente. Use IDs/ref existentes. Para NPC conhecido retornando use a mesma ref e omita appearance para reutilizar sua aparência salva. Ambientes já possuem modelos modulares locais: omita layout quando não precisar personalizar.',
 'Use pixelScene como estado visual atual. Tipos: scene(scene,location,layout?,carry?), spawn(ref,name,kind,appearance?), move(target OU x,y), talk(target,speaker,message), attack(target,weapon?), equip(weapon), remove(target). IDs/ref existentes são alvos; spawn.ref permite falar com um NPC criado no mesmo lote. kind é uma base: guard para combatente, merchant para civil, goblin para goblin; aparência muda as camadas.',
 'scene inicia um NOVO ENCONTRO, mesmo no mesmo ambiente. Ao afastar-se de NPC e encontrar outro trecho da floresta, emita scene e só os spawns do novo encontro. NPC anterior não acompanha automaticamente. carry leva apenas acompanhantes explicitamente estabelecidos. Movimento curto no mesmo encontro usa move, não scene. Não repita scene em conversa parada. Primeiro scene, depois spawn/talk, por fim visibleNpcs coerente.',
 'talk.speaker=player para fala do jogador e ID/ref do próprio NPC para resposta dele. Não invente fala do jogador se ele só pede conversar: aproxime com move e faça o NPC iniciar. Mostre no chat as falas correspondentes. Cada message tem até 180 caracteres.',
 'Só há animações de espada (sword, também aproximação para outras armas corpo a corpo), arco/besta (bow) e cajado/varinha (staff). Consulte pixelScene.player.inventory derivado da ficha. Use somente a categoria possuída. Não conceda arma para animar um ataque. O visual não altera HP, recursos ou inventário Oracle.',
 'Ambientes: '+JSON.stringify(Object.fromEntries(Object.entries(environments).map(([k,v])=>[k,v.name]))),
 'appearance combina '+JSON.stringify(appearanceOptions)+' e cores skin,hairColor,clothesColor,accentColor #RRGGBB. Selecione peças conforme descrição e preserve identidade.',
 'layout opcional:{ground:grass|dirt|stone|wood|sand|snow,background:forest|sky|wall|cave,props:[{type:tree|house|wall|gate|door|shop|rock|stall|table|torch|column|books|altar|grave|tent|boat|water|dunes|peaks,x:0..1280,y:100..660,scale:0.4..2,layer:far|mid|front,color:#RRGGBB}]}. Até 24 módulos. Omitir usa padrão. Não precisa buscar imagens da web para a cena.',
].join('\n');}

export function pixelContextFor(state:GameState){const {events,sequence,...scene}=pixelStateFor(state);return {...scene,knownNpcs:Object.entries(state.pixelVisual?.npcLooks??{}).map(([ref,npc])=>({ref,name:npc.name}))};}

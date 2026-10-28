import {environments} from './world.js';
import {initialState,applyEvent,interpretLocal,weapons,validateEvent} from './engine.js';
import {createRenderer} from './renderer.js';
const $=id=>document.getElementById(id);let state=initialState(),busy=false,session={connected:false};
const renderer=createRenderer($('scene'),()=>state);
const names=Object.fromEntries(Object.entries(environments).map(([id,e])=>[id,e.name]));
for(const [id,e] of Object.entries(environments))$('environment').add(new Option(e.name,id));
$('environment').onchange=async()=>{if(busy)return;lock(true);try{await execute([{type:'scene',scene:$('environment').value}]);}catch(e){notice(e.message);}finally{lock(false);}};
function fit(){const mobile=matchMedia('(max-width: 900px), (pointer: coarse)').matches;document.documentElement.classList.toggle('mobile',mobile);if(mobile){$('game').style.transform='none';document.body.style.width='';document.body.style.height='';document.body.style.overflow='';return;}const scale=Math.min(innerWidth/1280,innerHeight/720,1.25);$('game').style.transform=`scale(${scale})`;document.body.style.width='100vw';document.body.style.height='100vh';document.body.style.overflow='hidden';}addEventListener('resize',fit);fit();
function save(){try{localStorage.setItem('chatpixel-v1',JSON.stringify(state));}catch{notice('O navegador não permitiu salvar a cena.');}}
function notice(text=''){$('notice').textContent=text;}
function sync(){
 $('environment').value=state.scene;
 $('location').textContent=state.location||names[state.scene];$('weapon').value=state.player.weapon;$('weapon-label').textContent=`${weapons[state.player.weapon]||'Sem arma'} equipado${state.player.weapon==='sword'?'a':''}`;
 for(const option of $('weapon').options)option.disabled=!(state.player.inventory??Object.keys(weapons)).includes(option.value);
 $('inventory').textContent='Inventário: '+(state.player.inventory??Object.keys(weapons)).map(w=>weapons[w]).join(', ');
 $('inventory-items').replaceChildren();for(const [weapon,name] of Object.entries(weapons)){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=state.player.inventory.includes(weapon);box.disabled=busy;box.onchange=async()=>{if(busy)return;lock(true);try{await execute([{type:'inventory',weapon,action:box.checked?'add':'remove'}]);}catch(e){notice(e.message);}finally{lock(false);}};label.append(box,document.createTextNode(name));$('inventory-items').append(label);}
 $('target').replaceChildren();if(!state.npcs.length)$('target').add(new Option('Nenhum NPC presente',''));
 for(const n of state.npcs)$('target').add(new Option(`${n.name} · ${n.hits} impactos`,n.id));$('target').value=state.selected??'';$('count').textContent=`${state.events.length} eventos`;
}
function log(text,role='gm',result=''){
 if($('log').querySelector('.empty'))$('log').replaceChildren();const el=document.createElement('div');el.className=`entry ${role}`;
 const label=document.createElement('small');label.textContent=role==='gm'?'MESTRE':role==='player'?'JOGADOR':role==='npc'?'NPC':'SISTEMA';const p=document.createElement('p');p.textContent=text;el.append(label,p);
 if(result){const detail=document.createElement('small');detail.textContent=result;el.append(detail);} $('log').append(el);while($('log').children.length>60)$('log').firstChild.remove();$('log').scrollTop=$('log').scrollHeight;
}
function lock(value){busy=value;for(const el of document.querySelectorAll('#environment,#start-story,#inventory-items input,#send,#demo,#reset,#weapon,#target,#role,#ai,.suggestions button'))el.disabled=value||(el.id==='ai'&&!session.planEnabled);}
async function execute(events){
 if(!Array.isArray(events)||events.length>12)throw Error('Lote de eventos inválido');
 // Validate the whole batch on a copy, so invalid GPT output cannot partly mutate the scene.
 const check=structuredClone(state);for(const event of events)applyEvent(check,validateEvent(event));
 for(const raw of events){const fromX=state.player.x,fromY=state.player.y;const event=applyEvent(state,raw);sync();save();$('activity').textContent=({spawn:'Uma nova presença entra na história.',attack:`Ataque com ${(weapons[state.player.weapon]||'Sem arma').toLowerCase()}.`,equip:'Equipamento atualizado.',scene:'O cenário mudou.',remove:'Um personagem deixou a cena.',talk:state.dialogue?.message||'Uma conversa começa.',move:'O aventureiro se desloca.',inventory:'Inventário atualizado.'})[event.type];if(['attack','spawn','talk','move'].includes(event.type))await renderer.animate({...event,fromX,fromY});if(event.type==='talk'&&event.message)log(event.message,event.speaker==='player'?'player':'npc',state.npcs.find(n=>n.id===event.speaker)?.name||'');}
}
async function submit(text,role){if(busy||!text.trim())return;lock(true);notice();try{
 let events,narration='';if($('ai').checked){const r=await fetch('/api/interpret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,role,state:{scene:state.scene,location:state.location,dialogue:state.dialogue,player:state.player,npcs:state.npcs,selected:state.selected,history:state.history},model:$('model').value})});const data=await r.json();if(!r.ok)throw Error(data.error);events=data.events;narration=data.narration||'';}else events=interpretLocal(text,role,state);
 const check=structuredClone(state);for(const event of events)applyEvent(check,event);
 log(text,role);if(narration)log(narration,'gm');await execute(events);
 state.history=[...(state.history??[]),{role,text:text.slice(0,1500)},...(narration?[{role:'gm',text:narration.slice(0,2000)}]:[]),...events.filter(e=>e.type==='talk'&&e.speaker!=='player').map(e=>({role:'npc',text:(e.speaker+': '+(e.message||'')).slice(0,300)}))].slice(-12);save();$('text').value='';
 }catch(e){notice(e.message);log(text,role,'Não executado');}finally{lock(false);}}
$('start-story').onclick=()=>{if(!$('ai').checked){notice('Conecte o ChatGPT e ative a interpretação para iniciar a aventura.');return;}$('role').value='player';submit('Comece uma aventura de fantasia como mestre de RPG. Apresente o local e um NPC com aparência detalhada, dê a ele uma fala e pergunte o que faço.','player');};
$('narration').addEventListener('submit',e=>{e.preventDefault();submit($('text').value,$('role').value);});
for(const b of document.querySelectorAll('[data-text]'))b.onclick=()=>{$('role').value=b.dataset.role;submit(b.dataset.text,b.dataset.role);};
$('weapon').onchange=async()=>{if(busy)return;lock(true);try{await execute([{type:'equip',weapon:$('weapon').value}]);log(`Equipou ${(weapons[state.player.weapon]||'Sem arma').toLowerCase()}.`,'player');}finally{lock(false);}};
$('target').onchange=()=>{state.selected=$('target').value;save();};
$('scene').onclick=e=>{if(busy)return;const r=$('scene').getBoundingClientRect();const x=(e.clientX-r.left)*1280/r.width,y=(e.clientY-r.top)*720/r.height;const n=state.npcs.find(n=>Math.abs(n.x-x)<40&&y>n.y-80&&y<n.y+50);if(n){state.selected=n.id;sync();save();}};
$('reset').onclick=()=>{state=initialState();save();sync();$('log').replaceChildren();notice();$('activity').textContent='Cena reiniciada. Narre o próximo encontro.';};
$('demo').onclick=async()=>{if(busy)return;state=initialState();sync();lock(true);notice();try{
 for(const [text,role]of [['Um goblin chamado Grik aparece na clareira.','gm'],['Ataco Grik com minha arma.','player'],['Eu equipo um arco.','player'],['Ataco Grik novamente.','player'],['Eu equipo um cajado.','player'],['Ataco Grik com magia.','player']]){await execute(interpretLocal(text,role,state));log(text,role);}
 notice('Sequência concluída: aparição + espada + arco + magia. Impactos são visuais; HP e regras virão do OracleRPG.');}catch(e){notice(e.message);}finally{lock(false);}};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice('Tela cheia indisponível neste navegador.');}};
async function status(){try{const r=await fetch('/api/session');if(!r.ok)return;session=await r.json();$('connection').textContent=session.connected?'● ChatGPT conectado':'● Modo local';$('login').hidden=session.connected;$('logout').hidden=!session.connected;$('ai').disabled=!session.planEnabled;$('ai').checked=!!session.planEnabled;
 if(session.planEnabled){const r=await fetch('/api/models'),d=await r.json();if(!r.ok)throw Error(d.error);$('model').replaceChildren();for(const m of d.models)$('model').add(new Option(m.display_name,m.slug));$('model').hidden=false;}
 }catch(e){notice(e.message||'Inicie com npm start para conectar o ChatGPT.');}}
$('login').onclick=()=>{if(location.protocol==='file:'){notice('Para conectar: execute npm start e abra http://127.0.0.1:3210.');return;}location.href='/auth/login';};
$('logout').onclick=async()=>{await fetch('/auth/logout',{method:'POST'});location.reload();};
try{const saved=JSON.parse(localStorage.getItem('chatpixel-v1'));if(saved?.version===1&&Array.isArray(saved.events)&&saved.events.length<=100&&Array.isArray(saved.npcs)&&saved.npcs.length<=8&&(weapons[saved.player?.weapon]||saved.player?.weapon===null)&&names[saved.scene]&&saved.npcs.every(n=>typeof n.name==='string'&&Number.isFinite(n.x)&&Number.isFinite(n.y)&&['goblin','guard','merchant'].includes(n.kind))){state=saved;state.player.inventory??=Object.keys(weapons);}}catch{}
addEventListener('chatpixel:resume',()=>status());
sync();status();if(new URLSearchParams(location.search).has('auth')){notice(new URLSearchParams(location.search).get('auth')==='ok'?'ChatGPT conectado. Ative a interpretação para controlar a cena.':'Não foi possível conectar. Tente novamente.');history.replaceState(null,'',location.pathname);}
// OracleRPG adapter seam. An authenticated transport can call the same validated event queue.
window.chatpixel={version:1,getState:()=>structuredClone(state),async dispatch(events){if(busy)throw Error('Cena ocupada; aguarde a animação.');lock(true);try{await execute(events);}finally{lock(false);}}};

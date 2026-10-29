import {detailedTree} from './art.js';
import {sceneLayout,drawBackdrop,drawGround,drawModule} from './scenery.js';
import {entranceFor,journeyFrame,ENTRY_MS,REVEAL_MS,smoothFade} from './journey.js';
import {environments,npcAppearance,drawNpcLayers,drawEnvironment} from './world.js';

export function createRenderer(canvas,getState,{onError=()=>{}}={}){
 const c=canvas.getContext('2d'); c.imageSmoothingEnabled=false;let animation=null;let alive=true;let travel=null;const layerCache=new Map();
 function report(error){try{onError(error);}catch{}}
 function finishAnimation(error){if(!animation)return;const a=animation;animation=null;clearTimeout(a.timer);if(error)a.reject(error);else a.done();}
 function finishTravel(error){if(!travel)return;const tr=travel;travel=null;clearTimeout(tr.arrivalTimer);clearTimeout(tr.revealTimer);if(error)tr.reject?.(error);else tr.resolve?.();}
 function arrive(tr,t=performance.now()){if(travel!==tr||tr.phase==='reveal')return;try{tr.commit?.();tr.phase='reveal';tr.revealAt=t;clearTimeout(tr.arrivalTimer);tr.revealTimer=setTimeout(()=>{if(travel===tr)finishTravel();},REVEAL_MS+100);tr.revealTimer.unref?.();}catch(error){finishTravel(error);}}
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h)};
 function tree(x,y,s=1){detailedTree(c,rect,x,y,s,getState().scene);}
 function weapon(type,x,y,angle=0){if(!type)return;c.save();c.translate(x,y);c.rotate(angle);
  if(type==='sword'){rect(-2,-43,8,45,'#26383e');rect(0,-43,4,39,'#9dafb5');rect(0,-41,2,33,'#e5e9d7');rect(-8,-3,20,4,'#9f8050');rect(-6,-3,15,2,'#e7c881');rect(0,2,4,12,'#73503a');rect(0,5,4,2,'#bd9360');rect(-1,13,6,4,'#d3b36e');}
  else if(type==='bow'){for(let i=0;i<17;i++){const yy=-41+i*3,xx=Math.round(Math.sin(i/16*Math.PI)*15);rect(xx,yy,5,5,'#473b2c');rect(xx,yy,3,3,i%3?'#bc9461':'#e0bd7c');}rect(1,-39,1,46,'#dbd7b2');rect(10,-19,5,12,'#625245');rect(-8,-14,34,2,'#d9c58d');rect(24,-16,5,5,'#aebfbb');}
  else{rect(-2,-49,8,67,'#3d382f');rect(0,-47,4,64,'#9d7851');for(let i=0;i<5;i++)rect(0,-33+i*10,4,2,'#c0a16a');rect(-7,-53,17,15,'#5e8d86');rect(-4,-56,11,17,'#79c7b6');rect(-2,-54,5,10,'#c9edcc');rect(-9,-44,21,3,'#c0a16a');}
  c.restore();}
 function sprite(x,y,kind,name,selected,t,hit=false,held,appearance){
  c.save();c.translate(Math.round(x),Math.round(y));
  c.fillStyle='#08161290';c.beginPath();c.ellipse(0,8,28,9,0,0,7);c.fill();
  if(selected){c.strokeStyle='#d1e69a';c.lineWidth=2;c.beginPath();c.ellipse(0,8,32,12,0,0,7);c.stroke();rect(-3,-132,6,5,'#d1e69a');}
  const bob=Math.floor(Math.sin(t/400+x)*1.5);c.translate(0,bob);
  if(hit){c.shadowColor='#ffdb92';c.shadowBlur=24;}
  drawNpcLayers(c,rect,npcAppearance(kind,appearance));
  if(kind==='player'){rect(-20,-35,5,38,'#536f77');rect(-23,-31,5,35,'#536f77');weapon(held,28,-19,animation?.type==='attack'&&animation.weapon==='sword'?Math.sin(animation.progress*Math.PI)*2:0);}
  if(kind==='guard')weapon('sword',28,-18);
  c.shadowBlur=0;c.font='14px monospace';c.textAlign='center';const w=c.measureText(name).width+18;rect(-w/2,24,w,24,'#0d1b19cf');c.fillStyle=selected?'#e2eabe':'#a8bdab';c.fillText(name,0,41);c.restore();
 }
 function drawSpeech(x,y,message,label){
  c.font='16px monospace';const words=message.split(/\s+/),lines=[];let line='';for(const word of words){if(c.measureText(line+' '+word).width>290&&line){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);const visible=lines.slice(0,5);if(lines.length>5)visible[4]+='…';
  const w=330,h=38+visible.length*22,bx=Math.max(8,Math.min(1280-w-8,x-w/2)),by=Math.max(12,y-110-h);rect(bx-2,by-2,w+4,h+4,'#475651');rect(bx,by,w,h,'#e1e6ca');rect(Math.max(bx+8,Math.min(bx+w-16,x-4)),by+h,8,8,'#e1e6ca');c.textAlign='left';c.fillStyle='#677253';c.font='bold 13px monospace';c.fillText(label||'NPC',bx+14,by+20);c.fillStyle='#253a33';c.font='16px monospace';visible.forEach((text,i)=>c.fillText(text,bx+14,by+43+i*22,302));
 }
 function makeLayers(snapshot){
  const key=JSON.stringify([snapshot.scene,snapshot.layout]);if(layerCache.has(key))return layerCache.get(key);
  const factory=()=>canvas.ownerDocument?.createElement('canvas')??(typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(1280,720):null);
  const layout=sceneLayout(snapshot.scene,snapshot.layout);const layers=[0,1,2,3].map(layer=>{const surface=factory();if(!surface)return null;surface.width=1280;surface.height=720;const ctx=surface.getContext('2d');ctx.imageSmoothingEnabled=false;const r=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
   if(layer===0)drawBackdrop(ctx,r,snapshot.scene,layout);if(layer===1)drawGround(ctx,r,snapshot.scene,layout);
   for(const prop of layout.props){const l=prop.layer==='far'?0:prop.layer==='front'?3:2;if(l===layer)drawModule(ctx,r,prop,(x,y,scale)=>detailedTree(ctx,r,x,y,scale,snapshot.scene));}return surface;});
  if(layers.every(Boolean)){if(layerCache.size>=3)layerCache.delete(layerCache.keys().next().value);layerCache.set(key,layers);}return layers;
 }
 function beginTravel(destination={}){if(travel)return;const origin=structuredClone(getState());travel={origin,destination,started:performance.now(),readyAt:null,layers:(()=>{try{return makeLayers(origin);}catch{return [null,null,null,null];}})(),phase:'waiting'};}
 function drawTravel(t){const tr=travel;if(!tr)return false;if(tr.phase==='reveal')return false;const frame=journeyFrame(tr,t),layout=sceneLayout(tr.origin.scene,tr.origin.layout);
  if(tr.layers.every(Boolean)){for(let i=0;i<4;i++){const x=-(frame.offset*[.18,1,.5,1.2][i])%1280;for(const shift of [0,1280])c.drawImage(tr.layers[i],Math.round(x+shift),0);}}
  else{drawBackdrop(c,rect,tr.origin.scene,layout);drawGround(c,rect,tr.origin.scene,layout);for(const prop of layout.props)drawModule(c,rect,{...prop,x:(prop.x-frame.offset*.5+1280)%1280},tree,t);}
  const bob=Math.sin((t-tr.started)/80)*3,px=frame.playerX,py=450+bob;
  // Alternating boots, dust and bobbing make walking legible without sprite sheets.
  sprite(px,py,'player',tr.origin.player.name||'Aventureiro',false,t,false,tr.origin.player.weapon,tr.origin.player.appearance);rect(px-14+Math.sin(t/90)*7,py+7,12,5,'#273431');rect(px+3-Math.sin(t/90)*7,py+7,12,5,'#273431');
  if(frame.entranceX!==null){const kind=entranceFor(tr.destination.scene);if(kind==='path'){rect(frame.entranceX-55,310,110,230,'#263d3280');for(const x of [-75,75])tree(frame.entranceX+x,450,1.1);}else drawModule(c,rect,{type:kind==='gate'?'gate':kind==='door'?'shop':'door',x:frame.entranceX-(kind==='door'?90:0),y:470,scale:1.2,color:kind==='arch'?'#565e68':'#8d7958'},tree,t);}
  rect(320,610,640,48,'#10201ee8');c.fillStyle='#e1e6ca';c.textAlign='center';c.font='18px monospace';c.fillText(frame.phase==='walking'?'A caminho · preparando o próximo local…':'Entrando em '+(tr.destination.location||tr.destination.label||environments[tr.destination.scene]?.name||'novo local'),640,640,610);
  if(frame.fade){c.fillStyle='rgba(5,12,15,'+frame.fade+')';c.fillRect(0,0,1280,720);}
  if(frame.phase==='arrived')arrive(tr,t);
  return true;
 }
 function drawFrame(t){if(drawTravel(t))return;const s=getState(),layout=sceneLayout(s.scene,s.layout);
  const layers=makeLayers(s);if(layers.every(Boolean)){for(let i=0;i<3;i++)c.drawImage(layers[i],0,0);}else{drawBackdrop(c,rect,s.scene,layout);drawGround(c,rect,s.scene,layout);
  for(const prop of layout.props.filter(p=>p.layer!=='front').sort((a,b)=>(a.layer==='far'?-1:1)-(b.layer==='far'?-1:1)||a.y-b.y))drawModule(c,rect,prop,tree,t);}
  // Fireflies and dust.
  for(let i=0;i<28;i++){const x=(i*173+t*(.004+i%3*.002))%1280,y=140+(i*83)%470+Math.sin(t/900+i)*8;rect(x,y,2,2,i%3?'#9ba56b77':'#d5d69e');}
  let px=s.player.x,py=s.player.y;let a=animation;
  if(a){a.progress=Math.max(0,Math.min(1,(t-a.start)/a.duration));if(a.type==='move'||a.type==='talk'&&a.speaker==='player'){const p=a.progress*a.progress*(3-2*a.progress);px=a.fromX+(s.player.x-a.fromX)*p;py=a.fromY+(s.player.y-a.fromY)*p;}if(a.type==='attack'&&a.weapon==='sword'){const travel=Math.sin(a.progress*Math.PI);px+=(a.x-70-px)*travel;py+=(a.y-py)*travel;}}
  const actors=[...s.npcs.map(n=>({...n})),{id:'player',name:s.player.name||'Aventureiro',appearance:s.player.appearance,kind:'player',x:px,y:py}].sort((a,b)=>a.y-b.y);
  for(const n of actors)sprite(n.x,n.y,n.kind,n.name,n.id===s.selected,t,a?.target===n.id&&a.progress>.5&&a.progress<.8,s.player.weapon,n.appearance);
  if(a){
   if(a.type==='spawn'){c.strokeStyle='#c6e9a6';c.lineWidth=3;c.beginPath();c.ellipse(a.x,a.y+8,50*a.progress,18*a.progress,0,0,7);c.stroke();}
   if(a.type==='attack'){
    if(a.weapon!=='sword'){const p=Math.min(1,a.progress*1.5),x=s.player.x+(a.x-s.player.x)*p,y=s.player.y-35+(a.y-s.player.y)*p;rect(x-12,y,a.weapon==='bow'?26:15,4,a.weapon==='bow'?'#decfa3':'#91f2dd');if(a.weapon==='staff'){rect(x-4,y-5,11,14,'#c9fff0');}}
    else if(a.progress>.3&&a.progress<.8){c.strokeStyle='#f2edb0';c.lineWidth=7;c.beginPath();c.arc(a.x-45,a.y-40,48,-1.5,a.progress*6-1.5);c.stroke();}
    if(a.progress>.6){for(let i=0;i<10;i++){const q=i*Math.PI/5,d=(a.progress-.6)*150;rect(a.x+Math.cos(q)*d,a.y-30+Math.sin(q)*d,4,4,'#f7db92');}c.font='bold 15px monospace';c.fillStyle='#f2deb0';c.textAlign='center';c.fillText('IMPACTO',a.x,a.y-85-(a.progress-.6)*40);}
   }
   if(a.progress>=1)finishAnimation();
  }
  if(s.dialogue&&(!a||a.type==='talk'&&a.progress>.35)){const speaker=s.dialogue.speaker??'player';const n=speaker==='player'?{x:px,y:py}:s.npcs.find(n=>n.id===speaker);if(n)drawSpeech(n.x,n.y,s.dialogue.message,speaker==='player'?'Você':s.npcs.find(n=>n.id===speaker)?.name);}
  if(layers.every(Boolean))c.drawImage(layers[3],0,0);else for(const prop of layout.props.filter(p=>p.layer==='front'))drawModule(c,rect,prop,tree,t);
  if(travel?.phase==='reveal'){const p=Math.min(1,(t-travel.revealAt)/REVEAL_MS);c.fillStyle='rgba(5,12,15,'+(1-smoothFade(p))+')';c.fillRect(0,0,1280,720);if(p>=1)finishTravel();}
  const vignette=c.createRadialGradient(640,350,180,640,350,720);vignette.addColorStop(0,'#08171300');vignette.addColorStop(1,'#051310b0');c.fillStyle=vignette;c.fillRect(0,0,1280,720);
 }
 function draw(t){if(!alive)return;try{drawFrame(t);}catch(error){finishAnimation(error);finishTravel(error);report(error);}finally{if(alive)requestAnimationFrame(draw);}}
 requestAnimationFrame(draw);
 return {beginTravel,cancelTravel(){finishTravel(new Error('Transição cancelada.'));},cancelPending(error=new Error('Operação cancelada.')){finishAnimation(error);finishTravel(error);},getTravel(){return travel?{phase:travel.phase,destination:travel.destination,waiting:travel.readyAt===null}:null;},transition(destination,commit){beginTravel(destination);const tr=travel;tr.destination=destination;tr.readyAt=Math.max(performance.now(),tr.started+500);tr.commit=commit;return new Promise((resolve,reject)=>{tr.resolve=resolve;tr.reject=reject;tr.arrivalTimer=setTimeout(()=>arrive(tr),Math.max(0,tr.readyAt-performance.now())+ENTRY_MS+50);tr.arrivalTimer.unref?.();});},animate(e){const s=getState(),n=s.npcs.find(n=>n.id===(e.target??s.selected));return new Promise((done,reject)=>{const a={...e,target:n?.id,x:n?.x??640,y:n?.y??400,weapon:s.player.weapon,start:performance.now(),duration:e.type==='attack'?1100:e.type==='talk'?2300:e.type==='move'?1000:650,progress:0,done,reject};animation=a;a.timer=setTimeout(()=>{if(animation===a)finishAnimation();},a.duration+250);a.timer.unref?.();});},stop(){alive=false;finishAnimation(new Error('Renderização encerrada.'));finishTravel(new Error('Renderização encerrada.'));}};
}

const colors={forest:['#142c2b','#243e34','#2c4936'],dungeon:['#171e2b','#29313b','#303a44'],village:['#283038','#4c4737','#58553a']};
export function createRenderer(canvas,getState){
 const c=canvas.getContext('2d'); c.imageSmoothingEnabled=false;let animation=null;let alive=true;
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h)};
 function tree(x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);rect(-9,-10,18,75,'#253126');rect(1,0,6,60,'#3c4430');for(let i=0;i<4;i++){rect(-58+i*9,-100-i*23,116-i*18,39,'#102a27');rect(-48+i*9,-105-i*23,94-i*18,25,i%2?'#244535':'#1d3b30');rect(-34+i*7,-104-i*23,22,5,'#35553c');}c.restore();}
 function weapon(type,x,y,angle=0){c.save();c.translate(x,y);c.rotate(angle);if(type==='sword'){rect(0,-34,5,36,'#d2e8dc');rect(0,-34,2,29,'#8caeb0');rect(-5,0,15,4,'#caa860');rect(0,4,5,10,'#76543a');}else if(type==='bow'){c.strokeStyle='#c79c62';c.lineWidth=4;c.beginPath();c.arc(0,-10,21,-1.3,1.3);c.stroke();c.strokeStyle='#dcd5ad';c.lineWidth=1;c.beginPath();c.moveTo(6,-30);c.lineTo(6,10);c.stroke();}else{rect(0,-40,4,55,'#9a7455');rect(-4,-43,12,12,'#9ae8e0');rect(-1,-46,6,5,'#d4fff1');}c.restore();}
 function sprite(x,y,kind,name,selected,t,hit=false,held){
  c.save();c.translate(Math.round(x),Math.round(y));
  c.fillStyle='#08161290';c.beginPath();c.ellipse(0,8,28,9,0,0,7);c.fill();
  if(selected){c.strokeStyle='#d1e69a';c.lineWidth=2;c.beginPath();c.ellipse(0,8,32,12,0,0,7);c.stroke();rect(-3,-87,6,5,'#d1e69a');}
  const bob=Math.floor(Math.sin(t/400+x)*1.5);c.translate(0,bob);
  const skin=kind==='goblin'?'#8daf63':'#dcba8a',cloth=kind==='player'?'#759c9f':kind==='merchant'?'#b58a60':kind==='goblin'?'#8c644e':'#9eacb0';
  if(hit){c.shadowColor='#ffdb92';c.shadowBlur=24;}
  rect(-13,-6,10,15,'#303d3d');rect(4,-6,10,15,'#303d3d');rect(-17,4,14,6,'#202d2c');rect(4,4,15,6,'#202d2c');
  rect(-19,-40,38,35,cloth);rect(-15,-37,10,25,kind==='player'?'#b6cec5':'#c3af7d');rect(-19,-12,38,6,'#6d533f');rect(-3,-12,7,6,'#d9bb6f');
  rect(-25,-37,7,27,cloth);rect(18,-37,7,27,cloth);rect(-25,-13,7,7,skin);rect(18,-13,7,7,skin);
  rect(-15,-65,30,26,skin);rect(-19,-60,5,12,skin);rect(15,-60,5,12,skin);
  rect(-17,-70,34,12,kind==='goblin'?'#557549':'#514b3b');rect(-16,-62,7,8,'#514b3b');rect(-8,-54,4,4,'#253934');rect(7,-54,4,4,'#253934');rect(-3,-44,9,3,'#916e55');
  if(kind==='goblin'){rect(-26,-61,10,8,skin);rect(16,-61,10,8,skin);}
  if(kind==='player'){rect(-20,-35,5,38,'#536f77');rect(-23,-31,5,35,'#536f77');weapon(held,28,-19,animation?.type==='attack'&&animation.weapon==='sword'?Math.sin(animation.progress*Math.PI)*2:0);}
  if(kind==='guard')weapon('sword',28,-18);
  c.shadowBlur=0;c.font='14px monospace';c.textAlign='center';const w=c.measureText(name).width+18;rect(-w/2,24,w,24,'#0d1b19cf');c.fillStyle=selected?'#e2eabe':'#a8bdab';c.fillText(name,0,41);c.restore();
 }
 function draw(t){if(!alive)return;const s=getState(),pal=colors[s.scene];rect(0,0,1280,720,pal[0]);
  // Distant silhouettes and a hand-built tiled floor stay deterministic across frames.
  for(let i=0;i<14;i++){rect(i*100-20,80+(i%3)*17,65,310,'#19312e');rect(i*100,0,14,390,'#112925');}
  rect(0,300,1280,420,pal[1]);
  for(let row=0;row<14;row++)for(let col=0;col<30;col++){
   const n=(row*71+col*137)%53,x=col*48+(row%2)*24,y=300+row*32;
   if(s.scene==='dungeon'){rect(x,y,46,30,n%3===0?'#333d48':'#2b343e');rect(x+3,y+3,38,2,'#3b4650');}
   else{rect(x,y,44,30,n%4===0?pal[2]:pal[1]);if(n<15){rect(x+9,y+10,3,6,'#58704a');rect(x+14,y+6,3,10,'#425e41');}}
  }
  if(s.scene==='forest'){for(const [x,y,sz]of [[60,280,1.5],[205,275,1.1],[1100,280,1.5],[1230,350,1.7],[850,250,.8],[0,530,1.2]])tree(x,y,sz);}
  if(s.scene==='village'){for(const x of [100,960]){rect(x,150,190,170,'#6a5b45');rect(x-20,140,230,35,'#473f37');rect(x+10,118,170,25,'#785c45');rect(x+70,230,50,90,'#302d28');rect(x+18,197,34,32,'#d3b36d');}}
  if(s.scene==='dungeon'){for(const x of [100,1100]){rect(x,90,60,235,'#444b54');rect(x-10,90,80,20,'#59616a');rect(x+17,200,20,12,'#b87b46');rect(x+22,182+Math.sin(t/100)*3,12,23,'#f6c77c');}}
  // Stone ring and runes mark the encounter area.
  c.strokeStyle='#68806b40';c.lineWidth=3;c.beginPath();c.ellipse(650,430,365,136,0,0,7);c.stroke();
  for(let i=0;i<16;i++){let a=i*Math.PI/8;rect(650+Math.cos(a)*365,430+Math.sin(a)*136,13,5,'#6e826349');}
  // Fireflies and dust.
  for(let i=0;i<28;i++){const x=(i*173+t*(.004+i%3*.002))%1280,y=140+(i*83)%470+Math.sin(t/900+i)*8;rect(x,y,2,2,i%3?'#9ba56b77':'#d5d69e');}
  let px=s.player.x,py=s.player.y;let a=animation;
  if(a){a.progress=Math.min(1,(t-a.start)/a.duration);if(a.type==='attack'&&a.weapon==='sword'){const travel=Math.sin(a.progress*Math.PI);px+=(a.x-70-px)*travel;py+=(a.y-py)*travel;}}
  const actors=[...s.npcs.map(n=>({...n})),{id:'player',name:'Aventureiro',kind:'player',x:px,y:py}].sort((a,b)=>a.y-b.y);
  for(const n of actors)sprite(n.x,n.y,n.kind,n.name,n.id===s.selected,t,a?.target===n.id&&a.progress>.5&&a.progress<.8,s.player.weapon);
  if(a){
   if(a.type==='spawn'){c.strokeStyle='#c6e9a6';c.lineWidth=3;c.beginPath();c.ellipse(a.x,a.y+8,50*a.progress,18*a.progress,0,0,7);c.stroke();}
   if(a.type==='talk'){rect(a.x-45,a.y-115,90,28,'#e1e6ca');c.fillStyle='#32453a';c.font='16px monospace';c.textAlign='center';c.fillText('…',a.x,a.y-95);}
   if(a.type==='attack'){
    if(a.weapon!=='sword'){const p=Math.min(1,a.progress*1.5),x=s.player.x+(a.x-s.player.x)*p,y=s.player.y-35+(a.y-s.player.y)*p;rect(x-12,y,a.weapon==='bow'?26:15,4,a.weapon==='bow'?'#decfa3':'#91f2dd');if(a.weapon==='staff'){rect(x-4,y-5,11,14,'#c9fff0');}}
    else if(a.progress>.3&&a.progress<.8){c.strokeStyle='#f2edb0';c.lineWidth=7;c.beginPath();c.arc(a.x-45,a.y-40,48,-1.5,a.progress*6-1.5);c.stroke();}
    if(a.progress>.6){for(let i=0;i<10;i++){const q=i*Math.PI/5,d=(a.progress-.6)*150;rect(a.x+Math.cos(q)*d,a.y-30+Math.sin(q)*d,4,4,'#f7db92');}c.font='bold 15px monospace';c.fillStyle='#f2deb0';c.textAlign='center';c.fillText('IMPACTO',a.x,a.y-85-(a.progress-.6)*40);}
   }
   if(a.progress>=1){animation=null;a.done();}
  }
  const vignette=c.createRadialGradient(640,350,180,640,350,720);vignette.addColorStop(0,'#08171300');vignette.addColorStop(1,'#051310b0');c.fillStyle=vignette;c.fillRect(0,0,1280,720);requestAnimationFrame(draw);
 }
 requestAnimationFrame(draw);
 return {animate(e){const s=getState(),n=s.npcs.find(n=>n.id===(e.target??s.selected));return new Promise(done=>{animation={...e,target:n?.id,x:n?.x??640,y:n?.y??400,weapon:s.player.weapon,start:performance.now(),duration:e.type==='attack'?1100:650,progress:0,done};});},stop(){alive=false;}};
}

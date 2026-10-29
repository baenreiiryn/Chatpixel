/* Shared skeletal animation, independent of game rules and scene state. */
export function pose(rig,action,time){
 const flying=action==='fly'&&rig.flying;const moving=action==='walk';const attack=action==='attack';const phase=time*(flying?8:moving?6:2);const pulse=attack?Math.max(0,Math.sin(time*4)):0;
 const nodes=new Map(rig.nodes.map(n=>[n.id,n]));const world=new Map();
 function resolve(id){if(world.has(id))return world.get(id);const n=nodes.get(id);if(!n)throw Error('Missing parent '+id);const p=n.parent?resolve(n.parent):{x:attack?pulse*4:0,y:(flying?-12+Math.sin(time*4)*2:moving?Math.abs(Math.sin(phase))*-.7:Math.sin(phase)*.3),angle:0};
  let angle=n.angle;const wave=Math.sin(phase+(n.phase<0?Math.PI:0));
  if(n.motion==='leg')angle+=(moving?wave*23:flying?25:0);
  if(n.motion==='knee')angle+=(moving?Math.max(0,-wave)*27:flying?30:0);
  if(n.motion==='foot')angle-=moving?wave*8:0;
  if(n.motion==='arm')angle+=(moving?-wave*20:0)-(attack&&n.phase>0?pulse*85:0);
  if(n.motion==='elbow')angle+=(attack?pulse*45:moving?Math.max(0,wave)*10:0);
  if(n.motion==='head')angle+=Math.sin(phase)*1.3+ pulse*12;
  if(n.motion==='tail')angle+=Math.sin(phase)*7;
  if(n.motion==='wing')angle+=flying?Math.sin(phase)*36:Math.sin(phase)*2;
  if(n.motion==='insectLeg')angle+=(moving?wave*16:flying?15:0)+pulse*12;
  if(n.motion==='insectKnee')angle+=moving?Math.max(0,-wave)*16:0;
  if(n.motion==='antenna')angle+=Math.sin(phase)*6;
  if(n.motion==='mouth')angle+=pulse*15;
  if(n.motion==='serpent')angle+=Math.sin(phase-n.phase*.8)*(moving?12:3)+pulse*4;
  const a=p.angle*Math.PI/180;const out={x:p.x+Math.cos(a)*n.x-Math.sin(a)*n.y,y:p.y+Math.sin(a)*n.x+Math.cos(a)*n.y,angle:p.angle+angle};world.set(id,out);return out;
 }
 for(const n of rig.nodes)resolve(n.id);return world;
}
export function drawRig(ctx,rig,images,{x,y,scale=4,time=0,action='idle',joints=false,flip=false}={}){
 const world=pose(rig,action,time);ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(flip?-scale:scale,scale);ctx.imageSmoothingEnabled=false;
 for(const n of rig.nodes){const p=world.get(n.id);const im=images[n.part];if(!im)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle*Math.PI/180);ctx.globalAlpha=n.far?.66:1;ctx.drawImage(im,-n.pivot[0]*n.w,-n.pivot[1]*n.h,n.w,n.h);ctx.restore();}
 if(joints){ctx.lineWidth=.35;for(const n of rig.nodes){const p=world.get(n.id);if(n.parent){const par=world.get(n.parent);ctx.strokeStyle='#49e3c2';ctx.beginPath();ctx.moveTo(par.x,par.y);ctx.lineTo(p.x,p.y);ctx.stroke();}ctx.fillStyle='#ffcf65';ctx.beginPath();ctx.arc(p.x,p.y,.9,0,Math.PI*2);ctx.fill();}}
 ctx.restore();return world;
}

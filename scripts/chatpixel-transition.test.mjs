import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderer} from '../lib/chatpixel/renderer.js';
import {initialState,applyEvent} from '../lib/chatpixel/engine.js';
import {ENTRY_MS,REVEAL_MS} from '../lib/chatpixel/journey.js';

test('destination commits at full darkness then reveals gradually; static layers are reused',async t=>{
 let clock=0,next,created=0,colors=[];
 t.mock.method(performance,'now',()=>clock);
 const old=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>{next=fn;};
 const ctx=new Proxy({measureText:s=>({width:s.length*9}),createRadialGradient:()=>({addColorStop(){}}),fillRect(x,y,w,h){if(w===1280&&h===720)colors.push(this.fillStyle);}},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const canvas={getContext:()=>ctx,ownerDocument:{createElement(){created++;return {getContext:()=>ctx};}}};
 const state=initialState(),renderer=createRenderer(canvas,()=>state,{onError:e=>assert.fail(e.message)});
 const frame=at=>{clock=at;colors=[];next(at);};let commits=0,finished=false;
 try{
  frame(0);assert.equal(created,4);frame(10);assert.equal(created,4);
  applyEvent(state,{type:'spawn',name:'Borin',kind:'merchant',ref:'borin'});frame(20);assert.equal(created,4);
  applyEvent(state,{type:'prop',action:'add',ref:'chest',prop:{type:'rock',asset:'chest',x:800,y:300}});frame(30);assert.equal(created,5);
  applyEvent(state,{type:'prop',action:'remove',ref:'chest'});frame(40);assert.equal(created,5);
  const done=renderer.transition({scene:'shop'},()=>{assert.equal(colors.at(-1),'rgba(5,12,15,1)');commits++;state.scene='shop';state.layout=null;}).then(()=>{finished=true;});
  await new Promise(resolve=>setImmediate(resolve));
  const arrival=540+ENTRY_MS;
  frame(arrival-ENTRY_MS/4);assert.equal(commits,0);assert.ok(colors.includes('rgba(5,12,15,0.5)'));
  frame(arrival);assert.equal(commits,1);assert.equal(renderer.getTravel().phase,'reveal');
  frame(arrival+REVEAL_MS/2);assert.ok(colors.includes('rgba(5,12,15,0.5)'));assert.equal(finished,false);assert.equal(created,9);
  frame(arrival+REVEAL_MS);await done;assert.equal(renderer.getTravel(),null);
  frame(arrival+REVEAL_MS+20);assert.equal(created,9);
 }finally{renderer.stop();globalThis.requestAnimationFrame=old;}
});

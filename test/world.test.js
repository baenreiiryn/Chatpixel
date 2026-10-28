import test from 'node:test';import assert from 'node:assert/strict';
import {environments,appearanceOptions,npcAppearance,validateAppearance} from '../world.js';
import {initialState,applyEvent} from '../engine.js';import {createRenderer} from '../renderer.js';
test('18 ambientes e todas as opções modulares são válidas e renderizam',()=>{
 assert.equal(Object.keys(environments).length,18);let next;const old=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>{next=fn;};const text=[];
 const c=new Proxy({measureText:s=>({width:s.length*9}),createRadialGradient:()=>({addColorStop(){}}),fillText:(...args)=>text.push(args)}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const s=initialState(),renderer=createRenderer({getContext:()=>c},()=>s);
 try{for(const scene of Object.keys(environments)){applyEvent(s,{type:'scene',scene});next(100);}
 for(const [key,options] of Object.entries(appearanceOptions))for(const value of options){validateAppearance({[key]:value});s.npcs=[];applyEvent(s,{type:'spawn',name:'Teste',kind:'merchant',appearance:{[key]:value}});next(200);}
 applyEvent(s,{type:'talk',target:s.selected,speaker:'player',message:'Fala do jogador'});text.length=0;next(300);let label=text.find(x=>x[0]==='Você');assert.equal(label[1],Math.max(8,Math.min(942,s.player.x-165))+14);
 applyEvent(s,{type:'talk',target:s.selected,speaker:s.selected,message:'Resposta do NPC'});text.length=0;next(400);label=text.find(x=>x[0]==='Teste');assert.ok(text.some(x=>x[0]==='Resposta do NPC'));assert.equal(text.filter(x=>x[0]==='Teste').at(-1)[1],Math.max(8,Math.min(942,s.npcs.at(-1).x-165))+14);
 assert.throws(()=>validateAppearance({skin:'javascript:bad'}));assert.equal(npcAppearance('goblin').head,'goblin');
 }finally{renderer.stop();globalThis.requestAnimationFrame=old;}
});

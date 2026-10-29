import test from 'node:test';import assert from 'node:assert/strict';
import {environments,appearanceOptions,npcAppearance,drawNpcLayers} from '../lib/chatpixel/world.js';
import {modules,sceneLayout,drawBackdrop,drawGround,drawModule} from '../lib/chatpixel/scenery.js';
import {detailedTree} from '../lib/chatpixel/art.js';
function context(){let count=0;const c=new Proxy({},{get:()=>()=>{}});const r=(x,y,w,h,color)=>{assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(w>=0&&h>=0);assert.match(color,/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i);count++;};return {c,r,count:()=>count};}
test('all environments and modular props render finite shaded pixel clusters',()=>{
 for(const scene of Object.keys(environments)){const {c,r,count}=context(),layout=sceneLayout(scene);drawBackdrop(c,r,scene,layout);drawGround(c,r,scene,layout);for(const type of modules)drawModule(c,r,{type,x:100,y:300},(x,y,s)=>detailedTree(c,r,x,y,s,scene));assert.ok(count()>1000,scene);}
});
test('every modular character option renders with independently selected colors',()=>{
 for(const [layer,values] of Object.entries(appearanceOptions))for(const value of values){const {c,r,count}=context();drawNpcLayers(c,r,npcAppearance('merchant',{[layer]:value,clothesColor:'#926eb0',hairColor:'#d6ceb8'}));assert.ok(count()>80,layer+':'+value);}
});

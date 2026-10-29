import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assetIds,assetFor,sceneryFamily,createAssetStore} from '../lib/chatpixel/assets.js';
import {validateLayout} from '../lib/chatpixel/scenery.js';
test('all bundled image URLs exist, preload once, and failed images fall back',async()=>{
 const seen=[];class Image {width=160;height=200;set src(url){seen.push(url);assert.ok(fs.existsSync(new URL('../public'+url,import.meta.url)),url);queueMicrotask(()=>url.endsWith('/torch.png')?this.onerror():this.onload());}}
 const store=createAssetStore({ImageClass:Image});await store.preload();await store.preload();assert.equal(seen.length,110);assert.equal(store.revision,109);
 let calls=0;const ctx={drawImage(){calls++;}};assert.equal(store.drawProp(ctx,{type:'torch',x:100,y:535},'dungeon'),false);assert.equal(store.drawProp(ctx,{type:'tree',x:100,y:535},'forest'),true);assert.equal(calls,1);
 for(const scene of ['forest','village','dungeon'])assert.equal(store.drawLayer(ctx,scene,0),true);
 assert.equal(store.drawLayer(ctx,'desert',0),false);
});
test('explicit generated asset selection is validated and keeps existing module compatibility',()=>{
 for(const asset of assetIds){validateLayout({props:[{type:'rock',asset,x:100,y:300}]});assert.equal(assetFor({type:'rock',asset},'forest'),asset);}
 assert.throws(()=>validateLayout({props:[{type:'rock',asset:'../../unknown',x:100,y:300}]}));
 assert.equal(assetFor({type:'shop',indoor:true},'shop'),'counter');assert.equal(assetFor({type:'tree'},'snow'),'snow-pine');assert.equal(sceneryFamily('library'),null);
});

test('all environment floors draw with their walk line at the actor baseline and cover the screen bottom',async()=>{
 const {groundArt}=await import('../lib/chatpixel/grounds.js');
 class Image {set src(url){this.srcValue=url;queueMicrotask(()=>this.onload());}}
 const store=createAssetStore({ImageClass:Image});await store.preload();
 for(const [scene,meta] of Object.entries(groundArt)){let args;assert.ok(store.drawGround({drawImage(...v){args=v;}},'forest',{groundAsset:scene}));const [im,x,y,w,h]=args;assert.ok(im.srcValue.endsWith('/'+scene+'.png'));assert.equal(x,0);assert.equal(w,1280);assert.ok(y+h>=720);assert.ok(Math.abs(y+meta.walkY*h/meta.height-535)<2);}
 assert.throws(()=>validateLayout({groundAsset:'unknown'}));validateLayout({groundAsset:'road'});
});

test('all fifteen interiors pair backgrounds and floors without default furniture',async()=>{
 const {interiorArt}=await import('../lib/chatpixel/interiors.js');const {sceneLayout}=await import('../lib/chatpixel/scenery.js');
 class Image{set src(url){this.url=url;queueMicrotask(()=>this.onload());}}
 const store=createAssetStore({ImageClass:Image});await store.preload();
 for(const [room,variants] of Object.entries(interiorArt))for(const [wealth,meta] of Object.entries(variants)){
  const layout=sceneLayout(room,{wealth});assert.deepEqual(layout.props,[]);
  let args;const c={drawImage(...v){args=v;}};assert.ok(store.drawLayer(c,room,0,layout));assert.ok(args[0].url.includes(`${room}/${wealth}/background`));assert.ok(Math.abs(args[3]/args[4]-meta.background.width/meta.background.height)<.01);
  assert.ok(store.drawGround(c,room,layout));assert.ok(args[0].url.includes(`${room}/${wealth}/floor`));assert.ok(Math.abs(args[2]+meta.floor.walkY*args[4]/meta.floor.height-535)<2);assert.ok(args[2]+args[4]>=720);
 }
 assert.throws(()=>validateLayout({wealth:'royal'}));assert.throws(()=>validateLayout({interior:'../../'}));
});

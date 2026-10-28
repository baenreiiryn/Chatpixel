import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = path.join(root, specifier.slice(2));
      const withExtension = /\.[a-z0-9]+$/i.test(target) ? target : target + ".ts";
      return nextResolve(pathToFileURL(withExtension).href, context);
    }
    if (specifier.startsWith("./") && !specifier.match(/\.[a-z0-9]+$/i)) {
      try {
        return nextResolve(specifier + ".ts", context);
      } catch {
        return nextResolve(specifier, context);
      }
    }
    return nextResolve(specifier, context);
  },
});


const game=await import('../lib/game.ts');const gm=await import('../lib/gm.ts');const {runGmTurn}=await import('../lib/gmTurn.ts');const {pixelStateFor}=await import('../lib/chatpixelIntegration.ts');
function state(){const s=structuredClone(game.initialState);s.messages=[];s.pendingRoll=undefined;s.inventory=[{id:'bow',name:'Arco longo',qty:1,detail:'',icon:''}];return s;}
const opening={events:[{type:'scene',scene:'forest',location:'Clareira'},{type:'spawn',name:'Borin',kind:'merchant',ref:'borin',appearance:{head:'dwarf',beard:'long'}}],visibleNpcs:['borin']};
const call=(name,args)=>({type:'function_call',name,arguments:JSON.stringify(args),call_id:crypto.randomUUID()});const text=value=>({output:[{type:'message',content:[{type:'output_text',text:value}]}]});
test('session visual uses owned inventory and never changes mechanics or the global NPC registry',()=>{const s=state(),before=structuredClone(s);const result=gm.executeGmTool(s,'scene_render',JSON.stringify(opening));assert.equal(result.result.ok,true);assert.deepEqual(s,before);assert.deepEqual(result.state.inventory,s.inventory);assert.deepEqual(result.state.character,s.character);assert.deepEqual(result.state.npcs,s.npcs);assert.equal(result.state.pixelVisual.state.npcs[0].name,'Borin');assert.deepEqual(result.state.pixelVisual.state.player.inventory,['bow']);assert.equal(pixelStateFor(s).player.name,s.character.name);});
test('same-forest travel clears old visible NPC without erasing memory; unowned weapons are rejected atomically',()=>{const first=gm.executeGmTool(state(),'scene_render',JSON.stringify(opening)).state;const bad=gm.executeGmTool(first,'scene_render',JSON.stringify({events:[{type:'attack',target:'borin',weapon:'staff'}],visibleNpcs:['borin']}));assert.equal(bad.result.ok,false);assert.equal(bad.state,first);const moved=gm.executeGmTool(first,'scene_render',JSON.stringify({events:[{type:'scene',scene:'forest',location:'Clareira'},{type:'spawn',name:'Grik',kind:'goblin',ref:'grik'}],visibleNpcs:['grik']}));assert.equal(moved.result.ok,true);assert.deepEqual(moved.state.pixelVisual.state.npcs.map(n=>n.name),['Grik']);assert.equal(moved.state.pixelVisual.revision,2);});
test('opening-only and narrative-only turns can update Chatpixel through the same chat bridge',async()=>{let requests=0;const result=await runGmTurn(state(),'Comece a aventura',async payload=>{assert.ok(payload.tools.some(t=>t.name==='scene_render'));if(requests++===0)return text('Borin espera na clareira.');if(requests===2){assert.equal(payload.toolChoice.name,'scene_render');return {output:[call('scene_render',opening)]};}return text('Borin espera na clareira. O que faz?');},{model:'test',allowTools:false,allowedToolNames:['scene_set'],requirePixelVisual:true});assert.equal(result.state.pixelVisual.revision,1);assert.match(result.narration,/Borin/);assert.equal(requests,3);});
test('retry does not replay visual actions after a durable checkpoint',async()=>{let saved=state(),requests=0;await assert.rejects(runGmTurn(saved,'Olho em volta',async()=>{if(requests++===0)return {output:[call('scene_render',opening)]};throw Error('Rede caiu');},{model:'test',requirePixelVisual:true,onProgress:s=>{saved=s;}}),/Rede caiu/);assert.equal(saved.pixelVisual.revision,1);let again=0;const result=await runGmTurn(saved,'Olho em volta',async()=>again++===0?{output:[call('scene_render',opening)]}:text('Borin continua ali.'),{model:'test',requirePixelVisual:true});assert.equal(result.state.pixelVisual.revision,1);assert.equal(result.state.pixelVisual.state.npcs.length,1);});
test('waiting for dice permits visual staging without resolving the roll or applying damage',async()=>{const before=state();const result=await runGmTurn(before,'Ataco',async()=>({output:[call('request_player_roll',{label:'Ataque',reason:'Teste',formula:'2d12',rollKind:'duality'}),call('scene_render',opening)]}),{model:'test',requirePixelVisual:true});assert.ok(result.state.pendingRoll);assert.equal(result.state.pixelVisual.state.npcs[0].name,'Borin');assert.equal(result.state.character.hp,before.character.hp);});
test('a campaign restart discards the previous visual encounter',()=>{const previous=gm.executeGmTool(state(),'scene_render',JSON.stringify(opening)).state;assert.equal(game.restartCampaignFromSnapshot(previous).pixelVisual,undefined);});

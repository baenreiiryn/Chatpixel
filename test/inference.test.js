import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('narração GPT envia mensagens estruturadas e só retorna após conclusão',async()=>{
 const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('async function interpret(input)'),source.indexOf('http.createServer'));
 const context={planEnabled:()=>true,models:async()=>[{slug:'test-model'}],access:async()=>'test-token',resource:'https://example.invalid/v1',TextDecoder,validateEvent:()=>{}};
 let captured;
 context.remote=async(url,options)=>{
  captured=JSON.parse(options.body);
  assert.ok(Array.isArray(captured.input),'Sign in with ChatGPT exige input como array');
  assert.equal(captured.input[0].role,'user');
  const narration=JSON.parse(captured.input[0].content[0].text);
  assert.equal(captured.input[0].content[0].type,'input_text');
  assert.equal(narration.text,'Surge um guarda.');
  assert.equal(narration.state.selected,null);
  assert.equal(captured.store,false);assert.equal(captured.stream,true);
  return {body:(async function*(){yield new TextEncoder().encode('data: '+JSON.stringify({type:'response.output_text.delta',delta:'{"narration":"O guarda se aproxima.","events":[]}'})+'\n'+'data: '+JSON.stringify({type:'response.completed'})+'\n');})()};
 };
 vm.createContext(context);vm.runInContext(code,context);
 const result=await context.interpret({model:'test-model',text:'Surge um guarda.',role:'gm',state:{scene:'forest',player:{weapon:'sword'},npcs:[],selected:null}});
 assert.equal(result.events.length,0);
 context.remote=async()=>({body:(async function*(){})()});
 await assert.rejects(context.interpret({model:'test-model',text:'Surge um guarda.',role:'gm',state:{npcs:[]}}),/interrompida/);
});

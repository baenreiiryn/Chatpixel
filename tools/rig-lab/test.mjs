import assert from 'node:assert/strict';import fs from 'node:fs';import {pose} from './rig-player.js';
const d=JSON.parse(fs.readFileSync(new URL('./rigs.json',import.meta.url)));let count=0;
for(const [name,rig] of Object.entries(d.rigs)){
 assert.equal(new Set(rig.nodes.map(n=>n.id)).size,rig.nodes.length);
 for(const n of rig.nodes){assert.ok(d.assets[n.part],n.part);assert.ok(!n.parent||rig.nodes.some(p=>p.id===n.parent));assert.ok(n.w>0&&n.h>0);assert.ok(n.pivot.every(v=>v>=0&&v<=1));assert.ok(fs.existsSync(new URL(d.assets[n.part].file,import.meta.url)));}
 for(const action of ['idle','walk','attack','fly'])for(const scale of Object.values(d.sizes))for(let i=0;i<120;i++){const p=pose(rig,action,i/30);assert.equal(p.size,rig.nodes.length);for(const v of p.values())assert.ok([v.x,v.y,v.angle].every(Number.isFinite));count++;}
 const a=JSON.stringify([...pose(rig,'walk',0)]),b=JSON.stringify([...pose(rig,'walk',.3)]);assert.notEqual(a,b,name+' walking changes pose');
}
assert.equal(Object.keys(d.rigs).length,9);assert.equal(Object.keys(d.assets).length,64);console.log('PASS',count,'sampled poses, 9 families, 3 sizes, 64 assets.');

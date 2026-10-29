import {detailedNpc} from './art.js';
export const environments={
 shop:{name:'Loja',palette:['#302b33','#755d43','#8a7254'],style:'books'},
 forest:{name:'Floresta',palette:['#152d30','#30483a','#3e5740'],style:'trees'},
 village:{name:'Vila',palette:['#34404a','#6c6650','#787456'],style:'houses'},
 dungeon:{name:'Masmorra',palette:['#171d2c','#303949','#414b59'],style:'cells'},
 tavern:{name:'Taverna',palette:['#30242b','#684b3b','#795a42'],style:'inn'},
 castle:{name:'Castelo',palette:['#293143','#4b5361','#5b6370'],style:'throne'},
 cave:{name:'Caverna',palette:['#141e2b','#323747','#414556'],style:'rocks'},
 desert:{name:'Deserto',palette:['#b28a68','#bc985e','#cba96d'],style:'dunes'},
 coast:{name:'Praia',palette:['#5d8b9c','#c1ae7b','#d1bf8c'],style:'sea'},
 harbor:{name:'Porto',palette:['#405e71','#655744','#77664c'],style:'docks'},
 swamp:{name:'Pântano',palette:['#1e3232','#394a39','#4b5942'],style:'marsh'},
 mountain:{name:'Montanha',palette:['#36485c','#626c76','#77818b'],style:'peaks'},
 snow:{name:'Campos nevados',palette:['#556d84','#b3c6ce','#c7d5db'],style:'snow'},
 ruins:{name:'Ruínas',palette:['#333c40','#535c4a','#657059'],style:'ruins'},
 temple:{name:'Templo',palette:['#303142','#76736b','#89857b'],style:'altar'},
 cemetery:{name:'Cemitério',palette:['#202735','#384138','#495346'],style:'graves'},
 library:{name:'Biblioteca',palette:['#302b33','#594734','#6b5640'],style:'books'},
 market:{name:'Mercado',palette:['#435052','#76634b','#887456'],style:'stalls'},
 camp:{name:'Acampamento',palette:['#1c2a37','#3b463a','#4d5743'],style:'tents'}
};
export const appearanceOptions={head:['human','elf','dwarf','orc','goblin','skeleton'],body:['slim','average','broad'],clothes:['tunic','robe','armor','dress','coat'],hair:['none','short','long','braid','mohawk'],hat:['none','wizard','hood','helmet','crown','cap'],beard:['none','short','long','braided'],accessory:['none','glasses','eyepatch','necklace','scarf','backpack','shield']};
export function npcAppearance(kind,appearance={}){return {head:kind==='goblin'?'goblin':'human',body:'average',clothes:kind==='guard'?'armor':kind==='merchant'?'coat':'tunic',hair:'short',hat:'none',beard:'none',accessory:'none',skin:kind==='goblin'?'#8daf63':'#dcba8a',hairColor:'#514b3b',clothesColor:kind==='player'?'#759c9f':kind==='guard'?'#9eacb0':kind==='merchant'?'#b58a60':'#8c644e',accentColor:'#d9bb6f',...appearance};}
export function validateAppearance(a){if(!a||typeof a!=='object'||Array.isArray(a))throw Error('Aparência inválida');for(const [k,v] of Object.entries(a)){if(k in appearanceOptions){if(!appearanceOptions[k].includes(v))throw Error('Camada de aparência inválida: '+k);}else if(['skin','hairColor','clothesColor','accentColor'].includes(k)){if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('Cor inválida');}else throw Error('Camada desconhecida: '+k);}return a;}
// Independent pixel layers share the same anchor, allowing every combination.
export const drawNpcLayers=detailedNpc;
export function drawEnvironment(c,rect,scene,t,tree){
 const e=environments[scene]??environments.forest;
 const block=(x,y,w,h,color)=>rect(x,y,w,h,color);
 function column(x){block(x,105,48,210,'#85877e');block(x-8,100,64,18,'#aaac9f');block(x-8,300,64,14,'#aaac9f');}
 function roof(x,y,color='#875c49'){for(let i=0;i<5;i++)block(x+i*15,y-i*15,180-i*30,17,color);}
 function mountain(x,y,color){for(let i=0;i<9;i++)block(x+i*24,y-i*25,440-i*48,28,color);}
 if(e.style==='trees'||e.style==='marsh'||e.style==='snow'){for(const [x,y,s]of [[60,280,1.5],[205,275,1.1],[1100,280,1.5],[1230,350,1.7],[850,250,.8]])tree(x,y,s);if(e.style==='marsh'){for(let i=0;i<5;i++){c.fillStyle='#294c4d';c.beginPath();c.ellipse(160+i*240,490+(i%2)*80,95,24,0,0,7);c.fill();}}if(e.style==='snow'){for(let i=0;i<50;i++)block((i*173+t*.025)%1280,(i*89+t*.02)%700,4,4,'#e0edf0');}}
 if(e.style==='houses'){for(const x of [100,960]){block(x,150,190,170,'#79664d');roof(x-5,145);block(x+70,230,50,90,'#302d28');block(x+18,197,34,32,'#e3c37d');}}
 if(e.style==='cells'){for(const x of [100,1100]){column(x);block(x+17,200,20,12,'#b87b46');block(x+22,182+Math.sin(t/100)*3,12,23,'#f6c77c');}for(let x=420;x<820;x+=40)block(x,115,8,170,'#111723');}
 if(e.style==='inn'){block(0,100,1280,190,'#473329');for(let x=40;x<1240;x+=100)block(x,100,14,190,'#261f20');block(850,230,330,80,'#8d6644');for(const x of [110,370]){block(x,340,160,22,'#a17a4b');block(x+15,362,12,80,'#644b35');block(x+130,362,12,80,'#644b35');}block(530,140,150,145,'#6e6455');block(558,199,94,85,'#282328');block(583,230,42,46,'#efaa54');}
 if(e.style==='throne'){for(const x of [110,320,920,1130])column(x);block(550,155,140,150,'#684455');block(570,145,100,110,'#a96c57');block(540,270,160,35,'#b9a172');block(520,310,200,290,'#6b3746');for(const x of [405,805]){block(x,115,60,125,'#823c51');block(x+24,135,12,50,'#d4b76b');}}
 if(e.style==='rocks'){for(let i=0;i<12;i++){const h=50+(i*47)%170;block(i*112,0,65,h,'#222633');block(i*112+15,h,35,35,'#222633');}for(const x of [80,1040]){block(x,220,110,95,'#4b4b5a');block(x+25,190,70,40,'#565664');block(x+30,260,12,45,'#83cfca');}}
 if(e.style==='dunes'){for(let i=0;i<4;i++){c.fillStyle=i%2?'#b79660':'#d2ad70';c.beginPath();c.ellipse(i*400,280,300,90,0,0,7);c.fill();}for(const x of [110,1140]){block(x,200,15,130,'#58704c');block(x-25,245,25,12,'#58704c');block(x-25,215,10,40,'#58704c');}}
 if(e.style==='sea'||e.style==='docks'){block(0,130,1280,170,'#467d91');for(let y=155;y<290;y+=30)for(let i=0;i<9;i++)block((i*160+t*.02)%1280,y,70,3,'#89bac2');if(e.style==='sea'){block(0,290,1280,18,'#e3dbc0');block(110,210,12,125,'#765c40');for(let i=0;i<5;i++)block(50+i*23,195-Math.abs(2-i)*8,60,14,'#4f7051');}else{for(let i=0;i<8;i++)block(60+i*55,250,50,140,'#96754b');block(850,210,200,30,'#8c6240');block(940,95,9,115,'#c5af7a');for(let i=0;i<6;i++)block(950,110+i*15,80-i*10,17,'#dbd5ae');}}
 if(e.style==='peaks'){mountain(-100,300,'#7d8991');mountain(320,295,'#929ca4');mountain(820,310,'#76838e');mountain(445,170,'#c8d4da');}
 if(e.style==='ruins'){for(const x of [80,290,980,1160]){block(x,170+(x%3)*25,45,140,'#777d6d');block(x-8,165+(x%3)*25,60,15,'#9c9d84');}for(let i=0;i<9;i++)block(i*139,320+(i%2)*120,48,25,'#737960');}
 if(e.style==='altar'){for(const x of [100,270,980,1150])column(x);block(510,210,260,85,'#a19a88');block(540,198,200,14,'#c6be9f');for(const x of [555,705]){block(x,173,8,25,'#e5d7a2');block(x,164+Math.sin(t/130)*2,8,11,'#f5c374');}block(620,110,38,62,'#b2b394');block(603,125,72,15,'#b2b394');}
 if(e.style==='graves'){for(let i=0;i<8;i++){const x=75+i*155,y=200+(i%2)*65;block(x,y,45,65,'#777c78');block(x+16,y-15,12,24,'#93968a');block(x+5,y+5,35,8,'#93968a');}block(30,120,1220,5,'#545e59');}
 if(e.style==='books'){for(const x of [50,340,850]){block(x,110,240,195,'#3f3029');for(let row=0;row<3;row++){block(x,160+row*60,240,8,'#a18155');for(let i=0;i<14;i++)block(x+8+i*16,120+row*60,12,40,['#7e5955','#677861','#807655','#536d7c'][i%4]);}}}
 if(e.style==='stalls'){for(let i=0;i<4;i++){const x=65+i*310;block(x,170,225,35,i%2?'#a38a52':'#a85e59');for(let j=0;j<6;j++)block(x+j*38,170,19,35,'#d8c492');block(x+8,205,9,105,'#76583b');block(x+205,205,9,105,'#76583b');block(x,280,225,40,'#8f714b');for(let j=0;j<6;j++)block(x+20+j*32,265,20,15,['#a8ad64','#a7654f','#c5ae6e'][j%3]);}}
 if(e.style==='tents'){for(const x of [100,970]){roof(x,265,'#a39468');block(x+28,266,124,55,'#a39468');block(x+75,267,35,54,'#363934');}block(590,400,70,15,'#735438');block(610,364+Math.sin(t/110)*5,30,40,'#e4a65c');}
}

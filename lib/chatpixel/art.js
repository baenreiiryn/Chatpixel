// Modular high-detail pixel art. All shapes use integer pixel clusters and fixed seeds.
export function tint(hex,amount){const n=parseInt(hex.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,v+amount)).toString(16).padStart(2,'0')).join('');}
function noise(n){let v=(n+371)|0;v=Math.imul(v^(v>>>16),0x45d9f3b);v=Math.imul(v^(v>>>16),0x45d9f3b);v^=v>>>16;return (v>>>0)/4294967296;}
function poly(r,points,color,step=2){const min=Math.min(...points.map(p=>p[1])),max=Math.max(...points.map(p=>p[1]));for(let y=min;y<max;y+=step){const hits=[];for(let i=0;i<points.length;i++){const [x1,y1]=points[i],[x2,y2]=points[(i+1)%points.length];if((y1<=y&&y2>y)||(y2<=y&&y1>y))hits.push(x1+(y-y1)*(x2-x1)/(y2-y1));}hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2)r(Math.floor(hits[i]/2)*2,y,Math.ceil((hits[i+1]-hits[i])/2)*2,step,color);}}
function oval(r,x,y,rx,ry,color,step=3){for(let dy=-ry;dy<ry;dy+=step){const w=Math.sqrt(Math.max(0,1-(dy/ry)**2))*rx;r(x-Math.floor(w),y+dy,Math.ceil(w*2),step,color);}}
function grain(r,x,y,w,h,base,seed=0,count=30){for(let i=0;i<count;i++){const a=noise(seed+i*3),b=noise(seed+i*3+1);r(x+Math.floor(a*w/2)*2,y+Math.floor(b*h/2)*2,2+Math.floor(noise(i+seed)*3)*2,2,tint(base,i%3===0?20:-15));}}
function plank(r,x,y,w,h,base){r(x,y,w,h,tint(base,-28));r(x+2,y+2,w-4,h-4,base);r(x+3,y+2,w-6,2,tint(base,22));for(let i=0;i<3;i++)r(x+8+i*17,y+7+i*5,Math.max(4,w/3),2,tint(base,-15));}
function stone(r,x,y,w,h,col){r(x,y,w,h,tint(col,-32));r(x+2,y+2,w-4,h-4,col);r(x+4,y+2,w-8,3,tint(col,22));r(x+2,y+4,3,h-9,tint(col,10));grain(r,x+5,y+6,w-10,h-10,col,x+y,4);}
export function detailedTree(c,r,x,y,scale=1,variant='forest'){
 c.save();c.translate(x,y);c.scale(scale,scale);
 const leaf=variant==='snow'?'#9eb5b2':variant==='swamp'?'#3c6250':'#416c49';
 oval(r,6,9,77,17,'#10201d65');
 poly(r,[[-18,8],[-8,-164],[13,-164],[24,12],[9,1],[-2,13]],'#382e28');
 r(-6,-144,10,144,'#705740');r(-4,-135,4,118,'#96724c');
 for(let i=0;i<12;i++)r(-10+(i%3)*9,-128+i*10,3,15,'#4d3e30');
 poly(r,[[-8,-85],[-58,-135],[-52,-140],[8,-111]],'#67503b');
 poly(r,[[5,-117],[53,-164],[57,-159],[14,-92]],'#67503b');
 // Asymmetric crowns, each with a dark skirt, middle plane and lit upper edge.
 for(const [cx,cy,rx,ry]of [[-44,-147,61,42],[39,-155,66,46],[-13,-195,78,51],[30,-222,49,34]]){
  oval(r,cx,cy+9,rx+5,ry+4,tint(leaf,-30),4);oval(r,cx,cy,rx,ry,leaf,4);oval(r,cx-11,cy-11,rx*.77,ry*.7,tint(leaf,15),4);
  for(let i=0;i<30;i++){const a=noise(cx+cy+i*7),b=noise(i*13+cx);const xx=cx+(a-.5)*rx*1.5,yy=cy+(b-.5)*ry*1.4;r(xx,yy,6+(i%3)*3,3,i%4===0?tint(leaf,35):tint(leaf,-12));}
 }
 for(let i=0;i<8;i++)r(-30+i*9,4+(i%3)*3,5,3,'#63804d');c.restore();
}
export function detailedNpc(c,r,a){
 const cloth=a.clothesColor,skin=a.skin,hair=a.hairColor,accent=a.accentColor,ink='#19232a';
 c.save();c.scale(a.body==='broad'?1.19:a.body==='slim'?.88:1,a.head==='dwarf'?.86:a.head==='goblin'?.88:1);
 // Layer 1: boots and legs.
 r(-16,-17,13,26,ink);r(4,-17,13,26,ink);r(-13,-17,7,22,'#4a5050');r(7,-17,7,22,'#596060');
 r(-20,3,18,9,'#2d2b2b');r(3,3,19,9,'#2d2b2b');r(-18,3,13,3,'#73604c');r(5,3,13,3,'#73604c');r(-20,11,18,2,ink);r(3,11,19,2,ink);
 // Layer 2: silhouette, sleeves, shaded cloth and folds.
 poly(r,[[-17,-58],[17,-58],[24,-46],[20,-14],[-20,-14],[-24,-46]],ink);
 r(-18,-53,36,37,cloth);r(-24,-49,9,29,tint(cloth,-20));r(16,-49,10,29,tint(cloth,-25));r(-21,-48,4,23,tint(cloth,18));
 r(-14,-51,9,30,tint(cloth,22));r(7,-49,7,31,tint(cloth,-17));r(-5,-47,3,26,tint(cloth,9));
 r(-24,-22,9,8,tint(skin,-20));r(17,-22,9,8,tint(skin,-20));r(-23,-22,5,4,skin);r(18,-22,5,4,skin);
 if(['robe','dress'].includes(a.clothes)){poly(r,[[-15,-29],[15,-29],[25,5],[-25,5]],tint(cloth,-12));r(-19,-20,5,23,tint(cloth,16));r(10,-23,4,26,tint(cloth,-30));r(-3,-52,5,56,accent);r(-23,2,47,3,tint(accent,-12));}
 if(a.clothes==='armor'){stone(r,-17,-51,34,28,'#8e9da4');r(-12,-46,24,3,'#d0d9d3');r(-2,-44,3,18,'#c1ccc9');stone(r,-28,-55,15,13,'#8c9da3');stone(r,14,-55,15,13,'#8c9da3');for(let i=0;i<4;i++)r(-15+i*9,-23,6,9,'#697a84');r(-21,-50,3,3,accent);r(20,-50,3,3,accent);}
 if(a.clothes==='coat'){poly(r,[[-15,-55],[-3,-47],[-9,-22],[-18,-16]],tint(cloth,30));poly(r,[[15,-55],[3,-47],[9,-22],[18,-16]],tint(cloth,-25));r(-3,-47,5,26,'#d3c29c');for(let i=0;i<3;i++)r(7,-38+i*8,3,3,accent);plank(r,-16,-28,10,10,'#796047');}
 r(-20,-17,40,6,'#45362d');r(-3,-18,8,8,tint(accent,-20));r(-1,-16,4,4,accent);r(13,-17,7,12,'#766044');r(14,-15,5,2,'#b29768');
 // Layer 3: rear hair, ears, face, nose and eyes.
 if(['long','braid'].includes(a.hair)){r(-20,-87,40,46,tint(hair,-22));r(-18,-81,5,36,hair);}
 poly(r,[[-14,-85],[13,-85],[18,-77],[15,-62],[8,-55],[-7,-55],[-17,-63],[-19,-77]],ink);
 r(-15,-81,29,19,skin);r(-11,-64,22,7,tint(skin,-9));r(-12,-80,11,14,tint(skin,15));r(11,-78,4,17,tint(skin,-26));r(-19,-75,5,10,tint(skin,-8));r(15,-75,5,10,tint(skin,-25));
 if(['elf','orc','goblin'].includes(a.head)){poly(r,[[-15,-77],[-30,-82],[-23,-68],[-15,-68]],skin);poly(r,[[15,-77],[29,-82],[23,-68],[15,-68]],tint(skin,-16));r(-25,-77,7,3,tint(skin,-30));}
 r(-11,-73,8,3,tint(hair,-20));r(5,-73,8,3,tint(hair,-20));r(-10,-69,6,4,'#e4e4cf');r(6,-69,6,4,'#e4e4cf');r(-7,-69,3,4,'#2a4544');r(8,-69,3,4,'#2a4544');r(-1,-69,4,8,tint(skin,-24));r(-1,-68,2,5,tint(skin,21));r(-4,-59,10,2,'#865b4c');
 if(a.head==='skeleton'){r(-12,-73,10,9,ink);r(4,-73,10,9,ink);r(-1,-64,4,5,ink);for(let x=-9;x<12;x+=5)r(x,-58,3,4,ink);}
 if(a.head==='orc'){r(-10,-62,4,8,'#e6ddbd');r(9,-62,4,8,'#e6ddbd');}
 // Layer 4: independently selected hair, facial hair and headgear.
 if(a.hair!=='none'){poly(r,[[-19,-77],[-17,-87],[-8,-92],[9,-90],[18,-84],[18,-75],[9,-82],[-3,-81],[-12,-77]],tint(hair,-18));r(-12,-87,19,5,hair);r(-10,-88,11,2,tint(hair,31));for(let i=0;i<5;i++)r(-15+i*6,-84+(i%2)*3,3,7,tint(hair,17));if(a.hair==='long'){r(-20,-79,6,32,hair);r(-19,-76,2,23,tint(hair,28));}if(a.hair==='braid'){for(let i=0;i<7;i++)r(16+(i%2)*2,-74+i*5,7,5,i%2?hair:tint(hair,23));r(18,-42,6,3,accent);}if(a.hair==='mohawk'){r(-4,-104,9,20,hair);r(-3,-104,3,17,tint(hair,32));}}
 if(a.beard!=='none'){poly(r,[[-13,-61],[-4,-58],[5,-58],[14,-62],[12,-47],[1,a.beard==='short'?-47:-31],[-10,-48]],tint(hair,-12));for(let i=0;i<6;i++)r(-10+i*4,-56+(i%2)*3,2,a.beard==='short'?7:16,tint(hair,i%2?20:-22));if(a.beard==='braided'){r(-3,-36,8,4,accent);r(-1,-32,4,5,hair);}}
 if(a.hat==='wizard'){poly(r,[[-22,-88],[0,-122],[7,-110],[16,-88]],tint(cloth,-20));poly(r,[[-17,-90],[0,-118],[0,-91]],tint(cloth,24));r(-29,-89,57,6,ink);r(-25,-89,49,3,cloth);r(-14,-94,29,4,accent);r(5,-108,3,3,accent);}
 if(a.hat==='hood'){poly(r,[[-23,-60],[-23,-87],[-11,-98],[11,-98],[23,-87],[23,-60],[14,-58],[16,-82],[-14,-82],[-14,-58]],tint(cloth,-22));r(-18,-89,7,18,tint(cloth,24));r(-9,-94,19,4,cloth);}
 if(a.hat==='helmet'){stone(r,-20,-94,40,17,'#899da6');r(-17,-94,30,3,'#c7d3d3');r(-22,-79,7,21,'#7e939c');r(15,-79,7,21,'#617680');r(-2,-94,4,21,accent);r(-22,-80,44,3,'#b8c5c2');}
 if(a.hat==='crown'){r(-19,-91,37,9,tint(accent,-35));r(-17,-91,33,5,accent);for(let x=-17;x<18;x+=8){r(x,-99+(x%3),5,10,accent);r(x+1,-98+(x%3),2,4,tint(accent,39));}r(-2,-90,5,5,'#a04e61');}
 if(a.hat==='cap'){oval(r,0,-87,20,10,cloth,2);r(-23,-83,47,5,tint(cloth,-24));r(-12,-94,14,3,tint(cloth,26));}
 if(a.accessory==='glasses'){for(const x of [-13,4]){r(x,-72,12,2,accent);r(x,-64,12,2,accent);r(x,-72,2,9,accent);r(x+10,-72,2,9,accent);}r(-1,-70,5,2,accent);}
 if(a.accessory==='eyepatch'){r(-15,-74,32,2,ink);r(4,-72,11,9,ink);r(6,-70,5,2,'#4a5055');}
 if(a.accessory==='necklace'){r(-10,-50,3,5,accent);r(9,-50,3,5,accent);r(-7,-45,18,2,accent);r(-2,-43,7,7,accent);r(0,-42,3,4,'#74b9ae');}
 if(a.accessory==='scarf'){r(-20,-56,40,7,tint(accent,-20));r(-18,-56,32,3,accent);r(10,-50,8,23,accent);r(12,-49,2,18,tint(accent,25));}
 if(a.accessory==='backpack'){plank(r,-33,-48,14,32,'#7c6145');r(-31,-43,10,3,accent);}
 if(a.accessory==='shield'){poly(r,[[-38,-45],[-23,-51],[-12,-45],[-14,-23],[-25,-11],[-36,-23]],ink);poly(r,[[-35,-43],[-24,-47],[-15,-43],[-17,-24],[-25,-16],[-33,-25]],tint(accent,-14));r(-26,-42,4,23,accent);r(-32,-33,16,4,accent);}
 c.restore();
}
export function detailedBackdrop(c,r,scene,layout,pal){
 for(let y=0;y<330;y+=6)r(0,y,1280,6,tint(pal[0],Math.floor(y/330*20)));
 if(layout.background==='forest'){
  for(let layer=0;layer<3;layer++)for(let i=0;i<19;i++){const x=i*83+noise(i+layer*31)*42,y=290+layer*10,w=10+layer*7,col=['#253d3c','#1e3835','#17332d'][layer];r(x,0,w,y,col);poly(r,[[x+4,160],[x-30,105],[x-27,100],[x+9,139]],col);oval(r,x,y-225,65+layer*15,56,col,6);r(x+3,95,3,y-95,tint(col,10));}
  for(let i=0;i<28;i++)oval(r,i*49,305,50,23,i%2?'#294b37':'#31553d',4);
 }else if(layout.background==='wall'){
  for(let y=20;y<320;y+=38)for(let x=-80;x<1350;x+=90)stone(r,x+(Math.floor(y/38)%2)*45,y,88,36,tint(pal[1],Math.floor(noise(x+y)*15)-8));
  r(0,300,1280,12,tint(pal[1],-24));r(0,296,1280,4,tint(pal[1],24));
 }else if(layout.background==='cave'){
  for(let i=0;i<22;i++){const x=i*63,h=50+noise(i)*155;poly(r,[[x,0],[x+68,0],[x+42,h],[x+25,h+20]],i%2?'#1a2732':'#22313b');r(x+31,0,4,h*.6,'#30404a');}
 }else{
  for(let i=0;i<5;i++)poly(r,[[i*310-80,310],[i*310+110,135+noise(i)*60],[i*310+380,310]],tint(pal[0],15+i%2*10));
  oval(r,1065,82,29,29,'#ecd6a0',3);for(let i=0;i<7;i++){const x=noise(i+7)*1200,y=45+noise(i+16)*90;r(x,y,80,5,tint(pal[0],40));r(x+20,y-4,34,4,tint(pal[0],40));}
 }
}
export function detailedGround(c,r,scene,layout,pal){
 const base={grass:pal[1],dirt:'#6b604a',stone:'#46525b',wood:'#76563f',sand:'#c0a16c',snow:'#b8cbd1'}[layout.ground];r(0,300,1280,420,base);
 if(layout.ground==='stone'){for(let row=0;row<15;row++)for(let col=-1;col<24;col++)stone(r,col*60+(row%2)*30,300+row*31,58,29,tint(base,Math.floor(noise(row*31+col)*18)-9));}
 else if(layout.ground==='wood'){for(let row=0;row<14;row++)for(let col=-1;col<9;col++){const x=col*158+(row%2)*79,y=300+row*32;plank(r,x,y,156,31,tint(base,Math.floor(noise(row*31+col)*20)-10));r(x+8,y+6,2,2,'#302a29');r(x+145,y+23,2,2,'#302a29');}}
 else{
  if(layout.ground==='grass'||layout.ground==='dirt'){poly(r,[[560,300],[715,300],[785,420],[990,720],[485,720],[584,460]],'#665e45');poly(r,[[586,300],[674,300],[704,435],[842,720],[546,720],[624,441]],'#766c4f');}
  for(let i=0;i<1200;i++){const x=Math.floor(noise(i*3)*1280/2)*2,y=302+Math.floor(noise(i*3+1)*416/2)*2;if(layout.ground==='grass'&&!(x>560&&x<750+y*.15)){const col=tint(base,i%4?20:-15);r(x,y,2,4+i%6,col);r(x-3,y+3,3,2,col);if(i%7===0)r(x+3,y+4,2,2,'#b7ad69');
   }else r(x,y,3+i%5,2,tint(base,i%3?15:-12));}
  for(let i=0;i<45;i++){const x=noise(i*11)*1280,y=320+noise(i*11+1)*390;oval(r,x,y,4+i%6,2+i%3,tint(base,-24),2);r(x-2,y-2,5,2,tint(base,22));}
 }
 r(0,300,1280,5,'#16292c35');
}
export function detailedModule(c,r,p,tree,t=0){
 c.save();c.translate(p.x,p.y);c.scale(p.scale??1,p.scale??1);const col=p.color??'#8f7758';
 const roof=(x,y,w,h)=>{poly(r,[[x-10,y],[x+w/2,y-h],[x+w+10,y]],'#342e2e');for(let row=0;row<h/10;row++){const inset=row*w/h*5,yy=y-row*10;for(let xx=x+inset;xx<x+w-inset;xx+=23){r(xx,yy-8,22,9,row%2?'#845d4c':'#946953');r(xx+2,yy-8,18,2,'#b18161');r(xx+21,yy-6,2,7,'#573e37');}}};
 const window=(x,y)=>{stone(r,x-4,y-4,40,45,'#afa18a');r(x,y,32,37,'#3c3530');r(x+3,y+3,26,30,'#d5af62');r(x+6,y+5,9,20,'#f1d18a');r(x+14,y,4,37,'#67503a');r(x,y+17,32,4,'#67503a');r(x-5,y+37,42,5,'#45372e');};
 if(p.type==='tree')tree(0,0,1);
 if(p.type==='shop'&&p.indoor){
  plank(r,-2,-173,213,107,'#4e3a2d');for(let row=0;row<2;row++){for(let i=0;i<9;i++){const x=12+i*22,y=-159+row*47;const bottle=['#709888','#ad9162','#8c777c'][i%3];r(x+4,y,7,7,'#cab585');r(x+1,y+7,13,25,bottle);r(x+3,y+9,3,18,tint(bottle,30));r(x+1,y+21,13,7,'#d1bc8c');}plank(r,0,-123+row*47,210,7,'#a07a50');}
  for(let y=-67;y<0;y+=16)plank(r,-8,y,230,16,'#876644');plank(r,-14,-76,242,12,'#b08b59');r(22,-52,4,30,'#b99761');r(182,-52,4,30,'#b99761');r(50,-91,37,14,'#d3c19b');r(54,-91,28,3,'#eee0b7');r(140,-102,19,25,'#728e80');r(145,-107,9,7,'#d1b16c');
 }
 if(p.type==='house'||p.type==='shop'&&!p.indoor){
  oval(r,100,8,124,15,'#16232065');r(-3,-145,206,148,'#342c2b');r(0,-143,200,143,'#b5a082');grain(r,5,-135,190,125,'#b5a082',10,80);
  for(const x of [0,58,138,192])plank(r,x,-144,8,144,'#69503c');plank(r,0,-74,200,8,'#6d503a');plank(r,0,-10,200,12,'#584334');
  poly(r,[[10,-132],[52,-82],[46,-82],[10,-123]],'#775940');poly(r,[[145,-82],[190,-132],[190,-123],[152,-82]],'#775940');
  stone(r,74,-90,54,90,'#7e7564');r(80,-85,42,85,'#2a2c2a');for(let x=81;x<119;x+=9)plank(r,x,-82,8,81,'#6d4f38');r(110,-41,4,4,'#d5bb70');window(14,-124);window(151,-124);roof(-12,-148,224,90);
  stone(r,155,-238,24,63,'#7b7870');r(151,-242,32,8,'#a09a88');
  if(p.type==='shop'){for(let i=0;i<10;i++){r(-10+i*22,-114,22,24,i%2?'#cbbb8d':'#647762');r(-10+i*22,-90,22,5,i%2?'#a89970':'#455b4b');}plank(r,205,-130,43,30,'#5c4535');r(208,-124,36,3,'#bca16e');r(215,-116,20,3,'#bca16e');r(204,-145,4,30,'#5b4a37');}
 }
 if(p.type==='wall'){for(let row=0;row<5;row++)for(let x=0;x<320;x+=64)stone(r,x+(row%2)*10,-180+row*36,62,35,tint('#68747a',row%3*5));for(let i=0;i<6;i++)r(i*53+7,-8,29,6,'#566c4b');}
 if(p.type==='gate'||p.type==='door'){
  const h=p.type==='gate'?240:163;for(const x of [-100,80])for(let y=-h;y<0;y+=30)stone(r,x,y,79,29,'#717b7c');stone(r,-104,-h-12,268,30,'#969d94');r(-20,-h+18,100,h-18,'#14232a');
  if(p.type==='gate'){for(let x=-100;x<165;x+=39)stone(r,x,-h-33,24,23,'#a0a291');for(let x=-14;x<80;x+=15){r(x,-h+20,5,55,'#525d5e');r(x,-h+73,3,9,'#525d5e');}r(-16,-h+42,94,5,'#738080');}
  else{for(let x=-17;x<78;x+=15)plank(r,x,-h+23,14,h-24,'#66503c');r(-18,-55,95,7,'#2d3437');r(-18,-123,95,7,'#2d3437');r(57,-75,6,6,'#d2b56c');}
  stone(r,-105,0,270,12,'#838b81');
 }
 if(p.type==='rock'){poly(r,[[0,0],[-9,-35],[17,-78],[75,-90],[121,-52],[130,-9],[101,8]],'#343f46');poly(r,[[0,-30],[24,-74],[73,-84],[60,-26]],'#76818a');poly(r,[[60,-26],[73,-84],[115,-49],[123,-8]],'#58636e');poly(r,[[0,-30],[60,-26],[123,-8],[100,4],[9,0]],'#444f58');grain(r,10,-65,90,55,'#63717b',70,25);}
 if(p.type==='column'){stone(r,-7,-205,56,19,'#a4ac9f');stone(r,0,-186,42,175,'#818e87');r(6,-180,5,161,'#b1b6a5');r(18,-180,4,161,'#697971');r(31,-180,5,161,'#5c6b68');stone(r,-9,-14,60,20,'#a2aa9a');r(2,-94,25,2,'#4e605d');r(23,-92,2,14,'#4e605d');}
 if(p.type==='torch'){r(-4,-45,20,12,'#3c3430');plank(r,0,-49,11,50,'#79573b');r(-6,-51,24,6,'#8d9183');poly(r,[[-8,-55],[-10,-72],[0,-87],[4,-107],[18,-86],[23,-67],[15,-53]],'#b65e36');poly(r,[[-4,-56],[1,-77],[8,-91],[15,-72],[13,-56]],'#edab4e');r(3,-70,7,14,'#ffe2a1');}
 if(p.type==='table'||p.type==='altar'){const altar=p.type==='altar';for(const x of [13,151])plank(r,x,-28,16,32,tint(col,-22));for(let y=-62;y<-31;y+=10)plank(r,-4,y,190,10,altar?'#a7a68f':col);if(altar){for(const x of [30,145]){r(x,-98,7,35,'#d8cba2');r(x+1,-106,4,8,'#e8b266');}r(65,-74,50,12,'#5d4754');r(68,-74,43,3,'#d1bd91');}else{oval(r,55,-65,18,6,'#c6b28d',2);r(96,-86,12,22,'#8d7760');r(98,-86,8,3,'#d3ba87');}}
 if(p.type==='books'){plank(r,-4,-199,238,203,'#48382e');for(let row=0;row<3;row++){for(let i=0;i<14;i++){const x=7+i*15,y=-187+row*62,h=31+Math.floor(noise(i+row*17)*17),book=['#976660','#7d8b68','#b29a68','#5c7e8d','#806786'][i%5];r(x,y+45-h,11,h,book);r(x+1,y+48-h,2,h-5,tint(book,27));r(x,y+42,11,2,'#c0a779');r(x+3,y+51-h,6,2,'#cbb785');}plank(r,0,-141+row*62,231,9,'#92704b');}plank(r,-5,-201,10,205,'#a17a51');plank(r,228,-201,10,205,'#a17a51');}
 if(p.type==='stall'){for(const x of [8,200])plank(r,x,-136,10,137,'#70563d');for(let i=0;i<11;i++){r(i*20,-153,20,37,i%2?'#d1c095':'#a85f55');r(i*20,-119,20,7,i%2?'#ac9a72':'#7f4844');}for(let y=-32;y<0;y+=11)plank(r,-3,y,226,11,col);for(let i=0;i<7;i++){plank(r,7+i*30,-47,28,17,'#604b35');for(let j=0;j<3;j++)oval(r,14+i*30+j*6,-48-(j%2)*4,5,5,['#a6ad65','#b87553','#cdb178'][i%3],2);}}
 if(p.type==='grave'){stone(r,-2,-66,49,66,'#75827f');stone(r,5,-77,35,16,'#8b9790');r(20,-60,5,29,'#b0b5a3');r(12,-52,21,5,'#b0b5a3');r(10,-18,26,2,'#4c6159');r(12,-12,22,2,'#4c6159');for(let i=0;i<7;i++)r(-6+i*9,-3,6,5,'#526b48');}
 if(p.type==='tent'){poly(r,[[-8,0],[93,-130],[211,0]],'#393e34');poly(r,[[0,-5],[92,-123],[181,-5]],'#b4a579');poly(r,[[92,-123],[211,-3],[181,-5]],'#857857');poly(r,[[72,0],[94,-83],[124,0]],'#26342f');r(92,-122,3,120,'#d4bd86');for(let i=0;i<4;i++)r(30+i*27,-16-i*17,6,2,'#dfca91');r(-20,0,240,4,'#514d3c');}
 if(p.type==='boat'){poly(r,[[-12,-46],[213,-46],[185,1],[27,1]],'#3f3730');for(let y=-40;y<-3;y+=10)plank(r,10+(y+40)*.3,y,185-(y+40)*.7,9,'#886447');plank(r,89,-177,8,136,'#ae9262');poly(r,[[102,-170],[183,-61],[102,-61]],'#d3c9a6');poly(r,[[102,-165],[150,-70],[102,-70]],'#eee0b7');r(101,-101,55,3,'#b5a37c');}
 if(p.type==='water'){r(0,-100,400,101,'#3e7485');for(let i=0;i<80;i++){const x=noise(i*3)*390,y=-98+noise(i*3+1)*96;r(x,y,6+noise(i)*24,2,i%4?'#669b9f':'#b5d1bd');}r(0,-2,400,3,'#a2bca9');}
 if(p.type==='dunes'||p.type==='peaks'){const sand=p.type==='dunes';poly(r,[[-40,0],[153,sand?-104:-230],[405,0]],sand?'#b39362':'#556c7b');poly(r,[[-40,0],[153,sand?-104:-230],[190,0]],sand?'#d3b47c':'#879ba5');poly(r,[[153,sand?-104:-230],[405,0],[190,0]],sand?'#ad895a':'#687f8e');if(!sand)poly(r,[[116,-176],[153,-230],[212,-177],[180,-188],[159,-174],[143,-196]],'#d6ded1');}
 c.restore();
}

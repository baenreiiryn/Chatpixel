"""Deterministic crops and attachment data from the approved body atlases."""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import label
import json,base64
ROOT=Path(__file__).resolve().parent
SRC=ROOT/'sources'
files=['exec-cfe6a894-268f-4a16-acc2-a9fde4ab0765.png','exec-3c455418-5999-4dff-9ccc-765ae702c261.png','exec-91c19e87-7495-49e0-a005-619a0abcd1c2.png']
# Rectangles isolate each intended piece; keep only the dominant alpha component.
crops={
'human':(0,{'head':(1030,60,1090,137),'chest':(1110,60,1203,155),'pelvis':(1220,92,1285,152),'upperArm':(1030,150,1088,240),'forearm':(1120,158,1182,244),'hand':(1218,185,1267,243),'thigh':(1028,239,1094,364),'shin':(1120,250,1185,368),'foot':(1201,310,1282,364)}),
'feather':(0,{'upperWing':(1145,438,1213,516),'outerWing':(1219,417,1411,567),'foldedWing':(1311,570,1425,721)}),
'bird':(0,{'head':(972,769,1066,848),'body':(998,835,1138,950),'wing':(1220,753,1420,942),'tail':(1240,923,1405,1040),'thigh':(983,924,1042,1050),'shin':(1060,955,1123,1055),'foot':(1138,974,1231,1063)}),
'quad':(1,{'head':(989,126,1090,237),'neck':(1088,125,1174,236),'chest':(1176,126,1288,231),'pelvis':(1301,135,1403,242),'tail':(918,269,1056,360),'upperFront':(1065,230,1141,391),'lowerFront':(1139,241,1237,379),'upperBack':(1254,230,1336,382),'lowerBack':(1343,273,1425,378)}),
'dragon':(1,{'head':(983,431,1107,550),'neck':(1108,426,1218,561),'chest':(1208,448,1302,560),'pelvis':(1310,458,1403,557),'tail':(941,555,1162,785),'front':(1172,567,1249,684),'back':(1277,544,1360,694),'foot':(1355,594,1428,670),'wing':(1024,640,1297,807),'wingTip':(1275,689,1425,802)}),
'snake':(1,{'head':(962,860,1064,928),'neck':(1072,856,1132,951),'segment':(941,933,1085,1034),'curve':(1080,934,1211,1039),'tail':(1300,961,1421,1038)}),
'spider':(2,{'abdomen':(1038,113,1201,236),'head':(1205,134,1333,236),'mandible':(1340,145,1413,228),'upperLeg':(1031,230,1108,317),'lowerLeg':(1042,310,1137,422)}),
'fly':(2,{'head':(1072,465,1153,555),'thorax':(1015,549,1146,630),'abdomen':(1012,625,1146,753),'antenna':(1162,460,1241,510),'mandible':(1160,510,1211,566),'wing':(1212,488,1434,590),'hindWing':(1235,589,1400,657),'upperLeg':(1152,567,1211,648),'lowerLeg':(1178,642,1265,759)}),
'bug':(2,{'abdomen':(1008,803,1155,916),'thorax':(1195,829,1284,921),'head':(1275,850,1358,928),'antenna':(1338,809,1423,857),'mandible':(1350,850,1412,922),'upperLeg':(1024,911,1085,982),'lowerLeg':(1057,976,1121,1049)})}
assets={};(ROOT/'parts').mkdir(exist_ok=True)
for group,(sheet,parts) in crops.items():
 im=Image.open(SRC/files[sheet]).convert('RGBA')
 for name,box in parts.items():
  p=im.crop(box);a=np.array(p);labs,count=label(a[:,:,3]>32);sizes=np.bincount(labs.ravel());sizes[0]=0;winner=sizes.argmax();mask=labs==winner
  # Preserve antialias pixels close to the main island, suppress stray neighbors.
  from scipy.ndimage import binary_dilation
  a[:,:,3][~binary_dilation(mask,iterations=1)]=0
  p=Image.fromarray(a);bbox=p.getbbox();assert bbox,(group,name);p=p.crop(bbox)
  path=ROOT/'parts'/group;path.mkdir(exist_ok=True);out=path/(name+'.png');p.save(out)
  assets[group+'/'+name]={'file':str(out.relative_to(ROOT)),'width':p.width,'height':p.height,'source':files[sheet],'rect':list(box),'trim':list(bbox),'data':'data:image/png;base64,'+base64.b64encode(out.read_bytes()).decode()}
# Each node uses parent-local x/y, native canvas units, pivot normalized to its crop.
rigs={}
def node(id,part,parent,x,y,w,h,pivot=(.5,.12),angle=0,motion='',phase=0,far=False):
 return dict(id=id,part=part,parent=parent,x=x,y=y,w=w,h=h,pivot=list(pivot),angle=angle,motion=motion,phase=phase,far=far)
def humanoid(winged=False):
 n=[]
 if winged:
  for far,side in [(True,-1),(False,1)]: n.append(node('wing'+str(side),'feather/outerWing','chest',-2,2,30,22,(.1,.15),25 if far else 12,'wing',side,far))
 for far,side in [(True,-1),(False,1)]:
  suf=str(side);hip= -2 if far else 2
  n.extend([node('thigh'+suf,'human/thigh','pelvis',hip,3,7,13,motion='leg',phase=side,far=far),node('shin'+suf,'human/shin','thigh'+suf,0,10,6,12,motion='knee',phase=side,far=far),node('foot'+suf,'human/foot','shin'+suf,1,9,9,5,(.3,.35),motion='foot',phase=side,far=far)])
 n += [node('pelvis','human/pelvis',None,0,-25,10,8,(.5,.5)),node('chest','human/chest','pelvis',0,-12,13,15,(.5,.15)),node('head','human/head','chest',1,0,9,11,(.5,.8),motion='head')]
 for far,side in [(True,-1),(False,1)]:
  s=str(side);n.extend([node('arm'+s,'human/upperArm','chest',(-4 if far else 4),1,6,11,motion='arm',phase=side,far=far),node('forearm'+s,'human/forearm','arm'+s,0,8,6,10,motion='elbow',phase=side,far=far),node('hand'+s,'human/hand','forearm'+s,1,8,5,5,(.5,.2),far=far)])
 return n
def quadruped(dragon=False):
 g='dragon' if dragon else 'quad';n=[]
 n += [node('pelvis',g+'/pelvis',None,-13,-25,20,19,(.5,.5)),node('chest',g+'/chest','pelvis',14,-1,24,21,(.5,.5)),node('neck',g+'/neck','chest',6,-3,14,20,(.45,.85),motion='head'),node('head',g+'/head','neck',1,-9,18,17,(.2,.7),motion='head'),node('tail',g+'/tail','pelvis',-5,-4,32,22,(.85,.12),motion='tail')]
 for far,side in [(True,-1),(False,1)]:
  for front in [False,True]:
   s=('front' if front else 'back')+str(side);phase=side*(1 if front else -1)
   n.extend([node(s,g+('/front' if front else '/back') if dragon else g+('/upperFront' if front else '/upperBack'),'chest' if front else 'pelvis',3 if far else -2,3,9,16,motion='leg',phase=phase,far=far),node(s+'lower',g+'/foot' if dragon else g+('/lowerFront' if front else '/lowerBack'),s,1,12,12,13,(.25,.12),motion='knee',phase=phase,far=far)])
 if dragon:
  for far,side in [(True,-1),(False,1)]: n.append(node('wing'+str(side),'dragon/wing','chest',-2,-7,45,28,(.85,.75),-12,'wing',side,far))
 return n
def bird():
 n=[node('body','bird/body',None,0,-24,24,20,(.5,.5)),node('head','bird/head','body',9,-5,13,13,(.25,.7),motion='head'),node('tail','bird/tail','body',-9,4,24,15,(.85,.2),25,'tail')]
 for far,s in [(True,-1),(False,1)]:
  suf=str(s);n.extend([node('thigh'+suf,'bird/thigh','body',s*4,5,6,12,motion='leg',phase=s,far=far),node('shin'+suf,'bird/shin','thigh'+suf,1,9,5,9,motion='knee',phase=s,far=far),node('foot'+suf,'bird/foot','shin'+suf,0,7,10,6,(.25,.3),far=far),node('wing'+suf,'bird/wing','body',-2,-4,30,25,(.1,.15),15,'wing',s,far)])
 return n
def arthropod(group,pairs,flight=False):
 spider=group=='spider';n=[]
 n.append(node('body',group+('/head' if spider else '/thorax'),None,2,-18,18,15,(.5,.5)))
 n.append(node('abdomen',group+'/abdomen','body',-16,-2,25,20,(.5,.5),motion='tail'))
 if not spider:n.append(node('head',group+'/head','body',12,-1,13,12,(.3,.5),motion='head'))
 n.append(node('mouth',group+'/mandible','body' if spider else 'head',10 if spider else 8,3,6,8,(.3,.3),motion='mouth'))
 if not spider:n.append(node('antenna',group+'/antenna','head',5,-4,12,8,(.05,.9),motion='antenna'))
 for far,side in [(True,-1),(False,1)]:
  for i in range(pairs):
   s=f'{side}-{i}';phase=1 if (i+(side==1))%2 else -1;x=-8+i*6+(2 if far else 0);spread=(i-(pairs-1)/2)*45
   n.extend([node('leg'+s,group+'/upperLeg','body',x,1 if far else 4,8,14,(.5,.12),spread,'insectLeg',phase,far),node('tip'+s,group+'/lowerLeg','leg'+s,0,10,8,16,(.2,.1),-spread*.5,'insectKnee',phase,far)])
 if flight:
  for far,side in [(True,-1),(False,1)]:
   for i in range(2):n.append(node(f'wing{side}-{i}',group+('/wing' if i==0 else '/hindWing'),'body',-3,-4,34 if i==0 else 26,12,(.05,.8),-145+i*30,'wing',side,far))
 return n
def snake():
 n=[node('s0','snake/segment',None,-18,-7,22,14,(.15,.5),motion='serpent',phase=0)]
 for i in range(1,5):n.append(node('s'+str(i),'snake/curve','s'+str(i-1),7,0,22,14,(.15,.5),motion='serpent',phase=i))
 n.extend([node('tail','snake/tail','s0',6,0,22,10,(.95,.5),motion='tail'),node('neck','snake/neck','s4',9,-2,11,17,(.5,.85),motion='head'),node('head','snake/head','neck',1,-8,16,11,(.25,.6),motion='head')]);return n
for key,name,nodes,flying in [('humanoid','Humanoide',humanoid(),False),('winged-humanoid','Humanoide alado',humanoid(True),True),('quadruped','Quadrúpede',quadruped(),False),('bird','Pássaro',bird(),True),('dragon','Dragão quadrúpede',quadruped(True),True),('arachnid','Aracnídeo',arthropod('spider',4),False),('serpent','Serpentino',snake(),False),('flying-insect','Insetoide voador',arthropod('fly',3,True),True),('ground-insect','Insetoide terrestre',arthropod('bug',3),False)]:
 # Stable painter order: far limbs, torso/tail, near limbs, head.
 rank=lambda n:0 if n['far'] else 1 if n['id'] in ['tail','abdomen'] else 2 if n['id'] in ['pelvis','chest','body','neck'] or n['id'].startswith('s') and n['id'][1:].isdigit() else 4 if n['id'] in ['head','mouth','antenna'] else 3
 rigs[key]={'name':name,'flying':flying,'nodes':sorted(nodes,key=rank)}
manifest={'version':1,'sizes':{'small':2/3,'medium':1,'large':1.5},'sizeLabels':{'small':'Pequeno','medium':'Médio','large':'Grande'},'referenceBodyHeight':48,'units':'logical pixels; positive y down; rotations degrees','assets':{k:{a:b for a,b in v.items() if a!='data'} for k,v in assets.items()},'rigs':rigs}
(ROOT/'rigs.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
(ROOT/'embedded.json').write_text(json.dumps({**manifest,'assets':assets},ensure_ascii=False,separators=(',',':')))
print(len(assets),'cropped pieces;',len(rigs),'rig families')

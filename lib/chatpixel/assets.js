import {groundArt,groundFor} from './grounds.js';
// Generated artwork is bundled in the APK: no image service or network is needed.
export const assetIds=['oak','pine','dead-tree','willow','snow-pine','giant-mushroom','bush','flower-bush','fern','mushrooms','moss-boulder','rocks','log','stump','ivy','crystals','stalagmites','stalactites','ruined-arch','column','altar','statue','dungeon-door','bridge','house','shop','city-gate','tavern','cottage','stable','closed-door','open-door','barred-door','fireplace','bookcase','alchemy-shelf','counter','table','chair','bench','barrel','crate','chest','anvil','street-lamp','torch','weapon-rack','banner'];
export function sceneryFamily(scene){return ['forest','camp','swamp'].includes(scene)?'forest':['village','market'].includes(scene)?'town':['dungeon','cave'].includes(scene)?'dungeon':null;}
export function assetFor(prop,scene){
 if(prop.asset&&assetIds.includes(prop.asset))return prop.asset;
 const aliases={tree:scene==='snow'?'snow-pine':scene==='swamp'?'willow':'oak',rock:'moss-boulder',gate:'city-gate',door:scene==='dungeon'?'barred-door':'closed-door',shop:prop.indoor?'counter':'shop',stall:'shop',books:'bookcase',grave:'statue'};
 return aliases[prop.type]??(assetIds.includes(prop.type)?prop.type:null);
}
export function createAssetStore({ImageClass=globalThis.Image,onLoad=()=>{}}={}){
 const images=new Map();let revision=0;
 const paths=new Map(assetIds.map((id,i)=>[id,`/pixel-assets/v1/${i<24?'nature':'town'}/${id}.png`]));
 for(const family of ['forest','town','dungeon'])for(const layer of ['01-background','02-distant','03-midground','04-foreground'])paths.set(`${family}/${layer}`,`/pixel-assets/parallax-v1/${family}/${layer}.png`);
 for(const id of Object.keys(groundArt))paths.set(`ground/${id}`,`/pixel-assets/grounds-v1/${id}.png`);
 function load(id){if(images.has(id))return images.get(id).promise;if(!ImageClass||!paths.has(id))return Promise.resolve(null);
  const entry={image:null,promise:null};images.set(id,entry);
  entry.promise=new Promise(resolve=>{const image=new ImageClass();image.onload=()=>{entry.image=image;revision++;onLoad();resolve(image);};image.onerror=()=>resolve(null);image.src=paths.get(id);});return entry.promise;
 }
 function get(id){load(id);return images.get(id)?.image??null;}
 return {get,get revision(){return revision;},preload(){return Promise.all([...paths.keys()].map(load));},
  drawGround(c,scene,layout={}){const id=groundFor(scene,layout),im=get(`ground/${id}`);if(!im)return false;
   const meta=groundArt[id],scale=Math.max(1280/meta.width,185/(meta.height-meta.walkY)),y=535-meta.walkY*scale;
   c.drawImage(im,0,Math.round(y),1280,Math.ceil(meta.height*scale));return true;
  },
  drawProp(c,prop,scene){const id=assetFor(prop,scene),im=get(id);if(!im)return false;
   const heights={oak:340,pine:340,'snow-pine':340,willow:340,'dead-tree':320,house:300,shop:270,tavern:300,cottage:270,stable:270,'city-gate':340,column:280,altar:140,table:110,counter:140,torch:115,bookcase:250,'moss-boulder':110,statue:220,chair:110,barrel:90,crate:85,chest:80,fern:70,bush:90,'flower-bush':90,mushrooms:65};
   const h=(heights[id]??170)*(prop.scale??1),w=h*im.width/im.height;
   c.drawImage(im,Math.round(prop.x-w/2),Math.round(prop.y-h),Math.round(w),Math.round(h));return true;
  },
  drawLayer(c,scene,layer){const family=sceneryFamily(scene);if(!family)return false;let drawn=false;
   const ids=layer===0?['01-background','02-distant']:layer===2?['03-midground','04-foreground']:[];
   for(const id of ids){const im=get(`${family}/${id}`);if(!im)continue;const h=id==='01-background'?535:id==='02-distant'?330:id==='03-midground'?330:85;const base=535;
    c.drawImage(im,0,base-h,1280,h);drawn=true;}
   return drawn;
  }
 };
}

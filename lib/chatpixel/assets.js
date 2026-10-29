import {interiorArt,interiorFor} from './interiors.js';
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
 for(const [room,variants] of Object.entries(interiorArt))for(const [wealth,parts] of Object.entries(variants))for(const part of ['background','floor'])paths.set(`interior/${room}/${wealth}/${part}`,`/pixel-assets/interiors-v1/${parts[part].file}`);
 function load(id){if(images.has(id))return images.get(id).promise;if(!ImageClass||!paths.has(id))return Promise.resolve(null);
  const entry={image:null,promise:null};images.set(id,entry);
  entry.promise=new Promise(resolve=>{const image=new ImageClass();image.onload=()=>{entry.image=image;revision++;onLoad();resolve(image);};image.onerror=()=>resolve(null);image.src=paths.get(id);});return entry.promise;
 }
 function get(id){load(id);return images.get(id)?.image??null;}
 return {get,get revision(){return revision;},preload(){return Promise.all([...paths.keys()].map(load));},
  drawGround(c,scene,layout={}){const interior=interiorFor(scene,layout),id=groundFor(scene,layout),im=get(interior?`interior/${interior.room}/${interior.wealth}/floor`:`ground/${id}`);if(!im)return false;
   const meta=interior?.floor??groundArt[id],scale=Math.max(1280/meta.width,185/(meta.height-meta.walkY)),y=535-meta.walkY*scale;
   c.drawImage(im,0,Math.round(y),1280,Math.ceil(meta.height*scale));return true;
  },
  drawProp(c,prop,scene){const id=assetFor(prop,scene),im=get(id);if(!im)return false;
   const heights={oak:520,pine:520,'snow-pine':520,willow:520,'dead-tree':480,'giant-mushroom':340,house:510,shop:460,tavern:510,cottage:460,stable:460,'city-gate':560,'closed-door':245,'open-door':245,'barred-door':260,'dungeon-door':260,'ruined-arch':330,column:390,altar:155,table:125,counter:155,torch:130,bookcase:300,'alchemy-shelf':280,'moss-boulder':150,rocks:185,statue:300,chair:140,bench:100,barrel:125,crate:110,chest:100,anvil:125,'street-lamp':310,'weapon-rack':230,banner:260,bridge:210,fern:90,bush:120,'flower-bush':120,mushrooms:75,log:130,stump:120,ivy:250,crystals:160,stalagmites:250,stalactites:250};
   const h=(heights[id]??170)*(prop.scale??1),w=h*im.width/im.height;
   c.drawImage(im,Math.round(prop.x-w/2),Math.round(prop.y-h),Math.round(w),Math.round(h));return true;
  },
  drawLayer(c,scene,layer,layout={}){const interior=interiorFor(scene,layout);if(interior){if(layer!==0)return false;const im=get(`interior/${interior.room}/${interior.wealth}/background`);if(!im)return false;const h=535,w=Math.max(1280,h*interior.background.width/interior.background.height);c.drawImage(im,Math.round((1280-w)/2),0,Math.round(w),h);return true;}const family=sceneryFamily(scene);if(!family)return false;let drawn=false;
   const ids=layer===0?['01-background','02-distant']:layer===2?['03-midground','04-foreground']:[];
   for(const id of ids){const im=get(`${family}/${id}`);if(!im)continue;const h=id==='01-background'?535:id==='02-distant'?380:id==='03-midground'?500:110;const base=535;
    const width=id==='03-midground'?Math.max(1280,Math.round(h*im.width/im.height)):1280;
    c.drawImage(im,Math.round((1280-width)/2),base-h,width,h);drawn=true;}
   return drawn;
  }
 };
}

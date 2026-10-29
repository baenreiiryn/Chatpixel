"use client";
import {useEffect,useRef,useState} from 'react';
import {createRenderer,type PixelRenderer} from '@/lib/chatpixel/renderer.js';
import {applyEvent,initialState,type PixelState} from '@/lib/chatpixel/engine.js';
import {travelIntent} from '@/lib/chatpixel/journey.js';
import type {PixelVisual} from '@/lib/chatpixelIntegration';

type Props={visual?:PixelVisual;busy:boolean;playerText:string;scene:string;playerName:string};
export default function ChatpixelScene({visual,busy,playerText,scene,playerName}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null),renderer=useRef<PixelRenderer|null>(null);
 const current=useRef<PixelState>(structuredClone(visual?.state??initialState()));
 const revision=useRef(visual?.revision??0),queue=useRef<Promise<void>>(Promise.resolve()),processing=useRef(false),epoch=useRef(0);
 const [error,setError]=useState('');
 useEffect(()=>{if(!canvas.current)return;const token=++epoch.current;current.current.player.name=playerName;renderer.current=createRenderer(canvas.current,()=>current.current,{onError:e=>{if(epoch.current===token)setError(e.message);}});return()=>{epoch.current++;renderer.current?.stop();renderer.current=null;};},[]);
 useEffect(()=>{current.current.player.name=playerName;},[playerName]);
 useEffect(()=>{
  if(!visual||visual.revision===revision.current)return;
  revision.current=visual.revision;const token=epoch.current;const frame=structuredClone(visual);
  queue.current=queue.current.catch(()=>{}).then(async()=>{if(epoch.current!==token||!renderer.current)return;const r=renderer.current;processing.current=true;setError('');current.current=frame.before;
   try{for(let i=0;i<frame.batch.length;i++){const raw=frame.batch[i];if(epoch.current!==token)return;const fromX=current.current.player.x,fromY=current.current.player.y;
    if(raw.type==='scene'){
     // Prepare static actors before revealing the destination, without serial spawn waits.
     const setup=[raw];while(i+1<frame.batch.length&&['spawn','equip'].includes(frame.batch[i+1].type))setup.push(frame.batch[++i]);
     await r.transition(raw,()=>{current.current=structuredClone(current.current);for(const event of setup)applyEvent(current.current,event);});
    }
    else{const event=applyEvent(current.current,raw);if(['attack','spawn','talk','move'].includes(event.type))await r.animate({...event,fromX,fromY});}
   }}catch(e){if(epoch.current===token)setError(e instanceof Error?e.message:'Não foi possível animar este turno.');}
   finally{if(epoch.current===token){current.current=frame.state;processing.current=false;r.cancelTravel();}}
  });
 },[visual]);
 useEffect(()=>{if(busy){const destination=travelIntent(playerText);if(destination)renderer.current?.beginTravel(destination);}else if(!processing.current)renderer.current?.cancelTravel();},[busy,playerText]);
 return <div className="sceneArt pixelScene" ref={container} data-testid="chatpixel-scene">
  <canvas ref={canvas} width={1280} height={720} role="img" aria-label={`Cena visual de ${scene}. ${visual?.state.npcs.map(n=>n.name).join(', ')||'Nenhum NPC confirmado.'}`}/>
  <div className="pixelSceneMeta"><span>CHATPIXEL · CHAT DA SESSÃO</span><button type="button" aria-label="Ampliar cena" onClick={()=>{void container.current?.requestFullscreen?.().catch(()=>setError('Tela cheia indisponível.'));}}>⛶</button></div>
  {busy&&<span className="pixelSceneStatus" role="status">O mestre está preparando a cena…</span>}
  {error&&<div className="pixelSceneError" role="status"><span>{error}</span><button type="button" onClick={()=>{renderer.current?.cancelPending();current.current=structuredClone(visual?.state??initialState());setError('');}}>Restaurar visual</button></div>}
 </div>;
}

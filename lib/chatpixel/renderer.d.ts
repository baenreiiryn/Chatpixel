import type {PixelState,PixelEvent} from './engine.js';
export type PixelRenderer={beginTravel(destination?:Record<string,unknown>):void;cancelTravel():void;cancelPending(error?:Error):void;getTravel():unknown;transition(destination:PixelEvent,commit:()=>void):Promise<void>;animate(event:PixelEvent):Promise<void>;stop():void};
export function createRenderer(canvas:HTMLCanvasElement,getState:()=>PixelState,options?:{onError?:(error:Error)=>void}):PixelRenderer;

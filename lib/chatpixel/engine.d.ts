export type PixelEvent = {type:string;target?:string;speaker?:string;message?:string;scene?:string;location?:string;carry?:string[];weapon?:string;[key:string]:unknown};
export type PixelNpc = {id:string;ref?:string;name:string;kind:string;x:number;y:number;hits:number;appearance?:Record<string,string>};
export type PixelState = {version:number;scene:string;location?:string|null;layout?:unknown;encounter?:number;player:{x:number;y:number;weapon:string|null;inventory:string[];name?:string;appearance?:Record<string,string>};npcs:PixelNpc[];selected:string|null;dialogue?:{target:string;speaker:string;message:string}|null;events:PixelEvent[];sequence:number};
export function initialState():PixelState;
export function validateEvent(event:PixelEvent):PixelEvent;
export function applyEvent(state:PixelState,event:PixelEvent):PixelEvent;
export function finalizeTurn(data:{narration:string;events:PixelEvent[];visibleNpcs:string[]}):{narration:string;events:PixelEvent[];visibleNpcs:string[]};

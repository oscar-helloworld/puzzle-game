import { create } from "zustand";
type SettingsState = { musicOn: boolean; sfxOn: boolean; setMusicOn:(on:boolean)=>void; setSfxOn:(on:boolean)=>void; };
const LS = { music:"calm-puzzle.musicOn", sfx:"calm-puzzle.sfxOn" };
const load = (k:string, d=true)=>{ try{const v=localStorage.getItem(k); return v==null?d:v==="1";}catch{return d;} };
const save = (k:string,v:boolean)=>{ try{localStorage.setItem(k, v?"1":"0");}catch{} };
export const useSettings = create<SettingsState>((set)=> ({
  musicOn: load(LS.music, true),
  sfxOn: load(LS.sfx, true),
  setMusicOn:(on)=>{ save(LS.music,on); set({musicOn:on}); },
  setSfxOn:(on)=>{ save(LS.sfx,on); set({sfxOn:on}); },
}));

import React from "react";
import ToggleButton from "@/components/ToggleButton";
import { useSettings } from "@/state/useSettings";
import { AudioManager } from "@/audio/AudioManager";
export default function Home({ onStart, audio }:{onStart:()=>void; audio: AudioManager}){
  const { musicOn, sfxOn, setMusicOn, setSfxOn } = useSettings();
  const [isStarting, setIsStarting] = React.useState(false);
  const unlock = async ()=>{ await audio.ensureStarted().catch(()=>{}); if(musicOn) await audio.playRandom().catch(()=>{}); else { audio.setMusicOn(false); audio.stopAll(); } };
  const start = async ()=>{ 
    setIsStarting(true); 
    await unlock(); 
    onStart(); 
  };
  const toggleMusic = async ()=>{ const next=!musicOn; setMusicOn(next); audio.setMusicOn(next); if(next) await audio.playRandom().catch(()=>{}); else audio.stopAll(); };
  const toggleSfx = ()=>{ const next=!sfxOn; setSfxOn(next); audio.setSfxOn(next); };
  return (<div className="card">
    <div style={{textAlign:"center"}}>
      <div className="title">治愈系拼图 Calm Puzzle</div>
      <div className="subtitle">轻松·无压力·陪你专注当下</div>
    </div>
    <div className="row" style={{justifyContent:"center"}}>
      <button onClick={start} disabled={isStarting}>
        {isStarting ? "启动中..." : "开始"}
      </button>
    </div>
    <div className="row" style={{justifyContent:"center"}}>
      <ToggleButton pressed={musicOn} onToggle={toggleMusic}>音乐</ToggleButton>
      <ToggleButton pressed={sfxOn} onToggle={toggleSfx}>音效</ToggleButton>
    </div>
    <p className="badge" style={{textAlign:"center"}}>提示：首次点击会解锁音频播放（iOS/Safari 限制）</p>
  </div>);
}

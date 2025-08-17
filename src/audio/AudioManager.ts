type AudioManifest = { bgm: string[]; sfx: { snap: string } };
export class AudioManager {
  private ctx: AudioContext | null = null;
  private gainA?: GainNode; private gainB?: GainNode;
  private srcA?: AudioBufferSourceNode; private srcB?: AudioBufferSourceNode;
  private activeA = true;
  private manifest: AudioManifest | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private sfxSnapBuffer: AudioBuffer | null = null;
  private musicOn = true; private sfxOn = true;
  private musicGain?: GainNode;
  private sfxGain?: GainNode;
  setMusicOn(on:boolean){ this.musicOn = on; if(!on) this.pauseMusic(); else this.resumeMusic(); }
  setSfxOn(on:boolean){ this.sfxOn = on; }
  pauseMusic(){ if(!this.musicGain) return; this.musicGain.gain.value = 0; }
  resumeMusic(){ if(!this.musicGain) return; this.musicGain.gain.value = 1; }
  async ensureStarted(){ if(!this.ctx){ this.ctx = new (window.AudioContext||(window as any).webkitAudioContext)(); await this.ctx.resume().catch(()=>{});
    const master=this.ctx.createGain(); master.connect(this.ctx.destination);
    
    // 创建音乐主增益控制
    this.musicGain=this.ctx.createGain(); this.musicGain.connect(master);
    this.musicGain.gain.value = this.musicOn ? 1 : 0;
    
    // 创建音效专用增益控制
    this.sfxGain=this.ctx.createGain(); this.sfxGain.connect(master);
    this.sfxGain.gain.value = 0.9;
    
    this.gainA=this.ctx.createGain(); this.gainB=this.ctx.createGain();
    this.gainA.connect(this.musicGain); this.gainB.connect(this.musicGain);
    this.gainA.gain.value=1; this.gainB.gain.value=0;
    await this.loadManifest();
    const snapUrl=this.manifest?.sfx.snap; if(snapUrl) this.sfxSnapBuffer=await this.loadBuffer(snapUrl).catch(()=>null);
  } else { await this.ctx.resume().catch(()=>{});} }
  private async loadManifest(){ if(this.manifest) return; const res=await fetch("/content/audio.json"); this.manifest=await res.json(); }
  private async loadBuffer(url:string){ if(!this.ctx) throw new Error("AudioContext not ready"); if(this.buffers.has(url)) return this.buffers.get(url)!;
    const res=await fetch(url); const arr=await res.arrayBuffer(); const buf=await this.ctx.decodeAudioData(arr); this.buffers.set(url, buf); return buf; }
  async playRandom(){ if(!this.musicOn) return; await this.ensureStarted(); const list=this.manifest?.bgm??[]; if(!list.length) return; return this.playUrl(list[Math.floor(Math.random()*list.length)]); }
  async playUrl(url:string){ if(!this.musicOn) return; await this.ensureStarted(); if(!this.ctx||!this.gainA||!this.gainB) return;
    const buf=await this.loadBuffer(url);
    const makeSrc=()=>{ const s=this.ctx!.createBufferSource(); s.buffer=buf; s.loop=true; return s; };
    if(this.activeA){ this.srcB?.stop(); this.srcB=makeSrc(); this.srcB.connect(this.gainB!);
      const now=this.ctx.currentTime; this.gainB!.gain.cancelScheduledValues(now); this.gainB!.gain.setValueAtTime(0,now); this.gainB!.gain.linearRampToValueAtTime(1, now+.35);
      this.gainA!.gain.cancelScheduledValues(now); this.gainA!.gain.setValueAtTime(this.gainA!.gain.value, now); this.gainA!.gain.linearRampToValueAtTime(0, now+.35); this.srcB.start();
    } else { this.srcA?.stop(); this.srcA=makeSrc(); this.srcA.connect(this.gainA!);
      const now=this.ctx.currentTime; this.gainA!.gain.cancelScheduledValues(now); this.gainA!.gain.setValueAtTime(0,now); this.gainA!.gain.linearRampToValueAtTime(1, now+.35);
      this.gainB!.gain.cancelScheduledValues(now); this.gainB!.gain.setValueAtTime(this.gainB!.gain.value, now); this.gainB!.gain.linearRampToValueAtTime(0, now+.35); this.srcA.start(); }
    this.activeA=!this.activeA;
  }
  stopAll(){ this.srcA?.stop(); this.srcB?.stop(); this.srcA=undefined; this.srcB=undefined; }
  playSfxSnap(){ 
    if(!this.sfxOn || !this.ctx || !this.sfxSnapBuffer || !this.sfxGain) return; 
    
    // 确保上下文处于运行状态（同步检查，避免延迟）
    if(this.ctx.state === 'suspended') {
      this.ctx.resume().catch(()=>{});
    }
    
    // 立即播放音效，使用预先创建的音效增益节点
    const src=this.ctx.createBufferSource(); 
    src.buffer=this.sfxSnapBuffer; 
    src.connect(this.sfxGain); 
    src.start(); 
  }
}

type AudioManifest = { bgm: string[]; sfx: { snap: string } };
export class AudioManager {
  private preloadedAudio = new Map<string, HTMLAudioElement>();
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
  private isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/.test(navigator.userAgent);
  private htmlAudioCurrently?: HTMLAudioElement; // iOS Safari的HTML Audio回退
  setMusicOn(on:boolean){ 
    this.musicOn = on; 
    console.log(`🎵 音乐开关设置为: ${on}, iOS Safari: ${this.isIOSSafari}`);
    if(!on) this.pauseMusic(); else this.resumeMusic(); 
  }
  setSfxOn(on:boolean){ this.sfxOn = on; }
  setPreloadedAudio(url: string, audio: HTMLAudioElement){ this.preloadedAudio.set(url, audio); }
  pauseMusic(){ 
    console.log(`⏸️ 暂停音乐, iOS Safari: ${this.isIOSSafari}, HTML Audio: ${!!this.htmlAudioCurrently}`);
    if(this.isIOSSafari && this.htmlAudioCurrently) {
      this.htmlAudioCurrently.pause();
      console.log(`⏸️ iOS Safari: HTML Audio已暂停`);
    } else if(this.musicGain) {
      this.musicGain.gain.value = 0; 
      console.log(`⏸️ Web Audio API: 音量设为0`);
    }
  }
  resumeMusic(){ 
    console.log(`▶️ 恢复音乐, musicOn: ${this.musicOn}, iOS Safari: ${this.isIOSSafari}, HTML Audio: ${!!this.htmlAudioCurrently}`);
    if(this.isIOSSafari && this.musicOn) {
      if(this.htmlAudioCurrently) {
        // 如果有当前音频，尝试播放
        this.htmlAudioCurrently.play().catch(err => {
          console.warn('⚠️ iOS Safari: 恢复音乐播放失败', err);
        });
        console.log(`▶️ iOS Safari: HTML Audio已恢复播放`);
      } else {
        // 如果没有当前音频，播放随机音乐
        console.log(`🎵 iOS Safari: 没有当前音频，播放随机音乐`);
        this.playRandom().catch(err => {
          console.warn('⚠️ iOS Safari: 播放随机音乐失败', err);
        });
      }
    } else if(this.musicGain && this.musicOn) {
      this.musicGain.gain.value = 1; 
      console.log(`▶️ Web Audio API: 音量恢复为1`);
    }
  }
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
  async playRandom(){ 
    if(!this.musicOn) return; 
    await this.ensureStarted(); 
    const list=this.manifest?.bgm??[]; 
    if(!list.length) return; 
    return this.playUrl(list[Math.floor(Math.random()*list.length)]); 
  }
  
  async playUrl(url:string){ 
    if(!this.musicOn) return; 
    await this.ensureStarted(); 
    
    // iOS Safari 使用 HTML Audio 回退
    if(this.isIOSSafari) {
      console.log('🍎 iOS Safari: 使用HTML Audio播放音乐');
      this.stopHtmlAudio(); // 停止当前播放
      
      // 优先使用预加载的音频
      let audio = this.preloadedAudio.get(url);
      if(!audio) {
        // 如果没有预加载，创建新的音频元素
        console.log('📱 创建新的HTML Audio元素:', url);
        audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.src = url.startsWith('/') ? url : '/' + url;
        audio.loop = true;
        this.preloadedAudio.set(url, audio);
      }
      
      this.htmlAudioCurrently = audio;
      audio.volume = this.musicOn ? 0.7 : 0;
      audio.currentTime = 0;
      
      if(this.musicOn) {
        try {
          await audio.play();
          console.log('✅ iOS Safari: 音频播放成功');
        } catch (error) {
          console.warn('⚠️ iOS Safari: 音频播放失败，可能需要用户交互', error);
        }
      } else {
        console.log('🔇 iOS Safari: 音乐已关闭，不播放音频');
      }
      return;
    }
    
    // 其他浏览器使用 Web Audio API
    if(!this.ctx||!this.gainA||!this.gainB) return;
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
  
  private stopHtmlAudio() {
    if(this.htmlAudioCurrently) {
      this.htmlAudioCurrently.pause();
      this.htmlAudioCurrently.currentTime = 0;
      this.htmlAudioCurrently = undefined;
    }
  }
  stopAll(){ 
    console.log(`⏹️ 停止所有音频, iOS Safari: ${this.isIOSSafari}`);
    this.srcA?.stop(); this.srcB?.stop(); this.srcA=undefined; this.srcB=undefined; 
    this.stopHtmlAudio(); // 也停止iOS Safari的HTML Audio
  }
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

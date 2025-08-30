import React from "react";
import ToggleButton from "@/components/ToggleButton";
import { useSettings } from "@/state/useSettings";
import { getRandomPhrase } from "@/utils/phrases";
import { AudioManager } from "@/audio/AudioManager";
import { PuzzleEngine } from "@/game/PuzzleEngine";
import { getCurrentPuzzleConfig, onOrientationChange, type ScreenOrientation } from "@/utils/screenUtils";
import type { ResourcePreloader } from "@/utils/ResourcePreloader";
type ImagesManifest = {[key: string]: string[]};
export default function Game({ onBack, audio, preloader }:{onBack:()=>void; audio: AudioManager; preloader: ResourcePreloader}){
  const { musicOn, sfxOn, setMusicOn, setSfxOn } = useSettings();
  const [images, setImages] = React.useState<ImagesManifest>({});
  const [currentImg, setCurrentImg] = React.useState<string | null>(null);
  const [showModal, setShowModal] = React.useState(false);
  const [phrase, setPhrase] = React.useState<string | null>(null);
  const [isChangingImage, setIsChangingImage] = React.useState(false);
  const [currentConfig, setCurrentConfig] = React.useState(getCurrentPuzzleConfig());
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const engineRef = React.useRef<PuzzleEngine | null>(null);
  const startTimeRef = React.useRef<number | null>(null);
  const musicInitializedRef = React.useRef<boolean>(false);
  React.useEffect(()=>{ 
    console.log("开始加载图片清单...");
    fetch("/content/images.json")
      .then(r=>{
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((manifest:ImagesManifest)=>{
        console.log(`图片清单加载成功:`, manifest);
        setImages(manifest);
      })
      .catch(err=>{
        console.error("图片清单加载失败:", err);
      });
  },[]);
  React.useEffect(()=>{ audio.setMusicOn(musicOn); },[musicOn]);
  React.useEffect(()=>{ audio.setSfxOn(sfxOn); },[sfxOn]);
  
  const loadRandomImage = React.useCallback(async ()=>{ 
    const currentImageList = images[currentConfig.imageFolder];
    if(!currentImageList || currentImageList.length === 0 || isChangingImage) return; 
    
    setIsChangingImage(true);
    
    // 确保选择不同的图片
    let newUrl;
    do {
      newUrl = currentImageList[Math.floor(Math.random()*currentImageList.length)];
    } while (newUrl === currentImg && currentImageList.length > 1);
    
    console.log(`切换图片: ${currentImg} -> ${newUrl} (方向: ${currentConfig.imageFolder})`);
    setCurrentImg(newUrl); 
  },[images, currentImg, isChangingImage, currentConfig.imageFolder]);

  // 监听屏幕方向变化
  React.useEffect(() => {
    const cleanup = onOrientationChange((orientation) => {
      const newConfig = getCurrentPuzzleConfig();
      console.log(`屏幕方向变化: ${orientation}, 新配置: ${newConfig.rows}x${newConfig.cols}, 图片文件夹: ${newConfig.imageFolder}`);
      setCurrentConfig(newConfig);
      
      // 更新拼图引擎配置
      if (engineRef.current) {
        engineRef.current.updateGridConfig(newConfig.rows, newConfig.cols);
      }
      
      // 重新加载适合新方向的图片
      setCurrentImg(null);
      setTimeout(() => loadRandomImage(), 100);
    });
    
    return cleanup;
  }, [loadRandomImage]);
  
  React.useEffect(()=>{ 
    if(!currentImg) return; 
    const canvas=canvasRef.current; 
    if(!canvas) return; 
    
    console.log(`🚀 快速启动拼图: ${currentImg}`);
    
    // 创建拼图引擎的函数
    const createPuzzleEngine = (img: HTMLImageElement) => {
      console.log(`✅ 创建拼图引擎: ${currentImg} (配置: ${currentConfig.rows}x${currentConfig.cols})`);
      engineRef.current?.unmount(); 
      const engine=new PuzzleEngine(canvas, img, {
        rows:currentConfig.rows, cols:currentConfig.cols,
        onSnap:()=>{ audio.playSfxSnap(); },
        onComplete: async ()=>{ 
          const end=performance.now(); 
          const used=(startTimeRef.current==null)?0:Math.round((end-(startTimeRef.current||0))/1000);
          const p=await getRandomPhrase(); 
          setPhrase(p); 
          setShowModal(true); 
        },
        onOrientationChange: (rows, cols) => {
          console.log(`拼图引擎网格配置已更新: ${rows}x${cols}`);
        }
      }); 
      engine.mount(); 
      engineRef.current=engine; 
      startTimeRef.current=performance.now(); 
      setIsChangingImage(false);
      musicInitializedRef.current = true;
    };

    // 首先尝试使用预加载的图片缓存
    const imgPath = currentImg.startsWith('/') ? currentImg : '/' + currentImg;
    const preloadedImg = preloader.getPreloadedImage(imgPath);
    
    if (preloadedImg && preloadedImg.complete) {
      console.log(`⚡ 使用预加载缓存，立即启动: ${currentImg}`);
      // 使用 setTimeout 确保 React 状态更新完成
      setTimeout(() => createPuzzleEngine(preloadedImg), 0);
      return;
    }
    
    // 如果缓存中没有或未完成加载，则重新加载（兜底方案）
    console.log(`📥 图片不在缓存中，重新加载: ${currentImg}`);
    const img = new Image(); 
    img.crossOrigin = "anonymous";
    
    img.onload = () => createPuzzleEngine(img);
    img.onerror = () => { 
      console.error(`图片加载失败: ${currentImg}`); 
      setIsChangingImage(false);
    };
    
    img.src = imgPath; 
  },[currentImg, audio, currentConfig.rows, currentConfig.cols, preloader]);
  
  React.useEffect(()=>{ 
    const currentImageList = images[currentConfig.imageFolder];
    if(currentImageList && currentImageList.length > 0 && !currentImg){ 
      console.log(`图片列表已加载，当前方向(${currentConfig.imageFolder})共 ${currentImageList.length} 张图片`);
      loadRandomImage(); 
    } 
  },[images, currentImg, loadRandomImage, currentConfig.imageFolder]);
  const toggleMusic=async()=> { 
    const newMusicOn = !musicOn;
    setMusicOn(newMusicOn); 
    audio.setMusicOn(newMusicOn); 
    if(newMusicOn) {
      // 当开启音乐时，如果没有音乐在播放，就播放随机音乐
      await audio.playRandom().catch(()=>{});
    } else {
      // 当关闭音乐时，停止所有音乐
      audio.stopAll();
    }
  };
  const toggleSfx=()=> setSfxOn(!sfxOn);
  const nextImage=async()=>{ setShowModal(false); await loadRandomImage(); };
  const nextTrack=async()=>{ await audio.playRandom().catch(()=>{}); };
  const closeModal=()=>{ setShowModal(false); };
  return (<div className="card" style={{display:"flex",flexDirection:"column",gap:8,padding:"12px"}}>
    <div className="topbar">
      <div className="row">
        <ToggleButton pressed={musicOn} onToggle={toggleMusic}>音乐</ToggleButton>
        <ToggleButton pressed={sfxOn} onToggle={toggleSfx}>音效</ToggleButton>
      </div>
      <div className="row">
        <button onClick={nextImage} disabled={isChangingImage}>
          {isChangingImage ? "加载中..." : "换一张"}
        </button>
        <button onClick={nextTrack}>换一曲</button>
      </div>
    </div>
    <div className="canvas-wrap"><canvas ref={canvasRef}/></div>
    {showModal && (<div className="modal-backdrop"><div className="modal">
      <h3>完成啦 🎉</h3><p>{phrase ?? "愿你被世界温柔以待。"}</p>
      <div className="footer-buttons" style={{marginTop:12}}><button onClick={closeModal}>继续</button></div>
    </div></div>)}
  </div>);
}

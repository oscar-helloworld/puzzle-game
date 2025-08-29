import React from "react";
import Home from "./screens/Home";
import Game from "./screens/Game";
import LoadingScreen from "./components/LoadingScreen";
import { useSettings } from "./state/useSettings";
import { AudioManager } from "./audio/AudioManager";
import { ResourcePreloader } from "./utils/ResourcePreloader";
import { getCurrentPuzzleConfig } from "./utils/screenUtils";
import type { PreloadProgress } from "./utils/ResourcePreloader";

type Screen = "loading" | "home" | "game";
const audio = new AudioManager();
const preloader = new ResourcePreloader();

export default function App() {
  const [screen, setScreen] = React.useState<Screen>("loading");
  const [loadingProgress, setLoadingProgress] = React.useState<PreloadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
    currentResource: ""
  });
  const { musicOn } = useSettings();

  // 预加载资源
  React.useEffect(() => {
    const startPreloading = async () => {
      try {
        // 获取资源列表
        const [imagesRes, audioRes] = await Promise.all([
          fetch("/content/images.json").then(r => r.json()),
          fetch("/content/audio.json").then(r => r.json())
        ]);

        const currentOrientation = getCurrentPuzzleConfig();
        const orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';

        // 开始智能预加载
        await preloader.smartPreload(
          orientation,
          imagesRes,
          audioRes.bgm,
          (progress) => {
            setLoadingProgress(progress);
          }
        );

        // 预加载完成，延迟500ms显示完成效果
        setTimeout(() => {
          setScreen("home");
        }, 500);

      } catch (error) {
        console.error("预加载失败:", error);
        // 即使预加载失败也要进入游戏
        setTimeout(() => {
          setScreen("home");
        }, 1000);
      }
    };

    startPreloading();
  }, []);

  React.useEffect(() => { 
    if (screen === "game" && musicOn) { 
      audio.ensureStarted().catch(()=>{}); 
    } 
  }, [screen, musicOn]);

  if (screen === "loading") {
    return (
      <div className="container">
        <LoadingScreen progress={loadingProgress} isVisible={true} />
      </div>
    );
  }

  return (
    <div className="container">
      {screen === "home" ? 
        <Home onStart={() => setScreen("game")} audio={audio} /> : 
        <Game onBack={() => setScreen("home")} audio={audio} />
      }
    </div>
  );
}

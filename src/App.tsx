import React from "react";
import Home from "./screens/Home";
import Game from "./screens/Game";
import { useSettings } from "./state/useSettings";
import { AudioManager } from "./audio/AudioManager";
type Screen = "home" | "game";
const audio = new AudioManager();
export default function App() {
  const [screen, setScreen] = React.useState<Screen>("home");
  const { musicOn } = useSettings();
  React.useEffect(() => { if (screen === "game" && musicOn) { audio.ensureStarted().catch(()=>{}); } }, [screen, musicOn]);
  return <div className="container">{screen==="home"?<Home onStart={()=>setScreen("game")} audio={audio}/>:<Game onBack={()=>setScreen("home")} audio={audio}/>}</div>;
}

import React from "react";
import type { PreloadProgress } from "@/utils/ResourcePreloader";

interface LoadingScreenProps {
  progress: PreloadProgress;
  isVisible: boolean;
}

export default function LoadingScreen({ progress, isVisible }: LoadingScreenProps) {
  if (!isVisible) return null;

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <h1>🧩</h1>
          <h2>治愈系拼图</h2>
        </div>
        
        <div className="loading-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          
          <div className="progress-text">
            <span>{Math.round(progress.percentage)}%</span>
            <span className="progress-detail">
              {progress.loaded} / {progress.total}
            </span>
          </div>
        </div>
        
        <div className="loading-tips">
          {progress.percentage < 30 && "正在加载图片资源..."}
          {progress.percentage >= 30 && progress.percentage < 70 && "正在加载音频文件..."}
          {progress.percentage >= 70 && progress.percentage < 100 && "即将完成..."}
          {progress.percentage >= 100 && "准备就绪！"}
        </div>
      </div>
    </div>
  );
}

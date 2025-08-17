/**
 * 屏幕方向类型
 */
export type ScreenOrientation = 'landscape' | 'portrait';

/**
 * 拼图配置
 */
export interface PuzzleConfig {
  rows: number;
  cols: number;
  imageFolder: string;
}

/**
 * 检测当前屏幕方向
 * @returns 'landscape' 表示横屏（宽屏），'portrait' 表示竖屏
 */
export function getScreenOrientation(): ScreenOrientation {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return width > height ? 'landscape' : 'portrait';
}

/**
 * 根据屏幕方向获取拼图配置
 * @param orientation 屏幕方向
 * @returns 拼图配置信息
 */
export function getPuzzleConfig(orientation: ScreenOrientation): PuzzleConfig {
  if (orientation === 'landscape') {
    // 横屏：6列5行，使用1920x1080图片
    return {
      rows: 5,
      cols: 6,
      imageFolder: '1920x1080'
    };
  } else {
    // 竖屏：5列6行，使用1440x1920图片
    return {
      rows: 6,
      cols: 5,
      imageFolder: '1440x1920'
    };
  }
}

/**
 * 获取当前拼图配置
 */
export function getCurrentPuzzleConfig(): PuzzleConfig {
  const orientation = getScreenOrientation();
  return getPuzzleConfig(orientation);
}

/**
 * 监听屏幕方向变化
 * @param callback 当屏幕方向变化时的回调函数
 * @returns 清理函数
 */
export function onOrientationChange(callback: (orientation: ScreenOrientation) => void): () => void {
  let currentOrientation = getScreenOrientation();
  
  const handleResize = () => {
    const newOrientation = getScreenOrientation();
    if (newOrientation !== currentOrientation) {
      currentOrientation = newOrientation;
      callback(newOrientation);
    }
  };
  
  window.addEventListener('resize', handleResize);
  
  // 返回清理函数
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}




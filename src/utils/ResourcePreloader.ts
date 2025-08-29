/**
 * 资源预加载管理器 - 智能预加载图片和音频文件
 */

export interface PreloadProgress {
  loaded: number;
  total: number;
  percentage: number;
  currentResource: string;
}

export class ResourcePreloader {
  private imageCache = new Map<string, HTMLImageElement>();
  private audioCache = new Map<string, HTMLAudioElement>();
  private loadedImages = new Set<string>();
  private loadedAudio = new Set<string>();
  
  /**
   * 预加载图片列表
   */
  async preloadImages(
    imageUrls: string[], 
    onProgress?: (progress: PreloadProgress) => void
  ): Promise<void> {
    const total = imageUrls.length;
    let loaded = 0;

    const loadPromises = imageUrls.map(async (url) => {
      if (this.loadedImages.has(url)) {
        loaded++;
        onProgress?.({ loaded, total, percentage: (loaded / total) * 100, currentResource: url });
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = () => {
          this.imageCache.set(url, img);
          this.loadedImages.add(url);
          loaded++;
          onProgress?.({ 
            loaded, 
            total, 
            percentage: (loaded / total) * 100, 
            currentResource: url 
          });
          resolve();
        };
        
        img.onerror = () => {
          console.warn(`图片预加载失败: ${url}`);
          loaded++;
          onProgress?.({ 
            loaded, 
            total, 
            percentage: (loaded / total) * 100, 
            currentResource: url 
          });
          resolve(); // 即使失败也继续，不阻塞其他资源
        };
        
        img.src = url.startsWith('/') ? url : '/' + url;
      });
    });

    await Promise.all(loadPromises);
  }

  /**
   * 预加载音频列表
   */
  async preloadAudio(
    audioUrls: string[], 
    onProgress?: (progress: PreloadProgress) => void
  ): Promise<void> {
    const total = audioUrls.length;
    let loaded = 0;

    const loadPromises = audioUrls.map(async (url) => {
      if (this.loadedAudio.has(url)) {
        loaded++;
        onProgress?.({ loaded, total, percentage: (loaded / total) * 100, currentResource: url });
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.preload = "auto";
        
        audio.oncanplaythrough = () => {
          this.audioCache.set(url, audio);
          this.loadedAudio.add(url);
          loaded++;
          onProgress?.({ 
            loaded, 
            total, 
            percentage: (loaded / total) * 100, 
            currentResource: url 
          });
          resolve();
        };
        
        audio.onerror = () => {
          console.warn(`音频预加载失败: ${url}`);
          loaded++;
          onProgress?.({ 
            loaded, 
            total, 
            percentage: (loaded / total) * 100, 
            currentResource: url 
          });
          resolve(); // 即使失败也继续
        };
        
        audio.src = url.startsWith('/') ? url : '/' + url;
      });
    });

    await Promise.all(loadPromises);
  }

  /**
   * 智能预加载策略：优先加载当前方向的图片，然后加载其他资源
   */
  async smartPreload(
    currentOrientation: 'landscape' | 'portrait',
    images: { [key: string]: string[] },
    audioUrls: string[],
    onProgress?: (progress: PreloadProgress) => void
  ): Promise<void> {
    const currentImageFolder = currentOrientation === 'landscape' ? '1920x1080' : '1440x1920';
    const otherImageFolder = currentOrientation === 'landscape' ? '1440x1920' : '1920x1080';
    
    const currentImages = images[currentImageFolder] || [];
    const otherImages = images[otherImageFolder] || [];
    
    // 第一阶段：快速加载当前方向的前5张图片
    const priorityImages = currentImages.slice(0, 5);
    const remainingCurrentImages = currentImages.slice(5);
    
    const totalResources = currentImages.length + otherImages.length + audioUrls.length;
    let globalLoaded = 0;
    
    const updateGlobalProgress = (localProgress: PreloadProgress, phase: string) => {
      const phaseLoaded = localProgress.loaded;
      onProgress?.({
        loaded: globalLoaded + phaseLoaded,
        total: totalResources,
        percentage: ((globalLoaded + phaseLoaded) / totalResources) * 100,
        currentResource: `${phase}: ${localProgress.currentResource}`
      });
    };

    try {
      // 阶段1：优先加载当前方向的前5张图片（快速启动）
      console.log('🚀 开始预加载优先图片...');
      await this.preloadImages(priorityImages, (progress) => {
        updateGlobalProgress(progress, '优先图片');
      });
      globalLoaded += priorityImages.length;

      // 阶段2：并行加载音频和剩余图片
      console.log('🎵 开始并行加载音频和图片...');
      const [audioPromise, remainingImagesPromise, otherImagesPromise] = [
        this.preloadAudio(audioUrls, (progress) => {
          updateGlobalProgress(progress, '音频');
        }),
        this.preloadImages(remainingCurrentImages, (progress) => {
          updateGlobalProgress(progress, '当前图片');
        }),
        this.preloadImages(otherImages, (progress) => {
          updateGlobalProgress(progress, '其他图片');
        })
      ];

      await Promise.all([audioPromise, remainingImagesPromise, otherImagesPromise]);
      
      console.log('✅ 所有资源预加载完成！');
      
    } catch (error) {
      console.error('预加载过程中发生错误:', error);
    }
  }

  /**
   * 获取预加载的图片
   */
  getPreloadedImage(url: string): HTMLImageElement | null {
    return this.imageCache.get(url) || null;
  }

  /**
   * 获取预加载的音频
   */
  getPreloadedAudio(url: string): HTMLAudioElement | null {
    return this.audioCache.get(url) || null;
  }

  /**
   * 检查资源是否已加载
   */
  isImageLoaded(url: string): boolean {
    return this.loadedImages.has(url);
  }

  isAudioLoaded(url: string): boolean {
    return this.loadedAudio.has(url);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      imagesLoaded: this.loadedImages.size,
      audioLoaded: this.loadedAudio.size,
      totalCacheSize: this.imageCache.size + this.audioCache.size
    };
  }

  /**
   * 清理缓存（释放内存）
   */
  clearCache() {
    this.imageCache.clear();
    this.audioCache.clear();
    this.loadedImages.clear();
    this.loadedAudio.clear();
  }
}

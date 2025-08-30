type Tile={row:number;col:number;x:number;y:number;w:number;h:number;targetX:number;targetY:number;snapped:boolean;};
type Options={rows?:number;cols?:number;snapThreshold?:number;onComplete?:()=>void;onSnap?:()=>void;onOrientationChange?:(rows:number,cols:number)=>void;};

// 检测屏幕方向的简单函数
function getScreenOrientation(): 'landscape' | 'portrait' {
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}
export class PuzzleEngine{
  private canvas:HTMLCanvasElement; private ctx:CanvasRenderingContext2D; private img:HTMLImageElement;
  private options:Required<Options>; private tiles:Tile[]=[];
  private dragging:{tile:Tile;offsetX:number;offsetY:number}|null=null; private raf=0;
  private deviceScale=Math.max(1, Math.floor(window.devicePixelRatio||1));
  private puzzleRect={x:0,y:0,w:0,h:0}; private poolRect={x:0,y:0,w:0,h:0};
  private _showGrid=true; // 控制是否显示网格
  
  private get showGrid() { return this._showGrid; }
  private set showGrid(value: boolean) {
    if (this._showGrid !== value) {
      console.log(`🔄 showGrid 状态变化: ${this._showGrid} -> ${value}`);
      this._showGrid = value;
    }
  }
  constructor(canvas:HTMLCanvasElement,img:HTMLImageElement,opts?:Options){
    this.canvas=canvas; const ctx=canvas.getContext("2d"); if(!ctx) throw new Error("Canvas 2D not supported"); this.ctx=ctx; this.img=img;
    this.options={ rows:opts?.rows??5, cols:opts?.cols??6, snapThreshold:opts?.snapThreshold??18, onComplete:opts?.onComplete??(()=>{}), onSnap:opts?.onSnap??(()=>{}), onOrientationChange:opts?.onOrientationChange??(()=>{}) };
    this.handleResize=this.handleResize.bind(this); 
    this.onPointerDown=this.onPointerDown.bind(this); this.onPointerMove=this.onPointerMove.bind(this); this.onPointerUp=this.onPointerUp.bind(this);
    this.onTouchStart=this.onTouchStart.bind(this); this.onTouchMove=this.onTouchMove.bind(this); this.onTouchEnd=this.onTouchEnd.bind(this);
  }
  mount(){ 
    window.addEventListener("resize", this.handleResize); 
    
    // 同时注册 Pointer Events 和 Touch Events，让浏览器自己决定使用哪个
    // 现代浏览器会优先使用 Pointer Events，微信浏览器会回退到 Touch Events
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove); 
    window.addEventListener("pointerup", this.onPointerUp);
    
    // Touch Events 作为兼容性回退（微信浏览器等）
    this.canvas.addEventListener("touchstart", this.onTouchStart as any, { passive: false });
    (window as any).addEventListener("touchmove", this.onTouchMove, { passive: false }); 
    (window as any).addEventListener("touchend", this.onTouchEnd, { passive: false });
    
    this.handleResize(); this.layout(); this.loop(); 
  }
  unmount(){ 
    cancelAnimationFrame(this.raf); 
    window.removeEventListener("resize", this.handleResize);
    
    // 移除所有事件监听器
    this.canvas.removeEventListener("pointerdown", this.onPointerDown); 
    window.removeEventListener("pointermove", this.onPointerMove); 
    window.removeEventListener("pointerup", this.onPointerUp);
    
    this.canvas.removeEventListener("touchstart", this.onTouchStart as any); 
    (window as any).removeEventListener("touchmove", this.onTouchMove); 
    (window as any).removeEventListener("touchend", this.onTouchEnd);
  }
  updateGridConfig(rows: number, cols: number){ 
    if(this.options.rows === rows && this.options.cols === cols) return;
    this.options.rows = rows; this.options.cols = cols; 
    this.tiles = []; this.dragging = null; 
    this.showGrid = true; // 切换屏幕方向时重新显示网格
    this.layout(); // 重新布局会考虑新的屏幕方向
    console.log(`拼图网格已更新为 ${rows}行 ${cols}列`);
    this.options.onOrientationChange(rows, cols);
  }
  private handleResize(){ const rect=this.canvas.getBoundingClientRect(); this.canvas.width=Math.floor(rect.width*this.deviceScale); this.canvas.height=Math.floor(rect.height*this.deviceScale);
    this.ctx.setTransform(this.deviceScale,0,0,this.deviceScale,0,0); this.layout(); }
  private layout(){ 
    const W=this.canvas.width/this.deviceScale; 
    const H=this.canvas.height/this.deviceScale;
    
    const orientation = getScreenOrientation();
    
    if (orientation === 'portrait') {
      // 竖屏模式：最大化拼图区域，保持图片比例
      const topSpace=0; // 竖屏模式下紧贴顶部按钮区域
      
      // 强制使用98%的宽度
      const pw=Math.floor(W*0.98); 
      const imgRatio=this.img.naturalWidth/this.img.naturalHeight; 
      
      // 严格按图片比例计算高度
      const ph=Math.floor(pw/imgRatio);
      const px=Math.floor((W-pw)/2);
      
      this.puzzleRect={x:px,y:topSpace,w:pw,h:ph};
    } else {
      // 横屏模式：保持原来的逻辑
      const topSpace=60;
      const bottomSpace=120;
      const usableH=H-topSpace-bottomSpace;
      
      const pw=Math.floor(W*0.8); 
      const imgRatio=this.img.naturalWidth/this.img.naturalHeight; 
      let ph=Math.floor(pw/imgRatio);
      
      if(ph>usableH){ 
        ph=usableH; 
        const newPw=Math.floor(ph*imgRatio);
        const px=Math.floor((W-newPw)/2);
        this.puzzleRect={x:px,y:topSpace,w:newPw,h:ph};
      } else {
        const px=Math.floor((W-pw)/2);
        this.puzzleRect={x:px,y:topSpace,w:pw,h:ph};
      }
    }
    
    // 拼图池区域在底部，根据屏幕方向调整
    if (orientation === 'portrait') {
      // 竖屏模式：拼图池在拼图区域底部，使用固定高度
      const poolGap = 6;
      const poolMargin = 2;
      const poolY = this.puzzleRect.y + this.puzzleRect.h + poolGap;
      const poolH = Math.min(80, Math.max(50, H - poolY - 10)); // 高度在50-80px之间
      this.poolRect = {x: poolMargin, y: poolY, w: W - poolMargin * 2, h: poolH};
    } else {
      // 横屏模式：保持原有逻辑
      const poolGap = 12;
      const poolMargin = 8;
      const poolY = this.puzzleRect.y + this.puzzleRect.h + poolGap;
      const poolH = H - poolY - poolMargin;
      this.poolRect = {x: poolMargin, y: poolY, w: W - poolMargin * 2, h: poolH};
    } 
    
    if(this.tiles.length===0) this.buildTiles(); 
  }
  private buildTiles(){ 
    this.showGrid = true; // 开始新游戏时显示网格
    const {rows, cols}=this.options; const cellW=this.puzzleRect.w/cols; const cellH=this.puzzleRect.h/rows; const rand=(a:number,b:number)=>a+Math.random()*(b-a);
    this.tiles=[]; for(let r=0;r<rows;r++){ for(let c=0;c<cols;c++){ const targetX=Math.floor(this.puzzleRect.x+c*cellW); const targetY=Math.floor(this.puzzleRect.y+r*cellH);
      const w=Math.ceil(cellW); const h=Math.ceil(cellH); const x=Math.floor(rand(this.poolRect.x, this.poolRect.x+this.poolRect.w-w)); const y=Math.floor(rand(this.poolRect.y, this.poolRect.y+this.poolRect.h-h));
      this.tiles.push({row:r,col:c,x,y,w,h,targetX,targetY,snapped:false}); } } this.tiles.sort(()=>Math.random()-0.5); 
  }
  private loop=()=>{ this.raf=requestAnimationFrame(this.loop); this.render(); };
  private render(){ const {ctx}=this; const W=this.canvas.width/this.deviceScale; const H=this.canvas.height/this.deviceScale; ctx.clearRect(0,0,W,H);
    
    // 绘制拼图区域背景 - 使用更明显的颜色和边框
    ctx.save(); 
    ctx.shadowColor="rgba(0,0,0,0.4)"; ctx.shadowBlur=14; 
    ctx.fillStyle="#1e293b"; // 更明显的背景色
    ctx.fillRect(this.puzzleRect.x,this.puzzleRect.y,this.puzzleRect.w,this.puzzleRect.h); 
    
    // 只在显示网格时添加明显的边框
    if(this.showGrid) {
      ctx.strokeStyle="#38bdf8"; // 蓝色边框
      ctx.lineWidth=2;
      ctx.strokeRect(this.puzzleRect.x,this.puzzleRect.y,this.puzzleRect.w,this.puzzleRect.h);
    }
    ctx.restore();
    
    // 绘制网格线显示每个拼图块的目标位置（只在游戏进行中显示）
    if(this.showGrid) {
      this.drawGrid();
    }
    
    for(let i=0;i<this.tiles.length;i++){ this.drawTile(this.tiles[i]); } }
  private drawGrid(){ const {ctx}=this; const {rows, cols}=this.options;
    const cellW=this.puzzleRect.w/cols; const cellH=this.puzzleRect.h/rows;
    ctx.save(); ctx.strokeStyle="rgba(56, 189, 248, 0.3)"; ctx.lineWidth=1;
    // 绘制垂直线
    for(let c=1;c<cols;c++){ const x=this.puzzleRect.x+c*cellW; ctx.beginPath(); ctx.moveTo(x,this.puzzleRect.y); ctx.lineTo(x,this.puzzleRect.y+this.puzzleRect.h); ctx.stroke(); }
    // 绘制水平线
    for(let r=1;r<rows;r++){ const y=this.puzzleRect.y+r*cellH; ctx.beginPath(); ctx.moveTo(this.puzzleRect.x,y); ctx.lineTo(this.puzzleRect.x+this.puzzleRect.w,y); ctx.stroke(); }
    ctx.restore(); }
  private drawTile(t:Tile){ const {ctx}=this; const sx=Math.floor((t.col*this.img.naturalWidth)/this.options.cols); const sy=Math.floor((t.row*this.img.naturalHeight)/this.options.rows);
    const sw=Math.ceil(this.img.naturalWidth/this.options.cols); const sh=Math.ceil(this.img.naturalHeight/this.options.rows);
    ctx.save(); ctx.beginPath(); (ctx as any).roundRect?.(t.x,t.y,t.w,t.h,8); ctx.clip(); ctx.drawImage(this.img, sx, sy, sw, sh, t.x, t.y, t.w, t.h); ctx.restore();
    
    // 只在显示网格时绘制拼图块边框
    if(this.showGrid) {
      ctx.save(); ctx.globalAlpha=.2; ctx.strokeStyle="#000"; ctx.lineWidth=1; ctx.strokeRect(t.x+.5, t.y+.5, t.w-1, t.h-1); ctx.restore();
    }
    
    if(t.snapped){ ctx.save(); ctx.globalAlpha=.06; ctx.fillStyle="#fff"; ctx.fillRect(t.x,t.y,t.w,t.h); ctx.restore(); }
    
    // 如果正在拖拽这个块，显示目标位置的轮廓（但不显示距离信息）
    if(this.dragging && this.dragging.tile === t){
      const dx=t.x-t.targetX; const dy=t.y-t.targetY; const dist=Math.hypot(dx,dy);
      // 绘制目标位置的轮廓
      ctx.save(); ctx.strokeStyle=dist<this.options.snapThreshold?"#10b981":"#ef4444"; ctx.lineWidth=2; ctx.setLineDash([5,5]);
      ctx.strokeRect(t.targetX,t.targetY,t.w,t.h); ctx.restore();
    } }
  private pickTile(px:number,py:number){ for(let i=this.tiles.length-1;i>=0;i--){ const t=this.tiles[i]; if(t.snapped) continue; if(px>=t.x && px<=t.x+t.w && py>=t.y && py<=t.y+t.h) return t; } return null; }
  private onPointerDown(ev:PointerEvent){ const rect=this.canvas.getBoundingClientRect(); const px=(ev.clientX-rect.left); const py=(ev.clientY-rect.top);
    const t=this.pickTile(px,py); if(!t) return; this.canvas.setPointerCapture(ev.pointerId); const idx=this.tiles.indexOf(t); if(idx>=0){ this.tiles.splice(idx,1); this.tiles.push(t); }
    this.dragging={tile:t,offsetX:px-t.x,offsetY:py-t.y}; }
  private onPointerMove(ev:PointerEvent){ if(!this.dragging) return; const rect=this.canvas.getBoundingClientRect(); const px=(ev.clientX-rect.left); const py=(ev.clientY-rect.top);
    const {tile,offsetX,offsetY}=this.dragging; tile.x=Math.round(px-offsetX); tile.y=Math.round(py-offsetY); }
  private onPointerUp(ev:PointerEvent){ if(!this.dragging) return; const {tile}=this.dragging; this.dragging=null;
    const dx=tile.x-tile.targetX; const dy=tile.y-tile.targetY; const dist=Math.hypot(dx,dy); 
    console.log(`拼图块 [${tile.row},${tile.col}] 距离目标位置: ${Math.round(dist)}px (阈值: ${this.options.snapThreshold}px)`);
    if(dist<this.options.snapThreshold){ 
      tile.x=tile.targetX; tile.y=tile.targetY; tile.snapped=true; 
      console.log(`拼图块 [${tile.row},${tile.col}] 吸附成功！`);
      this.options.onSnap();
      if(this.tiles.every(t=>t.snapped)) { 
        console.log("🎉 拼图完成！隐藏网格线");
        this.showGrid = false; // 完成拼图后隐藏网格
        this.options.onComplete(); 
      } 
    } else {
      console.log(`拼图块 [${tile.row},${tile.col}] 距离太远，未吸附`);
    } }
  
  // Touch Events 回退方案（微信浏览器兼容性）
  private onTouchStart(ev: TouchEvent) {
    ev.preventDefault(); // 阻止默认的滚动行为
    const touch = ev.touches[0];
    if (!touch) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const px = touch.clientX - rect.left;
    const py = touch.clientY - rect.top;
    
    const t = this.pickTile(px, py);
    if (!t) return;
    
    const idx = this.tiles.indexOf(t);
    if (idx >= 0) {
      this.tiles.splice(idx, 1);
      this.tiles.push(t);
    }
    
    this.dragging = { tile: t, offsetX: px - t.x, offsetY: py - t.y };
  }
  
  private onTouchMove(ev: TouchEvent) {
    if (!this.dragging) return;
    ev.preventDefault();
    
    const touch = ev.touches[0];
    if (!touch) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const px = touch.clientX - rect.left;
    const py = touch.clientY - rect.top;
    
    const { tile, offsetX, offsetY } = this.dragging;
    tile.x = Math.round(px - offsetX);
    tile.y = Math.round(py - offsetY);
  }
  
  private onTouchEnd(ev: TouchEvent) {
    if (!this.dragging) return;
    ev.preventDefault();
    
    const { tile } = this.dragging;
    this.dragging = null;
    
    const dx = tile.x - tile.targetX;
    const dy = tile.y - tile.targetY;
    const dist = Math.hypot(dx, dy);
    
    console.log(`拼图块 [${tile.row},${tile.col}] 距离目标位置: ${Math.round(dist)}px (阈值: ${this.options.snapThreshold}px)`);
    
    if (dist < this.options.snapThreshold) {
      tile.x = tile.targetX;
      tile.y = tile.targetY;
      tile.snapped = true;
      console.log(`拼图块 [${tile.row},${tile.col}] 吸附成功！`);
      this.options.onSnap();
      
      if (this.tiles.every(t => t.snapped)) {
        console.log("🎉 拼图完成！隐藏网格线");
        this.showGrid = false;
        this.options.onComplete();
      }
    } else {
      console.log(`拼图块 [${tile.row},${tile.col}] 距离太远，未吸附`);
    }
  }
}

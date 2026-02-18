'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { TILE_SIZE } from '@/lib/game/map';
import { drawTile } from '@/lib/game/renderer';
import type { MapData } from '@/lib/game/types';

const TILE_TYPES = [
  { id: 0, name: 'Grass', color: '#95d5b2' },
  { id: 1, name: 'Tree', color: '#3a5a40' },
  { id: 23, name: 'BigTree', color: '#2d5a30' },
  { id: 2, name: 'Water', color: '#48cae4' },
  { id: 4, name: 'Path', color: '#e6ccb2' },
  { id: 7, name: 'Flower', color: '#ffc6ff' },
  { id: 8, name: 'Rock', color: '#6c757d' },
  { id: 11, name: 'Bush', color: '#40916c' },
  { id: 12, name: 'TallGrass', color: '#52b788' },
  { id: 13, name: 'Sand', color: '#faedcd' },
  { id: 14, name: 'Dirt', color: '#6f4e37' },
  { id: 15, name: 'Road', color: '#555555' },
  { id: 16, name: 'Building', color: '#b0b0b0' },
  { id: 22, name: 'BuildingDk', color: '#909090' },
  { id: 17, name: 'Sidewalk', color: '#d0ccc4' },
  { id: 18, name: 'Parking', color: '#707070' },
  { id: 19, name: 'Plaza', color: '#c4b8a8' },
  { id: 20, name: 'Hedge', color: '#2d6a4f' },
  { id: 21, name: 'SportField', color: '#4caf50' },
  { id: 3, name: 'Floor', color: '#ddb892' },
  { id: 5, name: 'Door', color: '#b08968' },
  { id: 6, name: 'Carpet', color: '#d62828' },
  { id: 9, name: 'HouseWall', color: '#fefae0' },
  { id: 10, name: 'Roof', color: '#d62828' },
];

const TILE_COLOR_MAP: Record<number, string> = {};
for (const t of TILE_TYPES) TILE_COLOR_MAP[t.id] = t.color;

function createEmptyTiles(cols: number, rows: number, fill = 0): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(fill));
}

export default function MapBuilderPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const tilesRef = useRef<number[][]>(createEmptyTiles(264, 200));
  const dirtyTiles = useRef<Set<string>>(new Set());
  const needsFullRedraw = useRef(true);
  const rafId = useRef(0);

  const MAX_UNDO = 200;
  type StrokeDiff = Map<string, number>; // "x,y" -> old tile value
  const undoStack = useRef<StrokeDiff[]>([]);
  const redoStack = useRef<StrokeDiff[]>([]);
  const currentStroke = useRef<StrokeDiff | null>(null);

  const [cols, setCols] = useState(264);
  const [rows, setRows] = useState(200);
  const [selectedTile, setSelectedTile] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showBackground, setShowBackground] = useState(true);
  const [bgOpacity, setBgOpacity] = useState(0.5);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [useRenderedPreview, setUseRenderedPreview] = useState(true);
  const [brushSize, setBrushSize] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [tileOpacity, setTileOpacity] = useState(0.7);
  const isPanningRef = useRef(false);
  const isPaintingRef = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const [mapTheme, setMapTheme] = useState<'outdoor' | 'indoor' | 'dungeon' | 'cave'>('outdoor');
  const [mapId, setMapId] = useState('custom_map');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [colsInput, setColsInput] = useState('264');
  const [rowsInput, setRowsInput] = useState('200');

  // Keep refs in sync for event handlers that read latest values
  const selectedTileRef = useRef(selectedTile);
  const brushSizeRef = useRef(brushSize);
  const colsRef = useRef(cols);
  const rowsRef = useRef(rows);
  const showGridRef = useRef(showGrid);
  const showBackgroundRef = useRef(showBackground);
  const tileOpacityRef = useRef(tileOpacity);
  const useRenderedRef = useRef(useRenderedPreview);
  useEffect(() => { selectedTileRef.current = selectedTile; }, [selectedTile]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { colsRef.current = cols; }, [cols]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { showGridRef.current = showGrid; }, [showGrid]);
  useEffect(() => { showBackgroundRef.current = showBackground; }, [showBackground]);
  useEffect(() => { tileOpacityRef.current = tileOpacity; }, [tileOpacity]);
  useEffect(() => { useRenderedRef.current = useRenderedPreview; }, [useRenderedPreview]);

  const zoomRef = useRef(zoom);
  const panRef = useRef(panOffset);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = panOffset; }, [panOffset]);

  const bgSrcRef = useRef('/base_map_1.png');
  useEffect(() => {
    const img = new window.Image();
    img.src = bgSrcRef.current;
    img.onload = () => setBgLoaded(true);
  }, []);

  // Prevent browser-level pinch zoom
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener('touchmove', preventZoom, { passive: false });
    document.addEventListener('gesturestart', preventGesture);
    document.addEventListener('gesturechange', preventGesture);
    document.addEventListener('gestureend', preventGesture);
    return () => {
      document.removeEventListener('touchmove', preventZoom);
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
    };
  }, []);

  // Native wheel handler
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const oldZoom = zoomRef.current;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.05, Math.min(10, oldZoom * factor));
      const scale = newZoom / oldZoom;
      setZoom(newZoom);
      setPanOffset({ x: mouseX - scale * (mouseX - panRef.current.x), y: mouseY - scale * (mouseY - panRef.current.y) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Touch pinch-to-zoom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let lastDist = 0;
    let lastCenter = { x: 0, y: 0 };
    const d = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const c = (a: Touch, b: Touch) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
    const onStart = (e: TouchEvent) => { if (e.touches.length === 2) { e.preventDefault(); lastDist = d(e.touches[0], e.touches[1]); lastCenter = c(e.touches[0], e.touches[1]); } };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const nd = d(e.touches[0], e.touches[1]);
      const nc = c(e.touches[0], e.touches[1]);
      const rect = el.getBoundingClientRect();
      const dx = nc.x - lastCenter.x;
      const dy = nc.y - lastCenter.y;
      const sf = nd / lastDist;
      const oz = zoomRef.current;
      const nz = Math.max(0.05, Math.min(10, oz * sf));
      const mx = nc.x - rect.left;
      const my = nc.y - rect.top;
      const zs = nz / oz;
      setZoom(nz);
      setPanOffset({ x: mx - zs * (mx - panRef.current.x) + dx, y: my - zs * (my - panRef.current.y) + dy });
      lastDist = nd;
      lastCenter = nc;
    };
    const onEnd = () => { lastDist = 0; };
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); };
  }, []);

  // Rebuild grid overlay canvas when dimensions or grid toggle change
  useEffect(() => {
    const pw = cols * TILE_SIZE;
    const ph = rows * TILE_SIZE;
    if (showGrid) {
      const gc = document.createElement('canvas');
      gc.width = pw;
      gc.height = ph;
      const gctx = gc.getContext('2d')!;
      gctx.strokeStyle = 'rgba(255,255,255,0.2)';
      gctx.lineWidth = 0.5;
      for (let x = 0; x <= cols; x++) { gctx.beginPath(); gctx.moveTo(x * TILE_SIZE, 0); gctx.lineTo(x * TILE_SIZE, ph); gctx.stroke(); }
      for (let y = 0; y <= rows; y++) { gctx.beginPath(); gctx.moveTo(0, y * TILE_SIZE); gctx.lineTo(pw, y * TILE_SIZE); gctx.stroke(); }
      gridCanvasRef.current = gc;
    } else {
      gridCanvasRef.current = null;
    }
    needsFullRedraw.current = true;
  }, [cols, rows, showGrid]);

  // Request full redraw when display settings change
  useEffect(() => { needsFullRedraw.current = true; }, [showBackground, tileOpacity, useRenderedPreview, bgOpacity]);

  const applyNewDimensions = useCallback((newCols: number, newRows: number) => {
    const prev = tilesRef.current;
    const next = createEmptyTiles(newCols, newRows);
    for (let y = 0; y < Math.min(prev.length, newRows); y++) {
      for (let x = 0; x < Math.min(prev[0]?.length ?? 0, newCols); x++) {
        next[y][x] = prev[y][x];
      }
    }
    tilesRef.current = next;
    needsFullRedraw.current = true;
  }, []);

  const paintAt = useCallback((canvasX: number, canvasY: number) => {
    const tileX = Math.floor(canvasX / TILE_SIZE);
    const tileY = Math.floor(canvasY / TILE_SIZE);
    const tiles = tilesRef.current;
    const c = colsRef.current;
    const r = rowsRef.current;
    const half = Math.floor(brushSizeRef.current / 2);
    const sel = selectedTileRef.current;
    const stroke = currentStroke.current;

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        if (ty >= 0 && ty < r && tx >= 0 && tx < c && tiles[ty][tx] !== sel) {
          const key = `${tx},${ty}`;
          if (stroke && !stroke.has(key)) {
            stroke.set(key, tiles[ty][tx]);
          }
          tiles[ty][tx] = sel;
          dirtyTiles.current.add(key);
        }
      }
    }
  }, []);

  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left) * (canvas.width / rect.width),
      y: (screenY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && e.shiftKey) || e.button === 2) {
      isPanningRef.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    if (e.button === 0) {
      isPaintingRef.current = true;
      currentStroke.current = new Map();
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      paintAt(x, y);
    }
  }, [screenToCanvas, paintAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      return;
    }
    if (isPaintingRef.current) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      paintAt(x, y);
    }
  }, [screenToCanvas, paintAt]);

  const handleMouseUp = useCallback(() => {
    if (isPaintingRef.current && currentStroke.current && currentStroke.current.size > 0) {
      undoStack.current.push(currentStroke.current);
      if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
      redoStack.current = [];
    }
    currentStroke.current = null;
    isPaintingRef.current = false;
    isPanningRef.current = false;
  }, []);

  const undo = useCallback(() => {
    const stroke = undoStack.current.pop();
    if (!stroke) return;
    const tiles = tilesRef.current;
    const redo: StrokeDiff = new Map();
    for (const [key, oldVal] of stroke) {
      const [xs, ys] = key.split(',');
      const x = parseInt(xs);
      const y = parseInt(ys);
      if (tiles[y]?.[x] !== undefined) {
        redo.set(key, tiles[y][x]);
        tiles[y][x] = oldVal;
        dirtyTiles.current.add(key);
      }
    }
    redoStack.current.push(redo);
  }, []);

  const redo = useCallback(() => {
    const stroke = redoStack.current.pop();
    if (!stroke) return;
    const tiles = tilesRef.current;
    const un: StrokeDiff = new Map();
    for (const [key, newVal] of stroke) {
      const [xs, ys] = key.split(',');
      const x = parseInt(xs);
      const y = parseInt(ys);
      if (tiles[y]?.[x] !== undefined) {
        un.set(key, tiles[y][x]);
        tiles[y][x] = newVal;
        dirtyTiles.current.add(key);
      }
    }
    undoStack.current.push(un);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  // Render loop via requestAnimationFrame — only redraws dirty tiles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const renderFrame = () => {
      const c = colsRef.current;
      const r = rowsRef.current;
      const pw = c * TILE_SIZE;
      const ph = r * TILE_SIZE;
      const tiles = tilesRef.current;
      const rendered = useRenderedRef.current;
      const hasBg = showBackgroundRef.current;
      const tAlpha = hasBg ? tileOpacityRef.current : 1;

      if (needsFullRedraw.current) {
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }
        ctx.clearRect(0, 0, pw, ph);
        ctx.imageSmoothingEnabled = false;

        const mapData: MapData = { id: 'preview', tiles, interactables: [], enemies: [], portals: [], theme: 'outdoor' };
        const now = Date.now();

        ctx.globalAlpha = tAlpha;
        for (let y = 0; y < r; y++) {
          for (let x = 0; x < c; x++) {
            const tile = tiles[y]?.[x] ?? 0;
            if (rendered) {
              drawTile(ctx, tile, x * TILE_SIZE, y * TILE_SIZE, now, mapData, x, y);
            } else {
              ctx.fillStyle = TILE_COLOR_MAP[tile] || '#000';
              ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
          }
        }
        ctx.globalAlpha = 1;

        if (gridCanvasRef.current) {
          ctx.drawImage(gridCanvasRef.current, 0, 0);
        }

        needsFullRedraw.current = false;
        dirtyTiles.current.clear();
      } else if (dirtyTiles.current.size > 0) {
        const mapData: MapData = { id: 'preview', tiles, interactables: [], enemies: [], portals: [], theme: 'outdoor' };
        const now = Date.now();
        const grid = gridCanvasRef.current;

        ctx.globalAlpha = tAlpha;
        for (const key of dirtyTiles.current) {
          const [xs, ys] = key.split(',');
          const x = parseInt(xs);
          const y = parseInt(ys);
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;
          const tile = tiles[y]?.[x] ?? 0;

          ctx.clearRect(px, py, TILE_SIZE, TILE_SIZE);
          if (rendered) {
            drawTile(ctx, tile, px, py, now, mapData, x, y);
          } else {
            ctx.fillStyle = TILE_COLOR_MAP[tile] || '#000';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          }

          // Redraw grid for this tile
          if (grid) {
            ctx.globalAlpha = 1;
            ctx.drawImage(grid, px, py, TILE_SIZE, TILE_SIZE, px, py, TILE_SIZE, TILE_SIZE);
            ctx.globalAlpha = tAlpha;
          }
        }
        ctx.globalAlpha = 1;
        dirtyTiles.current.clear();
      }

      rafId.current = requestAnimationFrame(renderFrame);
    };

    rafId.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  const exportJSON = useCallback(() => {
    const mapData: MapData = {
      id: mapId,
      tiles: tilesRef.current,
      interactables: [],
      enemies: [],
      portals: [],
      theme: mapTheme,
    };
    const json = JSON.stringify(mapData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [mapId, mapTheme]);

  const importJSON = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as MapData;
          if (data.tiles && data.tiles.length > 0) {
            const newRows = data.tiles.length;
            const newCols = data.tiles[0].length;
            tilesRef.current = data.tiles;
            setRows(newRows);
            setCols(newCols);
            setRowsInput(String(newRows));
            setColsInput(String(newCols));
            if (data.id) setMapId(data.id);
            if (data.theme) setMapTheme(data.theme);
            needsFullRedraw.current = true;
          }
        } catch {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const fillAll = useCallback(() => {
    const tiles = tilesRef.current;
    const c = colsRef.current;
    const r = rowsRef.current;
    const sel = selectedTileRef.current;
    const stroke: StrokeDiff = new Map();
    for (let y = 0; y < r; y++) {
      for (let x = 0; x < c; x++) {
        if (tiles[y][x] !== sel) {
          stroke.set(`${x},${y}`, tiles[y][x]);
        }
      }
    }
    if (stroke.size > 0) {
      undoStack.current.push(stroke);
      if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
      redoStack.current = [];
    }
    tilesRef.current = createEmptyTiles(c, r, sel);
    needsFullRedraw.current = true;
  }, []);

  const pixelW = cols * TILE_SIZE;
  const pixelH = rows * TILE_SIZE;

  return (
    <div className="h-screen w-screen flex bg-[#111] text-white overflow-hidden" style={{ touchAction: 'none' }}>
      {/* Sidebar */}
      <div className="w-72 min-w-72 bg-[#1a1a1a] border-r border-white/10 flex flex-col h-screen">
        <div className="p-3 border-b border-white/10 shrink-0">
          <h1 className="text-lg font-bold tracking-tight">Map Builder</h1>
          <a href="/" className="text-xs text-white/40 hover:text-white/70 transition-colors">&larr; Back to Game</a>
        </div>

        <div className="shrink-0 overflow-y-auto" style={{ maxHeight: '40vh' }}>
          {/* Map Settings */}
          <div className="border-b border-white/10">
            <button onClick={() => setSettingsOpen(v => !v)}
              className="w-full px-4 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/50 hover:text-white/70">
              <span>Map Settings</span><span>{settingsOpen ? '−' : '+'}</span>
            </button>
            {settingsOpen && (
              <div className="px-4 pb-3 space-y-2">
                <label className="block">
                  <span className="text-xs text-white/60">Map ID</span>
                  <input type="text" value={mapId} onChange={e => setMapId(e.target.value)}
                    className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-white/30" />
                </label>
                <label className="block">
                  <span className="text-xs text-white/60">Theme</span>
                  <select value={mapTheme} onChange={e => setMapTheme(e.target.value as MapData['theme'])}
                    className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-white/30">
                    <option value="outdoor">Outdoor</option><option value="indoor">Indoor</option>
                    <option value="dungeon">Dungeon</option><option value="cave">Cave</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <label className="block flex-1">
                    <span className="text-xs text-white/60">Columns (W)</span>
                    <input type="number" min={4} max={500} value={colsInput}
                      onChange={e => setColsInput(e.target.value)}
                      onBlur={() => { const v = Math.max(4, Math.min(500, parseInt(colsInput) || cols)); setCols(v); setColsInput(String(v)); applyNewDimensions(v, rows); }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-white/30" />
                  </label>
                  <label className="block flex-1">
                    <span className="text-xs text-white/60">Rows (H)</span>
                    <input type="number" min={4} max={500} value={rowsInput}
                      onChange={e => setRowsInput(e.target.value)}
                      onBlur={() => { const v = Math.max(4, Math.min(500, parseInt(rowsInput) || rows)); setRows(v); setRowsInput(String(v)); applyNewDimensions(cols, v); }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-white/30" />
                  </label>
                </div>
                <p className="text-[10px] text-white/30">{cols * TILE_SIZE}x{rows * TILE_SIZE}px &middot; {cols * rows} tiles</p>
              </div>
            )}
          </div>

          {/* View & Brush */}
          <div className="border-b border-white/10">
            <button onClick={() => setViewOpen(v => !v)}
              className="w-full px-4 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/50 hover:text-white/70">
              <span>View &amp; Brush</span><span>{viewOpen ? '−' : '+'}</span>
            </button>
            {viewOpen && (
              <div className="px-4 pb-3 space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="accent-blue-500" />Grid Overlay
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={useRenderedPreview} onChange={e => { setUseRenderedPreview(e.target.checked); needsFullRedraw.current = true; }} className="accent-blue-500" />Rendered Preview
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={showBackground} onChange={e => setShowBackground(e.target.checked)} className="accent-blue-500" />Background Image
                </label>
                {showBackground && (
                  <>
                    <label className="block">
                      <span className="text-xs text-white/60">BG Opacity: {Math.round(bgOpacity * 100)}%</span>
                      <input type="range" min={0} max={100} value={bgOpacity * 100}
                        onChange={e => setBgOpacity(Number(e.target.value) / 100)} className="w-full accent-blue-500" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-white/60">Tile Opacity: {Math.round(tileOpacity * 100)}%</span>
                      <input type="range" min={0} max={100} value={tileOpacity * 100}
                        onChange={e => { setTileOpacity(Number(e.target.value) / 100); needsFullRedraw.current = true; }} className="w-full accent-blue-500" />
                    </label>
                  </>
                )}
                <label className="block">
                  <span className="text-xs text-white/60">Brush: {brushSize}x{brushSize}</span>
                  <input type="range" min={1} max={10} value={brushSize}
                    onChange={e => setBrushSize(Number(e.target.value))} className="w-full accent-blue-500" />
                </label>
                <div className="flex gap-2">
                  <button onClick={fillAll}
                    className="flex-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded px-2 py-1 transition-colors">Fill All</button>
                  <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
                    className="flex-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded px-2 py-1 transition-colors">Reset View</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tile Palette */}
        <div className="flex-1 min-h-0 flex flex-col border-b border-white/10">
          <div className="px-4 pt-3 pb-1 shrink-0">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">Tiles</h2>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="grid grid-cols-2 gap-2 pt-1">
              {TILE_TYPES.map(t => (
                <button key={t.id} onClick={() => setSelectedTile(t.id)}
                  className={`flex items-center gap-2 p-2 rounded border transition-all ${
                    selectedTile === t.id ? 'border-blue-400 bg-blue-500/20 ring-1 ring-blue-400/50' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}>
                  <div className="w-8 h-8 rounded shrink-0 border border-black/30" style={{ backgroundColor: t.color }} />
                  <span className="text-xs text-white/80 leading-tight">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 space-y-2 shrink-0">
          <button onClick={exportJSON} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded px-3 py-2 transition-colors">Export JSON</button>
          <button onClick={importJSON} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-sm rounded px-3 py-2 transition-colors">Import JSON</button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div ref={viewportRef} className="flex-1 overflow-hidden relative select-none cursor-crosshair"
        style={{ touchAction: 'none' }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onContextMenu={e => e.preventDefault()}>
        <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, transformOrigin: '0 0', position: 'relative', width: pixelW, height: pixelH }}>
          {showBackground && bgLoaded && (
            <img src={bgSrcRef.current} alt="" draggable={false}
              style={{ position: 'absolute', top: 0, left: 0, width: pixelW, height: pixelH, objectFit: 'contain', opacity: bgOpacity, pointerEvents: 'none' }} />
          )}
          <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', display: 'block', position: 'relative' }} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm px-4 py-1.5 flex items-center gap-4 text-[11px] text-white/50 border-t border-white/10 z-10">
          <span>{cols}x{rows} tiles</span>
          <span>{cols * TILE_SIZE}x{rows * TILE_SIZE}px</span>
          <span>Tile: {TILE_TYPES[selectedTile]?.name}</span>
          <span>Brush: {brushSize}x{brushSize}</span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
          <span className="ml-auto">Ctrl+Z undo &middot; Ctrl+Shift+Z redo &middot; Right-click to pan &middot; Scroll to zoom</span>
        </div>
      </div>
    </div>
  );
}

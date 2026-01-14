import React, { useState, useRef, useEffect } from 'react';
import { X, Check, MousePointer2, ScanLine, RotateCcw, Loader2, Crosshair } from 'lucide-react';
import { Point } from '../types';
import { warpPerspective } from '../utils/perspectiveUtils';

interface ImageCropperProps {
  imageSrc: string;
  onSave: (processedImage: string) => void;
  onCancel: () => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onSave, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  
  // The 4 corner points relative to the displayed image dimensions
  // Order: TL, TR, BR, BL
  const [points, setPoints] = useState<Point[]>([]);
  const [displayedImgDims, setDisplayedImgDims] = useState({ width: 0, height: 0, left: 0, top: 0, scale: 1 });
  
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Constants for Magnifier
  const MAG_SIZE = 140; // Size of the magnifier window
  const MAG_ZOOM = 3;   // Zoom level (3x)

  // Initialize Image
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
        setImage(img);
    };
  }, [imageSrc]);

  // Initialize Points when image and container are ready
  useEffect(() => {
    if (!image || !containerRef.current) return;

    const updateLayout = () => {
        if (!containerRef.current || !image) return;
        const container = containerRef.current;
        const cWidth = container.clientWidth;
        const cHeight = container.clientHeight;
        const padding = 40; // Space for handles

        const availWidth = cWidth - padding * 2;
        const availHeight = cHeight - padding * 2;

        const imgAspect = image.width / image.height;
        const containerAspect = availWidth / availHeight;

        let displayWidth, displayHeight;

        if (imgAspect > containerAspect) {
            displayWidth = availWidth;
            displayHeight = availWidth / imgAspect;
        } else {
            displayHeight = availHeight;
            displayWidth = availHeight * imgAspect;
        }

        const left = (cWidth - displayWidth) / 2;
        const top = (cHeight - displayHeight) / 2;

        setDisplayedImgDims({
            width: displayWidth,
            height: displayHeight,
            left,
            top,
            scale: image.width / displayWidth // Ratio of Original / Displayed
        });

        // Initialize points to corners (slightly inset)
        if (points.length === 0) {
            setPoints([
                { x: 0, y: 0 }, // TL
                { x: displayWidth, y: 0 }, // TR
                { x: displayWidth, y: displayHeight }, // BR
                { x: 0, y: displayHeight } // BL
            ]);
        }
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [image]);

  const getClientPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if ('touches' in e) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
  };

  const handleMouseDown = (index: number) => {
    setDraggingPointIndex(index);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (draggingPointIndex === null || !containerRef.current) return;
    
    // Prevent scrolling on mobile while dragging
    // e.preventDefault(); // Note: React SyntheticEvent doesn't always support this directly in passive listeners

    const pos = getClientPos(e);
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Calculate x, y relative to the image
    let x = pos.x - containerRect.left - displayedImgDims.left;
    let y = pos.y - containerRect.top - displayedImgDims.top;

    // Allow dragging outside slightly, but clamp for UX if needed.
    // We allow it to float freely to capture edges.
    
    setPoints(prev => {
        const newPoints = [...prev];
        newPoints[draggingPointIndex] = { x, y };
        return newPoints;
    });
  };

  const handleEnd = () => {
    setDraggingPointIndex(null);
  };

  const resetPoints = () => {
    setPoints([
        { x: 0, y: 0 },
        { x: displayedImgDims.width, y: 0 },
        { x: displayedImgDims.width, y: displayedImgDims.height },
        { x: 0, y: displayedImgDims.height }
    ]);
  };

  const handleProcessAndSave = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    // Convert displayed points to original image coordinates
    const scale = displayedImgDims.scale;
    const originalPoints = points.map(p => ({
        x: p.x * scale,
        y: p.y * scale
    }));

    try {
        // Use a short timeout to let the UI render the loading state
        await new Promise(resolve => setTimeout(resolve, 50));
        const resultBase64 = await warpPerspective(imageSrc, originalPoints);
        onSave(resultBase64);
    } catch (e) {
        console.error("Warp failed", e);
        alert("이미지 처리 중 오류가 발생했습니다.");
        setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 touch-none">
      <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl w-full max-w-5xl flex flex-col h-[90vh] border border-slate-700">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <div>
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <ScanLine className="text-yellow-400" />
                문서 스캔 보정
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
                모서리를 드래그하세요. 확대경으로 정밀 조절이 가능합니다.
            </p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Workspace */}
        <div 
            className="flex-1 relative overflow-hidden flex items-center justify-center bg-slate-950"
            ref={containerRef}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
        >
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" 
                 style={{backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
            </div>

            {image && (
                <div 
                    style={{
                        width: displayedImgDims.width,
                        height: displayedImgDims.height,
                        transform: `translate(${displayedImgDims.left}px, ${displayedImgDims.top}px)`,
                        position: 'absolute',
                        left: 0,
                        top: 0
                    }}
                >
                    {/* The Image */}
                    <img 
                        src={image.src} 
                        alt="Original" 
                        className="w-full h-full object-contain pointer-events-none select-none opacity-80" 
                        draggable={false}
                    />

                    {/* SVG Overlay for connection lines */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                        <polygon 
                            points={points.map(p => `${p.x},${p.y}`).join(' ')} 
                            fill="rgba(250, 204, 21, 0.1)" 
                            stroke="#fbbf24" 
                            strokeWidth="2"
                            strokeDasharray="4"
                        />
                    </svg>

                    {/* Draggable Handles */}
                    {points.map((p, i) => (
                        <div
                            key={i}
                            onMouseDown={() => handleMouseDown(i)}
                            onTouchStart={() => handleMouseDown(i)}
                            className="absolute w-10 h-10 -ml-5 -mt-5 cursor-move z-20 group flex items-center justify-center"
                            style={{ left: p.x, top: p.y }}
                        >
                            {/* Touch Target */}
                            <div className="absolute inset-0 rounded-full" />
                            
                            {/* Visual Handle */}
                            <div className={`w-5 h-5 rounded-full border-2 border-white shadow-lg transition-transform ${draggingPointIndex === i ? 'bg-yellow-400 scale-125' : 'bg-blue-600 group-hover:scale-110'}`}></div>
                            
                            {/* Magnifier (Only visible when dragging this specific point) */}
                            {draggingPointIndex === i && (
                                <div 
                                    className="absolute pointer-events-none overflow-hidden rounded-full border-4 border-white shadow-2xl z-50 bg-slate-900"
                                    style={{
                                        width: MAG_SIZE,
                                        height: MAG_SIZE,
                                        bottom: '40px', // Position above the finger
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                    }}
                                >
                                    {/* Magnified Image Background */}
                                    <div 
                                        className="absolute bg-no-repeat"
                                        style={{
                                            backgroundImage: `url(${imageSrc})`,
                                            /* 
                                              Logic: 
                                              1. Scale displayed image dimension by Zoom Factor -> Background Size
                                              2. Position: (Point X * Zoom) - (Half Magnifier Size)
                                            */
                                            backgroundSize: `${displayedImgDims.width * MAG_ZOOM}px ${displayedImgDims.height * MAG_ZOOM}px`,
                                            backgroundPosition: `-${(p.x * MAG_ZOOM) - (MAG_SIZE / 2)}px -${(p.y * MAG_ZOOM) - (MAG_SIZE / 2)}px`,
                                            width: '100%',
                                            height: '100%'
                                        }}
                                    />
                                    
                                    {/* Crosshair Center */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-full h-px bg-yellow-400/50 absolute"></div>
                                        <div className="h-full w-px bg-yellow-400/50 absolute"></div>
                                        <div className="w-2 h-2 border border-yellow-400 rounded-full bg-transparent z-10"></div>
                                    </div>
                                </div>
                            )}

                            {/* Label */}
                            <div className={`absolute -top-8 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none transition-opacity whitespace-nowrap ${draggingPointIndex === i ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                                {i === 0 ? '좌상단' : i === 1 ? '우상단' : i === 2 ? '우하단' : '좌하단'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Footer Controls */}
        <div className="p-5 bg-slate-900 border-t border-slate-800">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-4">
                <button 
                    onClick={resetPoints}
                    className="flex items-center text-xs text-slate-400 hover:text-white transition-colors"
                >
                    <RotateCcw size={14} className="mr-1.5"/> 초기화
                </button>
                <div className="hidden md:flex text-[10px] text-slate-500 gap-4">
                    <span className="flex items-center"><MousePointer2 size={12} className="mr-1"/> 모서리를 드래그하여 맞추세요</span>
                </div>
             </div>

            <button
              onClick={handleProcessAndSave}
              disabled={isProcessing}
              className="flex items-center px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-xl font-bold transition-all shadow-lg hover:shadow-yellow-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                  <>
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    보정 처리 중...
                  </>
              ) : (
                  <>
                    <Check size={20} className="mr-2" />
                    스캔 및 저장
                  </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
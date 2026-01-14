import React, { useState, useEffect, useRef } from 'react';
import { WorkerData, AppView, AnalyzedDocument, PrintMode } from './types';
import { WorkerCard } from './components/WorkerCard';
import { PrintLayout } from './components/PrintLayout';
import { ImageCropper } from './components/ImageCropper';
import { Printer, Plus, Users, ArrowLeft, Construction, HardHat, Info, Files, Loader2, FileUp, Save, Download, Upload, Image as ImageIcon, Database, Sun, Cloud, CloudRain, CloudLightning, Snowflake, CloudFog, CloudDrizzle, MapPin, Clock, X, Grid, Maximize, Check } from 'lucide-react';
import { extractWorkerInfo } from './services/geminiService';
import { cropImageFromBox, resizeImage } from './utils/imageUtils';
import { fetchLocalWeather, getWeatherDescription, WeatherData } from './utils/weatherUtils';
import html2canvas from 'html2canvas';

// Simple UUID generator fallback
const generateId = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const App: React.FC = () => {
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [view, setView] = useState<AppView>(AppView.EDITOR);
  const [printMode, setPrintMode] = useState<PrintMode>('LIST'); // Default to 4 per page
  
  // Dashboard State (Weather & Time)
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 0,
    weatherCode: 0,
    humidity: 0,
    loading: true,
    error: null,
    locationName: '위치 확인 중...'
  });

  // Image Editing State
  const [editingImage, setEditingImage] = useState<{
    workerId: string;
    field: 'idCardImage' | 'safetyCertImage';
    src: string;
  } | null>(null);

  // Bulk Upload State
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, status: '' });
  
  // Save Image Loading State
  const [isSavingImage, setIsSavingImage] = useState(false);

  // Initialize
  useEffect(() => {
    if (workers.length === 0) {
      addWorker();
    }
    
    // Clock Interval
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Weather Fetch
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const weatherData = await fetchLocalWeather(latitude, longitude);
                setWeather(prev => ({
                    ...prev,
                    ...weatherData,
                    loading: false,
                    locationName: '현장 위치 수신 완료' 
                }));
            },
            (err) => {
                setWeather(prev => ({ ...prev, loading: false, error: '위치 권한 필요', locationName: '위치 미수신' }));
            }
        );
    } else {
        setWeather(prev => ({ ...prev, loading: false, error: 'GPS 미지원', locationName: '-' }));
    }

    return () => clearInterval(timer);
  }, []);

  const addWorker = () => {
    const newWorker: WorkerData = {
      id: generateId(),
      name: '',
      trade: '',
      team: '',
      idCardImage: null,
      safetyCertImage: null,
      createdAt: Date.now(),
    };
    setWorkers(prev => [...prev, newWorker]);
  };

  const updateWorker = (id: string, data: Partial<WorkerData>) => {
    setWorkers(prev => prev.map(w => w.id === id ? { ...w, ...data } : w));
  };

  const deleteWorker = (id: string) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      setWorkers(prev => prev.filter(w => w.id !== id));
    }
  };

  const openImageEditor = (workerId: string, field: 'idCardImage' | 'safetyCertImage', src: string) => {
    setEditingImage({ workerId, field, src });
  };

  const handleImageSave = (processedImage: string) => {
    if (editingImage) {
      updateWorker(editingImage.workerId, { [editingImage.field]: processedImage });
      setEditingImage(null);
    }
  };

  const handlePrint = () => {
    // Wait for a brief moment to ensure any pending renders (like hiding overlays) might complete, 
    // although with CSS media queries this is usually instant.
    setTimeout(() => {
        window.print();
    }, 100);
  };

  // --- Backup & Restore Logic ---
  const handleBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(workers));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadAnchorNode.setAttribute("download", `Hwigang_Construction_Workers_${dateStr}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleRestoreClick = () => {
    restoreInputRef.current?.click();
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const parsed = JSON.parse(event.target?.result as string);
            if (Array.isArray(parsed)) {
                if(window.confirm('현재 작성 중인 데이터가 모두 삭제되고 복구 파일로 대체됩니다. 진행하시겠습니까?')) {
                    setWorkers(parsed);
                    alert('데이터가 성공적으로 복구되었습니다.');
                }
            } else {
                alert('올바르지 않은 백업 파일 형식입니다.');
            }
        } catch (err) {
            console.error(err);
            alert('파일을 읽는 중 오류가 발생했습니다.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Save Page as Image Logic (Fixed Discrepancy) ---
  const handleSavePageAsImage = async (pageElementId: string) => {
    if (isSavingImage) return;
    setIsSavingImage(true);

    const element = document.getElementById(pageElementId);
    if (!element) {
        setIsSavingImage(false);
        return;
    }
    
    // 1. Clone the node
    const clone = element.cloneNode(true) as HTMLElement;
    
    // 2. Clean up UI elements (buttons) from the clone
    const overlays = clone.querySelectorAll('.no-print-overlay');
    overlays.forEach(el => el.remove());

    // 3. Set precise A4 pixel dimensions (210mm @ 96dpi ≈ 794px)
    // This forces the clone to have the exact same layout structure as print, 
    // fixing the discrepancy between screen (preview) and saved image.
    clone.style.width = '794px'; 
    clone.style.height = '1123px'; // 297mm @ 96dpi
    clone.style.position = 'absolute';
    clone.style.top = '0';
    clone.style.left = '0';
    clone.style.zIndex = '-9999'; // Hide behind everything
    clone.style.margin = '0';
    clone.style.transform = 'none'; // Ensure no scaling on the element itself
    clone.style.backgroundColor = '#ffffff';

    document.body.appendChild(clone);

    try {
        const canvas = await html2canvas(clone, { 
            scale: 2, // 2x resolution for high quality (Retina)
            useCORS: true, 
            logging: false,
            backgroundColor: '#ffffff',
            width: 794,
            height: 1123,
            scrollY: 0, // Prevent scrolling offset issues
            windowHeight: 1123,
            windowWidth: 794
        });
        
        const image = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = `Hwigang_Worker_List_${pageElementId}.png`;
        link.click();
    } catch (err) {
        console.error("Image generation failed", err);
        alert("이미지 저장 중 오류가 발생했습니다.");
    } finally {
        if (document.body.contains(clone)) {
            document.body.removeChild(clone);
        }
        setIsSavingImage(false);
    }
  };

  // --- Bulk Upload Logic (Optimized) ---
  const handleBulkUploadClick = () => {
    bulkInputRef.current?.click();
  };

  const handleBulkFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files: File[] = Array.from(e.target.files);
    setIsBulkProcessing(true);
    setBulkProgress({ current: 0, total: files.length, status: '준비 중...' });

    const analyzedDocs: AnalyzedDocument[] = [];
    
    // Reduced batch size to 1 to prevent hitting rate limits (429)
    const BATCH_SIZE = 1; 

    try {
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            // Add artificial delay to respect API rate limits
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            const batch = files.slice(i, i + BATCH_SIZE);
            setBulkProgress(prev => ({ 
                ...prev, 
                current: i, 
                status: `고속 AI 분석 중... (${Math.min(i + BATCH_SIZE, files.length)}/${files.length})` 
            }));

            const batchPromises = batch.map(async (file) => {
                try {
                    const base64Original = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => resolve(ev.target?.result as string);
                        reader.onerror = () => reject(new Error("File read error"));
                        reader.readAsDataURL(file);
                    });

                    // Resize for AI analysis only (speeds up upload & processing)
                    const base64ForAI = await resizeImage(base64Original, 800);

                    const extractedItems = await extractWorkerInfo(base64ForAI);
                    const croppedItems: AnalyzedDocument[] = [];

                    if (extractedItems && extractedItems.length > 0) {
                        for (const item of extractedItems) {
                             // Crop from the ORIGINAL high-res image for final quality
                             const croppedBase64 = await cropImageFromBox(base64Original, item.boundingBox);
                             croppedItems.push({
                                type: item.type,
                                name: item.name,
                                trade: item.trade,
                                originalImage: croppedBase64
                             });
                        }
                    } else {
                        // Fallback: Use original if nothing detected
                        croppedItems.push({
                            type: 'UNKNOWN',
                            name: '',
                            trade: '',
                            originalImage: base64Original
                        });
                    }
                    return croppedItems;

                } catch (err) {
                    console.error("Processing failed for file", file.name, err);
                    return []; 
                }
            });

            const results = await Promise.all(batchPromises);
            results.forEach(items => {
                analyzedDocs.push(...items);
            });
            setBulkProgress(prev => ({ ...prev, current: Math.min(i + BATCH_SIZE, files.length) }));
        }

        setBulkProgress(prev => ({ ...prev, status: '데이터 병합 중...' }));
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const newWorkers: WorkerData[] = [];
        const findWorkerByName = (name: string, list: WorkerData[]) => {
            if (!name) return null;
            const targetName = name.replace(/\s/g, '');
            return list.find(w => w.name.replace(/\s/g, '') === targetName);
        };

        const idCards = analyzedDocs.filter(d => d.type === 'ID_CARD');
        const safetyCerts = analyzedDocs.filter(d => d.type === 'SAFETY_CERT');
        const unknowns = analyzedDocs.filter(d => d.type === 'UNKNOWN');

        for (const doc of idCards) {
            let worker = findWorkerByName(doc.name, newWorkers);
            if (!worker) {
                 const existingGlobal = findWorkerByName(doc.name, workers);
                 if (existingGlobal) {
                     updateWorker(existingGlobal.id, { 
                         idCardImage: doc.originalImage, 
                         trade: doc.trade || existingGlobal.trade 
                     });
                     continue; 
                 }
                 worker = {
                    id: generateId(),
                    name: doc.name,
                    trade: doc.trade,
                    team: '',
                    idCardImage: doc.originalImage,
                    safetyCertImage: null,
                    createdAt: Date.now()
                 };
                 newWorkers.push(worker);
            } else {
                worker.idCardImage = doc.originalImage;
                if (doc.trade) worker.trade = doc.trade;
            }
        }

        for (const doc of safetyCerts) {
            let worker = findWorkerByName(doc.name, newWorkers);
            if (worker) {
                worker.safetyCertImage = doc.originalImage;
                if (!worker.trade && doc.trade) worker.trade = doc.trade;
            } else {
                 const existingGlobal = findWorkerByName(doc.name, workers);
                 if (existingGlobal) {
                     updateWorker(existingGlobal.id, { 
                         safetyCertImage: doc.originalImage,
                         trade: (!existingGlobal.trade && doc.trade) ? doc.trade : existingGlobal.trade
                     });
                     continue;
                 }
                 worker = {
                    id: generateId(),
                    name: doc.name,
                    trade: doc.trade,
                    team: '',
                    idCardImage: null,
                    safetyCertImage: doc.originalImage,
                    createdAt: Date.now()
                 };
                 newWorkers.push(worker);
            }
        }

        for (const doc of unknowns) {
             const worker: WorkerData = {
                id: generateId(),
                name: '',
                trade: '',
                team: '',
                idCardImage: doc.originalImage, 
                safetyCertImage: null,
                createdAt: Date.now()
             };
             newWorkers.push(worker);
        }

        if (workers.length === 1 && !workers[0].name && !workers[0].idCardImage && newWorkers.length > 0) {
            setWorkers(newWorkers);
        } else {
            setWorkers(prev => [...prev, ...newWorkers]);
        }

    } catch (error) {
        console.error("Bulk upload error", error);
        alert("일괄 처리 중 오류가 발생했습니다.");
    } finally {
        setIsBulkProcessing(false);
        if (e.target) e.target.value = '';
    }
  };

  // Weather Icon Component Helper
  const WeatherIcon = ({ code }: { code: number }) => {
    const { icon } = getWeatherDescription(code);
    switch (icon) {
        case 'Sun': return <Sun className="text-orange-500" size={18} />;
        case 'Cloud': return <Cloud className="text-slate-400" size={18} />;
        case 'CloudRain': return <CloudRain className="text-blue-500" size={18} />;
        case 'CloudLightning': return <CloudLightning className="text-purple-500" size={18} />;
        case 'Snowflake': return <Snowflake className="text-sky-400" size={18} />;
        case 'CloudFog': return <CloudFog className="text-slate-400" size={18} />;
        case 'CloudDrizzle': return <CloudDrizzle className="text-blue-300" size={18} />;
        default: return <Cloud className="text-slate-400" size={18} />;
    }
  };

  return (
    <div className="min-h-screen relative bg-slate-50 font-sans">
      
      {/* 1. TOP GNB (Brand & Primary Actions) */}
      <header className="no-print sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-md h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
             {/* Left: Brand */}
            <div className="flex items-center gap-3">
                <div className="bg-yellow-500 p-1.5 rounded text-slate-900">
                    <Construction size={22} strokeWidth={2.5} />
                </div>
                <div>
                    <h1 className="text-lg md:text-xl font-black text-white tracking-tighter leading-none">(주)휘강건설</h1>
                    <p className="text-[10px] text-slate-400 font-medium tracking-wide">SMART ONBOARDING SYSTEM</p>
                </div>
            </div>

            {/* Right: Actions - Dynamic based on View */}
            <div className="flex items-center gap-3">
                {view === AppView.EDITOR ? (
                    <button
                        onClick={() => setView(AppView.PRINT_PREVIEW)}
                        className="flex items-center px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-lg transition-all text-sm font-bold shadow-lg shadow-yellow-500/20"
                    >
                        <Printer size={18} className="mr-2" />
                        출력 및 저장 설정
                    </button>
                ) : (
                   /* In Preview Mode - Actions are inside the preview container usually, but here we can have a global Close */
                   <button
                        onClick={() => setView(AppView.EDITOR)}
                        className="flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-all text-sm font-semibold"
                    >
                        <X size={18} className="mr-2" />
                        닫기
                    </button>
                )}
            </div>
        </div>
      </header>

      {/* 2. INFO BAR (Context & Credits) */}
      <div className="no-print bg-white border-b border-slate-200 py-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-2 md:gap-0 text-xs md:text-sm">
              <div className="flex items-center gap-6 text-slate-600">
                   <div className="flex items-center gap-2">
                        <Clock size={14} className="text-blue-600" />
                        <span className="font-mono font-bold tracking-tight text-slate-800">
                            {currentTime.toLocaleTimeString('ko-KR', { hour12: false })}
                        </span>
                   </div>
                   <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-6">
                        <MapPin size={14} className="text-red-500" />
                        <span className="font-medium">{weather.locationName}</span>
                   </div>
                   <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-6">
                        {weather.loading ? <Loader2 size={14} className="animate-spin"/> : <WeatherIcon code={weather.weatherCode} />}
                        <span className="font-medium">{weather.temperature}°C</span>
                   </div>
              </div>

              <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 border-r border-slate-200 pr-4 mr-1">
                        <input type="file" ref={restoreInputRef} accept=".json" className="hidden" onChange={handleRestoreFile} />
                        <button onClick={handleRestoreClick} className="text-slate-400 hover:text-slate-700 px-2 py-1 rounded transition-colors" title="복구">
                            <Upload size={14} />
                        </button>
                        <button onClick={handleBackup} className="text-slate-400 hover:text-slate-700 px-2 py-1 rounded transition-colors" title="백업">
                            <Download size={14} />
                        </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Project Lead</span>
                      <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">박성훈 부장</span>
                  </div>
              </div>
          </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-140px)]">
        
        {/* Editor View */}
        {view === AppView.EDITOR && (
          <div className="no-print space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-2 border-b border-slate-200">
                <div>
                     <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="text-slate-400" size={24}/>
                        근로자 명단 관리
                     </h2>
                     <p className="text-sm text-slate-500 mt-1">
                        신분증과 이수증을 등록하여 명부를 작성하세요.
                     </p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <input 
                        type="file" 
                        ref={bulkInputRef} 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleBulkFiles}
                    />
                    <button
                        onClick={handleBulkUploadClick}
                        className="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 rounded-lg shadow-sm transition-all text-sm font-bold group"
                    >
                        <Files size={18} className="mr-2 text-slate-400 group-hover:text-blue-500" />
                        일괄 업로드
                    </button>

                    <button
                        onClick={addWorker}
                        className="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all text-sm font-bold"
                    >
                        <Plus size={18} className="mr-2 text-yellow-400" />
                        추가하기
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {workers.map((worker, index) => (
                <WorkerCard
                  key={worker.id}
                  index={index}
                  worker={worker}
                  onUpdate={updateWorker}
                  onDelete={deleteWorker}
                  onEditImage={openImageEditor}
                />
              ))}
            </div>

            {workers.length === 0 && (
                <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                    <div className="bg-slate-50 p-6 rounded-full mb-6">
                        <HardHat size={48} className="text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">등록된 데이터가 없습니다.</h3>
                    <p className="text-slate-500 mb-8 max-w-sm">
                        '일괄 업로드'를 통해 여러 장의 사진을 한 번에 등록하거나 '추가하기' 버튼을 눌러 시작하세요.
                    </p>
                </div>
            )}
          </div>
        )}

        {/* Print Preview Mode (Unified) */}
        {view === AppView.PRINT_PREVIEW && (
          <div className="no-print flex flex-col items-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
             
             {/* Toolbar */}
             <div className="sticky top-2 z-40 bg-slate-900/90 backdrop-blur text-white p-4 rounded-xl shadow-2xl flex flex-col md:flex-row items-center gap-6 max-w-4xl w-full border border-slate-700">
                <div className="flex-1">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Printer size={20} className="text-yellow-400"/>
                        출력 설정
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">출력 형태를 선택하고 인쇄 버튼을 누르세요.</p>
                </div>

                <div className="flex bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setPrintMode('LIST')}
                        className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${printMode === 'LIST' ? 'bg-yellow-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    >
                        <Grid size={16} className="mr-2"/>
                        리스트형 (4인)
                    </button>
                    <button
                        onClick={() => setPrintMode('DETAIL')}
                        className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${printMode === 'DETAIL' ? 'bg-yellow-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    >
                        <Maximize size={16} className="mr-2"/>
                        상세형 (1인)
                    </button>
                </div>

                <div className="h-8 w-px bg-slate-700 hidden md:block"></div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handlePrint}
                        className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-blue-500/30"
                    >
                        <Printer size={18} className="mr-2"/>
                        PDF 저장 / 인쇄
                    </button>
                    <button
                        onClick={() => setView(AppView.EDITOR)}
                        className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                        title="나가기"
                    >
                        <X size={20}/>
                    </button>
                </div>
             </div>
             
             {/* Preview Canvas with Padding Correction */}
             <div className="w-full flex justify-center pb-20 pt-32">
                 <div className="transform scale-[0.5] sm:scale-[0.6] lg:scale-[0.85] origin-top transition-transform duration-300">
                    <div className="ring-1 ring-slate-900/10 shadow-2xl rounded-sm bg-white">
                         <PrintLayout 
                            workers={workers} 
                            mode={printMode}
                            isPreview={true} 
                            onSavePageAsImage={handleSavePageAsImage}
                         />
                    </div>
                 </div>
             </div>
          </div>
        )}

        {/* Actual Print Content (Hidden on Screen, Visible on Print) */}
        <div className="print-only">
          <PrintLayout workers={workers} mode={printMode} isPreview={false} />
        </div>

      </main>

      {/* Modals */}
      {editingImage && (
        <ImageCropper
          imageSrc={editingImage.src}
          onSave={handleImageSave}
          onCancel={() => setEditingImage(null)}
        />
      )}

      {/* Loading Overlays */}
      {isBulkProcessing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 backdrop-blur-md">
            <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center">
                <Loader2 className="w-16 h-16 text-yellow-500 animate-spin mx-auto mb-6" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">AI 문서 분석 중</h3>
                <p className="text-slate-500 font-medium">{bulkProgress.status}</p>
            </div>
        </div>
      )}

      {isSavingImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-white px-8 py-6 rounded-2xl shadow-xl flex items-center space-x-4">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="font-bold text-slate-800">이미지 생성 중...</span>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
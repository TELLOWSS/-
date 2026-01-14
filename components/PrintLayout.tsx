import React from 'react';
import { WorkerData, PrintMode } from '../types';
import { Image as ImageIcon } from 'lucide-react';

interface PrintLayoutProps {
  workers: WorkerData[];
  mode: PrintMode;
  isPreview?: boolean;
  onSavePageAsImage?: (elementId: string) => void;
}

export const PrintLayout: React.FC<PrintLayoutProps> = ({ workers, mode, isPreview = false, onSavePageAsImage }) => {
  // Mode configuration
  const WORKERS_PER_PAGE = mode === 'LIST' ? 4 : 1;
  const pages = [];

  for (let i = 0; i < workers.length; i += WORKERS_PER_PAGE) {
    pages.push(workers.slice(i, i + WORKERS_PER_PAGE));
  }

  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="print-area">
      {pages.map((pageWorkers, pageIndex) => {
        const pageId = `print-page-${pageIndex}`;
        return (
          <div key={pageIndex} className="relative mb-8 print:mb-0">
            {/* Image Save Button (Only in Preview) */}
            {isPreview && (
                <div className="absolute -top-12 left-0 w-full flex justify-between items-center bg-slate-800 text-white px-4 py-2 rounded-t-lg no-print-overlay">
                    <span className="text-xs font-bold text-slate-300">
                        Page {pageIndex + 1} / {pages.length} ({mode === 'LIST' ? '리스트형' : '상세형'})
                    </span>
                    <button 
                        id={`btn-${pageId}`}
                        onClick={() => onSavePageAsImage?.(pageId)}
                        className="flex items-center text-xs font-bold bg-yellow-500 text-slate-900 px-3 py-1 rounded hover:bg-yellow-400 transition-colors"
                    >
                        <ImageIcon size={14} className="mr-1.5"/>
                        <span id={`btn-text-${pageId}`}>이미지로 저장</span>
                    </button>
                </div>
            )}
            
            <div id={pageId} className={`a4-page relative flex flex-col bg-white ${isPreview ? 'rounded-b-lg shadow-2xl' : ''}`}>
                
                {/* Header */}
                <header className="border-b-2 border-slate-900 pb-3 mb-4 pt-4 shrink-0">
                    <div className="text-center relative">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">신규 채용자 등록 명부</h1>
                        <p className="text-xs text-slate-500 font-medium mt-1">New Worker Registration & Safety Certification List</p>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600 hidden sm:block">
                            Date: {currentDate}
                        </div>
                    </div>
                </header>

                {/* Content Container - Use flex-1 and min-h-0 to force containment within A4 height */}
                <div className="flex-1 flex flex-col w-full h-full min-h-0">
                    
                    {/* --- LIST MODE (4 Workers per Page) --- */}
                    {mode === 'LIST' && (
                        <div className="grid grid-rows-4 gap-4 h-full">
                            {pageWorkers.map((worker, idx) => (
                                <div key={worker.id} className="border border-slate-400 rounded-sm overflow-hidden flex flex-row h-full max-h-[240px]">
                                    {/* Left: Info Block */}
                                    <div className="w-[25%] bg-slate-50 border-r border-slate-300 p-3 flex flex-col justify-center relative">
                                        <div className="absolute top-2 left-2 bg-slate-800 text-white text-xs font-bold px-2 py-0.5 rounded-sm">
                                            {pageIndex * WORKERS_PER_PAGE + idx + 1}
                                        </div>
                                        
                                        <div className="mt-4 space-y-3">
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-bold mb-0.5">성명 (Name)</div>
                                                <div className="text-lg font-black text-slate-900 leading-tight">{worker.name || "-"}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-bold mb-0.5">직종 (Trade)</div>
                                                <div className="text-sm font-bold text-slate-800 leading-tight">{worker.trade || "-"}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-bold mb-0.5">소속 (Team)</div>
                                                <div className="text-sm font-bold text-slate-800 leading-tight">{worker.team || "-"}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Images Block */}
                                    <div className="w-[75%] grid grid-cols-2 divide-x divide-slate-300">
                                        <div className="flex flex-col h-full relative p-2 overflow-hidden">
                                            <div className="absolute top-0 left-0 bg-white border-b border-r border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 z-10">
                                                신분증
                                            </div>
                                            <div className="flex-1 flex items-center justify-center overflow-hidden w-full h-full">
                                                {worker.idCardImage ? (
                                                    <img src={worker.idCardImage} className="max-w-full max-h-full object-contain" alt="ID" />
                                                ) : <span className="text-xs text-slate-300">미등록</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col h-full relative p-2 overflow-hidden">
                                            <div className="absolute top-0 left-0 bg-white border-b border-r border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 z-10">
                                                이수증
                                            </div>
                                            <div className="flex-1 flex items-center justify-center overflow-hidden w-full h-full">
                                                 {worker.safetyCertImage ? (
                                                    <img src={worker.safetyCertImage} className="max-w-full max-h-full object-contain" alt="Cert" />
                                                ) : <span className="text-xs text-slate-300">미등록</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* --- DETAIL MODE (1 Worker per Page) --- */}
                    {mode === 'DETAIL' && (
                        <div className="flex flex-col h-full border-2 border-slate-800 rounded-lg overflow-hidden min-h-0">
                            {pageWorkers.map((worker, idx) => (
                                <div key={worker.id} className="flex flex-col h-full min-h-0">
                                    {/* Top Info Bar */}
                                    <div className="bg-slate-100 border-b-2 border-slate-800 p-6 flex justify-between items-center shrink-0 h-[15%]">
                                        <div className="flex items-center gap-6">
                                            <div className="bg-slate-900 text-white text-2xl font-black px-4 py-2 rounded-lg">
                                                No. {pageIndex * WORKERS_PER_PAGE + idx + 1}
                                            </div>
                                            <div className="text-4xl font-black text-slate-900">
                                                {worker.name || "이름 미상"}
                                            </div>
                                        </div>
                                        <div className="text-right flex gap-8">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-bold text-slate-500 uppercase">Trade</span>
                                                <span className="text-2xl font-bold text-slate-800">{worker.trade || "-"}</span>
                                            </div>
                                            <div className="flex flex-col items-end border-l-2 border-slate-300 pl-8">
                                                <span className="text-sm font-bold text-slate-500 uppercase">Team</span>
                                                <span className="text-2xl font-bold text-slate-800">{worker.team || "-"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Large Images Grid - Takes remaining space */}
                                    <div className="flex-1 grid grid-rows-2 divide-y-2 divide-slate-800 min-h-0">
                                        
                                        {/* Row 1: ID Card */}
                                        <div className="flex flex-col h-full relative p-4 min-h-0 overflow-hidden">
                                            <div className="absolute top-0 left-0 bg-slate-800 text-white px-4 py-1.5 text-sm font-bold rounded-br-lg z-10">
                                                신분증 사본 (ID CARD)
                                            </div>
                                            <div className="flex-1 flex items-center justify-center w-full h-full bg-slate-50/50 min-h-0">
                                                {worker.idCardImage ? (
                                                    <img src={worker.idCardImage} className="max-w-full max-h-full object-contain shadow-lg" alt="ID" />
                                                ) : <span className="text-xl text-slate-300 font-bold">이미지 없음</span>}
                                            </div>
                                        </div>

                                        {/* Row 2: Safety Cert */}
                                        <div className="flex flex-col h-full relative p-4 min-h-0 overflow-hidden">
                                            <div className="absolute top-0 left-0 bg-green-700 text-white px-4 py-1.5 text-sm font-bold rounded-br-lg z-10">
                                                기초안전보건 이수증 (SAFETY CERTIFICATE)
                                            </div>
                                            <div className="flex-1 flex items-center justify-center w-full h-full bg-slate-50/50 min-h-0">
                                                {worker.safetyCertImage ? (
                                                    <img src={worker.safetyCertImage} className="max-w-full max-h-full object-contain shadow-lg" alt="Cert" />
                                                ) : <span className="text-xl text-slate-300 font-bold">이미지 없음</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <footer className="mt-auto pt-4 border-t border-slate-200 shrink-0">
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>본 문서는 (주)휘강건설 안전관리 시스템에 의해 생성되었습니다.</span>
                        <span>Page {pageIndex + 1} / {pages.length}</span>
                    </div>
                </footer>
            </div>
          </div>
        );
      })}
    </div>
  );
};
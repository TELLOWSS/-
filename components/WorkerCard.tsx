import React, { useRef, useState } from 'react';
import { WorkerData } from '../types';
import { Upload, Trash2, Edit2, Wand2, Loader2, User, Hammer, Briefcase } from 'lucide-react';
import { extractWorkerInfo } from '../services/geminiService';

interface WorkerCardProps {
  worker: WorkerData;
  index: number;
  onUpdate: (id: string, data: Partial<WorkerData>) => void;
  onDelete: (id: string) => void;
  onEditImage: (id: string, field: 'idCardImage' | 'safetyCertImage', currentSrc: string) => void;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({ worker, index, onUpdate, onDelete, onEditImage }) => {
  const idInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'idCardImage' | 'safetyCertImage') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const result = ev.target.result as string;
          onUpdate(worker.id, { [field]: result });
          
          // Trigger AI extraction if it's the ID card and fields are empty
          if (field === 'idCardImage' && (!worker.name || !worker.trade)) {
             handleAiExtraction(result);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiExtraction = async (imageData: string) => {
      setIsAiLoading(true);
      try {
          // Gemini now returns an array of documents.
          // For single card extraction, we take the first valid result.
          const results = await extractWorkerInfo(imageData);
          if (results && results.length > 0) {
              const info = results[0]; // Take the first one
              onUpdate(worker.id, {
                  name: info.name || worker.name,
                  trade: info.trade !== "" ? info.trade : (worker.trade || "")
              });
          }
      } finally {
          setIsAiLoading(false);
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-300">
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center space-x-2">
            <span className="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded-md">#{index + 1}</span>
            <h3 className="font-bold text-slate-700">신규 근로자 정보</h3>
        </div>
        <button 
            onClick={() => onDelete(worker.id)}
            className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
        >
            <Trash2 size={18} />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4 relative group">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                성명 (Name)
            </label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User size={16} />
                </div>
                <input
                type="text"
                value={worker.name}
                onChange={(e) => onUpdate(worker.id, { name: e.target.value })}
                placeholder="홍길동"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all font-medium text-slate-800"
                />
            </div>
            
            {/* AI Auto-fill Button Indicator */}
            {worker.idCardImage && !worker.name && (
                <button 
                    onClick={() => worker.idCardImage && handleAiExtraction(worker.idCardImage)}
                    disabled={isAiLoading}
                    className="absolute right-2 top-8 text-yellow-600 hover:text-yellow-700 disabled:opacity-50"
                    title="AI 정보 추출"
                >
                    {isAiLoading ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>}
                </button>
            )}
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                공정 (Trade)
            </label>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Hammer size={16} />
                </div>
                <input
                type="text"
                value={worker.trade}
                onChange={(e) => onUpdate(worker.id, { trade: e.target.value })}
                placeholder="형틀, 용접 등"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all font-medium text-slate-800"
                />
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                소속/팀 (Team)
            </label>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Briefcase size={16} />
                </div>
                <input
                type="text"
                value={worker.team}
                onChange={(e) => onUpdate(worker.id, { team: e.target.value })}
                placeholder="김반장팀"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all font-medium text-slate-800"
                />
            </div>
          </div>
        </div>

        {/* Image Upload Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ID Card Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                신분증 / 여권
            </label>
            <div 
                className={`relative group aspect-[1.6/1] rounded-xl border-2 border-dashed transition-all overflow-hidden ${worker.idCardImage ? 'border-yellow-400 bg-white' : 'border-slate-300 bg-slate-50 hover:border-yellow-400 hover:bg-yellow-50/10'}`}
            >
              {worker.idCardImage ? (
                <>
                  <img src={worker.idCardImage} alt="ID" className="w-full h-full object-contain p-2" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                     <button
                        onClick={() => onEditImage(worker.id, 'idCardImage', worker.idCardImage!)}
                        className="p-2 bg-white rounded-full text-slate-800 hover:bg-yellow-400 transition-colors shadow-lg"
                        title="보정하기"
                     >
                        <Edit2 size={20} />
                     </button>
                     <button
                        onClick={() => idInputRef.current?.click()}
                        className="p-2 bg-white rounded-full text-slate-800 hover:bg-yellow-400 transition-colors shadow-lg"
                        title="변경하기"
                     >
                        <Upload size={20} />
                     </button>
                  </div>
                </>
              ) : (
                <div 
                    onClick={() => idInputRef.current?.click()}
                    className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
                >
                  <div className="p-3 bg-white rounded-full shadow-sm mb-2 text-slate-400 group-hover:text-yellow-500 transition-colors">
                    <Upload size={24} />
                  </div>
                  <span className="text-sm font-medium text-slate-400 group-hover:text-slate-600">이미지 업로드</span>
                </div>
              )}
              <input 
                type="file" 
                ref={idInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleFileChange(e, 'idCardImage')}
              />
            </div>
          </div>

          {/* Safety Cert Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                기초안전보건교육 이수증
            </label>
            <div 
                className={`relative group aspect-[1.6/1] rounded-xl border-2 border-dashed transition-all overflow-hidden ${worker.safetyCertImage ? 'border-green-400 bg-white' : 'border-slate-300 bg-slate-50 hover:border-green-400 hover:bg-green-50/10'}`}
            >
              {worker.safetyCertImage ? (
                <>
                  <img src={worker.safetyCertImage} alt="Cert" className="w-full h-full object-contain p-2" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                     <button
                        onClick={() => onEditImage(worker.id, 'safetyCertImage', worker.safetyCertImage!)}
                        className="p-2 bg-white rounded-full text-slate-800 hover:bg-green-400 transition-colors shadow-lg"
                        title="보정하기"
                     >
                        <Edit2 size={20} />
                     </button>
                     <button
                        onClick={() => certInputRef.current?.click()}
                        className="p-2 bg-white rounded-full text-slate-800 hover:bg-green-400 transition-colors shadow-lg"
                        title="변경하기"
                     >
                        <Upload size={20} />
                     </button>
                  </div>
                </>
              ) : (
                <div 
                    onClick={() => certInputRef.current?.click()}
                    className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
                >
                  <div className="p-3 bg-white rounded-full shadow-sm mb-2 text-slate-400 group-hover:text-green-500 transition-colors">
                    <Upload size={24} />
                  </div>
                  <span className="text-sm font-medium text-slate-400 group-hover:text-slate-600">이미지 업로드</span>
                </div>
              )}
               <input 
                type="file" 
                ref={certInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleFileChange(e, 'safetyCertImage')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
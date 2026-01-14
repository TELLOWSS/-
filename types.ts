export interface WorkerData {
  id: string;
  name: string;
  trade: string; // 공정 (e.g., 용접, 비계)
  team: string; // 소속 팀 (e.g., 1팀, 김반장팀)
  idCardImage: string | null; // Base64
  safetyCertImage: string | null; // Base64
  createdAt: number;
}

export interface CropState {
  rotation: number;
  zoom: number;
  croppedAreaPixels: { x: number; y: number; width: number; height: number } | null;
}

export interface Point {
  x: number;
  y: number;
}

export enum AppView {
  EDITOR = 'EDITOR',
  PRINT_PREVIEW = 'PRINT_PREVIEW',
}

export type PrintMode = 'LIST' | 'DETAIL';

export type DocumentType = 'ID_CARD' | 'SAFETY_CERT' | 'UNKNOWN';

export interface ExtractedDocumentInfo {
  type: DocumentType;
  name: string;
  trade: string;
  boundingBox: number[]; // [ymin, xmin, ymax, xmax] (0-1000 scale)
}

export interface AnalyzedDocument {
  type: DocumentType;
  name: string;
  trade: string;
  originalImage: string;
}
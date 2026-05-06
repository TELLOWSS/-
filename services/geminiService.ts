import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedDocumentInfo } from "../types";

const MODEL_CANDIDATES = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

type GeminiErrorCode = 'API_KEY_MISSING' | 'MODEL_NOT_FOUND' | 'QUOTA_EXCEEDED' | 'UNKNOWN';

const emitGeminiError = (message: string, code: GeminiErrorCode = 'UNKNOWN') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gemini-error', { detail: { message, code } }));
  }
};

const SYSTEM_INSTRUCTION = `
당신은 건설 현장 서류(신분증, 이수증) 인식 및 분류 전문가입니다.
이미지에는 **하나 또는 여러 개의 문서**가 포함되어 있을 수 있습니다 (예: 신분증과 이수증이 나란히 놓여있음).

각각의 문서를 개별적으로 탐지하여 다음 정보를 추출하세요.

1. **boundingBox**: 해당 문서의 영역 좌표 [ymin, xmin, ymax, xmax]. (이미지 전체 크기를 1000x1000으로 가정했을 때의 정수 좌표)
2. **type**: 문서 종류.
   - 'ID_CARD': 주민등록증, 운전면허증, 여권, 외국인등록증.
   - 'SAFETY_CERT': 건설업 기초안전보건교육 이수증.
   - 'UNKNOWN': 그 외.
3. **name**: 문서에 적힌 사람 이름.
4. **trade**: 직종/공정 (용접, 비계, 철근 등). 없으면 빈 문자열.

결과는 **JSON 배열** 형태여야 합니다. 문서가 하나만 있어도 배열에 담아주세요.
`;

export const extractWorkerInfo = async (imageBase64: string): Promise<ExtractedDocumentInfo[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key is missing.");
    emitGeminiError('API 키가 설정되지 않았습니다. .env.local의 GEMINI_API_KEY를 확인하세요.', 'API_KEY_MISSING');
    return [];
  }

  const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
  const ai = new GoogleGenAI({ apiKey });
  let lastErrorType: 'NOT_FOUND' | 'QUOTA' | 'UNKNOWN' = 'UNKNOWN';

  const isQuotaError = (error: any) => {
    return error?.status === 429 ||
      error?.code === 429 ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('RESOURCE_EXHAUSTED') ||
      (error?.error && (error.error.code === 429 || error.error.status === 'RESOURCE_EXHAUSTED'));
  };

  const isNotFoundError = (error: any) => {
    return error?.status === 404 ||
      error?.code === 404 ||
      error?.message?.includes('NOT_FOUND') ||
      error?.message?.includes('404') ||
      error?.message?.toLowerCase?.().includes('model');
  };

  for (const modelName of MODEL_CANDIDATES) {
    let attempt = 0;
    const maxAttempts = 4;

    while (attempt < maxAttempts) {
      try {
        const timeoutPromise = new Promise<null>((_, reject) => {
            setTimeout(() => reject(new Error("Request timed out")), 20000);
        });

        const apiCallPromise = ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64
                }
              },
              {
                text: "Find all ID cards and Safety Certificates in this image. Return them as a JSON list with bounding boxes."
              }
            ]
          },
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                  type: Type.OBJECT,
                  properties: {
                      type: { type: Type.STRING, enum: ['ID_CARD', 'SAFETY_CERT', 'UNKNOWN'] },
                      name: { type: Type.STRING },
                      trade: { type: Type.STRING },
                      boundingBox: {
                          type: Type.ARRAY,
                          items: { type: Type.INTEGER },
                          description: "[ymin, xmin, ymax, xmax] on 0-1000 scale"
                      }
                  },
                  required: ["type", "name", "boundingBox"]
              }
            }
          }
        });

        const response: any = await Promise.race([apiCallPromise, timeoutPromise]);
        const text = response.text;

        if (text) {
          const result = JSON.parse(text);
          return Array.isArray(result) ? result : [result];
        }
        return [];

      } catch (error: any) {
        if (isNotFoundError(error)) {
          lastErrorType = 'NOT_FOUND';
          console.warn(`Model not available: ${modelName}. Trying next model...`);
          break;
        }

        if (isQuotaError(error) && attempt < maxAttempts - 1) {
          lastErrorType = 'QUOTA';
          const delay = 2000 * Math.pow(2, attempt);
          console.warn(`Quota limit hit (429) on ${modelName}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
          continue;
        }

        if (isQuotaError(error)) {
          lastErrorType = 'QUOTA';
        }

        console.error("Gemini Extraction Error:", JSON.stringify(error, null, 2));
        lastErrorType = lastErrorType === 'UNKNOWN' ? 'UNKNOWN' : lastErrorType;
        break;
      }
    }
  }

  if (lastErrorType === 'NOT_FOUND') {
    emitGeminiError('AI 모델 경로를 찾을 수 없습니다(404). 잠시 후 다시 시도하거나 모델 권한을 확인하세요.', 'MODEL_NOT_FOUND');
  } else if (lastErrorType === 'QUOTA') {
    emitGeminiError('AI 사용량 한도(Quota)를 초과했습니다. 잠시 후 다시 시도하세요.', 'QUOTA_EXCEEDED');
  } else {
    emitGeminiError('AI 모델에 연결할 수 없습니다. 잠시 후 다시 시도하거나 API 키/모델 권한을 확인하세요.', 'UNKNOWN');
  }
  console.error('No available Gemini model could process the request.');
  return [];
};
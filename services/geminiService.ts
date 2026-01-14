import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedDocumentInfo } from "../types";

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
    return [];
  }

  const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
  const ai = new GoogleGenAI({ apiKey });

  let attempt = 0;
  const maxAttempts = 7; // Increased retries for stability

  while (attempt < maxAttempts) {
    try {
      const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error("Request timed out")), 20000);
      });

      const apiCallPromise = ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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
        // Ensure it's always an array
        return Array.isArray(result) ? result : [result];
      }
      return [];

    } catch (error: any) {
      // Enhanced error detection to catch nested error objects from GoogleGenAI or raw responses
      const isQuotaError = 
        error.status === 429 || 
        error.code === 429 || 
        error.message?.includes('429') || 
        error.message?.includes('quota') ||
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        (error.error && (error.error.code === 429 || error.error.status === 'RESOURCE_EXHAUSTED'));

      if (isQuotaError && attempt < maxAttempts - 1) {
        // Exponential backoff starting at 2 seconds
        const delay = 2000 * Math.pow(2, attempt);
        console.warn(`Quota limit hit (429). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        continue;
      }

      console.error("Gemini Extraction Error:", JSON.stringify(error, null, 2));
      if (attempt === maxAttempts - 1 || !isQuotaError) {
        return [];
      }
      attempt++;
    }
  }
  return [];
};
import { GoogleGenAI } from "@google/genai";

function getGeminiClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({ apiKey });
}

export const geminiService = {
  analyzeLogs: async (logs: any[]): Promise<string> => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return 'Chưa cấu hình VITE_GEMINI_API_KEY trong frontend/.env.';
      }

      const prompt = `
        You are an expert system administrator analyzing system logs for a hydroelectric reservoir management application.
        Please analyze the following logs and provide a brief summary of the system's health, highlighting any critical issues or warnings that need attention.
        Keep the response concise and in Vietnamese.
        
        Logs to analyze:
        ${JSON.stringify(logs, null, 2)}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text || 'Không có phản hồi từ AI.';
    } catch (error) {
      console.error("Gemini API Error:", error);
      return 'Đã xảy ra lỗi khi phân tích nhật ký bằng AI. Vui lòng thử lại sau.';
    }
  }
};

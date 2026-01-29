
import { GoogleGenAI, Type } from "@google/genai";
import { DrumHit } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Sends audio data to Gemini to detect drum hits.
 * We use a specialized prompt to act as a "cleaner" and transient analyzer.
 */
export async function analyzeDrumStem(audioBase64: string, mimeType: string): Promise<DrumHit[]> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: audioBase64,
                mimeType: mimeType
              }
            },
            {
              text: `Act as a professional audio engineer and drum transcriber. 
              Listen to this drum stem and perform high-precision transient analysis.
              
              CLEANING PIPELINE INSTRUCTIONS:
              1. Identify clear transients for Kick, Snare, and Hi-hats.
              2. Ignore low-level background noise, audio artifacts, or bleed from other instruments.
              3. If multiple hits of the SAME type occur within 30ms, only count the most prominent one (the peak).
              4. Ensure timestamps are strictly accurate to the millisecond.
              5. Map intensity to a velocity value between 0.1 and 1.0.
              
              Return a clean JSON array of objects with "time", "type" (kick, snare, hihat), and "velocity".
              Return ONLY the JSON array.`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              time: { type: Type.NUMBER },
              type: { type: Type.STRING },
              velocity: { type: Type.NUMBER }
            },
            required: ["time", "type", "velocity"]
          }
        }
      }
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as DrumHit[];
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    if (error?.status === 404) {
       throw new Error("Model configuration error. Please contact support.");
    }
    throw new Error("Analysis failed. Audio may be too complex or long.");
  }
}

import { GoogleGenAI, Type } from "@google/genai";

// AI Services for DashMeals
// These functions now call Gemini API directly from the frontend as per guidelines.

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
};

// 1. Assistant Vocal pour Livreurs
export const processDeliveryVoiceCommand = async (command: string) => {
  try {
    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tu es un assistant vocal pour livreurs de repas en RDC. 
      Interprète cette commande vocale : "${command}"
      Retourne une action JSON parmi : 
      - { "action": "update_status", "status": "arrived" }
      - { "action": "update_status", "status": "delivered" }
      - { "action": "call_customer" }
      - { "action": "navigate" }
      - { "action": "unknown" }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING },
            status: { type: Type.STRING },
          },
          required: ["action"],
        },
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("AI Error:", e);
    return { action: "unknown" };
  }
};

// 2. Support Client Intelligent
export const getSmartSupportResponse = async (userMessage: string, context: any) => {
  try {
    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tu es le support client de DashMeals, une app de livraison en RDC.
      Contexte de l'utilisateur : ${JSON.stringify(context)}
      Message de l'utilisateur : "${userMessage}"
      Réponds de manière polie, concise et utile. Utilise un ton amical.`,
    });
    return response.text || "Désolé, je ne peux pas répondre pour le moment.";
  } catch (e) {
    console.error("AI Error:", e);
    return "Le service de support est temporairement indisponible.";
  }
};

// 3. Analyses Prédictives pour Restaurateurs
export const getBusinessInsights = async (orderHistory: any[]) => {
  try {
    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyse cet historique de commandes pour un restaurant : ${JSON.stringify(orderHistory)}
      Fournis 3 conseils stratégiques (JSON) pour améliorer le business :
      - Prédiction des pics de demande
      - Suggestions de menu basées sur la popularité
      - Optimisation des stocks`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  impact: { type: Type.STRING },
                },
                required: ["title", "description", "impact"],
              },
            },
          },
          required: ["insights"],
        },
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("AI Error:", e);
    return null;
  }
};

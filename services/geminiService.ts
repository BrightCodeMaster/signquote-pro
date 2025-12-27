import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DesignVariant, LightingType, SignType, SignPlacement } from "../types";
import { FONT_LIBRARY, getAllFonts } from "../constants";

export interface DesignResponse {
  variants: DesignVariant[];
  placement?: SignPlacement;
}

const getSystemInstruction = (allowedFonts: string[]) => `
You are an expert sign designer and surveyor.
1. Generate exactly 3 distinct, professional design variations for a storefront sign in this SPECIFIC ORDER:
   - Variant 1 (Standard): Clean, highly readable, FRONT_LIT. Suggest standard commercial font (e.g. Montserrat, Helvetica).
   - Variant 2 (Premium): Elegant, upscale, BACK_LIT (Halo). Suggest premium font (e.g. Montserrat, Gotham).
   - Variant 3 (Impact): Bold, heavy visibility, FRONT_LIT. Suggest thick/bold font (e.g. Montserrat Bold, Impact).

   Constraints:
   - You MUST select fonts ONLY from this list: ${allowedFonts.join(', ')}. 
   - If "Montserrat" is available in the list, prefer it for consistency unless style dictates otherwise.
   - For "Channel Letters", suggest letter height between 10 and 24 inches.
   - For "Lightbox" or "Vinyl", suggest appropriate contrasting colors.

2. Analyze the provided storefront image to find the optimal mounting location for the sign.
   - PRIORITY 1: Center of the main awning or fascia above the entrance.
   - PRIORITY 2: Centered on the empty wall space directly above the door.
   - Return the bounding box coordinates (ymin, xmin, ymax, xmax) normalized to 0-1 range.

Strictly adhere to the JSON schema.
`;

const designSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    variants: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "A creative name for this design style" },
          fontFamily: { type: Type.STRING, description: "CSS font-family name" },
          letterSpacing: { type: Type.STRING, description: "CSS letter-spacing (e.g. '0.05em')" },
          lighting: { type: Type.STRING, enum: [LightingType.FRONT_LIT, LightingType.BACK_LIT, LightingType.NON_LIT] },
          roundedBacker: { type: Type.BOOLEAN },
          stroke: { type: Type.BOOLEAN },
          strokeWidth: { type: Type.STRING, description: "CSS stroke width (e.g. '2px')" },
          recommendedLetterHeightIn: { type: Type.NUMBER },
          color: { type: Type.STRING, description: "Hex color for text" },
          backgroundColor: { type: Type.STRING, description: "Hex color for background/backer if applicable" }
        },
        required: ["name", "fontFamily", "letterSpacing", "lighting", "roundedBacker", "stroke", "strokeWidth", "recommendedLetterHeightIn", "color"]
      }
    },
    placement: {
      type: Type.OBJECT,
      description: "Detected optimal bounding box for the sign placement (0-1 coordinates)",
      properties: {
        ymin: { type: Type.NUMBER },
        xmin: { type: Type.NUMBER },
        ymax: { type: Type.NUMBER },
        xmax: { type: Type.NUMBER }
      },
      required: ["ymin", "xmin", "ymax", "xmax"]
    }
  },
  required: ["variants", "placement"]
};

// Strict mapping for Option A/B/C requirements
const OPTION_CONFIGS = [
  {
    name: "Option A – Standard Visibility",
    description: "Most common choice. Bright front-lit letters with excellent daytime and nighttime visibility."
  },
  {
    name: "Option B – Premium Halo (Recommended)",
    description: "Recommended for a premium look. Halo back-lit letters create an elegant, upscale appearance and higher perceived value."
  },
  {
    name: "Option C – Maximum Impact",
    description: "Best for maximum impact. Thicker, bolder letters improve readability for longer names or wider storefronts."
  }
];

export const generateDesignVariants = async (
  text: string, 
  signType: SignType, 
  allowedFonts: string[] = getAllFonts(),
  imageBase64?: string,
  userContext: string = ""
): Promise<DesignResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const promptText = `
      Design 3 variations for a ${signType} sign.
      Text content: "${text}".
      Context/Vibe: ${userContext || "Modern and professional business"}.
      ${imageBase64 ? "Analyze the image for optimal sign placement." : ""}
    `;

    const contents = imageBase64 
      ? [
          { text: promptText },
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
        ]
      : [{ text: promptText }];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: getSystemInstruction(allowedFonts),
        responseMimeType: "application/json",
        responseSchema: designSchema
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No data returned from AI");
    
    const parsed = JSON.parse(jsonText);

    // Post-process variants to enforce Option A/B/C naming and descriptions
    const mappedVariants = parsed.variants.slice(0, 3).map((v: DesignVariant, index: number) => {
      const config = OPTION_CONFIGS[index] || OPTION_CONFIGS[0];
      return {
        ...v,
        name: config.name,
        description: config.description,
        // Enforce lighting types to match requirements if AI deviates
        lighting: index === 1 ? LightingType.BACK_LIT : LightingType.FRONT_LIT
      };
    });

    return {
      variants: mappedVariants,
      placement: parsed.placement
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback if AI fails to ensure app is usable
    const fallbackFont = allowedFonts[0] || "Arial";
    return {
      variants: [
        {
          name: OPTION_CONFIGS[0].name,
          description: OPTION_CONFIGS[0].description,
          fontFamily: fallbackFont,
          letterSpacing: "0em",
          lighting: LightingType.FRONT_LIT,
          roundedBacker: false,
          stroke: false,
          strokeWidth: "0px",
          recommendedLetterHeightIn: 18,
          color: "#ffffff",
          backgroundColor: "#000000"
        },
        {
          name: OPTION_CONFIGS[1].name,
          description: OPTION_CONFIGS[1].description,
          fontFamily: allowedFonts[1] || fallbackFont,
          letterSpacing: "0.2em",
          lighting: LightingType.BACK_LIT,
          roundedBacker: false,
          stroke: true,
          strokeWidth: "1px",
          recommendedLetterHeightIn: 14,
          color: "#333333"
        },
        {
          name: OPTION_CONFIGS[2].name,
          description: OPTION_CONFIGS[2].description,
          fontFamily: allowedFonts[2] || fallbackFont,
          letterSpacing: "0em",
          lighting: LightingType.FRONT_LIT,
          roundedBacker: true,
          stroke: true,
          strokeWidth: "2px",
          recommendedLetterHeightIn: 24,
          color: "#ff0000"
        }
      ],
      placement: { ymin: 0.2, xmin: 0.3, ymax: 0.4, xmax: 0.7 } 
    };
  }
};
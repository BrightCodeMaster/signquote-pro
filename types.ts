export enum SignType {
  CHANNEL_LETTERS = 'Channel Letters',
  LIGHTBOX = 'Lightbox',
  WINDOW_VINYL = 'Window Vinyl',
}

export enum LightingType {
  NON_LIT = 'NON_LIT',
  FRONT_LIT = 'FRONT_LIT',
  BACK_LIT = 'BACK_LIT',
}

export interface DesignVariant {
  name: string;
  fontFamily: string;
  letterSpacing: string; // e.g. "0.05em"
  lighting: LightingType;
  roundedBacker: boolean;
  stroke: boolean;
  strokeWidth: string; // e.g. "2px"
  recommendedLetterHeightIn: number;
  color?: string;
  backgroundColor?: string;
  description?: string;
}

export interface SignPlacement {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface InstallConfig {
  heightFeet: number;
  liftType: 'NONE' | 'SCISSOR' | 'BOOM';
  electricalWork: boolean;
  permit: boolean;
  hardAccess: boolean;
  address: string;
  clientName: string;
}

export interface QuoteResult {
  fabricationCost: number;
  installationCost: number;
  subtotal: number;
  gst: number;
  total: number;
  breakdown: {
    fabBase: number;
    fabAdders: string[];
    installLabor: number;
    installLift: number;
    installAdders: string[];
  };
}

export interface CalibrationData {
  pxPerInch: number;
  referencePixels: number;
  referenceRealInches: number;
}
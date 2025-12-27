import { PRICING } from "../constants";
import { SignType, LightingType, InstallConfig, QuoteResult, DesignVariant } from "../types";

export const calculateQuote = (
  signType: SignType,
  dimensions: { widthIn: number; heightIn: number },
  text: string,
  variant: DesignVariant,
  installConfig: InstallConfig,
  isRush: boolean,
  hasLamination: boolean = false,
  lightboxDepth: number = 4
): QuoteResult => {
  let fabCost = 0;
  const fabAdders: string[] = [];

  // --- Fabrication Calculation ---
  if (signType === SignType.CHANNEL_LETTERS) {
    const rules = PRICING.FABRICATION[SignType.CHANNEL_LETTERS];
    const letterCount = text.replace(/\s/g, '').length;
    
    let rawCost = 0;
    // Base cost per letter
    const baseLettersCost = letterCount * rules.BASE_PER_LETTER;
    fabAdders.push(`${letterCount} Letters Base @ $${rules.BASE_PER_LETTER}: $${baseLettersCost.toFixed(2)}`);
    rawCost += baseLettersCost;

    // Height cost
    const heightCost = letterCount * dimensions.heightIn * rules.PER_INCH_HEIGHT;
    fabAdders.push(`Height Adder (${dimensions.heightIn}"): $${heightCost.toFixed(2)}`);
    rawCost += heightCost;

    // Lighting
    if (variant.lighting === LightingType.FRONT_LIT) {
      const litCost = letterCount * rules.LIGHTING_ADDER.FRONT_LIT;
      fabAdders.push(`Front Lit Upgrade: $${litCost.toFixed(2)}`);
      rawCost += litCost;
    } else if (variant.lighting === LightingType.BACK_LIT) {
      const litCost = letterCount * rules.LIGHTING_ADDER.BACK_LIT;
      fabAdders.push(`Back Lit Upgrade: $${litCost.toFixed(2)}`);
      rawCost += litCost;
    }

    // Backer
    if (variant.roundedBacker) {
      fabAdders.push(`Raceway/Backer: $${rules.BACKER_ADDER.toFixed(2)}`);
      rawCost += rules.BACKER_ADDER;
    }

    fabCost = Math.max(rawCost, rules.MIN_PRICE);
    if (fabCost === rules.MIN_PRICE && rawCost < rules.MIN_PRICE) {
      fabAdders.push(`Minimum Pricing Applied: $${rules.MIN_PRICE}`);
    }

  } else if (signType === SignType.LIGHTBOX) {
    const rules = PRICING.FABRICATION[SignType.LIGHTBOX];
    const sqft = (dimensions.widthIn * dimensions.heightIn) / 144;
    
    let rawCost = sqft * rules.PER_SQFT;
    fabAdders.push(`Size ${sqft.toFixed(1)} sqft @ $${rules.PER_SQFT}: $${rawCost.toFixed(2)}`);

    // Depth
    if (lightboxDepth > rules.DEPTH_BASE) {
      const depthExcess = lightboxDepth - rules.DEPTH_BASE;
      const depthCost = depthExcess * rules.DEPTH_ADDER_PER_INCH;
      fabAdders.push(`Depth Adder (${depthExcess}" extra): $${depthCost.toFixed(2)}`);
      rawCost += depthCost;
    }

    // Lighting (Assumed flat for lightbox based on simplified rules, or could be per sqft, but adhering to prompt "Lighting adder: 160")
    if (variant.lighting === LightingType.FRONT_LIT) {
      fabAdders.push(`Internal Illumination: $${rules.LIGHTING_ADDER_FRONT_LIT}`);
      rawCost += rules.LIGHTING_ADDER_FRONT_LIT;
    }

    fabCost = Math.max(rawCost, rules.MIN_PRICE);
    if (fabCost === rules.MIN_PRICE && rawCost < rules.MIN_PRICE) {
      fabAdders.push(`Minimum Pricing Applied: $${rules.MIN_PRICE}`);
    }

  } else if (signType === SignType.WINDOW_VINYL) {
    const rules = PRICING.FABRICATION[SignType.WINDOW_VINYL];
    const sqft = (dimensions.widthIn * dimensions.heightIn) / 144;
    
    let rawCost = sqft * rules.PER_SQFT;
    fabAdders.push(`Size ${sqft.toFixed(1)} sqft @ $${rules.PER_SQFT}: $${rawCost.toFixed(2)}`);

    if (hasLamination) {
      const lamCost = rawCost * rules.LAMINATION_PERCENT;
      fabAdders.push(`Lamination (+25%): $${lamCost.toFixed(2)}`);
      rawCost += lamCost;
    }

    fabCost = Math.max(rawCost, rules.MIN_PRICE);
  }

  // Rush Order
  if (isRush) {
    const rushFee = fabCost * PRICING.FABRICATION.RUSH_ORDER_PERCENT;
    fabAdders.push(`Rush Order (+12%): $${rushFee.toFixed(2)}`);
    fabCost += rushFee;
  }

  // --- Installation Calculation ---
  const iRules = PRICING.INSTALLATION;
  const installAdders: string[] = [];
  
  let installBase = iRules.BASE_TRIP;
  installAdders.push(`Base Trip Fee: $${iRules.BASE_TRIP}`);

  // Height -> Hours
  const tier = iRules.HEIGHT_TIERS.find(t => installConfig.heightFeet <= t.maxFt) || iRules.HEIGHT_TIERS[iRules.HEIGHT_TIERS.length - 1];
  const laborCost = tier.hours * iRules.LABOR_RATE;
  installAdders.push(`Labor (${tier.hours}hrs @ $${iRules.LABOR_RATE}/hr): $${laborCost.toFixed(2)}`);
  
  let liftCost = 0;
  if (installConfig.liftType === 'SCISSOR') liftCost = iRules.LIFT.SCISSOR;
  if (installConfig.liftType === 'BOOM') liftCost = iRules.LIFT.BOOM;
  if (liftCost > 0) installAdders.push(`${installConfig.liftType} Lift: $${liftCost}`);

  let extras = 0;
  if (installConfig.electricalWork) {
    extras += iRules.ELECTRICAL;
    installAdders.push(`Electrical Hookup: $${iRules.ELECTRICAL}`);
  }
  if (installConfig.permit) {
    extras += iRules.PERMIT;
    installAdders.push(`Permit Allowance: $${iRules.PERMIT}`);
  }
  if (installConfig.hardAccess) {
    extras += iRules.HARD_ACCESS;
    installAdders.push(`Hard Access/Parking: $${iRules.HARD_ACCESS}`);
  }

  const preContingencyInstall = installBase + laborCost + liftCost + extras;
  const contingency = preContingencyInstall * iRules.CONTINGENCY_PERCENT;
  installAdders.push(`Contingency (10%): $${contingency.toFixed(2)}`);

  const installationCost = preContingencyInstall + contingency;

  // --- Totals ---
  const subtotal = fabCost + installationCost;
  const gst = subtotal * PRICING.TAX.GST;
  const total = subtotal + gst;

  return {
    fabricationCost: fabCost,
    installationCost: installationCost,
    subtotal,
    gst,
    total,
    breakdown: {
      fabBase: fabCost, // This is total fab
      fabAdders,
      installLabor: laborCost,
      installLift: liftCost,
      installAdders
    }
  };
};
import React, { useState, useEffect, useMemo } from 'react';
import { ImageCalibrator } from './components/ImageCalibrator';
import { DraggableSign } from './components/DraggableSign';
import { generateDesignVariants } from './services/geminiService';
import { calculateQuote } from './utils/pricing';
import { DesignVariant, SignType, InstallConfig, QuoteResult, LightingType, SignPlacement } from './types';
import { PRICING, FONT_LIBRARY, getAllFonts } from './constants';
import { Loader2, Download, Calculator, Palette, Wand2, Type, Star } from 'lucide-react';
import jsPDF from 'jspdf';

const App: React.FC = () => {
  // State
  const [step, setStep] = useState(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pxPerInch, setPxPerInch] = useState<number | null>(null);
  
  // Sign Config
  const [signType, setSignType] = useState<SignType>(SignType.CHANNEL_LETTERS);
  const [signText, setSignText] = useState("OPEN");
  const [widthIn, setWidthIn] = useState<number>(0);
  const [heightIn, setHeightIn] = useState<number>(18); // Default for channel letters
  const [isRush, setIsRush] = useState(false);
  const [lightboxDepth, setLightboxDepth] = useState(4);
  const [hasLamination, setHasLamination] = useState(false);

  // Font Config
  const [fontCategory, setFontCategory] = useState<string>("General Commercial");
  const [selectedFonts, setSelectedFonts] = useState<string[]>([]);
  const [useSelectedFontsOnly, setUseSelectedFontsOnly] = useState<boolean>(true);

  // Initialize selectedFonts with all fonts from the default category on mount
  useEffect(() => {
    // Optional: Pre-select all or none. Let's pre-select none to encourage user choice, 
    // OR if requirements say 'If no fonts selected, fall back to default list', we can leave empty.
    // Let's keep empty initially and handle the logic at submission.
  }, []);

  // Install Config
  const [installConfig, setInstallConfig] = useState<InstallConfig>({
    heightFeet: 10,
    liftType: 'NONE',
    electricalWork: true,
    permit: true,
    hardAccess: false,
    address: '',
    clientName: ''
  });

  // AI & Design
  const [isGenerating, setIsGenerating] = useState(false);
  const [variants, setVariants] = useState<DesignVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<DesignVariant | null>(null);
  const [placement, setPlacement] = useState<SignPlacement | undefined>(undefined);

  // Quote
  const quote: QuoteResult | null = useMemo(() => {
    if (!selectedVariant) return null;
    return calculateQuote(
      signType,
      { widthIn: signType === SignType.CHANNEL_LETTERS ? widthIn : widthIn, heightIn },
      signText,
      selectedVariant,
      installConfig,
      isRush,
      hasLamination,
      lightboxDepth
    );
  }, [signType, signText, widthIn, heightIn, selectedVariant, installConfig, isRush, lightboxDepth, hasLamination]);

  // Handlers
  const handleImageLoaded = (file: File) => {
    setImageFile(file);
    setStep(1); // Stay on step 1 until calibrated
    setPlacement(undefined); // Reset placement on new image
    setVariants([]);
    setSelectedVariant(null);
  };

  const handleCalibrated = (val: number) => {
    setPxPerInch(val);
    if (val > 0) setStep(2);
  };

  const toggleFontSelection = (font: string) => {
    setSelectedFonts(prev => 
      prev.includes(font) ? prev.filter(f => f !== font) : [...prev, font]
    );
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data url prefix "data:image/jpeg;base64,"
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleGenerateDesigns = async () => {
    if (!signText) return;
    setIsGenerating(true);
    try {
      let imageBase64: string | undefined = undefined;
      if (imageFile) {
        imageBase64 = await fileToBase64(imageFile);
      }

      // Determine allowed fonts based on toggle and selection
      let allowedFonts: string[] = [];
      if (useSelectedFontsOnly && selectedFonts.length > 0) {
        allowedFonts = selectedFonts;
      } else {
        // Fallback to all fonts in the current category if none selected, or if toggle is off
        // Requirement: "If no fonts selected, fall back to the default category list."
        // We'll interpret 'default category list' as the fonts in the currently visible category, 
        // or effectively the currently active category.
        allowedFonts = FONT_LIBRARY[fontCategory];
      }

      const response = await generateDesignVariants(signText, signType, allowedFonts, imageBase64);
      setVariants(response.variants);
      setPlacement(response.placement);

      if (response.variants.length > 0) {
        setSelectedVariant(response.variants[0]);
        // Auto-update height if AI recommends it
        if (signType === SignType.CHANNEL_LETTERS) {
            setHeightIn(response.variants[0].recommendedLetterHeightIn);
        }
      }
      setStep(3);
    } catch (e) {
      console.error(e);
      alert("Failed to generate designs. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = () => {
    if (!quote || !selectedVariant) return;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Signage Quote", 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Client: ${installConfig.clientName}`, 20, 35);
    doc.text(`Address: ${installConfig.address}`, 20, 42);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 49);

    doc.setLineWidth(0.5);
    doc.line(20, 55, 190, 55);

    doc.setFontSize(14);
    doc.text("Sign Specifications", 20, 65);
    doc.setFontSize(10);
    doc.text(`Type: ${signType}`, 20, 72);
    doc.text(`Content: "${signText}"`, 20, 77);
    doc.text(`Dimensions: ${signType === SignType.CHANNEL_LETTERS ? `Height ${heightIn}"` : `${widthIn}" x ${heightIn}"`}`, 20, 82);
    
    // Updated PDF fields
    doc.text(`Option: ${selectedVariant.name}`, 20, 87);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    const splitDesc = doc.splitTextToSize(selectedVariant.description || "", 170);
    doc.text(splitDesc, 20, 92);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Font: ${selectedVariant.fontFamily}`, 20, 105);
    doc.text(`Lighting: ${selectedVariant.lighting}`, 20, 110);

    let y = 120;
    doc.setFontSize(14);
    doc.text("Pricing Breakdown", 20, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Fabrication", 20, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    
    quote.breakdown.fabAdders.forEach(line => {
      doc.text(`- ${line}`, 25, y);
      y += 5;
    });
    
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Installation", 20, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    quote.breakdown.installAdders.forEach(line => {
      doc.text(`- ${line}`, 25, y);
      y += 5;
    });

    y += 10;
    doc.line(20, y, 190, y);
    y += 10;
    
    doc.setFontSize(12);
    doc.text(`Subtotal: $${quote.subtotal.toFixed(2)}`, 140, y);
    y += 7;
    doc.text(`GST (5%): $${quote.gst.toFixed(2)}`, 140, y);
    y += 10;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Total: $${quote.total.toFixed(2)}`, 140, y);

    // Disclaimer
    y += 30;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Valid for 30 days. 50% deposit required to begin production.", 20, y);

    doc.save("sign_quote.pdf");
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Panel: Controls */}
      <div className="w-full md:w-96 bg-white shadow-xl z-10 flex flex-col h-screen overflow-y-auto border-r border-gray-200">
        <div className="p-6 bg-slate-900 text-white sticky top-0 z-20">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="w-6 h-6 text-blue-400" />
            SignQuote Pro
          </h1>
          <p className="text-slate-400 text-xs mt-1">Mockup & Estimate Tool</p>
        </div>

        <div className="p-6 space-y-8 flex-1">
          {/* Step 1: Sign Config */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
              Specs
            </h2>
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sign Type</label>
              <select 
                value={signType} 
                onChange={(e) => setSignType(e.target.value as SignType)}
                className="w-full p-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {Object.values(SignType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Text Content</label>
              <input 
                type="text" 
                value={signText}
                onChange={(e) => setSignText(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. JOE'S PIZZA"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Height (in)</label>
                 <input 
                  type="number" 
                  value={heightIn}
                  onChange={(e) => setHeightIn(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg"
                 />
              </div>
              {signType !== SignType.CHANNEL_LETTERS && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Width (in)</label>
                  <input 
                    type="number" 
                    value={widthIn}
                    onChange={(e) => setWidthIn(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              )}
            </div>

            {signType === SignType.LIGHTBOX && (
               <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Depth (in)</label>
                  <input 
                    type="number" 
                    value={lightboxDepth}
                    onChange={(e) => setLightboxDepth(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                  />
               </div>
            )}
            
            {signType === SignType.WINDOW_VINYL && (
               <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={hasLamination}
                    onChange={(e) => setHasLamination(e.target.checked)}
                    id="lam"
                  />
                  <label htmlFor="lam" className="text-sm">Add Lamination</label>
               </div>
            )}

            {/* Font Selection */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Type className="w-4 h-4" /> Font Library
              </h3>
              
              <div className="mb-2">
                <select 
                  value={fontCategory}
                  onChange={(e) => {
                    setFontCategory(e.target.value);
                    setSelectedFonts([]); // Clear selection on category change or keep it? 
                    // Usually UX expects clearing if the list changes completely, 
                    // but for now we'll just clear to avoid confusion.
                  }}
                  className="w-full p-2 text-sm border rounded bg-gray-50"
                >
                  {Object.keys(FONT_LIBRARY).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="max-h-32 overflow-y-auto border rounded p-2 bg-gray-50 mb-2">
                {FONT_LIBRARY[fontCategory].map(font => (
                  <label key={font} className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-gray-100 rounded px-1">
                    <input 
                      type="checkbox" 
                      checked={selectedFonts.includes(font)}
                      onChange={() => toggleFontSelection(font)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span style={{ fontFamily: font }}>{font}</span>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${useSelectedFontsOnly ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${useSelectedFontsOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <input 
                    type="checkbox" 
                    checked={useSelectedFontsOnly}
                    onChange={(e) => setUseSelectedFontsOnly(e.target.checked)}
                    className="hidden"
                  />
                  Use selected only
                </label>
                <span className="text-xs text-gray-400">
                  {selectedFonts.length} selected
                </span>
              </div>
            </div>

            <button 
              onClick={handleGenerateDesigns}
              disabled={isGenerating || !pxPerInch}
              className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition
                ${isGenerating ? 'bg-gray-300' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg'}
              `}
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 className="w-5 h-5" />}
              {isGenerating ? 'Designing...' : 'Generate Variations'}
            </button>
            {!pxPerInch && <p className="text-xs text-red-500 text-center">Please calibrate photo first</p>}
          </section>

          {/* Step 2: Design Selection */}
          {variants.length > 0 && (
            <section className="space-y-4 pt-4 border-t">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                Design Styles
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {variants.map((v, idx) => {
                  const isRecommended = v.name.includes("Recommended");
                  return (
                    <div 
                      key={idx}
                      onClick={() => {
                          setSelectedVariant(v);
                          if(signType === SignType.CHANNEL_LETTERS) setHeightIn(v.recommendedLetterHeightIn);
                      }}
                      className={`relative p-3 rounded-lg border-2 cursor-pointer transition flex flex-col gap-1
                        ${selectedVariant === v ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}
                      `}
                    >
                      {isRecommended && (
                        <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> Recommended
                        </div>
                      )}
                      
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-sm text-gray-900">{v.name.replace(" (Recommended)", "")}</p>
                        {selectedVariant === v && <div className="w-3 h-3 bg-blue-600 rounded-full mt-1" />}
                      </div>
                      
                      <p className="text-xs text-gray-600 leading-tight">
                        {v.description}
                      </p>
                      
                      <div className="mt-2 flex gap-2 text-[10px] text-gray-400 font-mono">
                        <span className="bg-gray-100 px-1 rounded">{v.fontFamily}</span>
                        <span className="bg-gray-100 px-1 rounded">{v.lighting}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Step 3: Quote Config */}
          <section className="space-y-4 pt-4 border-t">
             <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                Installation
              </h2>
              
              <div className="space-y-3">
                <input 
                  className="w-full p-2 border rounded text-sm" 
                  placeholder="Client Name"
                  value={installConfig.clientName}
                  onChange={e => setInstallConfig({...installConfig, clientName: e.target.value})}
                />
                <input 
                  className="w-full p-2 border rounded text-sm" 
                  placeholder="Installation Address"
                  value={installConfig.address}
                  onChange={e => setInstallConfig({...installConfig, address: e.target.value})}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500">Height (ft)</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border rounded text-sm" 
                      value={installConfig.heightFeet}
                      onChange={e => setInstallConfig({...installConfig, heightFeet: Number(e.target.value)})}
                    />
                  </div>
                   <div>
                    <label className="block text-xs text-gray-500">Lift</label>
                    <select 
                      className="w-full p-2 border rounded text-sm"
                      value={installConfig.liftType}
                      onChange={e => setInstallConfig({...installConfig, liftType: e.target.value as any})}
                    >
                      <option value="NONE">Ladder</option>
                      <option value="SCISSOR">Scissor Lift</option>
                      <option value="BOOM">Boom Lift</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                   <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={installConfig.electricalWork} onChange={e => setInstallConfig({...installConfig, electricalWork: e.target.checked})} />
                      Electrical
                   </label>
                   <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={installConfig.permit} onChange={e => setInstallConfig({...installConfig, permit: e.target.checked})} />
                      Permit
                   </label>
                   <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={installConfig.hardAccess} onChange={e => setInstallConfig({...installConfig, hardAccess: e.target.checked})} />
                      Hard Access
                   </label>
                   <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={isRush} onChange={e => setIsRush(e.target.checked)} />
                      Rush Order
                   </label>
                </div>
              </div>
          </section>
        </div>
        
        {/* Quote Footer */}
        {quote && (
          <div className="p-4 bg-gray-50 border-t border-gray-200">
             <div className="flex justify-between items-end mb-4">
                <div className="text-sm text-gray-600">Total Estimate</div>
                <div className="text-2xl font-bold text-gray-900">${quote.total.toFixed(2)}</div>
             </div>
             <button 
              onClick={handleExportPDF}
              className="w-full py-2 bg-slate-800 text-white rounded hover:bg-slate-900 flex items-center justify-center gap-2"
             >
               <Download className="w-4 h-4" /> Export PDF Quote
             </button>
          </div>
        )}
      </div>

      {/* Main Panel: Visuals */}
      <div className="flex-1 bg-gray-100 flex items-center justify-center p-8 relative overflow-hidden">
        <div className="bg-white shadow-2xl rounded-xl overflow-hidden max-w-5xl w-full relative">
           <ImageCalibrator 
             onImageLoaded={handleImageLoaded}
             onCalibrated={handleCalibrated}
             pxPerInch={pxPerInch}
           >
              {pxPerInch && selectedVariant && (
                <DraggableSign 
                  variant={selectedVariant}
                  text={signText}
                  signType={signType}
                  dimensions={{ widthIn, heightIn }}
                  pxPerInch={pxPerInch}
                  placement={placement}
                />
              )}
           </ImageCalibrator>
           
           {/* Help Overlay if needed */}
           {pxPerInch && !selectedVariant && (
             <div className="absolute top-4 right-4 bg-white/90 p-4 rounded-lg shadow-lg max-w-xs z-10 pointer-events-none">
               <h3 className="font-bold text-gray-800 mb-1">Ready to Design</h3>
               <p className="text-sm text-gray-600">Use the left panel to configure your sign and generate AI designs.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default App;
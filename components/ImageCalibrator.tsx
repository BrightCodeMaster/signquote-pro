import React, { useState, useRef, useEffect } from 'react';
import { Ruler, Upload } from 'lucide-react';

interface Props {
  onImageLoaded: (file: File, imageUrl: string) => void;
  onCalibrated: (pxPerInch: number) => void;
  pxPerInch: number | null;
  children?: React.ReactNode;
}

export const ImageCalibrator: React.FC<Props> = ({ onImageLoaded, onCalibrated, pxPerInch, children }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [realDistance, setRealDistance] = useState<string>('');
  
  const imageRef = useRef<HTMLImageElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      onImageLoaded(file, url);
      // Reset calibration
      onCalibrated(0);
      setStartPoint(null);
      setEndPoint(null);
      setShowInput(false);
    }
  };

  const getCoords = (e: React.MouseEvent) => {
    if (!imageRef.current) return { x: 0, y: 0 };
    const rect = imageRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageUrl || pxPerInch) return; // Don't allow recalibrating easily to avoid accidental clicks (UX choice for MVP)
    if (showInput) return;
    
    setIsDrawing(true);
    const coords = getCoords(e);
    setStartPoint(coords);
    setEndPoint(coords);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    setEndPoint(getCoords(e));
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setShowInput(true);
  };

  const submitCalibration = () => {
    if (!startPoint || !endPoint) return;
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    
    const inches = parseFloat(realDistance);
    if (!isNaN(inches) && inches > 0) {
      onCalibrated(distPx / inches);
      setShowInput(false);
    }
  };

  const resetCalibration = () => {
    onCalibrated(0);
    setStartPoint(null);
    setEndPoint(null);
    setShowInput(false);
    setRealDistance('');
  };

  return (
    <div className="flex flex-col gap-4">
      {!imageUrl ? (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition cursor-pointer relative">
          <input 
            type="file" 
            accept="image/png, image/jpeg" 
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <Upload className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-600">Upload Storefront Photo</p>
          <p className="text-sm text-gray-400">JPG or PNG supported</p>
        </div>
      ) : (
        <div className="relative border rounded-lg overflow-hidden bg-gray-900 group inline-block w-full">
            <img 
              ref={imageRef}
              src={imageUrl} 
              alt="Storefront" 
              className="w-full h-auto block select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onDragStart={(e) => e.preventDefault()}
            />
            
            {/* Children Elements (Sign Overlay) */}
            {children}

            {/* Overlay Instructions if not calibrated */}
            {!pxPerInch && !showInput && (
              <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg pointer-events-none backdrop-blur-sm z-30">
                <p className="flex items-center gap-2"><Ruler className="w-4 h-4" /> Click and drag a known length (e.g. door width) to calibrate.</p>
              </div>
            )}

            {/* Drawing Line */}
            {startPoint && endPoint && (
              <svg className="absolute inset-0 pointer-events-none w-full h-full z-40">
                <line 
                  x1={startPoint.x} 
                  y1={startPoint.y} 
                  x2={endPoint.x} 
                  y2={endPoint.y} 
                  stroke="#ef4444" 
                  strokeWidth="2" 
                />
                <circle cx={startPoint.x} cy={startPoint.y} r="4" fill="#ef4444" />
                <circle cx={endPoint.x} cy={endPoint.y} r="4" fill="#ef4444" />
              </svg>
            )}

            {/* Input Dialog */}
            {showInput && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-lg shadow-xl z-50 w-64">
                <h3 className="font-bold text-gray-900 mb-2">Calibration</h3>
                <p className="text-sm text-gray-600 mb-3">How many inches is this line?</p>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={realDistance}
                    onChange={(e) => setRealDistance(e.target.value)}
                    className="border rounded px-2 py-1 w-full"
                    placeholder="e.g. 36"
                    autoFocus
                  />
                  <button 
                    onClick={submitCalibration}
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Set
                  </button>
                </div>
              </div>
            )}

            {pxPerInch && (
              <button 
                onClick={resetCalibration}
                className="absolute top-4 right-4 bg-white/90 text-red-600 px-3 py-1 rounded shadow text-sm font-medium hover:bg-white z-30"
              >
                Recalibrate
              </button>
            )}
        </div>
      )}
    </div>
  );
};
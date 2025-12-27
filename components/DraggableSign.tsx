import React, { useState, useEffect, useRef } from 'react';
import { DesignVariant, SignType, LightingType, SignPlacement } from '../types';

interface Props {
  variant: DesignVariant;
  text: string;
  signType: SignType;
  dimensions: { widthIn: number; heightIn: number };
  pxPerInch: number;
  placement?: SignPlacement;
}

export const DraggableSign: React.FC<Props> = ({ variant, text, signType, dimensions, pxPerInch, placement }) => {
  // Store position in pixels relative to the image container
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  // Calculate pixel dimensions
  const heightPx = dimensions.heightIn * pxPerInch;
  const widthPx = dimensions.widthIn * pxPerInch;

  // Initialize position based on placement or default to center
  useEffect(() => {
    if (ref.current && ref.current.offsetParent) {
      const parent = ref.current.offsetParent as HTMLElement;
      
      let newX = 0;
      let newY = 0;

      if (placement) {
        // Use detected placement center
        newX = ((placement.xmin + placement.xmax) / 2) * parent.clientWidth;
        newY = ((placement.ymin + placement.ymax) / 2) * parent.clientHeight;
      } else if (!hasInitialized) {
        // Default to center if first run and no placement
        newX = parent.clientWidth / 2;
        newY = parent.clientHeight / 2;
      } else {
        return; // Don't reset if already initialized and no new placement
      }
      
      setPosition({ x: newX, y: newY });
      setHasInitialized(true);
    }
  }, [placement, hasInitialized]); // Re-run when placement changes from AI

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drag from bubbling to image
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Visual Bounding Box (The "Detected Zone")
  const renderBoundingBox = () => {
    if (!placement) return null;
    return (
      <div 
        className="absolute border-2 border-dashed border-yellow-400/70 pointer-events-none z-10 flex items-start justify-center"
        style={{
          top: `${placement.ymin * 100}%`,
          left: `${placement.xmin * 100}%`,
          width: `${(placement.xmax - placement.xmin) * 100}%`,
          height: `${(placement.ymax - placement.ymin) * 100}%`,
        }}
      >
        <span className="bg-yellow-400/90 text-black text-[10px] px-1 font-bold uppercase tracking-wider rounded-b">
          Detected Zone
        </span>
      </div>
    );
  };

  // Sign Style Construction
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    transform: 'translate(-50%, -50%)', // Center the sign on the position point
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    zIndex: 20,
    fontFamily: variant.fontFamily,
    color: variant.color || '#fff',
    letterSpacing: variant.letterSpacing,
    whiteSpace: 'nowrap',
    lineHeight: 1, // Crucial for accurate height alignment
  };

  // Specific Styles based on Type
  if (signType === SignType.CHANNEL_LETTERS) {
    // 3D Depth Logic
    // Depth scales with letter height (e.g. 500px height -> 15-20px depth)
    const depthPx = Math.max(2, Math.round(heightPx * 0.04));
    
    // Base shadows array
    const shadows: string[] = [];

    // 1. Highlight (Top-Left Edge) for realism - simulates light hitting top edge
    shadows.push(`-1px -1px 1px rgba(255,255,255,0.5)`);

    // 2. 3D Thickness (The "Return") - Solid stack
    const returnColor = '#1a1a1a'; // Dark casing color
    for (let i = 1; i <= depthPx; i++) {
        shadows.push(`${i}px ${i}px 0px ${returnColor}`);
    }

    // 3. Lighting / Drop Shadow (The "Wall Interaction")
    const castDistance = depthPx + 3;
    
    if (variant.lighting === LightingType.BACK_LIT) {
        // Halo effect: Glow is BEHIND the can (after thickness)
        const glowColor = variant.color || '#ffffff';
        // Add multiple blur layers for smooth glow
        shadows.push(`${castDistance}px ${castDistance}px ${heightPx * 0.1}px ${glowColor}`);
        shadows.push(`${castDistance}px ${castDistance}px ${heightPx * 0.3}px ${glowColor}`);
        // Add a dark "blocker" shadow right behind the can to separate it from the glow slightly?
        // No, standard halo is enough.
    } else if (variant.lighting === LightingType.FRONT_LIT) {
        // Cast shadow on wall
        shadows.push(`${castDistance}px ${castDistance}px ${heightPx * 0.15}px rgba(0,0,0,0.6)`);
        
        // Add a slight bloom to the face itself by adding a 0-offset glow at the beginning?
        // Note: text-shadow renders back-to-front. 
        // We can't put a shadow "on top" of text.
        // But we can simulate inner glow using the text color itself or brightness.
    } else {
        // Non-lit: Just a standard drop shadow
        shadows.push(`${castDistance}px ${castDistance}px ${heightPx * 0.08}px rgba(0,0,0,0.5)`);
    }

    containerStyle.textShadow = shadows.join(', ');
    
    // Improve Font Sizing Logic: Cap Height approx
    const adjustedFontSize = heightPx / 0.7;
    containerStyle.fontSize = `${adjustedFontSize}px`; 

    if (variant.stroke) {
      containerStyle.WebkitTextStroke = `${variant.strokeWidth} ${variant.backgroundColor || '#000'}`;
    }

    if (variant.roundedBacker) {
      containerStyle.backgroundColor = variant.backgroundColor || '#333';
      containerStyle.padding = `${heightPx * 0.1}px ${heightPx * 0.2}px`;
      containerStyle.borderRadius = `${heightPx * 0.5}px`;
      containerStyle.boxShadow = '5px 5px 15px rgba(0,0,0,0.5)';
    }
  } else {
    // Lightbox or Vinyl - Fixed box size
    containerStyle.width = `${widthPx}px`;
    containerStyle.height = `${heightPx}px`;
    containerStyle.backgroundColor = variant.backgroundColor || (signType === SignType.WINDOW_VINYL ? 'transparent' : '#fff');
    containerStyle.display = 'flex';
    containerStyle.alignItems = 'center';
    containerStyle.justifyContent = 'center';
    containerStyle.fontSize = `${heightPx * 0.6}px`; // Guess font size to fit box
    containerStyle.overflow = 'hidden';
    containerStyle.padding = '10px'; // Prevent text hitting edge
    
    if (signType === SignType.LIGHTBOX) {
       containerStyle.border = '4px solid #333';
       if (variant.lighting === LightingType.FRONT_LIT) {
         containerStyle.boxShadow = `0 0 ${heightPx * 0.1}px rgba(255,255,255,0.5)`;
       }
    }
  }

  return (
    <>
      {renderBoundingBox()}
      <div 
        ref={ref}
        style={containerStyle} 
        title="Drag to fine-tune position"
        onMouseDown={handleMouseDown}
      >
        {text}
      </div>
    </>
  );
};
import React from "react";

// Nano Banana hand-drawn style SVG illustrations
export const LowRiskIllustration = () => (
  <svg viewBox="0 0 200 200" className="w-28 h-28 mx-auto drop-shadow-md animate-pulse">
    {/* Soft pastel background cloud */}
    <path d="M40,100 C40,70 70,60 100,60 C130,60 160,70 160,100 C160,130 130,140 100,140 C70,140 40,130 40,100 Z" fill="#F0FDF4" />
    
    {/* Cheerful hand-drawn yellow banana style character */}
    <path d="M70,50 Q100,30 130,50 Q150,90 130,140 Q100,160 70,140 Q50,90 70,50 Z" fill="#FEF08A" stroke="#CA8A04" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    
    {/* Happy blushing cheeks */}
    <circle cx="85" cy="110" r="10" fill="#FCA5A5" opacity="0.6" />
    <circle cx="115" cy="110" r="10" fill="#FCA5A5" opacity="0.6" />
    
    {/* Big happy cartoon eyes */}
    <circle cx="85" cy="95" r="7" fill="#1E293B" />
    <circle cx="115" cy="95" r="7" fill="#1E293B" />
    <circle cx="87" cy="93" r="2.5" fill="#FFFFFF" />
    <circle cx="117" cy="93" r="2.5" fill="#FFFFFF" />
    
    {/* Cheerful hand-drawn grin */}
    <path d="M88,115 Q100,128 112,115" fill="none" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
    
    {/* Smiling eyebrows */}
    <path d="M78,85 Q85,80 92,85" fill="none" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
    <path d="M108,85 Q115,80 122,85" fill="none" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const MediumRiskIllustration = () => (
  <svg viewBox="0 0 200 200" className="w-28 h-28 mx-auto drop-shadow-md">
    {/* Soft warm background cloud */}
    <path d="M40,100 C40,70 70,60 100,60 C130,60 160,70 160,100 C160,130 130,140 100,140 C70,140 40,130 40,100 Z" fill="#FFFBEB" />
    
    {/* Worried yellow-orange character */}
    <path d="M70,50 Q100,30 130,50 Q150,90 130,140 Q100,160 70,140 Q50,90 70,50 Z" fill="#FED7AA" stroke="#EA580C" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    
    {/* Worried flat eyebrows */}
    <path d="M78,85 Q85,90 92,85" fill="none" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
    <path d="M108,85 Q115,90 122,85" fill="none" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
    
    {/* Big open worried eyes */}
    <circle cx="85" cy="98" r="8" fill="#1E293B" />
    <circle cx="115" cy="98" r="8" fill="#1E293B" />
    <circle cx="83" cy="96" r="2.5" fill="#FFFFFF" />
    <circle cx="113" cy="96" r="2.5" fill="#FFFFFF" />
    
    {/* Small nervous mouth */}
    <path d="M92,120 Q100,115 108,120" fill="none" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
    
    {/* Sweat drop */}
    <path d="M125,75 Q130,80 125,85 Q120,80 125,75" fill="#38BDF8" stroke="#0284C7" strokeWidth="1" />
  </svg>
);

export const HighRiskIllustration = () => (
  <svg viewBox="0 0 200 200" className="w-28 h-28 mx-auto drop-shadow-md animate-bounce">
    {/* Critical red warning aura */}
    <circle cx="100" cy="100" r="60" fill="#FEF2F2" />
    <circle cx="100" cy="100" r="45" fill="#FEE2E2" />
    
    {/* Alarmed Red Warning Beacon character */}
    <path d="M60,130 L140,130 L125,70 C125,55 115,45 100,45 C85,45 75,55 75,70 Z" fill="#EF4444" stroke="#991B1B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="50" y="130" width="100" height="15" rx="5" fill="#F87171" stroke="#991B1B" strokeWidth="4" />
    
    {/* Alarm light beams */}
    <path d="M100,35 L100,15" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />
    <path d="M65,45 L50,30" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />
    <path d="M135,45 L150,30" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />
    
    {/* Shocked eyes */}
    <ellipse cx="85" cy="90" rx="6" ry="10" fill="#FFFFFF" stroke="#991B1B" strokeWidth="2" />
    <ellipse cx="115" cy="90" rx="6" ry="10" fill="#FFFFFF" stroke="#991B1B" strokeWidth="2" />
    <circle cx="85" cy="90" r="3.5" fill="#1E293B" />
    <circle cx="115" cy="90" r="3.5" fill="#1E293B" />
    
    {/* Shocked open mouth */}
    <circle cx="100" cy="112" r="8" fill="#1E293B" />
  </svg>
);

export const LogVitalsIllustration = () => (
  <svg viewBox="0 0 200 200" className="w-16 h-16 mx-auto hover:scale-110 transition-transform">
    <circle cx="100" cy="100" r="80" fill="#FEE2E2" />
    {/* Smiling Heart Character */}
    <path d="M100,135 C100,135 55,100 55,75 C55,58 68,45 85,45 C94,45 100,52 100,52 C100,52 106,45 115,45 C132,45 145,58 145,75 C145,100 100,135 100,135 Z" fill="#EF4444" stroke="#991B1B" strokeWidth="3" />
    
    {/* Little happy eyes */}
    <circle cx="88" cy="72" r="3.5" fill="#FFFFFF" />
    <circle cx="112" cy="72" r="3.5" fill="#FFFFFF" />
    
    {/* Little smile */}
    <path d="M94,82 Q100,88 106,82" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const AskAIIllustration = () => (
  <svg viewBox="0 0 200 200" className="w-16 h-16 mx-auto hover:scale-110 transition-transform">
    <circle cx="100" cy="100" r="80" fill="#E0F2FE" />
    {/* Glowing Friendly Robot Character */}
    <rect x="65" y="65" width="70" height="60" rx="15" fill="#38BDF8" stroke="#0369A1" strokeWidth="4" />
    
    {/* Antenna */}
    <line x1="100" y1="65" x2="100" y2="45" stroke="#0369A1" strokeWidth="4" />
    <circle cx="100" cy="40" r="8" fill="#F59E0B" stroke="#0369A1" strokeWidth="2" />
    
    {/* Star Eyes */}
    <path d="M80,85 L83,91 L90,92 L85,96 L87,102 L80,99 L73,102 L75,96 L70,92 L77,91 Z" fill="#FEF08A" />
    <path d="M120,85 L123,91 L130,92 L125,96 L127,102 L120,99 L113,102 L115,96 L110,92 L117,91 Z" fill="#FEF08A" />
    
    {/* Screen Face Smile */}
    <path d="M90,110 Q100,118 110,110" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const InviteCaretakerIllustration = () => (
  <svg viewBox="0 0 200 200" className="w-16 h-16 mx-auto hover:scale-110 transition-transform">
    <circle cx="100" cy="100" r="80" fill="#ECFDF5" />
    {/* Happy waving person */}
    <path d="M70,140 Q100,105 130,140" fill="none" stroke="#10B981" strokeWidth="6" strokeLinecap="round" />
    <circle cx="100" cy="85" r="20" fill="#34D399" stroke="#065F46" strokeWidth="3" />
    {/* Heart symbol on chest or background */}
    <path d="M100,108 C100,108 90,98 90,92 C90,87 94,84 98,84 C100,84 100,86 100,86 C100,86 100,84 102,84 C106,84 110,87 110,92 C110,98 100,108 100,108 Z" fill="#EF4444" />
  </svg>
);

export const HospitalIllustration = () => (
  <svg viewBox="0 0 200 200" className="w-16 h-16 mx-auto hover:scale-110 transition-transform">
    <circle cx="100" cy="100" r="80" fill="#F0FDF4" />
    {/* Cute smiling Hospital Building */}
    <rect x="60" y="65" width="80" height="80" rx="10" fill="#10B981" stroke="#065F46" strokeWidth="4" />
    {/* Hospital Red Cross */}
    <path d="M100,80 L100,100 M90,90 L110,90" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
    {/* Smiling Windows */}
    <rect x="70" y="115" width="15" height="15" rx="2" fill="#FEF08A" />
    <rect x="115" y="115" width="15" height="15" rx="2" fill="#FEF08A" />
  </svg>
);

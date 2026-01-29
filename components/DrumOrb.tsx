
import React, { useEffect, useState } from 'react';

interface DrumOrbProps {
  label: string;
  lastHitTime: number; // Use timestamp to force re-animation
  velocity: number;
  position: 'top' | 'left' | 'right';
}

const DrumOrb: React.FC<DrumOrbProps> = ({ label, lastHitTime, velocity, position }) => {
  const [scale, setScale] = useState(1);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (lastHitTime > 0) {
      setActive(true);
      setScale(1 + (velocity * 0.6));
      
      const timeout = setTimeout(() => {
        setScale(1);
        setActive(false);
      }, 80);
      return () => clearTimeout(timeout);
    }
  }, [lastHitTime, velocity]);

  const posClasses = {
    top: 'top-20 left-1/2 -translate-x-1/2',
    left: 'bottom-40 left-1/4 -translate-x-1/2',
    right: 'bottom-40 right-1/4 translate-x-1/2'
  };

  const glowColor = label === 'Hi-Hat' ? 'bg-amber-300' : label === 'Kick' ? 'bg-cyan-400' : 'bg-rose-400';
  const gradFrom = label === 'Hi-Hat' ? 'from-amber-200' : label === 'Kick' ? 'from-cyan-300' : 'from-rose-300';
  const gradTo = label === 'Hi-Hat' ? 'to-yellow-500' : label === 'Kick' ? 'to-blue-500' : 'to-purple-600';

  return (
    <div className={`absolute transition-all duration-75 flex flex-col items-center ${posClasses[position]}`}>
      {/* Outer Glow */}
      <div 
        className={`absolute w-64 h-64 rounded-full ${glowColor} orb-glow transition-opacity duration-150`}
        style={{ transform: `scale(${scale * 1.5})`, opacity: active ? 0.9 : 0.2 }}
      />
      
      {/* Main Sphere */}
      <div 
        className={`relative w-48 h-48 rounded-full bg-gradient-to-br ${gradFrom} ${gradTo} shadow-2xl flex items-center justify-center overflow-hidden transition-transform duration-75`}
        style={{ transform: `scale(${scale})` }}
      >
        <div className="absolute inset-0 bg-white/20 rounded-full blur-sm" />
        <span className="text-white font-light text-xs uppercase tracking-widest z-10 opacity-70">
          {label}
        </span>
      </div>
    </div>
  );
};

export default DrumOrb;

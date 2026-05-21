import React from 'react';

interface LogoProps {
  className?: string;
  light?: boolean;
}

export default function Logo({ className = "w-full h-full", light = false }: LogoProps) {
  const primaryColor = light ? "text-orange-200" : "text-orange-500";
  const secondaryColor = light ? "text-white" : "text-slate-950";
  const trailColor = light ? "text-orange-300/60" : "text-orange-400";
  const lineStyle = light ? "text-white/10" : "text-slate-100";

  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {/* Outer elegant tech circle */}
      <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="3" className={light ? "text-white/20" : "text-orange-600/10"} />
      
      {/* Grid background lines */}
      <path d="M25 50H75M50 25V75" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" className={lineStyle} />
      
      {/* Motion trail lines representing extreme speed */}
      <path 
        d="M12 42L20 42M8 50L18 50M12 58L20 58" 
        stroke="currentColor" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        className={trailColor} 
      />
      
      {/* The Express delivery vehicle body */}
      <rect x="26" y="34" width="30" height="24" rx="4" fill="currentColor" className={primaryColor} />
      
      {/* Cabin with aerodynamic slope */}
      <path d="M56 38L72 44V58H56V38Z" fill="currentColor" className={secondaryColor} />
      
      {/* Windshield cut-out */}
      <path d="M59 42L68 45.5V50H59V42Z" fill="currentColor" className={light ? "text-orange-600" : "text-white"} />
      
      {/* Moving wheels with modern hubcaps */}
      <circle cx="36" cy="64" r="7" fill="currentColor" className={secondaryColor} />
      <circle cx="36" cy="64" r="3" fill="currentColor" className={primaryColor} />
      
      <circle cx="60" cy="64" r="7" fill="currentColor" className={secondaryColor} />
      <circle cx="60" cy="64" r="3" fill="currentColor" className={primaryColor} />
      
      {/* Mini glowing express indicator */}
      <circle cx="51" cy="40" r="1.5" fill="currentColor" className="text-amber-300" />
    </svg>
  );
}

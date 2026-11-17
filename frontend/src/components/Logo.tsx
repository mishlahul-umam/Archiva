import React from 'react';

export const Logo = ({ className }: { className?: string }) => (
  <img 
    src="/logo.png" 
    alt="Archiva Logo" 
    className={className}
    onError={(e) => {
      e.currentTarget.style.display = 'none'; // Hide if missing
      // Optional: fallback to text or previous SVG could go here, 
      // but let's keep it clean as requested.
    }}
  />
);

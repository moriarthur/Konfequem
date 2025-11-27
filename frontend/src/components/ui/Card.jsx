import React from 'react';

export default function Card({ 
  children, 
  className = '', 
  hover = false, 
  padding = 'p-6',
  shadow = 'shadow-soft',
  border = 'border border-border-subtle',
  rounded = 'rounded-2xl',
  ...props 
}) {
  const baseClasses = 'bg-surface-base transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/30';
  const hoverClasses = hover ? 'hover:shadow-lift hover:scale-[1.01] hover:bg-surface-muted' : '';
  
  return (
    <div className={`${baseClasses} ${shadow} ${border} ${rounded} ${padding} ${hoverClasses} ${className}`} {...props}>
      {children}
    </div>
  );
}

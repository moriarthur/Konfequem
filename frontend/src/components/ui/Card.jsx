import React from 'react';

export default function Card({ 
  children, 
  className = '', 
  hover = false, 
  padding = 'p-6',
  shadow = 'shadow-sm',
  border = 'border border-gray-200',
  rounded = 'rounded-2xl',
  ...props 
}) {
  const baseClasses = 'bg-white transition-all duration-300';
  const hoverClasses = hover ? 'hover:shadow-lg hover:scale-[1.02] hover:bg-gray-50' : '';
  
  return (
    <div className={`${baseClasses} ${shadow} ${border} ${rounded} ${padding} ${hoverClasses} ${className}`} {...props}>
      {children}
    </div>
  );
}

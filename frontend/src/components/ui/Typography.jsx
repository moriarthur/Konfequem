import React from 'react';

export function Heading({ level = 1, children, className = '', ...props }) {
  const baseClasses = 'font-semibold text-accent-secondary';
  
  const sizes = {
    1: 'text-4xl',
    2: 'text-3xl', 
    3: 'text-2xl',
    4: 'text-xl',
    5: 'text-lg',
    6: 'text-base'
  };
  
  const Tag = `h${level}`;
  
  return (
    <Tag className={`${baseClasses} ${sizes[level]} ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function Subheading({ children, className = '', ...props }) {
  return (
    <h3 className={`text-lg font-medium text-accent-secondary ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function Text({ children, variant = 'default', className = '', ...props }) {
  const variants = {
    default: 'text-sm text-accent-secondary/80',
    muted: 'text-sm text-accent-secondary/60',
    large: 'text-base text-accent-secondary',
    small: 'text-xs text-accent-secondary/60',
  };
  
  return (
    <p className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </p>
  );
}

export function Label({ children, className = '', ...props }) {
  return (
    <label className={`block text-sm font-medium text-accent-secondary mb-1 ${className}`} {...props}>
      {children}
    </label>
  );
}

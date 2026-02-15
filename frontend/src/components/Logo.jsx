const variants = {
  default: { width: 80, height: 80 },
  sm: { width: 40, height: 40 },
  md: { width: 64, height: 64 },
  lg: { width: 100, height: 100 },
  xl: { width: 140, height: 140 },
};

export default function Logo({ size = "md", className = "", alt = "Konfequem" }) {
  const sizeProps = variants[size] || variants.md;

  return (
    <img
      src="/konfequem_logo.svg"
      alt={alt}
      className={`inline-block ${className}`}
      {...sizeProps}
    />
  );
}

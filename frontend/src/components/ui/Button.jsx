const VARIANTS = {
  primary: 'bg-accent text-accent-ink border-transparent hover:brightness-110',
  secondary: 'bg-sheet text-ink border-rule-strong hover:bg-well',
  ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-well hover:text-ink',
  danger: 'bg-transparent text-pencil border-rule-strong hover:bg-pencil-soft',
};

const SIZES = {
  sm: 'h-8 px-2.5 text-xs gap-1.5 max-md:h-10',
  md: 'h-9 px-3.5 text-sm gap-2 max-md:h-11',
  icon: 'h-9 w-9 max-md:h-11 max-md:w-11',
};

/** Native button (or `as={Link}`) with the design-system variants. 44 px tall below 768 px. */
export function Button({
  variant = 'secondary',
  size = 'md',
  as: Component = 'button',
  className = '',
  ...props
}) {
  const type = Component === 'button' ? (props.type ?? 'button') : undefined;
  return (
    <Component
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-control border font-medium whitespace-nowrap select-none transition-[background-color,color,transform,filter] duration-150 ease-out-quint active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}

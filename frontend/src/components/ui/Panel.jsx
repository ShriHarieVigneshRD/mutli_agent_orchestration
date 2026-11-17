/** A sheet on the desk: hairline rule, tonal surface, no shadow. */
export function Panel({ as: Component = 'section', className = '', children, ...props }) {
  return (
    <Component className={`rounded-panel border border-rule bg-sheet ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function PanelHeader({ title, subtitle, actions, as: Heading = 'h2', id }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
      <div className="min-w-0">
        <Heading id={id} className="text-sm font-semibold text-ink">
          {title}
        </Heading>
        {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

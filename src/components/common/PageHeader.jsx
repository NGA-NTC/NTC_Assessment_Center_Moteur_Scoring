export default function PageHeader({ title, subtitle, description, right, action, meta, style }) {
  const actions = right ?? action;
  return (
    <div
      className="page-title mb-[18px] flex w-full flex-wrap items-end justify-between gap-2.5"
      style={style}
    >
      <div className="min-w-0 max-w-full flex-1">
        <div className="page-title__title font-serif text-2xl font-bold text-navy break-words">{title}</div>
        {(subtitle || description) && (
          <div className="page-title__subtitle mt-[3px] text-[13px] text-muted-foreground break-words">
            {subtitle ?? description}
          </div>
        )}
        {meta && <div className="mt-2 flex flex-wrap gap-2">{meta}</div>}
      </div>
      {actions && <div className="page-title__actions flex min-w-0 max-w-full flex-wrap justify-end gap-2">{actions}</div>}
    </div>
  );
}
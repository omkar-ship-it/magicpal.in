/**
 * The shared empty/placeholder card for every dock panel.
 *
 * Children land in a div rather than a paragraph: callers pass buttons and
 * links, and a block-level control inside a <p> is invalid markup that the
 * browser reflows into overlapping text — a bug this codebase has already
 * shipped once.
 */
export default function PanelNote({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-[13.5px] font-semibold">{title}</p>
      {children && (
        <div className="mt-1 flex flex-col items-start text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
          {children}
        </div>
      )}
    </div>
  );
}

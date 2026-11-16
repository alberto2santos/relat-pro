import { cloneElement, useId, type ReactElement } from 'react';

interface TooltipProps {
  label: string;
  children: ReactElement<{ 'aria-describedby'?: string; title?: string }>;
  position?: 'top' | 'bottom';
}

const Tooltip = ({ label, children, position = 'top' }: TooltipProps) => {
  const tooltipId = useId();

  return (
    <span className="group/tooltip relative inline-flex">
      {cloneElement(children, {
        'aria-describedby': [children.props['aria-describedby'], tooltipId].filter(Boolean).join(' '),
        title: children.props.title ?? label,
      })}
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-[100] w-max max-w-56 -translate-x-1/2 rounded-lg bg-slate-950 px-3 py-2 text-center text-xs font-medium leading-relaxed text-white opacity-0 shadow-xl transition duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 ${
          position === 'top'
            ? 'bottom-full mb-2 translate-y-1 group-hover/tooltip:translate-y-0 group-focus-within/tooltip:translate-y-0'
            : 'top-full mt-2 -translate-y-1 group-hover/tooltip:translate-y-0 group-focus-within/tooltip:translate-y-0'
        }`}
      >
        {label}
      </span>
    </span>
  );
};

export default Tooltip;

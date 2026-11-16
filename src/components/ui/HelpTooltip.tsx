import { HelpCircle } from 'lucide-react';
import { useId } from 'react';

interface HelpTooltipProps {
  label: string;
  content: string;
}

const HelpTooltip = ({ label, content }: HelpTooltipProps) => {
  const tooltipId = useId();

  return (
    <details className="group relative inline-flex shrink-0 align-middle">
      <summary
        aria-label={`Ajuda: ${label}`}
        aria-describedby={tooltipId}
        className="flex h-6 w-6 cursor-help list-none items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden"
      >
        <HelpCircle aria-hidden="true" className="h-4 w-4" />
      </summary>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-60 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-lg group-open:block group-hover:block group-focus-within:block"
      >
        {content}
      </span>
    </details>
  );
};

export default HelpTooltip;

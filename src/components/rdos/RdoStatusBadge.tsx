import { CheckCircle2, CircleX, FileEdit, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { StatusRdo } from '@/types/database';

const STATUS_PRESENTATION: Record<StatusRdo, {
  label: string;
  icon: typeof FileEdit;
  className: string;
}> = {
  draft: {
    label: 'Rascunho',
    icon: FileEdit,
    className: 'border-[#CBD5E1] bg-[#F1F5F9] text-[#475569] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  },
  submitted: {
    label: 'Enviado',
    icon: Send,
    className: 'border-[#7DD3FC] bg-[#E0F2FE] text-[#0369A1] dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
  },
  approved: {
    label: 'Aprovado',
    icon: CheckCircle2,
    className: 'border-[#86EFAC] bg-[#DCFCE7] text-[#15803D] dark:border-green-800 dark:bg-green-950 dark:text-green-200',
  },
  rejected: {
    label: 'Rejeitado',
    icon: CircleX,
    className: 'border-[#FCA5A5] bg-[#FEE2E2] text-[#B91C1C] dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  },
};

export default function RdoStatusBadge({ status }: { status: StatusRdo }) {
  const presentation = STATUS_PRESENTATION[status] ?? STATUS_PRESENTATION.draft;
  const Icon = presentation.icon;

  return (
    <Badge variant="outline" className={`h-7 gap-1.5 border px-2.5 font-semibold ${presentation.className}`}>
      <Icon aria-hidden="true" />
      <span>{presentation.label}</span>
    </Badge>
  );
}

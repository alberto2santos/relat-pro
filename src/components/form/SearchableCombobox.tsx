import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Check, ChevronDown, Loader2, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ComboboxOption = {
  value: string;
  label: string;
};

type SearchableComboboxProps = {
  id: string;
  labelId: string;
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  loading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  onBlur?: () => void;
};

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export default function SearchableCombobox({
  id,
  labelId,
  value,
  options,
  onChange,
  placeholder = 'Selecione uma opção',
  searchPlaceholder = 'Digite para buscar...',
  emptyMessage = 'Nenhum resultado encontrado.',
  loadingMessage = 'Carregando...',
  loading = false,
  hasError = false,
  onRetry,
  onEmptyAction,
  emptyActionLabel = 'Tentar novamente',
  disabled = false,
  invalid = false,
  onBlur,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchId = useId();
  const listboxId = useId();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const query = normalize(search);
    if (!query) return options;
    return options.filter((option) => normalize(option.label).includes(query));
  }, [options, search]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) setSearch('');
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowDown' && filteredOptions.length > 0) {
      event.preventDefault();
      optionRefs.current[0]?.focus();
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      optionRefs.current[Math.min(index + 1, filteredOptions.length - 1)]?.focus();
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index === 0) document.getElementById(searchId)?.focus();
      else optionRefs.current[index - 1]?.focus();
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-labelledby={labelId}
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-invalid={invalid || hasError}
          disabled={disabled || loading}
          onBlur={onBlur}
          className={cn(
            'flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-input bg-background px-3 text-left text-sm shadow-sm transition-colors',
            'hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20',
            'disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
          )}
        >
          <span className={cn('min-w-0 truncate', !selectedOption && 'text-muted-foreground')}>
            {selectedOption ? selectedOption.label : loading ? loadingMessage : placeholder}
          </span>
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={5}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(searchId)?.focus();
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              role="searchbox"
              aria-label={searchPlaceholder}
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
            />
          </div>

          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            className="mt-2 max-h-60 space-y-1 overflow-y-auto"
          >
            {hasError ? (
              <div className="p-3 text-center text-sm text-destructive">
                <p>Não foi possível carregar as opções.</p>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg px-3 font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    {emptyActionLabel}
                  </button>
                )}
              </div>
            ) : loading ? (
              <p role="status" className="p-3 text-center text-sm text-muted-foreground">{loadingMessage}</p>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    ref={(element) => { optionRefs.current[index] = element; }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      onBlur?.();
                      setOpen(false);
                    }}
                    onKeyDown={(event) => handleOptionKeyDown(event, index)}
                    className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span className="min-w-0 break-words">{option.label}</span>
                    {isSelected && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-sm text-muted-foreground">
                <p>{options.length ? 'Nenhum resultado corresponde à busca.' : emptyMessage}</p>
                {!options.length && onEmptyAction && (
                  <button
                    type="button"
                    onClick={onEmptyAction}
                    className="mt-2 inline-flex min-h-9 items-center rounded-lg px-3 font-semibold text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {emptyActionLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

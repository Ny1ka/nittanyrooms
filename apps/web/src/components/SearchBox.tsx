import { useDeferredValue, useId, useMemo, useRef, useState } from 'react';
import { searchIndex } from '../lib/data';
import { navigate } from '../lib/router';
import { Search } from './Icons';

const INDEX = searchIndex();

/** Combobox search across building names, aliases and room numbers (ARIA 1.2 pattern). */
export function SearchBox({ placeholder = 'Search buildings and rooms' }: { placeholder?: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const deferred = useDeferredValue(q);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const terms = deferred.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return INDEX.filter((e) => terms.every((t) => e.hay.includes(t))).slice(0, 8);
  }, [deferred]);

  function choose(i: number) {
    const r = results[i];
    if (!r) return;
    setOpen(false);
    setQ('');
    navigate(`/b/${r.buildingId}`, r.kind === 'room' ? { room: r.id } : {}, { transition: true });
  }

  const showList = open && q.trim().length > 0;

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">
        {placeholder}
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate" />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            choose(active);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="h-11 w-full rounded-control border border-input-border bg-surface pr-3.5 pl-10 text-base text-navy placeholder:text-slate"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-control border border-line bg-surface shadow-lg"
        >
          {results.length === 0 && (
            <li className="px-3.5 py-3 text-sm text-slate" role="option" aria-selected="false" aria-disabled="true">
              No buildings or rooms match “{q.trim()}”.
            </li>
          )}
          {results.map((r, i) => (
            <li
              key={`${r.kind}-${r.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer flex-col justify-center px-3.5 py-2 ${i === active ? 'bg-glow-tint' : ''}`}
            >
              <span className="font-semibold">{r.label}</span>
              <span className="text-small text-slate">
                {r.kind === 'room' ? 'Room · ' : 'Building · '}
                {r.sub}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

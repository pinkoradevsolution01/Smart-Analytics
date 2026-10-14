import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { Range } from '../api/analytics';
import './DateRangePicker.css';

type DateRangePickerProps = {
  range: Range;
  onChange: (range: Range) => void;
};

const pad = (value: number) => String(value).padStart(2, '0');
const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromIso = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1);
const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const sameDay = (first: Date, second: Date) => toIso(first) === toIso(second);
const humanDate = (value: string) => fromIso(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

function CalendarMonth({ month, start, end, onPick }: { month: Date; start: string | null; end: string | null; onPick: (value: string) => void }) {
  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
    if (index < firstWeekday) return null;
    return new Date(month.getFullYear(), month.getMonth(), index - firstWeekday + 1);
  });

  return <section className="calendar-month" aria-label={month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}>
    <h4>{month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</h4>
    <div className="calendar-weekdays">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-days">{cells.map((date, index) => {
      if (!date) return <span className="calendar-blank" key={`blank-${index}`} />;
      const value = toIso(date);
      const selectedStart = value === start;
      const selectedEnd = value === end;
      const inRange = Boolean(start && end && value > start && value < end);
      const isToday = sameDay(date, new Date());
      return <button type="button" key={value} onClick={() => onPick(value)} className={`${selectedStart ? 'range-start ' : ''}${selectedEnd ? 'range-end ' : ''}${inRange ? 'in-range ' : ''}${isToday ? 'is-today' : ''}`} aria-label={date.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}>{date.getDate()}</button>;
    })}</div>
  </section>;
}

export function DateRangePicker({ range, onChange }: DateRangePickerProps) {
  const today = useMemo(() => toIso(new Date()), []);
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(range.from);
  const [draftEnd, setDraftEnd] = useState<string | null>(range.to);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(fromIso(range.to)));
  const root = useRef<HTMLDivElement>(null);
  const years = useMemo(() => Array.from({ length: 81 }, (_, index) => new Date().getFullYear() - 40 + index), []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const openPicker = () => {
    setDraftStart(range.from);
    setDraftEnd(range.to);
    setViewMonth(startOfMonth(fromIso(range.to)));
    setOpen((current) => !current);
  };

  const pick = (value: string) => {
    if (!draftStart || draftEnd) {
      setDraftStart(value);
      setDraftEnd(null);
      return;
    }
    if (value < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(value);
      return;
    }
    setDraftEnd(value);
  };

  const chooseQuickRange = (days: number | 'month' | 'year' | 'today') => {
    const end = new Date();
    let start = new Date(end);
    if (typeof days === 'number') start = addDays(end, -(days - 1));
    if (days === 'month') start = new Date(end.getFullYear(), end.getMonth(), 1);
    if (days === 'year') start = new Date(end.getFullYear(), 0, 1);
    const next = { from: toIso(start), to: toIso(end) };
    setDraftStart(next.from);
    setDraftEnd(next.to);
    onChange(next);
    setViewMonth(startOfMonth(start));
    setOpen(false);
  };

  const apply = () => {
    if (!draftStart) return;
    onChange({ from: draftStart, to: draftEnd ?? draftStart });
    setOpen(false);
  };

  const display = range.from === range.to ? humanDate(range.from) : `${humanDate(range.from)} – ${humanDate(range.to)}`;
  const nextMonth = addMonths(viewMonth, 1);

  return <div className="date-range-picker" ref={root}>
    <button type="button" className="date-range-trigger" onClick={openPicker} aria-haspopup="dialog" aria-expanded={open}>
      <CalendarDays size={17} />
      <span><small>Date range</small>{display}</span>
      <ChevronRight className={open ? 'trigger-chevron open' : 'trigger-chevron'} size={16} />
    </button>
    {open && <div className="date-range-popover" role="dialog" aria-modal="false" aria-label="Select analytics date range">
      <div className="range-popover-heading">
        <div><span>Reporting period</span><strong>{draftStart && draftEnd ? `${humanDate(draftStart)} – ${humanDate(draftEnd)}` : draftStart ? `Start: ${humanDate(draftStart)}` : 'Choose a start date'}</strong></div>
        <button type="button" className="today-control" onClick={() => chooseQuickRange('today')}>Today</button>
      </div>
      <div className="quick-ranges" aria-label="Quick ranges">
        <button type="button" onClick={() => chooseQuickRange(7)}>Last 7 days</button>
        <button type="button" onClick={() => chooseQuickRange(30)}>Last 30 days</button>
        <button type="button" onClick={() => chooseQuickRange('month')}>This month</button>
        <button type="button" onClick={() => chooseQuickRange('year')}>This year</button>
      </div>
      <div className="calendar-navigation">
        <button type="button" aria-label="Previous month" onClick={() => setViewMonth((month) => addMonths(month, -1))}><ChevronLeft size={17} /></button>
        <div className="calendar-selects">
          <select aria-label="Calendar month" value={viewMonth.getMonth()} onChange={(event) => setViewMonth(new Date(viewMonth.getFullYear(), Number(event.target.value), 1))}>{Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{new Date(2026, month, 1).toLocaleDateString('en-PH', { month: 'long' })}</option>)}</select>
          <select aria-label="Calendar year" value={viewMonth.getFullYear()} onChange={(event) => setViewMonth(new Date(Number(event.target.value), viewMonth.getMonth(), 1))}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select>
        </div>
        <button type="button" aria-label="Next month" onClick={() => setViewMonth((month) => addMonths(month, 1))}><ChevronRight size={17} /></button>
      </div>
      <div className="calendar-months">
        <CalendarMonth month={viewMonth} start={draftStart} end={draftEnd} onPick={pick} />
        <CalendarMonth month={nextMonth} start={draftStart} end={draftEnd} onPick={pick} />
      </div>
      <div className="range-popover-footer">
        <button type="button" className="clear-range" onClick={() => { setDraftStart(null); setDraftEnd(null); }}><RotateCcw size={14} /> Clear</button>
        <div><button type="button" className="cancel-range" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="apply-range" disabled={!draftStart} onClick={apply}>Apply range</button></div>
      </div>
    </div>}
  </div>;
}
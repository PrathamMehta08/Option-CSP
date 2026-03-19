'use client';

import React, { useState, useEffect, useMemo, useDeferredValue, memo, useRef } from 'react';
import { 
  Search, 
  DollarSign, 
  Calendar, 
  Percent, 
  TrendingUp, 
  Info,
  ArrowUpRight,
  Filter,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
  Settings2,
  Table as TableIcon,
  Clock,
  LayoutGrid,
  ArrowUpDown,
  X,
  Delete
} from 'lucide-react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatNumberWithCommas = (value: string | number) => {
  const numericString = value.toString().replace(/[^0-9.]/g, '');
  const parts = numericString.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

// --- Data Types ---
interface OptionData {
  expiration: string;
  daysToExpiration: number;
  strike: number;
  lastPrice: number;
  high: number;
  delta: number;
  iv: number;
  moneyness: number;
  openInterest: number;
  volume: number;
  maxContracts: number;
  totalCapitalRequired: number;
  totalPremiumReceived: number;
  annualizedReturn: number;
}

interface ApiResponse {
  ticker: string;
  currentPrice: number;
  options: OptionData[];
  error?: string;
}

type SortConfig = {
  key: keyof OptionData | null;
  direction: 'asc' | 'desc' | null;
};

// --- Memoized Components ---

const AnalysisChart = memo(({ title, icon: Icon, data, xAxisKey, xAxisName, yAxisKey, yAxisName, unit, color }: any) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  return (
  <div className="bg-zinc-950 border border-zinc-900 p-4 md:p-6 space-y-4 rounded-xl text-white font-sans">
    <h4 className="font-medium text-zinc-500 flex items-center gap-2 text-[10px] md:text-sm uppercase tracking-wider">
      <Icon size={14} /> {title}
    </h4>
    <div className="h-[250px] md:h-[300px] w-full">
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#0a0a0a" vertical={false} />
            <XAxis type="number" dataKey={xAxisKey} name={xAxisName} stroke="#27272a" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis type="number" dataKey={yAxisKey} name={yAxisName} unit={unit} stroke="#27272a" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ background: '#000', border: '1px solid #18181b', borderRadius: '4px', fontSize: '10px' }}
              itemStyle={{ color }}
            />
            <Scatter name="Puts" data={data}>
                {data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={color} fillOpacity={0.6} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      ) : (
        <div className="w-full h-full bg-zinc-950/50 animate-pulse rounded-lg flex items-center justify-center">
          <Loader2 className="text-zinc-800 animate-spin" size={24} />
        </div>
      )}
    </div>
  </div>
);
});
AnalysisChart.displayName = 'AnalysisChart';

const ResultsTable = memo(({ options, title, count }: { options: OptionData[], title: string, count?: number }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

  const handleSort = (key: keyof OptionData) => {
    let direction: 'asc' | 'desc' | null = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    } else if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const processedOptions = useMemo(() => {
    let sorted = [...options];

    if (sortConfig.key && sortConfig.direction) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key!];
        const bVal = b[sortConfig.key!];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return sorted;
  }, [options, sortConfig]);

  const SortIcon = ({ colKey }: { colKey: keyof OptionData }) => {
    if (sortConfig.key !== colKey) return <ArrowUpDown size={10} className="ml-1 opacity-20 group-hover:opacity-50" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={10} className="ml-1 text-emerald-500" /> : <ChevronDown size={10} className="ml-1 text-emerald-500" />;
  };

  return (
    <div className="space-y-4 text-white font-sans overflow-hidden">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
          <TableIcon size={12} /> {title} {count !== undefined && `(${processedOptions.length}/${count})`}
        </h3>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-900 bg-black/50 overflow-y-auto max-h-[600px] scrollbar-thin">
        <table className="w-full text-left text-[10px] md:text-[11px] whitespace-nowrap border-collapse">
          <thead className="bg-zinc-950 text-zinc-500 sticky top-0 z-10">
            <tr className="border-b border-zinc-900">
              {[
                { label: 'Expiry', key: 'expiration' },
                { label: 'DTE', key: 'daysToExpiration' },
                { label: 'Strike', key: 'strike' },
                { label: 'Premium', key: 'lastPrice' },
                { label: 'Delta', key: 'delta' },
                { label: 'IV', key: 'iv' },
                { label: 'Moneyness', key: 'moneyness' },
                { label: 'OI', key: 'openInterest' },
                { label: 'Vol', key: 'volume' },
                { label: 'Contracts', key: 'maxContracts' },
                { label: 'Total Cap', key: 'totalCapitalRequired' },
                { label: 'Total Prem', key: 'totalPremiumReceived' },
                { label: 'Ann. Return', key: 'annualizedReturn' },
              ].map((col) => (
                <th 
                  key={col.key} 
                  className={cn(
                    "px-4 py-4 font-semibold uppercase tracking-wider cursor-pointer group hover:text-zinc-300 transition-colors",
                    sortConfig.key === col.key && "text-emerald-500"
                  )}
                  onClick={() => handleSort(col.key as keyof OptionData)}
                >
                  <div className="flex items-center">
                    {col.label}
                    <SortIcon colKey={col.key as keyof OptionData} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 border-none">
            {processedOptions.map((opt, i) => (
              <tr key={i} className="group hover:bg-zinc-900/30 transition-colors">
                <td className="px-4 py-4 text-zinc-400 font-medium">{opt.expiration}</td>
                <td className="px-4 py-4">
                   <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-500 font-bold font-mono text-[10px]">
                     {opt.daysToExpiration}d
                   </span>
                </td>
                <td className="px-4 py-4 font-bold text-zinc-100 tracking-tight">${opt.strike.toFixed(2)}</td>
                <td className="px-4 py-4 text-zinc-300 font-mono">${opt.lastPrice.toFixed(2)}</td>
                <td className="px-4 py-4">
                  <span className={cn(
                    "font-mono",
                    Math.abs(opt.delta) > 0.35 ? "text-amber-500" : "text-emerald-500/80"
                  )}>
                    {opt.delta.toFixed(3)}
                  </span>
                </td>
                <td className="px-4 py-4 text-zinc-500 font-mono">{opt.iv.toFixed(1)}%</td>
                <td className="px-4 py-4 text-zinc-500 font-mono">{opt.moneyness.toFixed(1)}%</td>
                <td className="px-4 py-4 text-zinc-600 font-mono">{opt.openInterest.toLocaleString()}</td>
                <td className="px-4 py-4 text-zinc-600 font-mono">{opt.volume.toLocaleString()}</td>
                <td className="px-4 py-4 text-zinc-400 font-mono">{opt.maxContracts}</td>
                <td className="px-4 py-4 text-zinc-500 font-mono">${opt.totalCapitalRequired.toLocaleString()}</td>
                <td className="px-4 py-4 text-zinc-500 font-mono">${opt.totalPremiumReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-4 text-right">
                  <span className="text-emerald-400 font-bold tabular-nums text-sm">
                    {opt.annualizedReturn.toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
ResultsTable.displayName = 'ResultsTable';

const DualRangeSlider = memo(({ min, max, value, onChange, label, unit = "$" }: { min: number, max: number, value: [number, number], onChange: (val: [number, number]) => void, label?: string, unit?: string }) => {
  const [localValue, setLocalValue] = useState(value);

  // Sync with parent when it changes externally (e.g. data fetch)
  useEffect(() => {
    setLocalValue(value);
  }, [value[0], value[1]]);

  // Debounced update to parent to keep things snappy
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue[0] !== value[0] || localValue[1] !== value[1]) {
        onChange(localValue);
      }
    }, 50); // Small 50ms debounce for 'live' but efficient feel
    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  const minVal = Math.min(min, max);
  const maxVal = Math.max(min, max);

  const handleLowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setLocalValue([Math.min(val, localValue[1]), localValue[1]]);
  };

  const handleHighChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setLocalValue([localValue[0], Math.max(val, localValue[0])]);
  };

  return (
    <div className="space-y-4">
      {label && (
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none block">{label}</label>
      )}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div className="bg-zinc-900 py-1.5 rounded-lg border border-zinc-800 text-center text-zinc-100 font-bold">{unit}{localValue[0]}</div>
        <div className="bg-zinc-900 py-1.5 rounded-lg border border-zinc-800 text-center text-zinc-100 font-bold">{unit}{localValue[1]}</div>
      </div>
      <div className="dual-range-container">
        {/* Track Background */}
        <div className="absolute w-full h-1.5 bg-zinc-900 rounded-full border border-zinc-800" />
        
        {/* Active Range Highlight */}
        <div 
          className="absolute h-1.5 bg-emerald-500 rounded-full z-0" 
          style={{
            left: `${((localValue[0] - minVal) / (maxVal - minVal || 1)) * 100}%`,
            right: `${100 - ((localValue[1] - minVal) / (maxVal - minVal || 1)) * 100}%`
          }}
        />

        <input 
          type="range" 
          min={minVal} 
          max={maxVal} 
          value={localValue[0]} 
          onChange={handleLowChange}
          className="dual-range-input accent-emerald z-10"
        />
        <input 
          type="range" 
          min={minVal} 
          max={maxVal} 
          value={localValue[1]} 
          onChange={handleHighChange}
          className="dual-range-input accent-emerald z-20"
        />
      </div>
    </div>
  );
});
DualRangeSlider.displayName = 'DualRangeSlider';

const CustomKeypad = memo(({ 
  type, 
  value, 
  onClose, 
  onChange,
  tickerPrice 
}: { 
  type: 'months' | 'delta' | 'strike', 
  value: string | number, 
  onClose: () => void, 
  onChange: (val: any) => void,
  tickerPrice?: number
}) => {
  const [input, setInput] = useState(value.toString());

  const handleKey = (key: string) => {
    if (key === 'BACK') {
      setInput(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    } else if (key === '.') {
      if (!input.includes('.')) setInput(prev => prev + '.');
    } else {
      setInput(prev => prev === '0' ? key : prev + key);
    }
  };

  useEffect(() => {
    if (type !== 'months') {
       const numeric = parseFloat(input);
       if (!isNaN(numeric)) onChange(numeric);
    }
  }, [input]);

  const MonthsGrid = () => (
    <div className="max-w-xs mx-auto grid grid-cols-4 gap-2 p-4">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
        <button 
          key={m}
          onClick={() => { onChange(m); onClose(); }}
          className={cn(
            "py-3 rounded-xl font-bold transition-all active:scale-95 text-xs",
            value === m ? "bg-emerald-500 text-black" : "bg-zinc-900 text-white border border-zinc-800"
          )}
        >
          {m}m
        </button>
      ))}
    </div>
  );

  const Keypad = () => {
    const presets = type === 'delta' 
      ? [-0.10, -0.15, -0.20, -0.30, -0.40] 
      : tickerPrice ? [
          { label: '-5%', val: tickerPrice * 0.95 },
          { label: '-10%', val: tickerPrice * 0.90 },
          { label: '-15%', val: tickerPrice * 0.85 },
          { label: '-20%', val: tickerPrice * 0.80 },
          { label: '-25%', val: tickerPrice * 0.75 },
        ] : [];

    return (
      <div className="flex flex-col h-full bg-black border-t border-zinc-800 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between p-2.5 border-b border-zinc-900">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Edit {type}</span>
          <button onClick={onClose} className="p-1 bg-zinc-900 rounded-full text-zinc-400"><X size={12} /></button>
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 p-3 bg-zinc-950/30">
          {presets.map((p: any) => (
             <button 
               key={typeof p === 'number' ? p : p.label}
               onClick={() => {
                 const val = typeof p === 'number' ? p : p.val;
                 setInput(val.toFixed(type === 'delta' ? 2 : 2));
               }}
               className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-bold text-zinc-300 active:bg-emerald-500 active:text-black transition-colors"
             >
               {typeof p === 'number' ? p : `${p.label} ($${p.val.toFixed(2)})`}
             </button>
          ))}
        </div>

        <div className="px-6 py-1 flex flex-col items-center justify-center bg-zinc-950">
           <span className="text-[8px] text-zinc-600 uppercase font-black mb-0.5 tracking-widest">Current Input</span>
           <div className="text-3xl font-mono font-bold text-white tracking-tighter">
             {type === 'strike' && <span className="text-zinc-700 mr-2">$</span>}
             {input}
           </div>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-0.5 p-0.5 bg-zinc-950/50">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'BACK'].map(k => (
            <button 
              key={k} 
              onClick={() => handleKey(k)}
              className="py-3.5 text-xl font-medium bg-zinc-900/40 hover:bg-zinc-800/60 active:bg-zinc-700/80 rounded flex items-center justify-center transition-colors"
            >
              {k === 'BACK' ? <Delete size={20} /> : k}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
      <div className="bg-black border-t border-zinc-800 rounded-t-[2rem] overflow-hidden h-[75vh]">
        {type === 'months' ? (
          <div className="p-4">
             <div className="flex items-center justify-between mb-4 px-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Expiry Selection</span>
                <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-400"><X size={16} /></button>
             </div>
             <MonthsGrid />
          </div>
        ) : <Keypad />}
      </div>
    </div>
  );
});

// --- Main Page ---

export default function CashSecuredPutAnalyzer() {
  const [ticker, setTicker] = useState('');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capitalInput, setCapitalInput] = useState('10,000');
  const [minMonths, setMinMonths] = useState(0);
  const [maxMonths, setMaxMonths] = useState(6);
  const [minDelta, setMinDelta] = useState(-0.2);
  const [strikeFilter, setStrikeFilter] = useState<[number, number]>([0, 2000]);
  const [selectedExps, setSelectedExps] = useState<string[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Custom Keyboard State
  const [activeKeypad, setActiveKeypad] = useState<'minMonths' | 'maxMonths' | 'minDelta' | 'strikeMin' | 'strikeMax' | null>(null);
  
  // Defer the filters so the sliders stay snappy
  const deferredStrikeFilter = useDeferredValue(strikeFilter);
  const deferredSelectedExps = useDeferredValue(selectedExps);

  const prevTickerRef = useRef('');
  const capital = useMemo(() => capitalInput.replace(/[^0-9.]/g, ''), [capitalInput]);

  const handleCapitalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, '');
    setCapitalInput(formatNumberWithCommas(rawValue));
  };

  const fetchOptions = async () => {
    if (!ticker) return;
    const tickerChanged = prevTickerRef.current !== ticker;
    prevTickerRef.current = ticker;

    setLoading(true);
    setError(null);
    setShowMobileFilters(false);
    try {
      const params = new URLSearchParams({
        ticker,
        capital,
        minMonths: minMonths.toString(),
        maxMonths: maxMonths.toString(),
        minDelta: minDelta.toString(),
        maxDelta: "0",
      });
      const res = await fetch(`/api/options?${params}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        if (json.options.length > 0) {
          if (tickerChanged) {
            const strikes = json.options.map((o: OptionData) => o.strike);
            setStrikeFilter([Math.min(...strikes), Math.max(...strikes)]);
            const exps = Array.from(new Set(json.options.map((o: OptionData) => o.expiration))) as string[];
            setSelectedExps(exps);
          } else {
            // If ticker is same, just ensure current filters are within bounds of new data if they were defaults
            // Actually, usually we just want to keep them.
          }
        }
      }
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const filteredOptions = useMemo(() => {
    if (!data) return [];
    return data.options.filter((opt: OptionData) => {
      const strikeMatch = opt.strike >= deferredStrikeFilter[0] && opt.strike <= deferredStrikeFilter[1];
      const expMatch = deferredSelectedExps.includes(opt.expiration);
      const affordableMatch = opt.maxContracts > 0;
      return strikeMatch && expMatch && affordableMatch;
    });
  }, [data, deferredStrikeFilter, deferredSelectedExps]);

  return (
    <div className="min-h-screen font-sans antialiased text-white selection:bg-emerald-500/30 pb-16">
      {/* Sticky Header / Mobile Controls Container */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-zinc-900 px-4 md:px-12 py-3 md:py-4">
        <div className="max-w-[1500px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
               <TrendingUp size={20} />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tighter">Option Analyzer</h1>
          </div>
          
          <div className="flex items-center gap-4 md:gap-8">
             {data && (
               <div className="flex items-center gap-4 md:gap-6 bg-zinc-900/50 px-3 md:px-4 py-2 rounded-xl border border-zinc-800">
                 <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-3 leading-none text-white">
                   <p className="text-[10px] md:text-xs text-zinc-500 uppercase font-bold tracking-[0.2em]">{data.ticker}</p>
                   <p className="text-lg md:text-2xl font-black text-emerald-500 tabular-nums">
                     ${data.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                 </div>
               </div>
             )}
             <button 
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="lg:hidden p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                aria-label="Toggle parameters"
              >
                <Settings2 size={24} />
              </button>
          </div>
        </div>
        
        {/* Mobile Parameters Dropdown (Sticky within header) */}
        <div className={cn(
          "lg:hidden overflow-y-auto transition-all duration-300 ease-in-out scrollbar-none",
          showMobileFilters ? "max-h-[85vh] opacity-100 py-6" : "max-h-0 opacity-0 py-0"
        )}>
            <div className="space-y-8 px-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ticker</label>
                  <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:border-zinc-500 outline-none text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Capital ($)</label>
                  <input type="text" value={capitalInput} onChange={handleCapitalChange} className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm font-mono focus:border-zinc-500 outline-none text-white" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Months to Expiry</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setActiveKeypad('minMonths')} className="bg-zinc-900 py-3 rounded-xl border border-zinc-800 text-left px-4 group">
                    <p className="text-[8px] text-zinc-600 uppercase font-black mb-0.5">Min</p>
                    <span className="text-sm text-white">{minMonths}</span>
                  </button>
                  <button onClick={() => setActiveKeypad('maxMonths')} className="bg-zinc-900 py-3 rounded-xl border border-zinc-800 text-left px-4">
                    <p className="text-[8px] text-zinc-600 uppercase font-black mb-0.5">Max</p>
                    <span className="text-sm text-white">{maxMonths}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Max Delta</label>
                <button onClick={() => setActiveKeypad('minDelta')} className="w-full bg-zinc-900 py-3 rounded-xl border border-zinc-800 text-left px-4 group">
                  <p className="text-[8px] text-zinc-600 uppercase font-black mb-0.5">Filter Limit</p>
                  <span className="text-sm font-mono text-white">{minDelta}</span>
                </button>
              </div>

              {data && (
                <div className="space-y-4 pt-6 border-t border-zinc-900">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Strike Price Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setActiveKeypad('strikeMin')} className="bg-zinc-900 py-3 rounded-xl border border-zinc-800 text-left px-4">
                      <p className="text-[8px] text-zinc-600 uppercase font-black mb-0.5">Min Strike</p>
                      <span className="text-sm font-mono text-white">${strikeFilter[0]}</span>
                    </button>
                    <button onClick={() => setActiveKeypad('strikeMax')} className="bg-zinc-900 py-3 rounded-xl border border-zinc-800 text-left px-4">
                      <p className="text-[8px] text-zinc-600 uppercase font-black mb-0.5">Max Strike</p>
                      <span className="text-sm font-mono text-white">${strikeFilter[1]}</span>
                    </button>
                  </div>
                </div>
              )}

              <button 
                onClick={fetchOptions}
                disabled={loading}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-black text-[13px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <span>Scan Markets</span>}
              </button>
           </div>
        </div>
      </div>

      <main className="max-w-[1500px] mx-auto p-4 md:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-20 items-start">
          {/* Static/Sticky Sidebar on Desktop */}
          <aside className="hidden lg:block lg:col-span-3 lg:sticky lg:top-[120px] max-h-[calc(100vh-160px)] overflow-y-auto pr-8 scrollbar-thin pb-20">
            <div className="space-y-10">
              <section className="space-y-6">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-900 pb-2">Analysis Parameters</h2>
                
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-zinc-400">Ticker Symbol</label>
                    <input 
                      type="text" 
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value.toUpperCase())}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-zinc-500 transition-colors text-white"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-zinc-400">Capital Available ($)</label>
                    <input 
                      type="text" 
                      value={capitalInput}
                      onChange={handleCapitalChange}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-zinc-500 transition-colors font-mono text-white"
                    />
                  </div>

                  <DualRangeSlider 
                    min={0}
                    max={12}
                    value={[minMonths, maxMonths]}
                    onChange={([min, max]) => { setMinMonths(min); setMaxMonths(max); }}
                    label="Months Range"
                    unit=""
                  />

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Max Delta</label>
                      <span className="text-xs text-emerald-500 font-mono font-bold leading-none">{minDelta}</span>
                    </div>
                    <input 
                      type="range" 
                      min="-1" max="0" step="0.01"
                      value={minDelta}
                      onChange={(e) => setMinDelta(parseFloat(e.target.value))}
                      className="premium-slider"
                    />
                  </div>

                  <button 
                    onClick={fetchOptions}
                    disabled={loading}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-900 disabled:text-zinc-600 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.97]"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <span>Update Analysis</span>}
                  </button>
                </div>
              </section>

              {data && (
                <section className="space-y-6 pt-6 border-t border-zinc-900 text-white font-sans">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-900 pb-2">Refine Results</h2>
                  
                  <div className="space-y-8 font-sans">
                    <DualRangeSlider 
                      min={Math.min(...data.options.map(o => o.strike))}
                      max={Math.max(...data.options.map(o => o.strike))}
                      value={strikeFilter}
                      onChange={setStrikeFilter}
                      label="Strike Price Filter"
                    />

                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-zinc-400">Specific Expirations</label>
                      <div className="max-h-60 overflow-y-auto space-y-1 pr-2 scrollbar-thin font-mono">
                        {Array.from(new Set(data.options.map(o => o.expiration))).map(exp => (
                          <label key={exp} className="flex items-center gap-3 text-[11px] text-zinc-500 hover:text-white cursor-pointer transition-colors py-2 border-b border-zinc-900 last:border-none group">
                            <input 
                              type="checkbox" 
                              checked={selectedExps.includes(exp)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedExps([...selectedExps, exp]);
                                else setSelectedExps(selectedExps.filter(s => s !== exp));
                              }}
                              className="w-4 h-4 accent-emerald-500 bg-zinc-900 border-zinc-800 rounded-sm group-hover:border-zinc-700"
                            />
                            {exp}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </aside>

          {/* Scrolling Content Area */}
          <section className="lg:col-span-9 space-y-12 md:space-y-20">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs font-bold uppercase tracking-widest text-center justify-center">
                 <Info size={14} />
                 <p>{error}</p>
              </div>
            )}

            {data && filteredOptions.length > 0 ? (
              <div className="space-y-16 md:space-y-24">
                {/* Top Picks */}
                <ResultsTable title="Best Cash-Secured Put Opportunities" options={filteredOptions.slice(0, 10)} />

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-white font-sans">
                  <AnalysisChart title="Yield / Strike Analysis" icon={BarChart3} data={filteredOptions} xAxisKey="strike" xAxisName="Strike" yAxisKey="annualizedReturn" yAxisName="Return" unit="%" color="#10b981" />
                  <AnalysisChart title="Yield / DTE Profile" icon={Calendar} data={filteredOptions} xAxisKey="daysToExpiration" xAxisName="DTE" yAxisKey="annualizedReturn" yAxisName="Return" unit="%" color="#3b82f6" />
                </div>

                {/* Full Results */}
                <ResultsTable title="Full Market Scan Results" options={filteredOptions} count={filteredOptions.length} />
              </div>
            ) : (
              <div className="h-[40vh] md:h-[50vh] flex flex-col items-center justify-center space-y-6 md:space-y-10 rounded-[2rem] border border-zinc-900 bg-zinc-950/20 px-8 text-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-transparent to-transparent">
                {!loading && !error && (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-600 border border-zinc-800 animate-in fade-in zoom-in duration-500">
                       <LayoutGrid size={28} />
                    </div>
                    <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                      <p className="text-zinc-200 text-xl font-bold tracking-tight uppercase">Analyze the Markets</p>
                      <p className="text-zinc-500 text-xs md:text-sm max-w-xs mx-auto leading-relaxed">Enter a symbol like <span className="text-emerald-500 font-mono font-bold">NVDA</span> or <span className="text-emerald-500 font-mono font-bold">TSLA</span> to find premium cash-secured put opportunities.</p>
                    </div>
                  </>
                )}
                {loading && (
                  <div className="flex flex-col items-center gap-8">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500/30 blur-[40px] rounded-full animate-pulse" />
                      <Loader2 className="animate-spin text-emerald-500" size={56} strokeWidth={1} />
                    </div>
                    <div className="space-y-2">
                       <p className="text-zinc-500 text-[10px] uppercase tracking-[0.4em] font-black animate-pulse">Deep Scanning Chains</p>
                       <p className="text-zinc-700 text-[9px] uppercase tracking-widest">Real-time Data Stream Active</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Custom Keypad Bottom Sheets */}
      {activeKeypad === 'minMonths' && (
        <CustomKeypad 
          type="months" 
          value={minMonths} 
          onClose={() => setActiveKeypad(null)} 
          onChange={setMinMonths} 
        />
      )}
      {activeKeypad === 'maxMonths' && (
        <CustomKeypad 
          type="months" 
          value={maxMonths} 
          onClose={() => setActiveKeypad(null)} 
          onChange={setMaxMonths} 
        />
      )}
      {activeKeypad === 'minDelta' && (
        <CustomKeypad 
          type="delta" 
          value={minDelta} 
          onClose={() => setActiveKeypad(null)} 
          onChange={setMinDelta} 
        />
      )}
      {activeKeypad === 'strikeMin' && data && (
        <CustomKeypad 
          type="strike" 
          value={strikeFilter[0]} 
          onClose={() => setActiveKeypad(null)} 
          onChange={(val) => setStrikeFilter([val, strikeFilter[1]])} 
          tickerPrice={data.currentPrice}
        />
      )}
      {activeKeypad === 'strikeMax' && data && (
        <CustomKeypad 
          type="strike" 
          value={strikeFilter[1]} 
          onClose={() => setActiveKeypad(null)} 
          onChange={(val) => setStrikeFilter([strikeFilter[0], val])} 
          tickerPrice={data.currentPrice}
        />
      )}
    </div>
  );
}

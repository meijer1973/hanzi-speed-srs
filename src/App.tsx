import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  BookOpen, 
  Settings, 
  Printer, 
  Upload, 
  Trash2, 
  Volume2, 
  Timer, 
  CheckCircle2, 
  XCircle,
  ChevronRight,
  ChevronLeft,
  X
} from 'lucide-react';
import { Card, SRSSettings, AppConfig, CardSide } from './types';

const CHINESE_FONTS = [
  { name: 'Standard', class: 'font-standard' },
  { name: 'Artistic (Calligraphy)', class: 'font-artistic' },
  { name: 'Handwritten', class: 'font-handwritten' },
  { name: 'Playful (Billboard)', class: 'font-playful' },
];

export default function App() {
  const [view, setView] = useState<'review' | 'manage' | 'settings' | 'print'>('review');
  const [cards, setCards] = useState<Card[]>([]);
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [srsSettings, setSrsSettings] = useState<SRSSettings[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    frontSides: ['characters'],
    backSides: ['meaning', 'pronunciation'],
    chineseFont: 'font-standard'
  });

  // Review State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeTaken, setTimeTaken] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (view !== 'review') {
      setStartTime(null);
      setIsFlipped(false);
      setTimeTaken(null);
    }
  }, [view]);

  useEffect(() => {
    if (view === 'review' && dueCards.length > 0 && startTime === null && !isFlipped) {
      setStartTime(Date.now());
      setIsFlipped(false);
      setTimeTaken(null);
    }
  }, [view, dueCards, startTime, isFlipped]);

  const fetchData = async () => {
    const [cardsRes, dueRes, srsRes] = await Promise.all([
      fetch('/api/cards'),
      fetch('/api/cards/due'),
      fetch('/api/srs-settings')
    ]);
    setCards(await cardsRes.json());
    setDueCards(await dueRes.json());
    setSrsSettings(await srsRes.json());
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
  };

  const handleStartReview = () => {
    if (dueCards.length > 0) {
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setStartTime(Date.now());
      setTimeTaken(null);
    }
  };

  const handleFlip = () => {
    if (!isFlipped && startTime) {
      const end = Date.now();
      setTimeTaken((end - startTime) / 1000);
      setIsFlipped(true);
    }
  };

  const handleReviewResult = async (success: boolean) => {
    if (!dueCards[currentCardIndex]) return;

    await fetch(`/api/cards/${dueCards[currentCardIndex].id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeTaken, success })
    });

    if (currentCardIndex < dueCards.length - 1) {
      setIsFlipped(false);
      
      // Delay updating the card content until it has flipped back to the front
      setTimeout(() => {
        setCurrentCardIndex(prev => prev + 1);
        setStartTime(Date.now());
        setTimeTaken(null);
      }, 300); 
    } else {
      setView('review');
      setStartTime(null);
      setIsFlipped(false);
      setTimeTaken(null);
      fetchData();
    }
  };

  return (
    <div className="min-h-screen font-sans">
      {/* Navigation */}
      <nav className="bg-[#8b0000] text-white p-4 shadow-lg flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-white text-[#8b0000] p-1 rounded-sm font-bold text-xl">漢</div>
          <h1 className="text-xl font-bold tracking-widest">HANZI SPEED SRS</h1>
        </div>
        <div className="flex gap-6">
          <button onClick={() => setView('review')} className={`flex items-center gap-1 hover:text-yellow-400 transition-colors ${view === 'review' ? 'text-yellow-400' : ''}`}>
            <BookOpen size={20} /> Review
          </button>
          <button onClick={() => setView('manage')} className={`flex items-center gap-1 hover:text-yellow-400 transition-colors ${view === 'manage' ? 'text-yellow-400' : ''}`}>
            <Plus size={20} /> Manage
          </button>
          <button onClick={() => setView('settings')} className={`flex items-center gap-1 hover:text-yellow-400 transition-colors ${view === 'settings' ? 'text-yellow-400' : ''}`}>
            <Settings size={20} /> Settings
          </button>
          <button onClick={() => setView('print')} className={`flex items-center gap-1 hover:text-yellow-400 transition-colors ${view === 'print' ? 'text-yellow-400' : ''}`}>
            <Printer size={20} /> Print
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-8">
        {view === 'review' && (
          <ReviewView 
            dueCards={dueCards} 
            currentCardIndex={currentCardIndex}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            onResult={handleReviewResult}
            timeTaken={timeTaken}
            config={config}
            speak={speak}
            srsSettings={srsSettings}
          />
        )}

        {view === 'manage' && (
          <ManageView 
            cards={cards} 
            onRefresh={fetchData} 
          />
        )}

        {view === 'settings' && (
          <SettingsView 
            config={config} 
            setConfig={setConfig} 
            srsSettings={srsSettings}
            onRefresh={fetchData}
          />
        )}

        {view === 'print' && (
          <PrintView cards={cards} config={config} />
        )}
      </main>
    </div>
  );
}

function ReviewView({ dueCards, currentCardIndex, isFlipped, onFlip, onResult, timeTaken, config, speak, srsSettings }: any) {
  const currentCard = dueCards[currentCardIndex];
  const currentSrs = srsSettings.find((s: any) => s.step === currentCard?.status) || srsSettings[srsSettings.length - 1];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (dueCards.length === 0) return;

      if (e.key === 'Enter') {
        if (!isFlipped) {
          onFlip();
        }
      } else if (e.key === ' ') {
        e.preventDefault(); // Prevent scrolling
        if (isFlipped) {
          onResult(true);
        }
      } else if (e.key === 'v' || e.key === 'V') {
        if (isFlipped) {
          onResult(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, onFlip, onResult, timeTaken, currentSrs, dueCards.length]);

  if (dueCards.length === 0) {
    return (
      <div className="text-center py-20">
        <CheckCircle2 size={64} className="mx-auto text-green-600 mb-4" />
        <h2 className="text-2xl font-bold mb-2">All caught up!</h2>
        <p className="text-gray-600">No cards due for review right now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-full flex justify-between items-center text-sm font-bold text-gray-500 uppercase tracking-widest">
        <span>Card {currentCardIndex + 1} of {dueCards.length}</span>
        <span>Status: Step {currentCard.status}</span>
      </div>

      <div 
        className="w-full max-w-md aspect-[3/4] perspective-1000 cursor-pointer"
        onClick={() => !isFlipped && onFlip()}
      >
        <motion.div 
          className="w-full h-full relative preserve-3d shadow-2xl rounded-2xl border-4 border-[#8b0000]"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-white flex flex-col items-center justify-center p-8 text-center">
            {config.frontSides.map((side: CardSide) => (
              <div key={side} className={`mb-4 ${side === 'characters' ? `${config.chineseFont} text-8xl` : 'text-2xl italic'}`}>
                {currentCard[side]}
              </div>
            ))}
            {!isFlipped && (
              <div className="mt-8 text-gray-400 animate-pulse flex items-center gap-2">
                <Timer size={16} /> Click to reveal
              </div>
            )}
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden bg-[#fffdfa] flex flex-col items-center justify-center p-8 text-center rotate-y-180">
            {config.backSides.map((side: CardSide) => (
              <div key={side} className={`mb-4 ${side === 'characters' ? `${config.chineseFont} text-8xl` : 'text-2xl font-bold'}`}>
                {currentCard[side]}
              </div>
            ))}
            <button 
              onClick={(e) => { e.stopPropagation(); speak(currentCard.characters); }}
              className="mt-4 p-2 rounded-full bg-[#8b0000] text-white hover:scale-110 transition-transform"
            >
              <Volume2 size={24} />
            </button>
          </div>
        </motion.div>
      </div>

      {isFlipped && (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <div className="text-center">
            <p className="text-lg font-bold">Time: {timeTaken?.toFixed(2)}s</p>
            <p className="text-sm text-gray-500">Target: {currentSrs?.time_cap_seconds}s</p>
          </div>
          
          <div className="flex gap-4 w-full">
            <button 
              onClick={() => onResult(false)}
              className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
            >
              <XCircle size={20} /> Wrong (V)
            </button>
            <button 
              onClick={() => onResult(true)}
              className={`flex-1 py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                timeTaken! <= currentSrs?.time_cap_seconds 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-yellow-500 text-white hover:bg-yellow-600'
              }`}
            >
              <CheckCircle2 size={20} /> {timeTaken! <= currentSrs?.time_cap_seconds ? 'Success (Space)' : 'Too Slow (Space)'}
            </button>
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
            Shortcuts: [V] Wrong • [Space] Correct
          </p>
        </div>
      )}
      {!isFlipped && (
        <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
          Shortcut: [Enter] to Flip
        </p>
      )}
    </div>
  );
}

function ManageView({ cards, onRefresh }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCard, setNewCard] = useState({ characters: '', meaning: '', pronunciation: '' });
  const [importText, setImportText] = useState('');

  const handleAdd = async () => {
    await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCard)
    });
    setNewCard({ characters: '', meaning: '', pronunciation: '' });
    setIsAdding(false);
    onRefresh();
  };

  const handleImport = async () => {
    const lines = importText.split('\n').filter(l => l.trim());
    const newCards = lines.map(line => {
      const [characters, meaning, pronunciation] = line.split(',').map(s => s.trim());
      return { characters, meaning, pronunciation: pronunciation || '' };
    });
    
    await fetch('/api/cards/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: newCards })
    });
    setImportText('');
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this card?')) {
      await fetch(`/api/cards/${id}`, { method: 'DELETE' });
      onRefresh();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#8b0000]">Card Management</h2>
        <div className="flex gap-2">
          <button onClick={() => setIsAdding(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Card
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <input 
              placeholder="Characters (e.g. 你好)" 
              className="border p-2 rounded"
              value={newCard.characters}
              onChange={e => setNewCard({...newCard, characters: e.target.value})}
            />
            <input 
              placeholder="Meaning" 
              className="border p-2 rounded"
              value={newCard.meaning}
              onChange={e => setNewCard({...newCard, meaning: e.target.value})}
            />
            <input 
              placeholder="Pronunciation (Pinyin)" 
              className="border p-2 rounded"
              value={newCard.pronunciation}
              onChange={e => setNewCard({...newCard, pronunciation: e.target.value})}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-500">Cancel</button>
            <button onClick={handleAdd} className="btn-primary">Save Card</button>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Upload size={18} /> Bulk Import</h3>
        <p className="text-sm text-gray-500 mb-2">Format: characters, meaning, pronunciation (one per line)</p>
        <textarea 
          className="w-full h-32 border p-2 rounded mb-4 font-mono text-sm"
          placeholder="你好, Hello, nǐ hǎo&#10;谢谢, Thanks, xièxie"
          value={importText}
          onChange={e => setImportText(e.target.value)}
        />
        <button onClick={handleImport} className="btn-secondary w-full">Import Cards</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card: Card) => (
          <div key={card.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-[#8b0000] flex justify-between items-center">
            <div>
              <div className="text-2xl font-bold">{card.characters}</div>
              <div className="text-gray-600">{card.meaning} • <span className="italic">{card.pronunciation}</span></div>
              <div className="text-xs text-gray-400 mt-1">Status: Step {card.status} • Next: {new Date(card.next_review_at).toLocaleString()}</div>
            </div>
            <button onClick={() => handleDelete(card.id)} className="text-red-400 hover:text-red-600 p-2">
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView({ config, setConfig, srsSettings, onRefresh }: any) {
  const [localSrs, setLocalSrs] = useState(srsSettings);

  useEffect(() => {
    setLocalSrs(srsSettings);
  }, [srsSettings]);

  const handleSaveSrs = async () => {
    await fetch('/api/srs-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: localSrs })
    });
    onRefresh();
    alert('SRS Settings saved!');
  };

  const toggleSide = (type: 'front' | 'back', side: CardSide) => {
    const key = type === 'front' ? 'frontSides' : 'backSides';
    const current = config[key];
    if (current.includes(side)) {
      if (current.length > 1) {
        setConfig({ ...config, [key]: current.filter((s: string) => s !== side) });
      }
    } else {
      setConfig({ ...config, [key]: [...current, side] });
    }
  };

  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-2xl font-bold text-[#8b0000] mb-6">Display Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="font-bold mb-4">Chinese Font Style</h3>
            <div className="grid grid-cols-2 gap-3">
              {CHINESE_FONTS.map(font => (
                <button 
                  key={font.name}
                  onClick={() => setConfig({...config, chineseFont: font.class})}
                  className={`p-6 border-2 rounded-xl text-center transition-all flex flex-col items-center justify-center gap-2 ${
                    config.chineseFont === font.class 
                      ? 'border-[#8b0000] bg-red-50 shadow-sm' 
                      : 'border-gray-100 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`${font.class} text-5xl text-[#8b0000]`}>字</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{font.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="font-bold mb-4">Card Layout</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-gray-500 mb-2">Front Sides</p>
                <div className="flex gap-2">
                  {['characters', 'meaning', 'pronunciation'].map((side: any) => (
                    <button 
                      key={side}
                      onClick={() => toggleSide('front', side)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${config.frontSides.includes(side) ? 'bg-[#8b0000] text-white border-[#8b0000]' : 'border-gray-200 text-gray-400'}`}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500 mb-2">Back Sides</p>
                <div className="flex gap-2">
                  {['characters', 'meaning', 'pronunciation'].map((side: any) => (
                    <button 
                      key={side}
                      onClick={() => toggleSide('back', side)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${config.backSides.includes(side) ? 'bg-[#8b0000] text-white border-[#8b0000]' : 'border-gray-200 text-gray-400'}`}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#8b0000]">SRS Configuration</h2>
          <button onClick={handleSaveSrs} className="btn-primary">Save SRS Steps</button>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3">Step</th>
                <th className="px-6 py-3">Speed Cap (sec)</th>
                <th className="px-6 py-3">Interval (hours)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {localSrs.map((s: any, idx: number) => (
                <tr key={s.step}>
                  <td className="px-6 py-4 font-bold">Step {s.step}</td>
                  <td className="px-6 py-4">
                    <input 
                      type="number" 
                      className="border p-1 rounded w-20"
                      value={s.time_cap_seconds}
                      onChange={e => {
                        const newSrs = [...localSrs];
                        newSrs[idx].time_cap_seconds = parseInt(e.target.value);
                        setLocalSrs(newSrs);
                      }}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="number" 
                      className="border p-1 rounded w-20"
                      value={s.interval_hours}
                      onChange={e => {
                        const newSrs = [...localSrs];
                        newSrs[idx].interval_hours = parseInt(e.target.value);
                        setLocalSrs(newSrs);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 bg-red-50 text-xs text-red-800 italic">
            * Beyond the last step, intervals will automatically increase by 50% for each successful speed-cap review.
          </div>
        </div>
      </section>
    </div>
  );
}

function PrintView({ cards, config }: any) {
  const [statusFilter, setStatusFilter] = useState<number | 'all'>('all');
  
  const filteredCards = statusFilter === 'all' 
    ? cards 
    : cards.filter((c: Card) => c.status === statusFilter);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 print:space-y-0">
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-[#8b0000]">Print Flashcards</h2>
        <div className="flex gap-4 items-center">
          <select 
            className="border p-2 rounded"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          >
            <option value="all">All Statuses</option>
            {[0,1,2,3,4,5,6].map(s => <option key={s} value={s}>Step {s}</option>)}
          </select>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
            <Printer size={18} /> Print Now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 print:grid-cols-2 print:gap-2">
        {filteredCards.map((card: Card) => (
          <div key={card.id} className="chinese-card aspect-[3/2] p-6 flex flex-col items-center justify-center text-center border-2 border-black print:border-gray-300">
            <div className={`text-5xl mb-2 ${config.chineseFont}`}>{card.characters}</div>
            <div className="text-xl font-bold">{card.meaning}</div>
            <div className="text-sm italic text-gray-500">{card.pronunciation}</div>
            <div className="absolute top-2 right-2 text-[8px] opacity-30">Status: {card.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

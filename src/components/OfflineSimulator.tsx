import { useState, useEffect, useRef } from 'react';

// --- TIPOS ---
type Personality = 'ALTRUIST' | 'GREEDY' | 'CHAOTIC' | 'OPPORTUNIST';
type ActionType = 'COLLABORATE' | 'PRIVATE' | 'STEAL';
type TabType = 'ACTIONS' | 'DASHBOARD' | 'NEWS' | 'RANKING' | 'LEADER';

interface PlayerStats {
  stole: number;
  collaborated: number;
  private: number;
  rescued: number;
  donated: number;
}

interface BotPlayer {
  id: number;
  name: string;
  personality: Personality;
  reputation: number;
  stash: number;
  stats: PlayerStats;
  isDead: boolean;
  isBankrupt: boolean;
  daysBankrupt: number;
}

interface VoteSession {
  targetId: number;
  targetName: string;
  targetReputation: number;
  accusedBy: string;
  isOpen: boolean;
  bailCost: number;
}

interface NewsItem {
  id: number;
  text: string;
  type: 'INFO' | 'ALERT' | 'BANKRUPTCY_ALERT' | 'DEATH';
  targetId?: number;
  data?: any;
  resolved?: boolean;
}

type SortType = 'WEALTH' | 'THEFT' | 'SAINT';

// GENERADOR DE NOMBRES
const generateName = () => {
  const prefixes = ["Neo", "Cyber", "Lord", "Lady", "Dr", "Exo", "Bit", "Net"];
  const bases = ["Wolf", "Fox", "Hawk", "Snake", "Lion", "Ghost", "Viper", "Zero"];
  const suffixes = ["_77", ".eth", "_X", "2099", "_AI", "xD"];
  return `${prefixes[Math.floor(Math.random()*prefixes.length)]}${bases[Math.floor(Math.random()*bases.length)]}${suffixes[Math.floor(Math.random()*suffixes.length)]}`;
};

export default function OfflineSimulator({ onBack }: { onBack: () => void }) {
  // --- FASES ---
  const [gamePhase, setGamePhase] = useState<'SETUP' | 'PLAYING' | 'GAMEOVER'>('SETUP');
  const [botCount, setBotCount] = useState(50);
  const [initialPop, setInitialPop] = useState(50);
  
  // --- MUNDO & TIEMPO ---
  const [day, setDay] = useState(1);
  const [dayProgress, setDayProgress] = useState(0);
  const [publicSilo, setPublicSilo] = useState(1000);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isPaused, setIsPaused] = useState(true);

  // --- JUGADOR ---
  const [myStash, setMyStash] = useState(50);
  const [myReputation, setMyReputation] = useState(50);
  const [myStats, setMyStats] = useState<PlayerStats>({ stole: 0, collaborated: 0, private: 0, rescued: 0, donated: 0 });
  const [amIExpelled, setAmIExpelled] = useState(false);
  const [amIBankrupt, setAmIBankrupt] = useState(false);
  const [myDaysBankrupt, setMyDaysBankrupt] = useState(0);
  
  // --- ACCIONES ---
  const [hasActed, setHasActed] = useState(false);
  const [autoPilotAction, setAutoPilotAction] = useState<ActionType | null>(null);

  // --- UI & DASHBOARD CONFIG ---
  const [activeTab, setActiveTab] = useState<TabType>('ACTIONS');
  const [newsLog, setNewsLog] = useState<NewsItem[]>([]);
  const [unreadNews, setUnreadNews] = useState(false);
  const [gameOverSort, setGameOverSort] = useState<SortType>('WEALTH');
  
  // Configuración de Tiles (Windows Phone style)
  const [editMode, setEditMode] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState({
     wealthParams: true,
     socialThermometer: true,
     inequality: true,
     distribution: true
  });

  // Alertas No Invasivas
  const [voteSession, setVoteSession] = useState<VoteSession | null>(null);
  const [activeBailout, setActiveBailout] = useState<{id: number, name: string, debt: number, newsId: number} | null>(null);
  const [showSuspects, setShowSuspects] = useState(false);

  // --- IA ---
  const [bots, setBots] = useState<BotPlayer[]>([]);

  const stateRef = useRef({ 
    bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, 
    gamePhase, initialPop, amIBankrupt, myDaysBankrupt, autoPilotAction 
  });

  useEffect(() => {
    stateRef.current = { 
      bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, 
      gamePhase, initialPop, amIBankrupt, myDaysBankrupt, autoPilotAction 
    };
  }, [bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, gamePhase, initialPop, amIBankrupt, myDaysBankrupt, autoPilotAction]);

  // --- CÁLCULOS ECONÓMICOS ---
  const activeBots = bots.filter(b => !b.isDead);
  const activePopulation = activeBots.length + (amIExpelled ? 0 : 1);
  const totalPrivateWealth = activeBots.reduce((acc, bot) => acc + bot.stash, 0) + (amIExpelled ? 0 : myStash);
  const currentTotalWealth = publicSilo + totalPrivateWealth;
  
  const avgPrivateWealth = Math.max(1, totalPrivateWealth / (activePopulation || 1));
  const baseCost = Math.max(5, avgPrivateWealth * 0.10); 
  const safeSiloLevel = activePopulation * 50; 
  const scarcityMultiplier = Math.max(1, safeSiloLevel / (publicSilo + 1));
  const costOfLiving = Math.floor(baseCost * scarcityMultiplier); 

  // Métricas avanzadas
  const publicRatio = ((publicSilo / (currentTotalWealth || 1)) * 100).toFixed(1);
  const allStashes = [...activeBots.map(b => b.stash), (amIExpelled ? 0 : myStash)].sort((a, b) => b - a);
  const top10Count = Math.ceil(allStashes.length * 0.1);
  const wealthTop10 = allStashes.slice(0, top10Count).reduce((a, b) => a + b, 0);
  const inequalityPercentage = ((wealthTop10 / (totalPrivateWealth || 1)) * 100).toFixed(1);

  const getSocialSentiment = () => {
    if (publicSilo < safeSiloLevel * 0.2) return { icon: '🔥', text: 'COLAPSO', color: 'text-red-600' };
    if (costOfLiving > 30) return { icon: '🤬', text: 'INSUFRIBLE', color: 'text-red-500' };
    if (costOfLiving > 15) return { icon: '😨', text: 'INFLACIÓN', color: 'text-orange-400' };
    return { icon: '😎', text: 'ESTABLE', color: 'text-farm-green' };
  };
  const sentiment = getSocialSentiment();

  // --- HELPERS ---
  const addNews = (text: string, type: 'INFO' | 'ALERT' | 'BANKRUPTCY_ALERT' | 'DEATH' = 'INFO', data?: any) => {
    setNewsLog(prev => [{ id: Date.now() + Math.random(), text: `Día ${day}: ${text}`, type, data, resolved: false }, ...prev].slice(0, 30));
    if (activeTab !== 'NEWS') setUnreadNews(true);
  };

  const markNewsResolved = (newsId: number) => {
    setNewsLog(prev => prev.map(item => item.id === newsId ? { ...item, resolved: true } : item));
  };

  // --- MOTOR DE JUEGO ---
  const processDayEnd = () => {
    const currentData = stateRef.current;
    
    // Check Game Over
    const aliveCount = currentData.bots.filter(b => !b.isDead).length + (currentData.amIExpelled ? 0 : 1);
    if (aliveCount < (currentData.initialPop / 2)) {
       setIsPaused(true);
       setGamePhase('GAMEOVER');
       return; 
    }

    // 1. TURNO JUGADOR
    if (!currentData.amIExpelled && !currentData.amIBankrupt) {
      if (currentData.hasActed) {
         setMyStash(prev => prev - costOfLiving);
      } else {
         if (currentData.autoPilotAction) {
            executePlayerAction(currentData.autoPilotAction, true); 
            setMyStash(prev => prev - costOfLiving);
         } else {
            setMyStash(prev => prev - costOfLiving);
            addNews("💤 Inactividad: Cobrado costo de vida sin ingresos.", "ALERT");
         }
      }
    }

    // 2. DESGASTE
    setMyReputation(r => Math.max(0, r - 2)); 
    setBots(prev => prev.map(b => ({ ...b, reputation: Math.max(0, b.reputation - 2) })));

    // 3. BANCARROTA
    if (!currentData.amIBankrupt && stateRef.current.myStash < 0 && !currentData.amIExpelled) {
       setAmIBankrupt(true); setMyDaysBankrupt(0);
       addNews("¡ESTÁS EN QUIEBRA! Revisa NOTICIAS.", 'BANKRUPTCY_ALERT', { id: 999, name: 'TÚ', debt: stateRef.current.myStash });
    } else if (currentData.amIBankrupt) {
       setMyDaysBankrupt(days => {
           if (days >= 5) {
               setAmIExpelled(true);
               addNews("Has muerto de inanición.", 'DEATH');
               // Game Over check next tick
               return days;
           }
           return days + 1;
       });
    }

    // 4. BOTS
    processBotsTurn(currentData);

    // 5. RESET
    setDay(d => d + 1);
    setHasActed(false);
    setDayProgress(0);
  };

  const processBotsTurn = (currentData: any) => {
      // (Lógica de bots resumida para ahorrar espacio, idéntica a v2)
      const activeList = [...currentData.bots.filter((b:any) => !b.isDead), { id: 999, name: 'TÚ', reputation: currentData.myReputation, isDead: currentData.amIExpelled }];
      const topRep = activeList.sort((a,b) => b.reputation - a.reputation)[0];
      
      if (topRep && topRep.id !== 999 && currentData.publicSilo < (activePopulation * 10)) {
          if (Math.random() < 0.3) executeExpropriation(true, "Líder Bot");
      }

      setBots(currentBots => currentBots.map(bot => {
         if (bot.isDead) return bot;
         if (bot.isBankrupt) {
            if (bot.daysBankrupt >= 5) { addNews(`✝️ ${bot.name} murió.`, 'DEATH'); return { ...bot, isDead: true, stash: 0 }; }
            return { ...bot, daysBankrupt: bot.daysBankrupt + 1 };
         }
         let newStash = bot.stash - costOfLiving;
         if (newStash < 0) {
            addNews(`🆘 ${bot.name} pide rescate.`, 'BANKRUPTCY_ALERT', { id: bot.id, name: bot.name, debt: newStash });
            return { ...bot, isBankrupt: true, stash: newStash, daysBankrupt: 0 };
         }
         
         const roll = Math.random();
         let decision: ActionType = 'PRIVATE';
         if (bot.personality === 'GREEDY') decision = roll < 0.6 ? 'STEAL' : 'PRIVATE';
         else if (bot.personality === 'ALTRUIST') decision = roll < 0.6 ? 'COLLABORATE' : 'PRIVATE';
         else decision = roll < 0.3 ? 'STEAL' : roll < 0.6 ? 'PRIVATE' : 'COLLABORATE';

         let currentStats = { ...bot.stats };
         let newRep = bot.reputation;

         if (decision === 'STEAL') { newStash += 60; setPublicSilo(s => s - 40); newRep -= 3; currentStats.stole += 1; } 
         else if (decision === 'PRIVATE') { newStash += 25; currentStats.private += 1; } 
         else { setPublicSilo(s => s + 25); newRep += 6; newStash += 10; currentStats.collaborated += 1; }
         return { ...bot, reputation: Math.max(0, Math.min(100, newRep)), stash: newStash, stats: currentStats };
      }));
  };

  useEffect(() => {
    let tickInterval: any;
    if (!isPaused && gamePhase === 'PLAYING') {
      const tickRate = 50; 
      tickInterval = setInterval(() => {
        // En esta versión, las ventanas "no invasivas" NO pausan el juego automáticamente,
        // a menos que el usuario lo decida. O podemos pausarlo para dar tiempo a leer.
        // Vamos a NO pausar para aumentar la tensión, pero el usuario puede pausar manual.
        
        setDayProgress(prev => {
          const increment = 0.5 * speedMultiplier;
          if (prev + increment >= 100) {
            processDayEnd();
            return 0;
          }
          return prev + increment;
        });
      }, tickRate);
    }
    return () => clearInterval(tickInterval);
  }, [isPaused, gamePhase, speedMultiplier]);

  // --- ACTIONS HANDLER ---
  const executePlayerAction = (type: ActionType, isAuto: boolean) => {
    if (isAuto || (!hasActed && !amIExpelled && !amIBankrupt)) {
        if (type === 'COLLABORATE') {
            setPublicSilo(s => s + 25); setMyStash(s => s + 10); setMyReputation(r => Math.min(100, r + 6)); setMyStats(s => ({ ...s, collaborated: s.collaborated + 1 }));
        } else if (type === 'PRIVATE') {
            setMyStash(s => s + 25); setMyStats(s => ({ ...s, private: s.private + 1 }));
        } else if (type === 'STEAL') {
            setPublicSilo(s => s - 40); setMyStash(s => s + 60); setMyReputation(r => Math.max(0, r - 10)); setMyStats(s => ({ ...s, stole: s.stole + 1 }));
        }
        if (!isAuto) setHasActed(true);
    }
  };

  const startGame = () => {
    const siloStart = botCount * 100;
    const newBots: BotPlayer[] = Array.from({ length: botCount }).map((_, i) => ({
        id: i, name: generateName(), personality: ['ALTRUIST','GREEDY','CHAOTIC','OPPORTUNIST'][Math.floor(Math.random()*4)] as Personality,
        reputation: Math.floor(Math.random() * 30) + 40, stash: Math.floor(Math.random() * 40) + 30,
        stats: { stole: 0, collaborated: 0, private: 0, rescued: 0, donated: 0 }, isDead: false, isBankrupt: false, daysBankrupt: 0
    }));
    setBots(newBots); setPublicSilo(siloStart); setInitialPop(botCount + 1); setGamePhase('PLAYING');
    setDay(1); setMyStash(60); setMyReputation(50); setIsPaused(false); setSpeedMultiplier(1);
    setAmIExpelled(false); setAmIBankrupt(false); setHasActed(false); setDayProgress(0); setAutoPilotAction(null);
    setNewsLog([{ id: 1, text: "Sistema iniciado.", type: 'INFO', resolved: false }]);
  };

  // --- LOGICA DE EVENTOS ---
  const executeExpropriation = (isBotAction: boolean, leaderName: string) => {
    const targetSilo = safeSiloLevel; 
    const deficit = targetSilo - stateRef.current.publicSilo;
    if (deficit <= 0 && isBotAction) return;
    const taxPerHead = Math.ceil(deficit / activePopulation);
    let gathered = 0;
    
    if (!stateRef.current.amIExpelled && !stateRef.current.amIBankrupt) {
       const taken = Math.min(stateRef.current.myStash, taxPerHead);
       setMyStash(s => s - taken); gathered += taken;
    }
    if (!isBotAction) setMyReputation(r => Math.max(0, r - 30));

    setBots(prev => prev.map(b => {
      if (b.isDead || b.isBankrupt) return b;
      const taken = Math.min(b.stash, taxPerHead);
      gathered += taken;
      return { ...b, stash: b.stash - taken };
    }));
    setPublicSilo(prev => prev + gathered);
    addNews(`📢 EXPROPIACIÓN por ${leaderName}. Recaudado: $${gathered}.`, 'ALERT');
  };

  const startVoteAgainst = (targetId: number, targetName: string, targetRep: number, accuser: string) => {
      // NO pausamos automáticamente para que sea fluido, a menos que quieras
      setShowSuspects(false);
      setVoteSession({ targetId, targetName, targetReputation: targetRep, accusedBy: accuser, isOpen: true, bailCost: costOfLiving * 5 });
      addNews(`⚖️ JUICIO: ${accuser} acusa a ${targetName}.`, 'ALERT');
  };

  const finalizeVote = (playerVote: 'YES' | 'NO' | 'ABSTAIN') => {
    if (!voteSession) return;
    const { bots } = stateRef.current;
    let yes = playerVote === 'YES' ? 1 : 0; let no = playerVote === 'NO' ? 1 : 0;
    bots.filter(b => !b.isDead && b.id !== voteSession.targetId).forEach(bot => {
       const prejudice = (100 - voteSession.targetReputation) / 100;
       if (Math.random() < (prejudice - 0.1)) yes++; else no++;
    });
    if (yes > no) {
      if (voteSession.targetId === 999) { setAmIExpelled(true); setMyStash(0); addNews(`🛑 EXPULSADO.`, 'ALERT'); setGamePhase('GAMEOVER'); }
      else { setBots(prev => prev.map(b => b.id === voteSession.targetId ? { ...b, isDead: true, stash: 0 } : b)); addNews(`🔨 EXPULSADO: ${voteSession.targetName}.`, 'ALERT'); }
      setPublicSilo(prev => prev + 50);
    } else { addNews(`🛡️ INOCENTE: ${voteSession.targetName}.`); }
    setVoteSession(null);
  };

  const handleRescue = (type: 'PRIVATE' | 'PUBLIC') => {
     if (!activeBailout) return;
     const { id, name, debt, newsId } = activeBailout;
     const emergencyFund = costOfLiving * 7;
     const totalCost = Math.abs(debt) + emergencyFund;

     if (type === 'PRIVATE') {
        if (myStash >= totalCost) {
           setMyStash(s => s - totalCost);
           setMyReputation(r => Math.min(100, r + 20)); setMyStats(s => ({ ...s, rescued: s.rescued + 1 }));
           resolveBankrupt(id, emergencyFund); addNews(`🤝 TÚ rescataste a ${name}.`);
           markNewsResolved(newsId);
        }
     } else {
        setPublicSilo(s => s - totalCost);
        resolveBankrupt(id, emergencyFund); addNews(`🏛️ Rescate PÚBLICO para ${name}.`);
        markNewsResolved(newsId);
     }
     setActiveBailout(null);
  };

  const resolveBankrupt = (id: number, finalStash: number) => {
     if (id === 999) { setMyStash(finalStash); setAmIBankrupt(false); setMyDaysBankrupt(0); }
     else { setBots(prev => prev.map(b => b.id === id ? { ...b, stash: finalStash, isBankrupt: false, daysBankrupt: 0 } : b)); }
  };

  // --- GAME OVER RENDER ---
  if (gamePhase === 'GAMEOVER') {
    const allP = [...bots, { id: 999, name: 'TÚ', reputation: myReputation, stash: myStash, stats: myStats, isDead: amIExpelled, isMe: true }];
    const richest = [...allP].sort((a:any,b:any) => b.stash - a.stash)[0];
    const biggestThief = [...allP].sort((a:any,b:any) => b.stats.stole - a.stats.stole)[0];
    const mostCollaborative = [...allP].sort((a:any,b:any) => b.stats.collaborated - a.stats.collaborated)[0];
    
    const sortedList = [...allP].sort((a:any, b:any) => {
       if (gameOverSort === 'WEALTH') return b.stash - a.stash;
       if (gameOverSort === 'THEFT') return b.stats.stole - a.stats.stole;
       return b.stats.collaborated - a.stats.collaborated;
    });

    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 font-pixel">
         <div className="border-4 border-red-500 bg-gray-900 p-6 w-full max-w-md shadow-2xl rounded-xl">
            <h2 className="text-3xl text-red-500 mb-4 text-center animate-pulse">SOCIEDAD FALLIDA</h2>
            <div className="grid grid-cols-3 gap-2 mb-6">
                {[{l:'MAGNATE',v:richest,k:'WEALTH'},{l:'LADRÓN',v:biggestThief,k:'THEFT'},{l:'SANTO',v:mostCollaborative,k:'SAINT'}].map((cat:any) => (
                    <button key={cat.l} onClick={() => setGameOverSort(cat.k as any)} className={`p-2 border rounded text-xs ${gameOverSort===cat.k ? 'bg-white text-black' : 'bg-black text-gray-400'}`}>
                        <div className="font-bold">{cat.l}</div>
                        <div>{cat.v.name}</div>
                    </button>
                ))}
            </div>
            <div className="h-48 overflow-y-auto border border-gray-700 mb-4 bg-black p-2">
                <table className="w-full text-xs text-left">
                    <thead><tr><th>NOMBRE</th><th className="text-right">VALOR</th></tr></thead>
                    <tbody>
                        {sortedList.map((p:any,i) => (
                            <tr key={i} className={`border-b border-gray-800 ${p.isMe?'text-gold':''}`}>
                                <td>{i+1}. {p.name} {p.isDead && '💀'}</td>
                                <td className="text-right">{gameOverSort==='WEALTH'?p.stash:gameOverSort==='THEFT'?p.stats.stole:p.stats.collaborated}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={() => setGamePhase('SETUP')} className="w-full py-4 bg-red-600 text-white font-bold hover:bg-red-500 rounded">REINICIAR SISTEMA</button>
         </div>
      </div>
    );
  }

  if (gamePhase === 'SETUP') return (
     <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 font-pixel">
        <div className="w-full max-w-md border-[16px] border-gray-800 rounded-[3rem] bg-gray-900 p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-10"></div>
            <h1 className="text-4xl mb-8 text-gold text-center mt-8">SOCIETY_OS</h1>
            <label className="block mb-2 text-farm-green">POBLACIÓN: {botCount}</label>
            <input type="range" min="10" max="100" step="10" value={botCount} onChange={(e) => setBotCount(parseInt(e.target.value))} className="w-full mb-8 accent-farm-green"/>
            <button onClick={startGame} className="w-full py-4 bg-farm-green text-black font-bold rounded-xl shadow-lg hover:scale-105 transition-transform">INICIAR SIMULACIÓN</button>
            <button onClick={onBack} className="mt-8 text-center w-full text-gray-500 underline text-xs">APAGAR DISPOSITIVO</button>
        </div>
     </div>
  );

  // --- RENDER PRINCIPAL (DEVICE FRAME) ---
  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center p-2 sm:p-4 font-pixel select-none">
      
      {/* DEVICE BODY */}
      <div className="relative w-full max-w-md h-full max-h-[900px] bg-black border-[12px] border-gray-800 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col ring-2 ring-gray-700">
         
         {/* NOTCH */}
         <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-5 bg-gray-800 rounded-b-xl z-50 flex justify-center items-center">
            <div className="w-12 h-1 bg-gray-900 rounded-full"></div>
         </div>

         {/* TOP BAR */}
         <div className="h-16 bg-gradient-to-b from-gray-900 to-black border-b border-gray-800 flex items-center px-5 justify-between shrink-0 pt-4">
             <div className="flex flex-col">
                <span className="text-white text-xs">DÍA {day}</span>
                <span className={`text-lg leading-none ${amIBankrupt ? 'text-red-500 animate-pulse' : 'text-farm-green'}`}>${myStash}</span>
             </div>
             <div className="flex-1 mx-3 flex flex-col justify-center">
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                   <div className={`h-full transition-all duration-200 ${dayProgress>80?'bg-red-500':'bg-blue-500'}`} style={{width: `${dayProgress}%`}}/>
                </div>
                <span className="text-[8px] text-gray-500 text-center mt-1">CICLO DIARIO</span>
             </div>
             <div className="text-right">
                <span className="text-gray-400 text-[10px] block">POBLACIÓN</span>
                <span className="text-white text-sm">{activePopulation}</span>
             </div>
         </div>

         {/* MAIN AREA */}
         <div className="flex-1 overflow-y-auto bg-black relative scrollbar-hide">
             
             {/* 1. DASHBOARD (WINDOWS PHONE STYLE) */}
             {activeTab === 'DASHBOARD' && (
                <div className="p-4 space-y-4 pb-32">
                   <div className="flex justify-between items-center mb-2">
                      <h2 className="text-gray-500 text-xs">PANEL DE CONTROL</h2>
                      <button onClick={() => setEditMode(!editMode)} className={`text-xs px-2 py-1 rounded ${editMode ? 'bg-gold text-black' : 'bg-gray-800 text-gray-400'}`}>⚙️ EDITAR</button>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3">
                      {/* TILE: WEALTH */}
                      {visibleWidgets.wealthParams && (
                         <div className={`col-span-1 bg-gray-900 p-3 rounded-xl border border-gray-800 relative ${editMode ? 'animate-pulse' : ''}`}>
                            {editMode && <button onClick={()=>setVisibleWidgets(p=>({...p, wealthParams:!p.wealthParams}))} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 rounded-bl-lg">x</button>}
                            <p className="text-[10px] text-gray-400 uppercase">Silo Público</p>
                            <p className={`text-2xl ${publicSilo<safeSiloLevel*0.2?'text-red-500':'text-blue-400'}`}>{publicSilo}</p>
                         </div>
                      )}
                      
                      {/* TILE: SENTIMENT */}
                      {visibleWidgets.socialThermometer && (
                         <div className="col-span-1 bg-gray-900 p-3 rounded-xl border border-gray-800">
                             <p className="text-[10px] text-gray-400 uppercase">Clima Social</p>
                             <div className="flex items-center gap-2">
                                <span className="text-2xl">{sentiment.icon}</span>
                                <span className={`text-sm ${sentiment.color}`}>{sentiment.text}</span>
                             </div>
                         </div>
                      )}

                      {/* TILE: INEQUALITY (WIDE) */}
                      {visibleWidgets.inequality && (
                          <div className="col-span-2 bg-gray-900 p-3 rounded-xl border border-gray-800">
                              <p className="text-[10px] text-gray-400 uppercase mb-1">Índice GINI (Top 10% posee:)</p>
                              <div className="w-full bg-gray-800 h-4 rounded-full overflow-hidden relative">
                                  <div className="h-full bg-gold absolute left-0" style={{width: `${inequalityPercentage}%`}}></div>
                              </div>
                              <p className="text-right text-xs text-gold mt-1">{inequalityPercentage}% Riqueza Privada</p>
                          </div>
                      )}

                      {/* TILE: DISTRIBUTION (WIDE) */}
                      {visibleWidgets.distribution && (
                          <div className="col-span-2 bg-gray-900 p-3 rounded-xl border border-gray-800">
                              <p className="text-[10px] text-gray-400 uppercase mb-1">Público vs Privado</p>
                              <div className="flex h-6 w-full rounded overflow-hidden">
                                  <div style={{width: `${publicRatio}%`}} className="bg-blue-600 flex items-center justify-center text-[9px] text-white">{publicRatio}%</div>
                                  <div style={{width: `${100-parseFloat(publicRatio)}%`}} className="bg-yellow-600 flex items-center justify-center text-[9px] text-black">PRIV</div>
                              </div>
                          </div>
                      )}
                   </div>
                   
                   {/* ADD WIDGETS PLACEHOLDER */}
                   {editMode && <div className="p-4 border-2 border-dashed border-gray-700 text-gray-500 text-center rounded-xl text-xs">AGREGAR WIDGETS (Próximamente)</div>}
                </div>
             )}

             {/* 2. ACTIONS TAB (CLEAN) */}
             {activeTab === 'ACTIONS' && (
                <div className="p-4 flex flex-col h-full pb-32">
                   {/* Alerta de Estado */}
                   {hasActed ? (
                      <div className="p-4 mb-4 bg-green-900 bg-opacity-20 border border-green-800 rounded-xl text-center">
                         <p className="text-green-400 text-sm">✅ Tarea Diaria Completada</p>
                         <p className="text-gray-500 text-[10px] mt-1">Esperando siguiente ciclo...</p>
                      </div>
                   ) : (
                      <div className="p-2 mb-2 text-center text-gray-500 text-[10px]">SELECCIONA UNA ACTIVIDAD PARA HOY</div>
                   )}

                   <div className="flex flex-col gap-3">
                      {[
                        { id: 'COLLABORATE', label: 'COLABORAR', sub: '+25 Silo / +10 Tú', color: 'bg-farm-green', text: 'text-black', border: 'border-green-800' },
                        { id: 'PRIVATE', label: 'PRIVADO', sub: '+0 Silo / +25 Tú', color: 'bg-gold', text: 'text-black', border: 'border-yellow-700' },
                        { id: 'STEAL', label: 'ROBAR', sub: '-40 Silo / +60 Tú', color: 'bg-red-600', text: 'text-white', border: 'border-red-900' }
                      ].map((action) => (
                        <div key={action.id} className={`flex items-stretch bg-gray-900 border ${action.border} rounded-2xl overflow-hidden shadow-lg transition-transform active:scale-95`}>
                           <button 
                              onClick={() => executePlayerAction(action.id as ActionType, false)}
                              disabled={hasActed || amIBankrupt}
                              className={`flex-1 p-5 text-left ${hasActed ? 'opacity-30' : ''}`}
                           >
                              <div className={`text-base font-bold ${action.id==='STEAL'?'text-red-400':action.id==='PRIVATE'?'text-yellow-400':'text-green-400'}`}>{action.label}</div>
                              <div className="text-[10px] text-gray-500 mt-1 font-mono">{action.sub}</div>
                           </button>
                           <div className="w-16 bg-black bg-opacity-30 flex flex-col items-center justify-center border-l border-gray-800">
                              <span className="text-[8px] text-gray-500 mb-2">AUTO</span>
                              <button 
                                 onClick={() => setAutoPilotAction(prev => prev === action.id ? null : action.id as ActionType)}
                                 className={`w-10 h-6 rounded-full relative transition-colors ${autoPilotAction === action.id ? action.color : 'bg-gray-700'}`}
                              >
                                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${autoPilotAction === action.id ? 'right-1' : 'left-1'}`}></div>
                              </button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             )}
             
             {/* 3. NEWS & RANKING SIMPLE */}
             {activeTab === 'NEWS' && (
                <div className="p-4 space-y-2 pb-32">
                   {newsLog.map(n => (
                      <div key={n.id} onClick={() => { if(n.type==='BANKRUPTCY_ALERT' && !n.resolved) { setActiveBailout({...n.data, newsId: n.id}); } }} className={`p-3 rounded-lg border-l-4 bg-gray-900 text-xs ${n.type==='ALERT'?'border-red-500':n.type==='DEATH'?'border-gray-600':'border-blue-500'} ${n.type==='BANKRUPTCY_ALERT'&&!n.resolved?'cursor-pointer hover:bg-gray-800 ring-1 ring-gold':''}`}>
                         <p className="text-gray-300">{n.text}</p>
                         {n.resolved && <span className="text-[9px] text-green-500">RESUELTO</span>}
                      </div>
                   ))}
                </div>
             )}

             {activeTab === 'RANKING' && (
                 <div className="pb-32">
                     {bots.concat({id:999, name:'⭐ TÚ', stash:myStash, reputation:myReputation} as any).sort((a,b)=>b.stash-a.stash).map((p,i) => (
                         <div key={p.id} className={`flex justify-between p-3 border-b border-gray-800 ${p.id===999?'bg-gray-800':''}`}>
                             <span className="text-gray-400 w-6">{i+1}</span>
                             <span className={p.id===999?'text-gold':'text-white'}>{p.name}</span>
                             <span className="text-gray-500 font-mono">${p.stash}</span>
                         </div>
                     ))}
                 </div>
             )}
             
             {/* LEADER ACTIONS */}
             {activeTab === 'LEADER' && (
                 <div className="p-4 grid grid-cols-1 gap-4 mt-4">
                     <button onClick={() => setShowSuspects(true)} className="bg-purple-900 border border-purple-500 p-8 rounded-2xl text-xl font-bold hover:bg-purple-800">⚖️ INICIAR JUICIO</button>
                     <button onClick={() => executeExpropriation(false, "JUGADOR")} className="bg-red-900 border border-red-500 p-8 rounded-2xl text-xl font-bold hover:bg-red-800">📢 EXPROPIAR</button>
                 </div>
             )}

         </div>

         {/* PANEL DE CRISIS (NO INVASIVO - FLOTANTE ABAJO) */}
         {(activeBailout || (voteSession && voteSession.isOpen)) && (
            <div className="absolute bottom-[4.5rem] left-2 right-2 bg-gray-900 border-t-4 border-gold rounded-t-xl shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-20 transition-transform duration-300 p-4">
                
                {activeBailout && (
                   <div className="flex flex-col gap-2">
                       <div className="flex justify-between items-center mb-2">
                           <h3 className="text-gold text-sm font-bold">🚑 SOLICITUD DE RESCATE</h3>
                           <button onClick={()=>setActiveBailout(null)} className="text-gray-500 text-xs">X</button>
                       </div>
                       <p className="text-xs text-white mb-2">Ayudar a <span className="text-blue-400">{activeBailout.name}</span> cuesta <span className="text-red-400">${Math.abs(activeBailout.debt) + (costOfLiving * 7)}</span></p>
                       <div className="flex gap-2">
                           <button disabled={myStash < (Math.abs(activeBailout.debt) + (costOfLiving*7))} onClick={()=>handleRescue('PRIVATE')} className="flex-1 bg-gold text-black text-xs py-3 rounded font-bold disabled:opacity-50">PAGAR</button>
                           <button onClick={()=>setActiveBailout(null)} className="px-4 bg-gray-700 text-white text-xs rounded">IGNORAR</button>
                       </div>
                   </div>
                )}

                {voteSession && voteSession.isOpen && (
                    <div className="flex flex-col gap-2">
                       <h3 className="text-danger text-sm font-bold text-center">⚖️ VOTO EN CURSO: {voteSession.targetName}</h3>
                       <div className="flex gap-2">
                           <button onClick={()=>finalizeVote('YES')} className="flex-1 bg-red-600 py-3 rounded text-white text-xs font-bold">CULPABLE</button>
                           <button onClick={()=>finalizeVote('NO')} className="flex-1 bg-blue-600 py-3 rounded text-white text-xs font-bold">INOCENTE</button>
                       </div>
                    </div>
                )}
            </div>
         )}
         
         {/* BARRA DE VELOCIDAD HORIZONTAL (FLOTANTE DERECHA) */}
         <div className="absolute bottom-[5rem] right-4 z-10 flex gap-1 bg-black rounded-full px-2 py-1 border border-gray-700 shadow-lg">
             {[0, 1, 5].map(s => (
                 <button key={s} onClick={()=> {setSpeedMultiplier(s); setIsPaused(s===0)}} className={`w-8 h-8 rounded-full text-[10px] font-bold ${speedMultiplier===s && !isPaused ? 'bg-farm-green text-black' : 'text-gray-400 hover:bg-gray-800'}`}>
                     {s===0 ? '⏸' : `x${s}`}
                 </button>
             ))}
         </div>

         {/* DOCK DE NAVEGACIÓN */}
         <div className="h-16 bg-gray-900 border-t border-gray-800 shrink-0 flex items-center justify-around pb-2 px-2 relative z-30 rounded-b-[2rem]">
             {[
               {id: 'ACTIONS', icon: '⚡', label: 'ACCIONES'},
               {id: 'DASHBOARD', icon: '📊', label: 'DATOS'}, // Ahora es el Dashboard Tile
               {id: 'NEWS', icon: '📡', label: 'RED', alert: unreadNews},
               {id: 'RANKING', icon: '🏆', label: 'RANK'},
               {id: 'LEADER', icon: '👑', label: 'MANDO', hidden: ![...bots, {id:999,reputation:myReputation} as any].sort((a,b)=>b.reputation-a.reputation).slice(0,3).some(p=>p.id===999)}
             ].map(t => !t.hidden && (
                <button key={t.id} onClick={()=>{setActiveTab(t.id as any); if(t.id==='NEWS') setUnreadNews(false)}} className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${activeTab===t.id ? 'text-farm-green bg-gray-800' : 'text-gray-500'}`}>
                   <div className="relative">
                      <span className="text-xl">{t.icon}</span>
                      {t.alert && <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
                   </div>
                   <span className="text-[8px] mt-1">{t.label}</span>
                </button>
             ))}
         </div>

         {/* MODAL SUSPECTS (Full overlay sigue siendo mejor para listas largas, pero estilizado) */}
         {showSuspects && (
             <div className="absolute inset-0 bg-black bg-opacity-95 z-50 p-6 flex flex-col">
                 <h2 className="text-center text-gold mb-4 font-bold">SELECCIONAR OBJETIVO</h2>
                 <div className="flex-1 overflow-y-auto">
                     {bots.filter(b=>!b.isDead).map(b => (
                         <button key={b.id} onClick={()=>startVoteAgainst(b.id, b.name, b.reputation, 'TÚ')} className="w-full text-left p-4 border-b border-gray-800 text-white hover:bg-red-900 flex justify-between">
                             <span>{b.name}</span>
                             <span className="text-gray-400 text-xs">{b.reputation} Rep</span>
                         </button>
                     ))}
                 </div>
                 <button onClick={()=>setShowSuspects(false)} className="mt-4 py-4 bg-gray-800 rounded-xl text-white">CANCELAR</button>
             </div>
         )}

      </div>
    </div>
  );
}

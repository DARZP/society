import { useState, useEffect, useRef } from 'react';

// --- TIPOS ---
type Personality = 'ALTRUIST' | 'GREEDY' | 'CHAOTIC' | 'OPPORTUNIST';
type ActionType = 'COLLABORATE' | 'PRIVATE' | 'STEAL';

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

// --- GENERADOR DE NOMBRES ---
const generateName = () => {
  const prefixes = [
    "xX_", "The", "Dr", "Lord", "El_", "La_", "Sir", "Lady", "Captain", "Agent", 
    "iAm", "Real", "Not", "Big", "Lil_", "Cyber", "Mega", "Iron", "Dark", "Hyper", 
    "Super", "Master", "Pro", "Noob", "Just", "Im", "Mr", "Miss", "General", "Don",
    "Shadow", "Mystic", "Techno", "Retro", "Neon", "Ultra", "Epic", "Toxic"
  ];
  
  const bases = [
    "Juan", "Maria", "Carlos", "Sofia", "Alex", "Kevin", "Brayan", "Karen", "Luis", "Ana", 
    "Pedro", "Lucia", "Diego", "Valeria", "Jorge", "Fernanda", "Miguel", "Camila", 
    "Slayer", "Wolf", "Ghost", "Panda", "Dragon", "Tiger", "Eagle", "Viper", "Cobra", "Bear", 
    "Fox", "Raven", "Shark", "Hawk", "Lion", "Falcon", "Phoenix", "Titan", "Demon", "Angel",
    "Crypto", "Bitcoin", "Satoshi", "Dev", "Coder", "Hacker", "Glitch", "Pixel", "Token", "Coin",
    "System", "Error", "Null", "Void", "Data", "Bot", "AI", "Nexus", "Matrix",
    "Noob", "Pro", "God", "King", "Queen", "Prince", "Joker", "Stark", "Neo", "Goku", 
    "Naruto", "Sonic", "Mario", "Zelda", "Link", "Ash", "Kratos", "Chief", "Doom"
  ];
  
  const suffixes = [
    "_Xx", "_HD", "_YT", "_TV", "_LP", "_Official", "_Real", "_Gaming", "Plays", 
    "123", "321", "69", "420", "666", "777", "88", "99", "007", "2077", "2025", "3000", "101",
    ".eth", ".btc", ".sol", ".tez", 
    "ok", "lol", "uwu", "xD", "_v2", "_beta", ""
  ];
  
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const b = bases[Math.floor(Math.random() * bases.length)];
  const s = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  return `${p}${b}${s}`;
};

export default function OfflineSimulator({ onBack }: { onBack: () => void }) {
  // --- FASES ---
  const [gamePhase, setGamePhase] = useState<'SETUP' | 'PLAYING' | 'GAMEOVER'>('SETUP');
  const [botCount, setBotCount] = useState(50);
  const [initialPop, setInitialPop] = useState(50);
  
  // --- MUNDO & ECONOMÍA ---
  const [day, setDay] = useState(1);
  const [publicSilo, setPublicSilo] = useState(1000);
  const [initialTotalWealth, setInitialTotalWealth] = useState(1000);
  
  // --- JUGADOR ---
  const [myStash, setMyStash] = useState(50);
  const [myReputation, setMyReputation] = useState(50);
  const [myStats, setMyStats] = useState<PlayerStats>({ stole: 0, collaborated: 0, private: 0, rescued: 0, donated: 0 });
  const [amIExpelled, setAmIExpelled] = useState(false);
  const [amIBankrupt, setAmIBankrupt] = useState(false);
  const [myDaysBankrupt, setMyDaysBankrupt] = useState(0);
  
  // --- UI & CONTROLES ---
  const [activeTab, setActiveTab] = useState<'ACTIONS' | 'RANKING' | 'STATS' | 'NEWS' | 'LEADER'>('ACTIONS');
  const [newsLog, setNewsLog] = useState<NewsItem[]>([]);
  const [unreadNews, setUnreadNews] = useState(false);
  const [gameOverSort, setGameOverSort] = useState<SortType>('WEALTH');
  
  // Switch Automático y Progreso del Día
  const [autoAction, setAutoAction] = useState<ActionType | null>(null);
  const [dayProgress, setDayProgress] = useState(0);
  
  // Modales
  const [voteSession, setVoteSession] = useState<VoteSession | null>(null);
  const [activeBailout, setActiveBailout] = useState<{id: number, name: string, debt: number, newsId: number} | null>(null);
  const [showSuspects, setShowSuspects] = useState(false);

  // --- MOTORES ---
  const [bots, setBots] = useState<BotPlayer[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [timeMultiplier, setTimeMultiplier] = useState(1); 

  const stateRef = useRef({ bots, myReputation, myStash, publicSilo, autoAction, amIExpelled, gamePhase, initialPop, initialTotalWealth, amIBankrupt, myDaysBankrupt });
  useEffect(() => {
    stateRef.current = { bots, myReputation, myStash, publicSilo, autoAction, amIExpelled, gamePhase, initialPop, initialTotalWealth, amIBankrupt, myDaysBankrupt };
  }, [bots, myReputation, myStash, publicSilo, autoAction, amIExpelled, gamePhase, initialPop, initialTotalWealth, amIBankrupt, myDaysBankrupt]);

  // --- CÁLCULOS ECONÓMICOS ---
  const activeBots = bots.filter(b => !b.isDead);
  const activePopulation = activeBots.length + (amIExpelled ? 0 : 1);
  const totalPrivateWealth = activeBots.reduce((acc, bot) => acc + bot.stash, 0) + (amIExpelled ? 0 : myStash);
  const currentTotalWealth = publicSilo + totalPrivateWealth;
  
  // Inflación balanceada (Suavizada)
  const wealthPerCapita = Math.max(1, currentTotalWealth / (activePopulation || 1));
  // Base cost reducido un poco (0.12 en vez de 0.15) para dar respiro al inicio
  const baseCost = Math.max(5, wealthPerCapita * 0.12); 
  const safeSiloLevel = activePopulation * 50; 
  const scarcityMultiplier = Math.max(1, safeSiloLevel / (publicSilo + 1));
  const costOfLiving = Math.floor(baseCost * scarcityMultiplier); 

  // GINI & Stats
  const publicRatio = ((publicSilo / (currentTotalWealth || 1)) * 100).toFixed(1);
  const allStashes = [...activeBots.map(b => b.stash), (amIExpelled ? 0 : myStash)].sort((a, b) => b - a);
  const top10Count = Math.ceil(allStashes.length * 0.1);
  const inequalityPercentage = ((allStashes.slice(0, top10Count).reduce((a, b) => a + b, 0) / (totalPrivateWealth || 1)) * 100).toFixed(1);

  const getSocialSentiment = () => {
    if (publicSilo < safeSiloLevel * 0.2) return { icon: '🔥', text: 'COLAPSO', color: 'text-red-600' };
    if (costOfLiving > 30) return { icon: '🤬', text: 'FURIA', color: 'text-danger' };
    if (costOfLiving > 15) return { icon: '😨', text: 'MIEDO', color: 'text-orange-400' };
    return { icon: '😎', text: 'ESTABLE', color: 'text-farm-green' };
  };
  const sentiment = getSocialSentiment();

  const addNews = (text: string, type: 'INFO' | 'ALERT' | 'BANKRUPTCY_ALERT' | 'DEATH' = 'INFO', data?: any) => {
    setNewsLog(prev => [{ id: Date.now() + Math.random(), text: `Día ${day}: ${text}`, type, data, resolved: false }, ...prev].slice(0, 30));
    if (activeTab !== 'NEWS') setUnreadNews(true);
  };

  const markNewsResolved = (newsId: number) => {
    setNewsLog(prev => prev.map(item => item.id === newsId ? { ...item, resolved: true } : item));
  };

  // --- INICIO ---
  const startGame = () => {
    const siloStart = botCount * 120; // Un poco más de silo inicial
    const newBots: BotPlayer[] = Array.from({ length: botCount }).map((_, i) => {
      const rand = Math.random();
      let p: Personality = 'OPPORTUNIST';
      if (rand < 0.2) p = 'ALTRUIST'; else if (rand < 0.4) p = 'GREEDY'; else if (rand < 0.5) p = 'CHAOTIC';
      return {
        id: i, name: generateName(), personality: p,
        reputation: Math.floor(Math.random() * 30) + 40, stash: Math.floor(Math.random() * 40) + 40, // + Dinero inicial 
        stats: { stole: 0, collaborated: 0, private: 0, rescued: 0, donated: 0 },
        isDead: false, isBankrupt: false, daysBankrupt: 0
      };
    });

    const playerStartStash = 70;
    const totalStart = siloStart + (newBots.reduce((a,b)=>a+b.stash,0)) + playerStartStash;

    setBots(newBots);
    setPublicSilo(siloStart); 
    setInitialTotalWealth(totalStart);
    setInitialPop(botCount + 1);
    setGamePhase('PLAYING');
    setDay(1);
    setMyStats({ stole: 0, collaborated: 0, private: 0, rescued: 0, donated: 0 });
    setMyReputation(50);
    setMyStash(playerStartStash);
    setAmIExpelled(false);
    setAmIBankrupt(false);
    setMyDaysBankrupt(0);
    setNewsLog([{ id: 1, text: "Bienvenido al Sistema.", type: 'INFO' }]);
    setIsRunning(false);
    setDayProgress(0);
    setAutoAction(null);
  };

  // --- LÓGICA DE ACCIONES ---
  const applyActionGain = (action: ActionType, isPlayer: boolean, botId?: number) => {
    let siloChange = 0;
    let personalGain = 0;
    let repChange = 0;

    if (action === 'COLLABORATE') {
        siloChange = 25; personalGain = 10; repChange = 6;
        if (isPlayer) setMyStats(s => ({ ...s, collaborated: s.collaborated + 1 }));
    } else if (action === 'PRIVATE') {
        siloChange = 0; personalGain = 25; repChange = -2; 
        if (isPlayer) setMyStats(s => ({ ...s, private: s.private + 1 }));
    } else if (action === 'STEAL') {
        siloChange = -40; personalGain = 60; repChange = -10;
        if (isPlayer) setMyStats(s => ({ ...s, stole: s.stole + 1 }));
    }

    setPublicSilo(s => s + siloChange);

    if (isPlayer) {
        setMyStash(s => s + personalGain);
        setMyReputation(r => Math.max(0, Math.min(100, r + repChange)));
    } else if (botId !== undefined) {
        setBots(prev => prev.map(b => {
            if (b.id === botId) {
                return { 
                    ...b, 
                    stash: b.stash + personalGain, 
                    reputation: Math.max(0, Math.min(100, b.reputation + repChange)),
                    stats: { 
                        ...b.stats, 
                        collaborated: action === 'COLLABORATE' ? b.stats.collaborated + 1 : b.stats.collaborated,
                        private: action === 'PRIVATE' ? b.stats.private + 1 : b.stats.private,
                        stole: action === 'STEAL' ? b.stats.stole + 1 : b.stats.stole
                    }
                };
            }
            return b;
        }));
    }
  };

  // --- FUNCIÓN RECUPERADA: DONAR ---
  const donateToSilo = () => {
     if (myStash < 20 || hasActed) return;
     setMyStash(s => s - 20);
     setPublicSilo(s => s + 20);
     setMyReputation(r => Math.min(100, r + 10)); // +10 Rep por donar
     setMyStats(s => ({...s, donated: s.donated + 20}));
     setHasActed(true);
  };

  // --- EXPROPIACIÓN ---
  const executeExpropriation = (isBotAction: boolean, leaderName: string) => {
    const targetSilo = safeSiloLevel; 
    const deficit = targetSilo - stateRef.current.publicSilo;
    if (deficit <= 0 && !isBotAction) { alert("Silo sano."); return; }
    if (deficit <= 0 && isBotAction) return;

    const taxPerHead = Math.ceil(deficit / activePopulation);
    let gathered = 0;
    
    if (!stateRef.current.amIExpelled && !stateRef.current.amIBankrupt) {
       const taken = Math.min(stateRef.current.myStash, taxPerHead);
       setMyStash(s => s - taken);
       gathered += taken;
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
    if (!isBotAction) alert(`Recaudado: $${gathered}`);
  };

  // --- JUICIOS ---
  const startVoteAgainst = (targetId: number, targetName: string, targetRep: number, accuser: string) => {
      setIsRunning(false);
      setShowSuspects(false);
      setVoteSession({ targetId, targetName, targetReputation: targetRep, accusedBy: accuser, isOpen: true, bailCost: costOfLiving * 5 });
      addNews(`⚖️ JUICIO: ${accuser} acusa a ${targetName}.`, 'ALERT');
  };

  const payBailoutInTrial = () => {
    if (!voteSession) return;
    if (myStash >= voteSession.bailCost) {
      setMyStash(s => s - voteSession.bailCost);
      setMyReputation(r => Math.min(100, r + 10));
      addNews(`💸 FIANZA: Salvaste a ${voteSession.targetName}.`);
      setVoteSession(null);
      setIsRunning(true);
    }
  };

  const finalizeVote = (playerVote: 'YES' | 'NO' | 'ABSTAIN') => {
    if (!voteSession) return;
    const { bots } = stateRef.current;
    let yes = playerVote === 'YES' ? 1 : 0;
    let no = playerVote === 'NO' ? 1 : 0;

    bots.filter(b => !b.isDead && b.id !== voteSession.targetId).forEach(bot => {
       const prejudice = (100 - voteSession.targetReputation) / 100;
       if (Math.random() < (prejudice - 0.1)) yes++; else no++;
    });

    if (yes > no) {
      let confiscated = 0;
      if (voteSession.targetId === 999) {
        setAmIExpelled(true);
        confiscated = Math.max(0, stateRef.current.myStash);
        setMyStash(0);
        addNews(`🛑 CULPABLE (${yes} vs ${no}). Confiscado: $${confiscated}.`, 'ALERT');
      } else {
        const victim = bots.find(b => b.id === voteSession.targetId);
        if (victim) confiscated = Math.max(0, victim.stash);
        setBots(prev => prev.map(b => b.id === voteSession.targetId ? { ...b, isDead: true, stash: 0 } : b));
        addNews(`🔨 EXPULSADO (${yes} vs ${no}): ${voteSession.targetName}. Incautado: $${confiscated}.`, 'ALERT');
      }
      setPublicSilo(prev => prev + confiscated);
    } else {
      addNews(`🛡️ INOCENTE (${yes} vs ${no}): ${voteSession.targetName}.`);
    }
    setVoteSession(null);
    setIsRunning(true);
  };

  // --- RESCATES ---
  const openBailoutModal = (item: NewsItem) => {
     if (item.type === 'BANKRUPTCY_ALERT' && item.data && !item.resolved) {
        setIsRunning(false);
        setActiveBailout({ ...item.data, newsId: item.id });
     }
  };

  const handleRescue = (type: 'PRIVATE' | 'PUBLIC') => {
     if (!activeBailout) return;
     const { id, name, debt, newsId } = activeBailout;
     const buffer = costOfLiving * 5;
     const totalRescueCost = Math.abs(debt) + buffer;

     if (type === 'PRIVATE') {
        if (myStash >= totalRescueCost) {
           setMyStash(s => s - totalRescueCost);
           setMyReputation(r => Math.min(100, r + 25));
           setMyStats(s => ({ ...s, rescued: s.rescued + 1 }));
           resolveBankrupt(id, buffer);
           addNews(`🤝 TÚ rescataste a ${name}.`);
           markNewsResolved(newsId);
        }
     } else if (type === 'PUBLIC') {
        setPublicSilo(s => s - totalRescueCost);
        resolveBankrupt(id, buffer);
        addNews(`🏛️ Rescate PÚBLICO para ${name}.`);
        markNewsResolved(newsId);
     }
     setActiveBailout(null);
     setIsRunning(true);
  };

  const resolveBankrupt = (id: number, finalStash: number) => {
     setBots(prev => prev.map(b => b.id === id ? { ...b, stash: finalStash, isBankrupt: false, daysBankrupt: 0 } : b));
  };

  // --- BUCLE PRINCIPAL (TICK) ---
  useEffect(() => {
    let interval: any;
    if (isRunning && gamePhase === 'PLAYING') {
      const tickRate = 50; 
      interval = setInterval(() => {
        setDayProgress(prev => {
            const next = prev + (0.5 * timeMultiplier); 
            if (next >= 100) {
                handleEndOfDay();
                return 0;
            }
            return next;
        });
      }, tickRate);
    }
    return () => clearInterval(interval);
  }, [isRunning, gamePhase, timeMultiplier, costOfLiving]); 

  // --- FIN DEL DÍA ---
  const handleEndOfDay = () => {
        const currentData = stateRef.current;
        
        // 1. JUGADOR
        if (!currentData.amIExpelled && !currentData.amIBankrupt) {
            if (currentData.autoAction) {
                applyActionGain(currentData.autoAction, true);
            }
            // COBRO DE VIDA SIEMPRE
            setMyStash(prev => prev - costOfLiving);
            setMyReputation(r => Math.max(0, r - 2));
        }

        setDay(d => d + 1);
        setHasActed(false); 

        // 2. IA BOTS
        const activeList = [...currentData.bots.filter(b => !b.isDead), { id: 999, name: 'TÚ', reputation: currentData.myReputation, isDead: currentData.amIExpelled }];
        const topRep = activeList.sort((a,b) => b.reputation - a.reputation)[0];
        
        // IA Expropiación
        if (topRep && topRep.id !== 999 && currentData.publicSilo < (stateRef.current.bots.length * 10)) {
           if (Math.random() < 0.3) executeExpropriation(true, "Líder Bot");
        }

        // Bots Loop
        setBots(currentBots => currentBots.map(bot => {
          if (bot.isDead) return bot;
          
          let newRep = Math.max(0, bot.reputation - 2);

          // Bancarrota check
          if (bot.isBankrupt) {
             if (bot.daysBankrupt >= 5) {
                 addNews(`✝️ ${bot.name} murió.`, 'DEATH');
                 return { ...bot, isDead: true, stash: 0 };
             }
             return { ...bot, daysBankrupt: bot.daysBankrupt + 1 };
          }

          let newStash = bot.stash;
          let currentStats = { ...bot.stats };
          
          // DECISIÓN
          const financialStress = costOfLiving / (Math.max(1, bot.stash)); 
          const socialPanic = 1 - Math.min(1, currentData.publicSilo / (stateRef.current.bots.length * 50)); 
          const roll = Math.random();
          let decision: ActionType = 'PRIVATE';

          if (bot.stash < costOfLiving * 2) {
             if (roll < 0.9) decision = 'STEAL'; 
          } else if (bot.personality === 'ALTRUIST' && bot.stash > costOfLiving * 5) {
             decision = 'COLLABORATE';
          } else if (bot.personality === 'GREEDY') {
             if (roll < 0.6) decision = 'PRIVATE'; else decision = 'STEAL';
          } else {
             if (roll < 0.7) decision = 'COLLABORATE'; else decision = 'PRIVATE';
          }

          // Ejecutar Acción Bot
          if (decision === 'COLLABORATE') {
             setPublicSilo(s => s + 25); newStash += 10; newRep = Math.min(100, newRep + 6); currentStats.collaborated++;
          } else if (decision === 'PRIVATE') {
             newStash += 25; currentStats.private++; newRep -= 2;
          } else {
             setPublicSilo(s => s - 40); newStash += 60; newRep = Math.max(0, newRep - 10); currentStats.stole++;
          }

          // COBRO VIDA
          newStash -= costOfLiving;

          if (newStash < 0) {
             addNews(`🆘 ${bot.name} pide rescate.`, 'BANKRUPTCY_ALERT', { id: bot.id, name: bot.name, debt: newStash });
             return { ...bot, isBankrupt: true, stash: newStash, daysBankrupt: 0, reputation: newRep, stats: currentStats };
          }

          return { ...bot, reputation: newRep, stash: newStash, stats: currentStats };
        }));

        // 3. COLAPSO
        setPublicSilo(prev => {
           let val = Math.max(0, prev);
           const aliveCount = currentData.bots.filter(b => !b.isDead).length + (currentData.amIExpelled ? 0 : 1);
           if (aliveCount < (currentData.initialPop / 2)) {
              setIsRunning(false);
              setGamePhase('GAMEOVER');
           }
           return val;
        });
  };

  // CHECK JUGADOR BANKRUPT
  useEffect(() => {
      if (!amIBankrupt && !amIExpelled && myStash < 0) {
          setAmIBankrupt(true);
          setMyDaysBankrupt(0);
          addNews("¡ESTÁS EN QUIEBRA!", 'BANKRUPTCY_ALERT', { id: 999, name: 'TÚ', debt: myStash });
      } else if (amIBankrupt && myStash >= 0) {
          setAmIBankrupt(false);
      }
  }, [myStash]);

  // RENDER HELPERS
  const activePlayersList = [...bots.filter(b => !b.isDead), { id: 999, name: 'TÚ', reputation: myReputation, isDead: amIExpelled }];
  const sortedByRep = [...activePlayersList].sort((a,b) => b.reputation - a.reputation);
  const amITopRep = sortedByRep.slice(0, 3).some(p => p.id === 999);

  // --- RENDERIZADO PRINCIPAL ---
  return (
    <div className="w-full h-screen bg-black flex flex-col font-terminal text-sm text-gray-300 overflow-hidden">
      
      {/* 1. TOP BAR */}
      <div className="shrink-0 bg-gray-900 border-b border-gray-700 p-2">
         <div className="w-full h-2 bg-gray-800 rounded-full mb-2 relative overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-400 via-yellow-200 to-purple-500 transition-all duration-100 ease-linear" style={{ width: `${dayProgress}%` }}></div>
         </div>
         <div className="flex justify-between items-center text-xs">
            <span className="text-white font-pixel">DÍA {day}</span>
            <div className="flex gap-3">
               <span className={`${publicSilo < 500 ? 'text-red-500 animate-pulse' : 'text-farm-green'}`}>SILO: {publicSilo}</span>
               <span className="text-danger">COSTO: -{costOfLiving}</span>
               <span className={`${myStash < 0 ? 'text-red-500 font-bold' : 'text-gold'}`}>$$: {myStash}</span>
            </div>
         </div>
      </div>

      {/* 2. MODALES */}
      {activeBailout && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 animate-bounce-in">
           <h3 className="text-gold font-pixel text-lg mb-4">RESCATE FINANCIERO</h3>
           <div className="bg-gray-900 p-4 w-full mb-6 border border-gray-700">
              <p className="flex justify-between mb-2"><span>Deuda:</span> <span className="text-red-400">${Math.abs(activeBailout.debt)}</span></p>
              <p className="flex justify-between mb-2"><span>Buffer (5 días):</span> <span className="text-blue-400">${costOfLiving * 5}</span></p>
              <div className="h-px bg-gray-600 my-2"></div>
              <p className="flex justify-between text-lg font-bold"><span>TOTAL:</span> <span className="text-gold">${Math.abs(activeBailout.debt) + (costOfLiving * 5)}</span></p>
           </div>
           <button 
              onClick={() => handleRescue('PRIVATE')} 
              disabled={myStash < (Math.abs(activeBailout.debt) + (costOfLiving * 5))}
              className="w-full py-4 bg-gold text-black font-pixel mb-2 disabled:opacity-50"
           >
              PAGAR CON MI DINERO
           </button>
           
           {amITopRep && (
              <button onClick={() => handleRescue('PUBLIC')} className="w-full py-4 bg-farm-green text-black font-pixel mb-2">
                 USAR FONDOS PÚBLICOS
              </button>
           )}

           <button onClick={() => setActiveBailout(null)} className="mt-4 text-gray-500 underline">CANCELAR</button>
        </div>
      )}

      {voteSession && voteSession.isOpen && (
        <div className="absolute inset-0 z-50 bg-black bg-opacity-95 flex flex-col items-center justify-center p-6 border-4 border-gold">
           <h3 className="text-gold font-pixel text-xl mb-4 text-center">TRIBUNAL</h3>
           <p className="text-white text-center mb-4">{voteSession.accusedBy} vs <span className="text-danger font-bold">{voteSession.targetName}</span></p>
           <div className="grid grid-cols-2 gap-2 w-full mb-4">
              <button onClick={() => finalizeVote('YES')} className="bg-danger text-white py-2 font-pixel text-xs">CULPABLE</button>
              <button onClick={() => finalizeVote('NO')} className="bg-blue-600 text-white py-2 font-pixel text-xs">INOCENTE</button>
              <button onClick={() => finalizeVote('ABSTAIN')} className="bg-gray-600 text-white py-2 font-pixel text-xs col-span-2">ABSTENER</button>
           </div>
           <button onClick={payBailoutInTrial} disabled={myStash < voteSession.bailCost} className="w-full bg-gold text-black font-pixel py-3 text-xs disabled:opacity-50">💸 FIANZA (-${voteSession.bailCost})</button>
        </div>
      )}

      {showSuspects && (
         <div className="absolute inset-0 z-50 bg-black bg-opacity-95 p-6 border-4 border-gold">
            <h3 className="text-gold font-pixel text-center mb-4">ACUSAR</h3>
            <div className="h-64 overflow-y-auto">
               {bots.filter(b => !b.isDead && b.reputation < 60).map(b => (
                  <button key={b.id} onClick={() => startVoteAgainst(b.id, b.name, b.reputation, 'TÚ')} className="w-full text-left p-2 border-b border-gray-700 hover:bg-gray-800 text-danger font-terminal">{b.name} (Rep: {b.reputation} Pts)</button>
               ))}
            </div>
            <button onClick={() => {setShowSuspects(false); setIsRunning(true);}} className="mt-4 w-full bg-gray-600 text-white py-2 font-pixel">CANCELAR</button>
         </div>
      )}

      {/* 3. MAIN CONTENT AREA */}
      <div className="flex-grow overflow-y-auto relative custom-scrollbar bg-black p-4">
         
         {/* GAME OVER */}
         {gamePhase === 'GAMEOVER' && (
            <div className="text-center space-y-6 mt-10 animate-fade-in">
               <h1 className="text-3xl text-danger font-pixel mb-4">SOCIEDAD CAÍDA</h1>
               
               <div className="flex justify-center gap-2 mb-4">
                  {['WEALTH', 'THEFT', 'SAINT'].map(type => (
                     <button key={type} onClick={() => setGameOverSort(type as SortType)} className={`px-3 py-2 border ${gameOverSort === type ? 'bg-white text-black border-white' : 'bg-black text-gray-500 border-gray-700'}`}>
                        {type}
                     </button>
                  ))}
               </div>
               
               <div className="h-64 overflow-y-auto border border-gray-800">
                  {[...bots, {id:999, name:'TÚ', personality:'OPPORTUNIST', reputation:myReputation, stash:myStash, stats:myStats, isDead:amIExpelled, isBankrupt:false, daysBankrupt:0}].sort((a,b) => {
                      if (gameOverSort === 'WEALTH') return b.stash - a.stash;
                      if (gameOverSort === 'THEFT') return b.stats.stole - a.stats.stole;
                      return b.stats.collaborated - a.stats.collaborated;
                  }).map((p, i) => (
                     <div key={i} className="flex justify-between p-2 border-b border-gray-900 text-xs">
                        <span>#{i+1} {p.name}</span>
                        <span className="text-gold">{gameOverSort === 'WEALTH' ? p.stash : gameOverSort === 'THEFT' ? p.stats.stole : p.stats.collaborated}</span>
                     </div>
                  ))}
               </div>
               
               <button onClick={() => setGamePhase('SETUP')} className="w-full py-4 bg-farm-green text-black font-pixel mt-4">REINICIAR SIMULACIÓN</button>
            </div>
         )}

         {/* SETUP SCREEN */}
         {gamePhase === 'SETUP' && (
            <div className="h-full flex flex-col justify-center items-center px-8">
               <h1 className="text-4xl font-pixel text-farm-green mb-8 text-center">SOCIETY<br/>MOBILE</h1>
               <label className="text-gray-400 mb-2 font-terminal">POBLACIÓN: {botCount}</label>
               <input type="range" min="10" max="100" value={botCount} onChange={e => setBotCount(parseInt(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mb-10 accent-farm-green"/>
               <button onClick={startGame} className="w-full py-5 bg-white text-black font-pixel text-xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]">INICIAR SISTEMA</button>
            </div>
         )}

         {/* PANTALLA DE JUEGO */}
         {gamePhase === 'PLAYING' && activeTab === 'ACTIONS' && (
            <div className="flex flex-col gap-4 h-full justify-center">
               
               {amIExpelled ? (
                  <div className="text-center"><p className="text-danger font-pixel mb-4">HAS SIDO EXPULSADO</p><button onClick={() => setGamePhase('GAMEOVER')} className="bg-white text-black font-pixel py-3 px-6">TERMINAR</button></div>
               ) : amIBankrupt ? (
                  <div className="text-center"><p className="text-danger font-bold mb-2">¡ESTÁS EN QUIEBRA!</p><p className="text-xs text-gray-400">Espera un rescate en NEWS o muere.</p></div>
               ) : (
               <>
               <button onClick={donateToSilo} className="w-full bg-blue-900 text-blue-200 font-pixel py-3 mb-4 border border-blue-500 hover:bg-blue-800">🤝 DONAR AL PUEBLO (-20$)</button>
               
               {[
                 { id: 'COLLABORATE', label: '🤝 COLABORAR', desc: '+25 Silo / +10 Tú', color: 'bg-farm-green', text: 'text-black' },
                 { id: 'PRIVATE', label: '🏠 PRIVADO', desc: '+0 Silo / +25 Tú', color: 'bg-yellow-600', text: 'text-black' },
                 { id: 'STEAL', label: '😈 ROBAR', desc: '-40 Silo / +60 Tú', color: 'bg-red-600', text: 'text-white' }
               ].map((action) => (
                  <div key={action.id} className="flex gap-2 h-24 w-full">
                     <button 
                        onClick={() => !hasActed && !autoAction && applyActionGain(action.id as ActionType, true)}
                        disabled={hasActed || !!autoAction || amIExpelled || amIBankrupt}
                        className={`flex-grow ${action.color} ${action.text} font-pixel text-xl flex flex-col justify-center items-center hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all shadow-lg`}
                     >
                        <span>{action.label}</span>
                        <span className="text-[10px] font-terminal opacity-75">{action.desc}</span>
                     </button>

                     <button 
                        onClick={() => setAutoAction(autoAction === action.id ? null : action.id as ActionType)}
                        className={`w-20 border-2 flex flex-col items-center justify-center transition-all ${autoAction === action.id ? 'border-gold bg-gold text-black' : 'border-gray-700 bg-gray-900 text-gray-500'}`}
                     >
                        <div className={`w-4 h-4 rounded-full mb-1 ${autoAction === action.id ? 'bg-black' : 'bg-gray-700'}`}></div>
                        <span className="text-[10px] font-pixel">AUTO</span>
                     </button>
                  </div>
               ))}
               </>
               )}

               {amITopRep && (
                  <div className="mt-4 p-2 border border-gold text-center bg-gray-900">
                     <p className="text-gold text-xs mb-2">👑 ERES LÍDER DE OPINIÓN</p>
                     <div className="flex gap-2">
                        <button onClick={() => setShowSuspects(true)} className="flex-1 bg-purple-900 text-purple-200 py-2 text-xs border border-purple-500">⚖️ JUICIO</button>
                        <button onClick={() => executeExpropriation(false, "JUGADOR")} className="flex-1 bg-red-900 text-red-200 py-2 text-xs border border-red-500">📢 EXPROPIAR</button>
                     </div>
                  </div>
               )}

            </div>
         )}

         {gamePhase === 'PLAYING' && activeTab === 'NEWS' && (
            <div className="space-y-2">
               {newsLog.map(item => (
                  <div key={item.id} className={`p-4 border-b border-gray-800 ${item.resolved ? 'opacity-50 grayscale' : ''}`}>
                     <p className={`${item.type === 'ALERT' ? 'text-red-400' : 'text-gray-300'}`}>{item.text}</p>
                     {item.type === 'BANKRUPTCY_ALERT' && !item.resolved && (
                        <button 
                           onClick={() => setActiveBailout({ ...item.data, newsId: item.id })}
                           className="mt-3 w-full bg-blue-900 text-blue-200 py-3 text-xs font-bold hover:bg-blue-800 rounded"
                        >
                           🚑 VER OPCIONES DE RESCATE
                        </button>
                     )}
                     {item.resolved && <span className="text-[10px] text-farm-green block mt-1 font-bold">✓ RESUELTO</span>}
                  </div>
               ))}
            </div>
         )}

         {gamePhase === 'PLAYING' && activeTab === 'STATS' && (
            <div className="font-terminal space-y-6 p-2 text-center h-full flex flex-col justify-center">
               <div className="bg-gray-900 p-6 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">TERMÓMETRO SOCIAL</p>
                  <p className={`text-6xl ${sentiment.color}`}>{sentiment.icon}</p>
                  <p className={`text-2xl font-bold ${sentiment.color} mt-2`}>{sentiment.text}</p>
               </div>
               <div className="bg-gray-900 p-6 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">DISTRIBUCIÓN RIQUEZA</p>
                  <div className="w-full h-6 bg-gray-700 rounded-full flex overflow-hidden"><div style={{ width: `${publicRatio}%` }} className="bg-farm-green h-full"></div><div style={{ width: `${100-parseFloat(publicRatio)}%` }} className="bg-gold h-full"></div></div>
                  <div className="flex justify-between text-xs mt-2"><span className="text-farm-green">PÚBLICO ({publicRatio}%)</span><span className="text-gold">PRIVADO</span></div>
               </div>
               <div className="bg-gray-900 p-6 border border-gray-700"><p className="text-xs text-gray-400 mb-2">GINI (TOP 10%)</p><p className="text-white text-xl"><span className="text-gold font-bold">{inequalityPercentage}%</span> posesión.</p></div>
            </div>
         )}

         {gamePhase === 'PLAYING' && activeTab === 'RANKING' && (
            <table className="w-full font-terminal text-sm text-left"><thead className="text-gray-500 border-b border-gray-700 sticky top-0 bg-black"><tr><th className="pb-2 pl-2">#</th><th>CIUDADANO</th><th className="text-right">REP</th><th className="text-right pr-2">$$$</th></tr></thead><tbody>
               {[...bots, {id:999, name:'TÚ', personality:'OPPORTUNIST', reputation:myReputation, stash:myStash, isDead:amIExpelled, isBankrupt:amIBankrupt, daysBankrupt:myDaysBankrupt, stats:myStats}].filter(p => !p.isDead).sort((a,b) => b.reputation - a.reputation).map((player, index) => (
                  <tr key={player.id} className={`border-b border-gray-900 ${player.id === 999 ? 'text-gold bg-gray-900' : 'text-gray-300'} ${player.isBankrupt ? 'opacity-50 text-red-500' : ''}`}><td className="py-3 pl-2">{index + 1}</td><td className="py-3">{player.name} {player.isBankrupt && '(SOS)'}</td><td className={`py-3 text-right ${player.reputation < 30 ? 'text-danger' : 'text-farm-green'}`}>{player.reputation}</td><td className="py-3 text-right pr-2 font-mono">{player.id === 999 ? player.stash : '🔒???'}</td></tr>
               ))}
            </tbody></table>
         )}

      </div>

      {/* 3. BOTTOM BAR: TABS & CONTROLS */}
      {gamePhase === 'PLAYING' && (
         <div className="shrink-0 bg-gray-900 border-t border-gray-700">
            
            {/* CONTROLES VELOCIDAD */}
            <div className="flex justify-center gap-1 p-2 bg-black border-b border-gray-800">
               {[0, 0.5, 1, 3, 5, 10].map(s => (
                  <button 
                     key={s} 
                     onClick={() => { setIsRunning(s > 0); setTimeMultiplier(s || 1); }}
                     className={`px-3 py-1 text-[10px] font-pixel border ${s === timeMultiplier && isRunning ? 'bg-farm-green text-black border-farm-green' : 'bg-gray-900 text-gray-500 border-gray-700'}`}
                  >
                     {s === 0 ? '⏸' : `x${s}`}
                  </button>
               ))}
            </div>

            {/* BARRA DE NAVEGACIÓN (TABS GRANDES) */}
            <div className="flex h-16">
               {['ACTIONS', 'NEWS', 'STATS', 'RANKING'].map(tab => (
                  <button 
                     key={tab} 
                     onClick={() => setActiveTab(tab as any)}
                     className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${activeTab === tab ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-400'}`}
                  >
                     <span className="text-lg">
                        {tab === 'ACTIONS' ? '🎮' : tab === 'NEWS' ? '📰' : tab === 'STATS' ? '📊' : '🏆'}
                     </span>
                     <span className="text-[9px] font-pixel tracking-widest">{tab}</span>
                     {tab === 'NEWS' && unreadNews && <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></div>}
                  </button>
               ))}
            </div>
         </div>
      )}

    </div>
  );
}

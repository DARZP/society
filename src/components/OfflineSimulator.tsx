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

// GENERADOR DE NOMBRES
const generateName = () => {
  const prefixes = ["xX_", "The", "Dr", "Lord", "El_", "La_", "Sir", "Lady", "Captain", "Agent", "Cyber", "Dark", "Hyper"];
  const bases = ["Slayer", "Juan", "Carlos", "Sofia", "Alex", "Wolf", "Ghost", "Panda", "Crypto", "Dev", "Noob", "Pro", "God", "King", "Queen", "Joker", "Neo", "Goku"];
  const suffixes = ["_Xx", "123", "69", "777", "99", "007", ".eth", ".btc", "xD", "_v2"];
  return `${prefixes[Math.floor(Math.random()*prefixes.length)]}${bases[Math.floor(Math.random()*bases.length)]}${suffixes[Math.floor(Math.random()*suffixes.length)]}`;
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
  const [activeTab, setActiveTab] = useState<'ACTIONS' | 'RANKING' | 'STATS' | 'NEWS'>('ACTIONS');
  const [newsLog, setNewsLog] = useState<NewsItem[]>([]);
  const [unreadNews, setUnreadNews] = useState(false);
  const [gameOverSort, setGameOverSort] = useState<SortType>('WEALTH');
  
  // NUEVO: Switch de Auto-Acción y Progreso del Día
  const [autoAction, setAutoAction] = useState<ActionType | null>(null);
  const [dayProgress, setDayProgress] = useState(0);
  
  // Modales
  const [voteSession, setVoteSession] = useState<VoteSession | null>(null);
  const [activeBailout, setActiveBailout] = useState<{id: number, name: string, debt: number, newsId: number} | null>(null);
  const [showSuspects, setShowSuspects] = useState(false);

  // --- MOTORES ---
  const [bots, setBots] = useState<BotPlayer[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [timeMultiplier, setTimeMultiplier] = useState(1); // 1 = Normal

  const stateRef = useRef({ bots, myReputation, myStash, publicSilo, autoAction, amIExpelled, gamePhase, initialPop, initialTotalWealth, amIBankrupt, myDaysBankrupt });
  useEffect(() => {
    stateRef.current = { bots, myReputation, myStash, publicSilo, autoAction, amIExpelled, gamePhase, initialPop, initialTotalWealth, amIBankrupt, myDaysBankrupt };
  }, [bots, myReputation, myStash, publicSilo, autoAction, amIExpelled, gamePhase, initialPop, initialTotalWealth, amIBankrupt, myDaysBankrupt]);

  // --- CÁLCULOS ECONÓMICOS ---
  const activeBots = bots.filter(b => !b.isDead);
  const activePopulation = activeBots.length + (amIExpelled ? 0 : 1);
  const totalPrivateWealth = activeBots.reduce((acc, bot) => acc + bot.stash, 0) + (amIExpelled ? 0 : myStash);
  const currentTotalWealth = publicSilo + totalPrivateWealth;
  
  const wealthPerCapita = Math.max(1, currentTotalWealth / (activePopulation || 1));
  const baseCost = Math.max(5, wealthPerCapita * 0.15); 
  const safeSiloLevel = activePopulation * 50; 
  const scarcityMultiplier = Math.max(1, safeSiloLevel / (publicSilo + 1));
  const costOfLiving = Math.floor(baseCost * scarcityMultiplier); 

  // GINI
  const publicRatio = ((publicSilo / (currentTotalWealth || 1)) * 100).toFixed(1);
  const allStashes = [...activeBots.map(b => b.stash), (amIExpelled ? 0 : myStash)].sort((a, b) => b - a);
  const top10Count = Math.ceil(allStashes.length * 0.1);
  const wealthTop10 = allStashes.slice(0, top10Count).reduce((a, b) => a + b, 0);
  const inequalityPercentage = ((wealthTop10 / (totalPrivateWealth || 1)) * 100).toFixed(1);

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
    const siloStart = botCount * 100;
    const newBots: BotPlayer[] = Array.from({ length: botCount }).map((_, i) => {
      const rand = Math.random();
      let p: Personality = 'OPPORTUNIST';
      if (rand < 0.2) p = 'ALTRUIST'; else if (rand < 0.4) p = 'GREEDY'; else if (rand < 0.5) p = 'CHAOTIC';
      return {
        id: i, name: generateName(), personality: p,
        reputation: Math.floor(Math.random() * 30) + 40, stash: Math.floor(Math.random() * 40) + 30, 
        stats: { stole: 0, collaborated: 0, private: 0, rescued: 0, donated: 0 },
        isDead: false, isBankrupt: false, daysBankrupt: 0
      };
    });

    const playerStartStash = 60;
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
    setNewsLog([{ id: 1, text: "Bienvenido.", type: 'INFO' }]);
    setIsRunning(false);
    setDayProgress(0);
    setAutoAction(null); // Reset switch
  };

  // --- LÓGICA DE TURNOS ---
  // Esta función aplica el efecto de una acción (sea manual o auto)
  const applyActionEffect = (action: ActionType, isManual: boolean) => {
    const current = stateRef.current;
    if (current.amIExpelled || current.amIBankrupt) return;

    if (action === 'COLLABORATE') {
        setPublicSilo(s => s + 25);
        // Manual: +10 ahora, paga costo al final. Auto: +10 - costo (neto).
        // Para simplificar, aquí solo sumamos ganancia. El costo de vida se cobra SIEMPRE al final del día.
        setMyStash(s => s + 10); 
        setMyReputation(r => Math.min(100, r + 6)); // +6 para vencer decay
        setMyStats(s => ({ ...s, collaborated: s.collaborated + 1 }));
    } else if (action === 'PRIVATE') {
        setMyStash(s => s + 25);
        setMyStats(s => ({ ...s, private: s.private + 1 }));
    } else if (action === 'STEAL') {
        setPublicSilo(s => s - 40);
        setMyStash(s => s + 60);
        setMyReputation(r => Math.max(0, r - 10));
        setMyStats(s => ({ ...s, stole: s.stole + 1 }));
    }
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
     // Costo: Deuda + 5 días de supervivencia (buffer)
     const buffer = costOfLiving * 5;
     const totalRescueCost = Math.abs(debt) + buffer;

     if (type === 'PRIVATE') {
        if (myStash >= totalRescueCost) {
           setMyStash(s => s - totalRescueCost);
           setMyReputation(r => Math.min(100, r + 25)); // Gran bono
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
      // Tick rate constante, la velocidad cambia cuánto avanza la barra
      const tickRate = 50; // ms
      
      interval = setInterval(() => {
        // AVANZAR TIEMPO
        setDayProgress(prev => {
            const next = prev + (0.5 * timeMultiplier); // Velocidad base * multi
            if (next >= 100) {
                // --- FIN DEL DÍA ---
                handleEndOfDay();
                return 0;
            }
            return next;
        });
      }, tickRate);
    }
    return () => clearInterval(interval);
  }, [isRunning, gamePhase, timeMultiplier, costOfLiving]); // Dependencias clave

  const handleEndOfDay = () => {
        const currentData = stateRef.current;
        
        // 1. TURNO JUGADOR
        if (!currentData.amIExpelled && !currentData.amIBankrupt) {
            // Ejecutar Auto-Acción si existe
            if (currentData.autoAction) {
                applyActionEffect(currentData.autoAction, false);
            }
            // Si NO hay autoAction y no hice clic, NO GANO NADA (pierdo oportunidad)
            
            // Cobro de vida SIEMPRE (incluso si no gané nada)
            setMyStash(prev => prev - costOfLiving);
            
            // Desgaste Político
            setMyReputation(r => Math.max(0, r - 2));
        }

        // 2. CHECK QUIEBRA JUGADOR
        if (!currentData.amIBankrupt && stateRef.current.myStash < 0 && !currentData.amIExpelled) {
            // Check manual pq el state update es lento
            // Pero usamos el valor que acabamos de calcular (teorico)
            // Mejor: useEffect detecta el cambio de myStash
        }

        setDay(d => d + 1);

        // 3. IA BOTS & SIMULACIÓN
        setBots(currentBots => currentBots.map(bot => {
          if (bot.isDead) return bot;
          
          // Desgaste
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

          // Lógica simplificada de supervivencia
          if (newStash < costOfLiving * 2) {
             if (roll < 0.9) decision = 'STEAL'; // Desesperado
          } else if (bot.personality === 'ALTRUIST' && newStash > costOfLiving * 5) {
             decision = 'COLLABORATE';
          } else if (bot.personality === 'GREEDY') {
             if (roll < 0.6) decision = 'PRIVATE'; else decision = 'STEAL';
          } else {
             // Normal
             if (roll < 0.7) decision = 'COLLABORATE'; else decision = 'PRIVATE';
          }

          // Ejecutar Acción Bot
          if (decision === 'STEAL') {
             newStash += 60; setPublicSilo(s => s - 40); newRep -= 3; currentStats.stole += 1;
          } else if (decision === 'PRIVATE') {
             newStash += 25; currentStats.private += 1;
          } else {
             setPublicSilo(s => s + 25); newRep += 6; newStash += 10; currentStats.collaborated += 1;
          }

          // Cobrar vida
          newStash -= costOfLiving;

          if (newStash < 0) {
             addNews(`🆘 ${bot.name} pide rescate.`, 'BANKRUPTCY_ALERT', { id: bot.id, name: bot.name, debt: newStash });
             return { ...bot, isBankrupt: true, stash: newStash, daysBankrupt: 0, reputation: newRep, stats: currentStats };
          }

          return { ...bot, reputation: Math.min(100, newRep), stash: newStash, stats: currentStats };
        }));

        // 4. COLAPSO
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

  // CHECK JUGADOR BANKRUPT (Efecto derivado)
  useEffect(() => {
      if (!amIBankrupt && !amIExpelled && myStash < 0) {
          setAmIBankrupt(true);
          setMyDaysBankrupt(0);
          addNews("¡ESTÁS EN QUIEBRA!", 'BANKRUPTCY_ALERT', { id: 999, name: 'TÚ', debt: myStash });
      } else if (amIBankrupt && myStash >= 0) {
          setAmIBankrupt(false); // Recuperado
      }
  }, [myStash]);

  // AUTO-EXILIO JUGADOR
  useEffect(() => {
      if (amIBankrupt) {
          // Lógica simplificada: incrementar días al final del día (ya está en handleEndOfDay state update del bot, aqui solo visual)
      }
  }, [day]);


  // --- RENDER HELPERS ---
  const activePlayersList = [...bots.filter(b => !b.isDead), { id: 999, name: 'TÚ', reputation: myReputation, isDead: amIExpelled }];
  const sortedByRep = [...activePlayersList].sort((a,b) => b.reputation - a.reputation);
  const amITopRep = sortedByRep.slice(0, 3).some(p => p.id === 999);

  // --- RENDERIZADO PRINCIPAL ---
  return (
    <div className="w-full h-screen bg-black flex flex-col font-terminal text-sm text-gray-300 overflow-hidden">
      
      {/* 1. TOP BAR: STATUS & PROGRESS */}
      <div className="shrink-0 bg-gray-900 border-b border-gray-700 p-2">
         {/* Barra de Día/Noche */}
         <div className="w-full h-2 bg-gray-800 rounded-full mb-2 relative overflow-hidden">
            <div 
               className="h-full bg-gradient-to-r from-blue-400 via-yellow-200 to-purple-500 transition-all duration-100 ease-linear"
               style={{ width: `${dayProgress}%` }}
            ></div>
         </div>
         
         <div className="flex justify-between items-center text-xs">
            <span className="text-white font-pixel">DÍA {day}</span>
            <div className="flex gap-4">
               <span className={`${publicSilo < 500 ? 'text-red-500 animate-pulse' : 'text-farm-green'}`}>SILO: {publicSilo}</span>
               <span className="text-danger">COSTO: -{costOfLiving}</span>
               <span className={`${myStash < 0 ? 'text-red-500 font-bold' : 'text-gold'}`}>$$: {myStash}</span>
            </div>
         </div>
      </div>

      {/* 2. MAIN CONTENT AREA (SCROLLABLE) */}
      <div className="flex-grow overflow-y-auto relative custom-scrollbar bg-black p-4">
         
         {/* GAME OVER */}
         {gamePhase === 'GAMEOVER' && (
            <div className="text-center space-y-6 mt-10 animate-fade-in">
               <h1 className="text-3xl text-danger font-pixel mb-4">SOCIEDAD CAÍDA</h1>
               
               {/* Leaderboard Final */}
               <div className="flex justify-center gap-2 mb-4">
                  {['WEALTH', 'THEFT', 'SAINT'].map(type => (
                     <button key={type} onClick={() => setGameOverSort(type as SortType)} className={`px-3 py-2 border ${gameOverSort === type ? 'bg-white text-black border-white' : 'bg-black text-gray-500 border-gray-700'}`}>
                        {type}
                     </button>
                  ))}
               </div>
               
               <div className="h-64 overflow-y-auto border border-gray-800">
                  {/* Tabla Simplificada */}
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
               
               <button onClick={() => setGamePhase('SETUP')} className="w-full py-4 bg-farm-green text-black font-pixel">REINICIAR SIMULACIÓN</button>
            </div>
         )}

         {/* PANTALLA DE JUEGO */}
         {gamePhase === 'PLAYING' && activeTab === 'ACTIONS' && (
            <div className="flex flex-col gap-4 h-full justify-center">
               
               {/* ACTION BUTTONS CON SWITCH */}
               {[
                 { id: 'COLLABORATE', label: '🤝 COLABORAR', desc: '+25 Silo / +10 Tú', color: 'bg-farm-green', text: 'text-black' },
                 { id: 'PRIVATE', label: '🏠 PRIVADO', desc: '+0 Silo / +25 Tú', color: 'bg-yellow-600', text: 'text-black' },
                 { id: 'STEAL', label: '😈 ROBAR', desc: '-40 Silo / +60 Tú', color: 'bg-red-600', text: 'text-white' }
               ].map((action) => (
                  <div key={action.id} className="flex gap-2 h-20 w-full">
                     {/* Botón Principal (Acción Manual) */}
                     <button 
                        onClick={() => !hasActed && !autoAction && applyActionEffect(action.id as ActionType, true)}
                        disabled={hasActed || !!autoAction || amIExpelled || amIBankrupt}
                        className={`flex-grow ${action.color} ${action.text} font-pixel text-lg flex flex-col justify-center items-center hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all`}
                     >
                        <span>{action.label}</span>
                        <span className="text-[10px] font-terminal opacity-75">{action.desc}</span>
                     </button>

                     {/* Switch Auto */}
                     <button 
                        onClick={() => setAutoAction(autoAction === action.id ? null : action.id as ActionType)}
                        className={`w-16 border-2 flex flex-col items-center justify-center transition-all ${autoAction === action.id ? 'border-gold bg-gold text-black' : 'border-gray-700 bg-black text-gray-500'}`}
                     >
                        <div className={`w-3 h-3 rounded-full mb-1 ${autoAction === action.id ? 'bg-black' : 'bg-gray-700'}`}></div>
                        <span className="text-[8px] font-pixel">AUTO</span>
                     </button>
                  </div>
               ))}

               {amITopRep && (
                  <div className="mt-4 p-2 border border-gold text-center">
                     <p className="text-gold text-xs mb-2">👑 ERES LÍDER DE OPINIÓN</p>
                     <div className="flex gap-2">
                        <button onClick={() => setShowSuspects(true)} className="flex-1 bg-purple-900 text-purple-200 py-2 text-xs border border-purple-500">⚖️ JUICIO</button>
                        {/* Expropiación si silo bajo */}
                        <button onClick={() => alert("Expropiación")} className="flex-1 bg-red-900 text-red-200 py-2 text-xs border border-red-500">📢 EXPROPIAR</button>
                     </div>
                  </div>
               )}

            </div>
         )}

         {/* NEWS / RESCUE TAB */}
         {gamePhase === 'PLAYING' && activeTab === 'NEWS' && (
            <div className="space-y-2">
               {newsLog.map(item => (
                  <div key={item.id} className={`p-3 border-b border-gray-800 ${item.resolved ? 'opacity-50 grayscale' : ''}`}>
                     <p className={`${item.type === 'ALERT' ? 'text-red-400' : 'text-gray-300'}`}>{item.text}</p>
                     
                     {/* Botón interactivo para rescates */}
                     {item.type === 'BANKRUPTCY_ALERT' && !item.resolved && (
                        <button 
                           onClick={() => setActiveBailout({ ...item.data, newsId: item.id })}
                           className="mt-2 w-full bg-blue-900 text-blue-200 py-2 text-xs hover:bg-blue-800"
                        >
                           🚑 VER OPCIONES DE RESCATE
                        </button>
                     )}
                     {item.resolved && <span className="text-[10px] text-farm-green block mt-1">✓ RESUELTO</span>}
                  </div>
               ))}
            </div>
         )}

         {/* MODAL RESCATE (FULL SCREEN OVERLAY) */}
         {activeBailout && (
            <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6 animate-bounce-in">
               <h2 className="text-xl font-pixel text-blue-400 mb-4">RESCATE FINANCIERO</h2>
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

         {/* OTRAS PESTAÑAS SIMPLIFICADAS PARA BREVEDAD (RANKING/STATS) - Se mantienen igual en lógica */}
         {gamePhase === 'PLAYING' && activeTab === 'RANKING' && (
             <div className="text-center text-gray-500 mt-10">RANKING AQUÍ...</div>
         )}

         {/* SETUP SCREEN */}
         {gamePhase === 'SETUP' && (
            <div className="h-full flex flex-col justify-center items-center px-8">
               <h1 className="text-4xl font-pixel text-farm-green mb-8 text-center">SOCIETY<br/>MOBILE</h1>
               <label className="text-gray-400 mb-2">POBLACIÓN: {botCount}</label>
               <input type="range" min="10" max="100" value={botCount} onChange={e => setBotCount(parseInt(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mb-10 accent-farm-green"/>
               <button onClick={startGame} className="w-full py-5 bg-white text-black font-pixel text-xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]">INICIAR SISTEMA</button>
            </div>
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
                     {/* Íconos Simples */}
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

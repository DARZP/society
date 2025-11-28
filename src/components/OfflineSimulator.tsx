import { useState, useEffect, useRef } from 'react';

// --- TIPOS ---
type Personality = 'ALTRUIST' | 'GREEDY' | 'CHAOTIC' | 'OPPORTUNIST';
type ActionType = 'COLLABORATE' | 'PRIVATE' | 'STEAL';
type TabType = 'ACTIONS' | 'RANKING' | 'STATS' | 'NEWS' | 'LEADER';

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

// GENERADOR DE NOMBRES (Simplificado para brevedad, usa tu lista original si prefieres)
const generateName = () => {
  const prefixes = ["Dr", "Lord", "Sir", "Lady", "Cyber", "Iron", "Dark", "Neo"];
  const bases = ["Juan", "Sofia", "Alex", "Wolf", "Panda", "Viper", "Ghost", "Zero"];
  const suffixes = ["_Xx", "777", ".eth", "_AI", "2077"];
  return `${prefixes[Math.floor(Math.random()*prefixes.length)]}${bases[Math.floor(Math.random()*bases.length)]}${suffixes[Math.floor(Math.random()*suffixes.length)]}`;
};

export default function OfflineSimulator({ onBack }: { onBack: () => void }) {
  // --- FASES ---
  const [gamePhase, setGamePhase] = useState<'SETUP' | 'PLAYING' | 'GAMEOVER'>('SETUP');
  const [botCount, setBotCount] = useState(50);
  const [initialPop, setInitialPop] = useState(50);
  
  // --- MUNDO & TIEMPO ---
  const [day, setDay] = useState(1);
  const [dayProgress, setDayProgress] = useState(0); // 0 a 100
  const [publicSilo, setPublicSilo] = useState(1000);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 0 (pausa), 0.5, 1, 3, 5, 10
  const [isPaused, setIsPaused] = useState(true);

  // --- JUGADOR ---
  const [myStash, setMyStash] = useState(50);
  const [myReputation, setMyReputation] = useState(50);
  const [myStats, setMyStats] = useState<PlayerStats>({ stole: 0, collaborated: 0, private: 0, rescued: 0, donated: 0 });
  const [amIExpelled, setAmIExpelled] = useState(false);
  const [amIBankrupt, setAmIBankrupt] = useState(false);
  const [myDaysBankrupt, setMyDaysBankrupt] = useState(0);
  
  // --- SISTEMA DE ACCIONES ---
  const [hasActed, setHasActed] = useState(false);
  const [autoPilotAction, setAutoPilotAction] = useState<ActionType | null>(null);

  // --- UI ---
  const [activeTab, setActiveTab] = useState<TabType>('ACTIONS');
  const [newsLog, setNewsLog] = useState<NewsItem[]>([]);
  const [unreadNews, setUnreadNews] = useState(false);
  const [gameOverSort, setGameOverSort] = useState<SortType>('WEALTH');
  
  // Modales
  const [voteSession, setVoteSession] = useState<VoteSession | null>(null);
  const [activeBailout, setActiveBailout] = useState<{id: number, name: string, debt: number, newsId: number} | null>(null);
  const [showSuspects, setShowSuspects] = useState(false);

  // --- IA ---
  const [bots, setBots] = useState<BotPlayer[]>([]);

  // REFERENCIA PARA EL BUCLE (Evita stale closures)
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
  
  const avgPrivateWealth = Math.max(1, totalPrivateWealth / (activePopulation || 1));
  const baseCost = Math.max(5, avgPrivateWealth * 0.10); 
  const safeSiloLevel = activePopulation * 50; 
  const scarcityMultiplier = Math.max(1, safeSiloLevel / (publicSilo + 1));
  const costOfLiving = Math.floor(baseCost * scarcityMultiplier); 

  // --- HELPERS UI ---
  const addNews = (text: string, type: 'INFO' | 'ALERT' | 'BANKRUPTCY_ALERT' | 'DEATH' = 'INFO', data?: any) => {
    setNewsLog(prev => [{ id: Date.now() + Math.random(), text: `Día ${day}: ${text}`, type, data, resolved: false }, ...prev].slice(0, 30));
    if (activeTab !== 'NEWS') setUnreadNews(true);
  };

  const markNewsResolved = (newsId: number) => {
    setNewsLog(prev => prev.map(item => item.id === newsId ? { ...item, resolved: true } : item));
  };

  // --- LÓGICA DE FIN DE DÍA (EL MOTOR) ---
  const processDayEnd = () => {
    const currentData = stateRef.current;
    
    // 1. TURNO DEL JUGADOR (Auto-Piloto vs Inactividad)
    if (!currentData.amIExpelled && !currentData.amIBankrupt) {
      if (currentData.hasActed) {
         // Ya actuó manualmente, cobramos costo de vida
         setMyStash(prev => prev - costOfLiving);
      } else {
         // No ha actuado. Revisamos piloto automático
         if (currentData.autoPilotAction) {
            // Ejecutar acción automática
            executePlayerAction(currentData.autoPilotAction, true); 
            // La función executePlayerAction ya resta el costo de vida si es necesario? 
            // Ajuste: executePlayerAction suma ganancias. El costo de vida se resta AQUÍ al final del día.
            setMyStash(prev => prev - costOfLiving);
         } else {
            // CASTIGO POR INACTIVIDAD
            setMyStash(prev => prev - costOfLiving);
            addNews("💤 Dormiste todo el día. Cobrado costo de vida sin ingresos.", "ALERT");
         }
      }
    }

    // 2. DESGASTE POLÍTICO
    setMyReputation(r => Math.max(0, r - 2)); 
    setBots(prev => prev.map(b => ({ ...b, reputation: Math.max(0, b.reputation - 2) })));

    // 3. CHECK BANCARROTA JUGADOR
    if (!currentData.amIBankrupt && stateRef.current.myStash < 0 && !currentData.amIExpelled) {
       // Nota: usamos stateRef.current.myStash actualizado (react batching puede ser tricky aqui, pero confiamos en el ref actualizado o check siguiente tick)
       // Para seguridad, comprobamos en el siguiente tick, PERO para efectos visuales inmediatos:
       setAmIBankrupt(true);
       setMyDaysBankrupt(0);
       addNews("¡ESTÁS EN QUIEBRA! Revisa NOTICIAS.", 'BANKRUPTCY_ALERT', { id: 999, name: 'TÚ', debt: stateRef.current.myStash });
    } else if (currentData.amIBankrupt) {
       setMyDaysBankrupt(days => {
           if (days >= 5) {
               setAmIExpelled(true);
               addNews("Has muerto de inanición.", 'DEATH');
               return days;
           }
           return days + 1;
       });
    }

    // 4. LÓGICA DE BOTS (IA Simplificada para brevedad, misma lógica original)
    processBotsTurn(currentData);

    // 5. FINALIZAR DÍA
    setDay(d => d + 1);
    setHasActed(false); // Reset para el día siguiente
    setDayProgress(0);  // Reset barra
    
    // Check Game Over
    const aliveCount = currentData.bots.filter(b => !b.isDead).length + (currentData.amIExpelled ? 0 : 1);
    if (aliveCount < (currentData.initialPop / 2)) {
       setIsPaused(true);
       setGamePhase('GAMEOVER');
    }
  };

  const processBotsTurn = (currentData: any) => {
      // (Lógica idéntica a tu original, condensada aquí)
      const activeList = [...currentData.bots.filter((b:any) => !b.isDead), { id: 999, name: 'TÚ', reputation: currentData.myReputation, isDead: currentData.amIExpelled }];
      const topRep = activeList.sort((a,b) => b.reputation - a.reputation)[0];
      
      // Expropiación bot
      if (topRep && topRep.id !== 999 && currentData.publicSilo < (activePopulation * 10)) {
          if (Math.random() < 0.3) executeExpropriation(true, "Líder Bot");
      }

      // Juicios bot
      const top3Bots = currentData.bots.filter((b:any) => !b.isDead).sort((a:any,b:any) => b.reputation - a.reputation).slice(0, 3);
      if (top3Bots.length > 0 && Math.random() < 0.15) { 
         const judge = top3Bots[Math.floor(Math.random() * top3Bots.length)];
         const criminals = currentData.bots.filter((b:any) => !b.isDead && b.reputation < 30 && b.id !== judge.id);
         if (criminals.length > 0) {
            const victim = criminals[0];
            startVoteAgainst(victim.id, victim.name, victim.reputation, judge.name);
         }
      }

      setBots(currentBots => currentBots.map(bot => {
         if (bot.isDead) return bot;
         // Rescates Bot-Bot
         if (bot.isBankrupt) {
            // (Logica de bots ricos salvando pobres...)
            const richBots = currentBots.filter(b => !b.isDead && !b.isBankrupt && b.stash > 300);
            if (richBots.length > 0 && Math.random() < 0.2) {
                 const savior = richBots[0];
                 const debt = Math.abs(bot.stash) + (costOfLiving * 7);
                 if (savior.stash > debt + 50) {
                    bot.stash = costOfLiving * 7; bot.isBankrupt = false; bot.daysBankrupt = 0;
                    savior.stash -= debt; savior.reputation = Math.min(100, savior.reputation + 20);
                    addNews(`🤝 ${savior.name} rescató a ${bot.name}.`);
                    return bot; 
                 }
            }
            if (bot.daysBankrupt >= 5) {
                addNews(`✝️ ${bot.name} murió por pobreza.`, 'DEATH');
                return { ...bot, isDead: true, stash: 0 };
            }
            return { ...bot, daysBankrupt: bot.daysBankrupt + 1 };
         }

         // Acciones Bot
         let newStash = bot.stash - costOfLiving;
         if (newStash < 0) {
            addNews(`🆘 ${bot.name} pide rescate.`, 'BANKRUPTCY_ALERT', { id: bot.id, name: bot.name, debt: newStash });
            return { ...bot, isBankrupt: true, stash: newStash, daysBankrupt: 0 };
         }
         
         // Decisión simple IA
         const roll = Math.random();
         let decision: ActionType = 'PRIVATE';
         if (bot.personality === 'GREEDY') decision = roll < 0.6 ? 'STEAL' : 'PRIVATE';
         else if (bot.personality === 'ALTRUIST') decision = roll < 0.6 ? 'COLLABORATE' : 'PRIVATE';
         else decision = roll < 0.3 ? 'STEAL' : roll < 0.6 ? 'PRIVATE' : 'COLLABORATE';

         let currentStats = { ...bot.stats };
         let newRep = bot.reputation;

         if (decision === 'STEAL') {
             newStash += 60; setPublicSilo(s => s - 40); newRep -= 3; currentStats.stole += 1;
         } else if (decision === 'PRIVATE') {
             newStash += 25; currentStats.private += 1;
         } else {
             setPublicSilo(s => s + 25); newRep += 6; newStash += 10; currentStats.collaborated += 1;
         }
         return { ...bot, reputation: Math.max(0, Math.min(100, newRep)), stash: newStash, stats: currentStats };
      }));
  };

  // --- BUCLE DE TIEMPO (TICK) ---
  useEffect(() => {
    let tickInterval: any;
    if (!isPaused && gamePhase === 'PLAYING') {
      const tickRate = 50; // ms por tick
      tickInterval = setInterval(() => {
        // Pausar si hay modales abiertos
        if (voteSession?.isOpen || activeBailout || showSuspects) return;

        setDayProgress(prev => {
          const increment = 0.5 * speedMultiplier; // Ajustar velocidad base aquí
          if (prev + increment >= 100) {
            processDayEnd();
            return 0;
          }
          return prev + increment;
        });
      }, tickRate);
    }
    return () => clearInterval(tickInterval);
  }, [isPaused, gamePhase, speedMultiplier, voteSession, activeBailout, showSuspects]);


  // --- ACCIONES ---
  const executePlayerAction = (type: ActionType, isAuto: boolean) => {
    if (isAuto) {
        // Solo lógica de datos, sin flags de UI manual
        if (type === 'COLLABORATE') {
            setPublicSilo(s => s + 25); setMyStash(s => s + 10); setMyReputation(r => Math.min(100, r + 6)); setMyStats(s => ({ ...s, collaborated: s.collaborated + 1 }));
        } else if (type === 'PRIVATE') {
            setMyStash(s => s + 25); setMyStats(s => ({ ...s, private: s.private + 1 }));
        } else if (type === 'STEAL') {
            setPublicSilo(s => s - 40); setMyStash(s => s + 60); setMyReputation(r => Math.max(0, r - 10)); setMyStats(s => ({ ...s, stole: s.stole + 1 }));
        }
    } else {
        // Acción manual inmediata
        if (hasActed || amIExpelled || amIBankrupt) return;
        if (type === 'COLLABORATE') {
            setPublicSilo(s => s + 25); setMyStash(s => s + 10); setMyReputation(r => Math.min(100, r + 6)); setMyStats(s => ({ ...s, collaborated: s.collaborated + 1 }));
        } else if (type === 'PRIVATE') {
            setMyStash(s => s + 25); setMyStats(s => ({ ...s, private: s.private + 1 }));
        } else if (type === 'STEAL') {
            setPublicSilo(s => s - 40); setMyStash(s => s + 60); setMyReputation(r => Math.max(0, r - 10)); setMyStats(s => ({ ...s, stole: s.stole + 1 }));
        }
        setHasActed(true);
    }
  };

  const handleManualAction = (type: ActionType) => executePlayerAction(type, false);

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
    setNewsLog([{ id: 1, text: "Bienvenido a SOCIETY OS v2.0", type: 'INFO', resolved: false }]);
  };

  // --- OTRAS FUNCIONES (Expropiación, Juicios, Rescates) ---
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
      setIsPaused(true); setShowSuspects(false);
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
      if (voteSession.targetId === 999) { setAmIExpelled(true); setMyStash(0); addNews(`🛑 EXPULSADO.`, 'ALERT'); }
      else { setBots(prev => prev.map(b => b.id === voteSession.targetId ? { ...b, isDead: true, stash: 0 } : b)); addNews(`🔨 EXPULSADO: ${voteSession.targetName}.`, 'ALERT'); }
      setPublicSilo(prev => prev + 50); // Confiscación simbólica
    } else { addNews(`🛡️ INOCENTE: ${voteSession.targetName}.`); }
    setVoteSession(null); setIsPaused(false);
  };

  const openBailoutModal = (item: NewsItem) => {
     if (item.type === 'BANKRUPTCY_ALERT' && item.data && !item.resolved) {
        setIsPaused(true);
        setActiveBailout({ ...item.data, newsId: item.id });
     }
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
     setActiveBailout(null); setIsPaused(false);
  };

  const resolveBankrupt = (id: number, finalStash: number) => {
     if (id === 999) { setMyStash(finalStash); setAmIBankrupt(false); setMyDaysBankrupt(0); }
     else { setBots(prev => prev.map(b => b.id === id ? { ...b, stash: finalStash, isBankrupt: false, daysBankrupt: 0 } : b)); }
  };

  // --- VISTAS AUXILIARES ---
  if (gamePhase === 'SETUP') return (
     <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 font-pixel text-farm-green">
        <h1 className="text-4xl mb-8 text-gold animate-pulse">SOCIETY_OS</h1>
        <div className="w-full max-w-sm border-2 border-farm-green p-6 bg-gray-900">
           <label className="block mb-4">DENSIDAD POBLACIONAL: {botCount}</label>
           <input type="range" min="10" max="200" step="10" value={botCount} onChange={(e) => setBotCount(parseInt(e.target.value))} className="w-full mb-8 accent-farm-green"/>
           <button onClick={startGame} className="w-full py-4 bg-farm-green text-black font-bold hover:bg-white transition-colors">INICIAR SISTEMA</button>
        </div>
        <button onClick={onBack} className="mt-8 underline text-gray-500">APAGAR</button>
     </div>
  );

  // --- RENDER PRINCIPAL (DATAPAD) ---
  return (
    <div className="fixed inset-0 bg-black text-white font-pixel overflow-hidden flex flex-col select-none">
      
      {/* 1. TOP STATUS BAR (Ciclo Día/Noche) */}
      <div className="h-14 bg-gray-900 border-b border-soil flex items-center px-4 justify-between shrink-0 relative z-20">
         <div className="flex flex-col">
            <span className="text-gold text-lg leading-none">DÍA {day}</span>
            <span className="text-[10px] text-gray-400">Población: {activePopulation}</span>
         </div>
         
         {/* Barra de Progreso del Día */}
         <div className="flex-1 mx-4 h-3 bg-gray-800 rounded-full border border-gray-600 relative overflow-hidden">
            <div 
              className={`h-full transition-all duration-100 ease-linear ${dayProgress > 80 ? 'bg-red-500' : 'bg-blue-400'}`} 
              style={{ width: `${dayProgress}%` }}
            />
         </div>

         <div className="text-right">
             <span className={`block text-xl leading-none ${amIBankrupt ? 'text-red-500 animate-pulse' : 'text-farm-green'}`}>${myStash}</span>
             <span className="text-[10px] text-danger">COSTO: -{costOfLiving}</span>
         </div>
      </div>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto relative bg-gray-950 p-2 scrollbar-hide">
         
         {/* STATUS ALERTS */}
         {amIExpelled && <div className="p-4 bg-red-900 text-white text-center border-2 border-red-500 mb-4 animate-pulse">🛑 EXPULSADO DE LA SOCIEDAD</div>}
         {amIBankrupt && <div className="p-4 bg-yellow-900 text-yellow-200 text-center border-2 border-yellow-500 mb-4">⚠ CUENTA CONGELADA (Ver Noticias)</div>}

         {/* PESTAÑA: ACCIONES (DATAPAD STYLE) */}
         {activeTab === 'ACTIONS' && (
            <div className="space-y-4 pb-20">
               
               {/* Dashboard de Recursos */}
               <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-900 p-3 border border-gray-700 rounded shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                     <p className="text-gray-400 text-[10px] uppercase">Silo Público</p>
                     <p className={`text-2xl ${publicSilo < (activePopulation*10) ? 'text-red-500' : 'text-farm-green'}`}>{publicSilo}</p>
                  </div>
                  <div className="bg-gray-900 p-3 border border-gray-700 rounded">
                     <p className="text-gray-400 text-[10px] uppercase">Reputación</p>
                     <p className="text-2xl text-blue-400">{myReputation}</p>
                  </div>
               </div>

               {/* Botón Donar */}
               <button onClick={() => { if(myStash>=20 && !hasActed) { setMyStash(s=>s-20); setPublicSilo(s=>s+20); setMyReputation(r=>Math.min(100,r+6)); setHasActed(true); } }} disabled={hasActed || myStash < 20} className="w-full py-2 bg-blue-900 border border-blue-500 text-blue-200 text-xs rounded hover:bg-blue-800 disabled:opacity-50">
                  💝 DONAR AL PUEBLO (-$20 / +Rep)
               </button>

               <div className="w-full h-px bg-gray-800 my-2"></div>

               {/* ACCIONES PRINCIPALES CON SWITCHES */}
               <div className="flex flex-col gap-3">
                  {[
                    { id: 'COLLABORATE', label: 'COLABORAR', sub: '+25 Silo / +10 Tú', color: 'bg-farm-green', text: 'text-black', border: 'border-green-600' },
                    { id: 'PRIVATE', label: 'TRABAJO PRIVADO', sub: '+0 Silo / +25 Tú', color: 'bg-gold', text: 'text-black', border: 'border-yellow-600' },
                    { id: 'STEAL', label: 'ROBAR RECURSOS', sub: '-40 Silo / +60 Tú', color: 'bg-red-600', text: 'text-white', border: 'border-red-800' }
                  ].map((action) => (
                    <div key={action.id} className={`flex items-stretch bg-gray-900 border ${action.border} rounded-lg overflow-hidden relative`}>
                       {/* Botón Manual */}
                       <button 
                          onClick={() => handleManualAction(action.id as ActionType)}
                          disabled={hasActed || amIBankrupt}
                          className={`flex-1 p-4 text-left hover:brightness-110 active:scale-95 transition-all ${hasActed ? 'opacity-40 grayscale' : ''}`}
                       >
                          <div className={`text-sm font-bold ${action.id === 'STEAL' ? 'text-red-400' : action.id === 'PRIVATE' ? 'text-yellow-400' : 'text-green-400'}`}>{action.label}</div>
                          <div className="text-[10px] text-gray-400">{action.sub}</div>
                       </button>

                       {/* Switch Auto-Piloto */}
                       <div className="w-16 bg-black flex flex-col items-center justify-center border-l border-gray-700">
                          <span className="text-[8px] text-gray-500 mb-1">AUTO</span>
                          <button 
                             onClick={() => setAutoPilotAction(prev => prev === action.id ? null : action.id as ActionType)}
                             className={`w-8 h-4 rounded-full relative transition-colors ${autoPilotAction === action.id ? action.color : 'bg-gray-700'}`}
                          >
                             <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${autoPilotAction === action.id ? 'right-0.5' : 'left-0.5'}`}></div>
                          </button>
                       </div>
                       
                       {/* Indicador visual de acción realizada hoy */}
                       {hasActed && !amIBankrupt && ( // Aquí podrías guardar qué acción hiciste para marcarla, por simplicidad solo disableo
                          <div className="absolute inset-0 bg-black bg-opacity-50 pointer-events-none" />
                       )}
                    </div>
                  ))}
               </div>
               
               {hasActed && <div className="text-center text-xs text-gray-500 mt-2">✅ JORNADA COMPLETADA</div>}
               {!hasActed && !autoPilotAction && <div className="text-center text-[10px] text-red-400 mt-2 animate-pulse">⚠ SI NO ACTÚAS, PERDERÁS EL TURNO</div>}

            </div>
         )}

         {activeTab === 'STATS' && (
             <div className="grid grid-cols-1 gap-4 font-terminal">
                 <div className="bg-gray-800 p-4 rounded text-center">
                    <h3 className="text-gray-400 text-xs mb-2">CALIDAD DE VIDA</h3>
                    <div className="text-4xl mb-2">{costOfLiving > 30 ? '🤬' : costOfLiving > 15 ? '😨' : '😎'}</div>
                    <p className="text-sm">Costo Diario: ${costOfLiving}</p>
                 </div>
                 {/* ... más stats ... */}
             </div>
         )}

         {activeTab === 'NEWS' && (
             <div className="space-y-2">
                 {newsLog.map(n => (
                    <div key={n.id} onClick={() => openBailoutModal(n)} className={`p-3 text-xs border-l-4 rounded bg-gray-900 ${n.type === 'DEATH' ? 'border-gray-500' : n.type === 'ALERT' ? 'border-red-500' : 'border-blue-500'} ${n.type === 'BANKRUPTCY_ALERT' && !n.resolved ? 'cursor-pointer hover:bg-gray-800' : ''}`}>
                       <p className="text-white">{n.text}</p>
                       {n.resolved && <span className="text-[10px] text-green-500 font-bold">RESUELTO</span>}
                    </div>
                 ))}
             </div>
         )}
         
         {activeTab === 'RANKING' && (
             <div className="pb-20">
                <table className="w-full text-xs text-left">
                   <thead className="text-gray-500 border-b border-gray-700"><tr><th className="p-2">#</th><th>NOMBRE</th><th className="text-right">$$</th></tr></thead>
                   <tbody>
                      {bots.concat({id:999, name:'TÚ', stash:myStash, reputation:myReputation} as any).sort((a,b)=>b.stash-a.stash).map((p,i) => (
                         <tr key={p.id} className={`border-b border-gray-800 ${p.id===999 ? 'text-gold' : 'text-gray-400'}`}>
                            <td className="p-2">{i+1}</td><td>{p.name}</td><td className="text-right">{p.stash}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
         )}

         {/* LIDER TAB - SOLO SI ERES TOP */}
         {activeTab === 'LEADER' && (
             <div className="grid grid-cols-2 gap-4 p-4">
                 <button onClick={() => { setIsPaused(true); setShowSuspects(true); }} className="bg-purple-900 p-6 border border-purple-500 rounded text-center">
                    <span className="text-2xl block mb-2">⚖️</span> JUICIOS
                 </button>
                 <button onClick={() => executeExpropriation(false, "JUGADOR")} className="bg-red-900 p-6 border border-red-500 rounded text-center">
                    <span className="text-2xl block mb-2">📢</span> EXPROPIAR
                 </button>
             </div>
         )}

      </div>

      {/* 3. CONTROL DE VELOCIDAD FLOTANTE (DERECHA ABAJO) */}
      <div className="absolute bottom-20 right-4 z-30 flex flex-col gap-1 bg-black bg-opacity-80 p-2 rounded border border-gray-700 backdrop-blur-sm">
         {[0, 0.5, 1, 3, 5, 10].map(s => (
             <button 
                key={s} 
                onClick={() => { setSpeedMultiplier(s); setIsPaused(s === 0); }}
                className={`w-8 h-8 rounded text-[10px] flex items-center justify-center ${speedMultiplier === s && !isPaused ? 'bg-farm-green text-black font-bold' : 'bg-gray-800 text-gray-400'}`}
             >
                {s === 0 ? '⏸' : `x${s}`}
             </button>
         ))}
      </div>

      {/* 4. BOTTOM NAVIGATION BAR (DOCK) */}
      <div className="h-16 bg-gray-900 border-t border-soil shrink-0 flex items-center justify-around z-30 pb-safe">
         {[
           { id: 'ACTIONS', icon: '⚡', label: 'ACCIONES' },
           { id: 'STATS', icon: '📊', label: 'DATOS' },
           { id: 'NEWS', icon: '📡', label: 'RED', alert: unreadNews },
           { id: 'RANKING', icon: '🏆', label: 'RANGO' },
           { id: 'LEADER', icon: '👑', label: 'MANDO', hidden: ![...bots, {id:999,reputation:myReputation} as any].sort((a,b)=>b.reputation-a.reputation).slice(0,3).some(p=>p.id===999) }
         ].map(tab => !tab.hidden && (
            <button 
               key={tab.id} 
               onClick={() => { setActiveTab(tab.id as TabType); if(tab.id === 'NEWS') setUnreadNews(false); }}
               className={`flex flex-col items-center justify-center w-full h-full ${activeTab === tab.id ? 'text-farm-green bg-gray-800' : 'text-gray-500'}`}
            >
               <div className="relative">
                  <span className="text-xl mb-1 block">{tab.icon}</span>
                  {tab.alert && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
               </div>
               <span className="text-[9px] font-terminal">{tab.label}</span>
            </button>
         ))}
      </div>

      {/* MODAL DE RESCATE (MEJORADO) */}
      {activeBailout && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-6">
           <div className="w-full bg-gray-900 border-2 border-gold p-6 rounded shadow-2xl">
              <h3 className="text-gold text-xl text-center mb-4 font-bold">SOLICITUD DE RESCATE</h3>
              <div className="bg-black p-4 mb-4 font-mono text-sm space-y-2">
                 <div className="flex justify-between text-red-400"><span>Deuda Actual:</span><span>${Math.abs(activeBailout.debt)}</span></div>
                 <div className="flex justify-between text-blue-400"><span>Fondo Emergencia:</span><span>+${costOfLiving*7}</span></div>
                 <div className="border-t border-gray-600 my-2 pt-2 flex justify-between text-white font-bold">
                    <span>TOTAL REQUERIDO:</span>
                    <span>${Math.abs(activeBailout.debt) + (costOfLiving * 7)}</span>
                 </div>
              </div>
              
              <div className="space-y-3">
                 <button 
                    disabled={myStash < (Math.abs(activeBailout.debt) + (costOfLiving * 7))}
                    onClick={() => handleRescue('PRIVATE')}
                    className="w-full py-3 bg-gold text-black font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                 >
                    🤝 PAGAR DE MI BOLSILLO (${Math.abs(activeBailout.debt) + (costOfLiving * 7)})
                 </button>
                 
                 {/* Solo si eres lider */}
                 {[...bots, {id:999,reputation:myReputation} as any].sort((a,b)=>b.reputation-a.reputation).slice(0,3).some(p=>p.id===999) && (
                     <button onClick={() => handleRescue('PUBLIC')} className="w-full py-3 bg-farm-green text-black font-bold border border-green-400">
                        🏛️ USAR FONDOS PÚBLICOS
                     </button>
                 )}

                 <button onClick={() => { setActiveBailout(null); setIsPaused(false); }} className="w-full py-3 text-gray-500 underline">IGNORAR</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL SUSPECTS (SIMPLE) */}
      {showSuspects && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 p-8 flex flex-col">
            <h2 className="text-xl text-danger mb-4 text-center">SELECCIONAR ACUSADO</h2>
            <div className="flex-1 overflow-y-auto border border-gray-700">
                {bots.filter(b => !b.isDead).map(b => (
                    <button key={b.id} onClick={() => startVoteAgainst(b.id, b.name, b.reputation, 'TÚ')} className="w-full text-left p-4 border-b border-gray-800 hover:bg-red-900 flex justify-between">
                        <span>{b.name}</span>
                        <span className="text-gray-400">{b.reputation} Rep</span>
                    </button>
                ))}
            </div>
            <button onClick={() => { setShowSuspects(false); setIsPaused(false); }} className="p-4 bg-gray-800 mt-4">CANCELAR</button>
        </div>
      )}

      {/* MODAL VOTACION (SIMPLE) */}
      {voteSession && voteSession.isOpen && (
         <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-6">
            <div className="bg-gray-900 border-2 border-danger p-6 w-full text-center">
               <h3 className="text-2xl text-danger mb-2">JUICIO EN PROCESO</h3>
               <p className="mb-6">{voteSession.accusedBy} acusa a <br/><span className="text-xl font-bold text-white">{voteSession.targetName}</span></p>
               <div className="flex gap-2 mb-4">
                  <button onClick={() => finalizeVote('YES')} className="flex-1 bg-red-600 py-3 text-white font-bold">CULPABLE</button>
                  <button onClick={() => finalizeVote('NO')} className="flex-1 bg-blue-600 py-3 text-white font-bold">INOCENTE</button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}

import { useState, useEffect, useRef } from 'react';

// --- TIPOS ---
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
  reputation: number;
  stash: number;
  stats: PlayerStats;
  isDead: boolean;
  isBankrupt: boolean;
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
  type: 'INFO' | 'ALERT' | 'BANKRUPTCY_ALERT';
  targetId?: number;
  data?: any;
}

type SortType = 'WEALTH' | 'THEFT' | 'SAINT';

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
  
  // --- UI ---
  const [hasActed, setHasActed] = useState(false);
  const [activeTab, setActiveTab] = useState<'ACTIONS' | 'RANKING' | 'STATS' | 'NEWS' | 'LEADER'>('ACTIONS');
  const [newsLog, setNewsLog] = useState<NewsItem[]>([]);
  const [unreadNews, setUnreadNews] = useState(false);
  const [gameOverSort, setGameOverSort] = useState<SortType>('WEALTH');
  
  // Modales
  const [voteSession, setVoteSession] = useState<VoteSession | null>(null);
  const [activeBailout, setActiveBailout] = useState<{id: number, name: string, debt: number} | null>(null);
  const [showSuspects, setShowSuspects] = useState(false);

  // --- MOTORES ---
  const [bots, setBots] = useState<BotPlayer[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(2000);

  const stateRef = useRef({ bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, gamePhase, initialPop, initialTotalWealth, amIBankrupt });
  useEffect(() => {
    stateRef.current = { bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, gamePhase, initialPop, initialTotalWealth, amIBankrupt };
  }, [bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, gamePhase, initialPop, initialTotalWealth, amIBankrupt]);

  // --- CÁLCULOS ECONÓMICOS ---
  const activeBots = bots.filter(b => !b.isDead);
  const activePopulation = activeBots.length + (amIExpelled ? 0 : 1);
  const totalPrivateWealth = activeBots.reduce((acc, bot) => acc + bot.stash, 0) + (amIExpelled ? 0 : myStash);
  const currentTotalWealth = publicSilo + totalPrivateWealth;
  
  const monetaryInflation = Math.max(1, currentTotalWealth / (initialTotalWealth || 1));
  const safeSiloLevel = activePopulation * 50; 
  const scarcityInflation = Math.max(1, safeSiloLevel / (publicSilo + 1));
  const rawCost = 5 * (monetaryInflation + scarcityInflation - 0.5);
  const costOfLiving = Math.floor(Math.max(5, rawCost)); 

  // GINI
  const publicRatio = ((publicSilo / (currentTotalWealth || 1)) * 100).toFixed(1);
  const allStashes = [...activeBots.map(b => b.stash), (amIExpelled ? 0 : myStash)].sort((a, b) => b - a);
  const top10Count = Math.ceil(allStashes.length * 0.1);
  const wealthTop10 = allStashes.slice(0, top10Count).reduce((a, b) => a + b, 0);
  const inequalityPercentage = ((wealthTop10 / (totalPrivateWealth || 1)) * 100).toFixed(1);

  // TERMÓMETRO
  const getSocialSentiment = () => {
    if (publicSilo < safeSiloLevel * 0.2) return { icon: '🔥', text: 'ANARQUÍA', color: 'text-red-600' };
    if (costOfLiving > 25) return { icon: '🤬', text: 'FURIA', color: 'text-danger' };
    if (costOfLiving > 15) return { icon: '😨', text: 'MIEDO', color: 'text-orange-400' };
    if (parseFloat(inequalityPercentage) > 70) return { icon: '😒', text: 'TENSIÓN', color: 'text-yellow-400' };
    return { icon: '😎', text: 'ESTABLE', color: 'text-farm-green' };
  };
  const sentiment = getSocialSentiment();

  const addNews = (text: string, type: 'INFO' | 'ALERT' | 'BANKRUPTCY_ALERT' = 'INFO', data?: any) => {
    setNewsLog(prev => [{ id: Date.now() + Math.random(), text: `Día ${day}: ${text}`, type, data }, ...prev].slice(0, 30));
    if (activeTab !== 'NEWS') setUnreadNews(true);
  };

  // --- INICIO ---
  const startGame = () => {
    const siloStart = botCount * 100;
    const newBots: BotPlayer[] = Array.from({ length: botCount }).map((_, i) => ({
      id: i,
      name: `Ciudadano #${i + 1}`,
      reputation: Math.floor(Math.random() * 40) + 40,
      stash: Math.floor(Math.random() * 30) + 20, 
      stats: { stole: 0, collaborated: 0, private: 0, rescued: 0, donated: 0 },
      isDead: false,
      isBankrupt: false
    }));

    const playerStartStash = 50;
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
    setNewsLog([{ id: 1, text: "Bienvenido. Cuida la inflación.", type: 'INFO' }]);
    setIsRunning(false);
    setHasActed(false);
  };

  // --- EXPROPIACIÓN ---
  const triggerExpropriation = () => {
    setIsRunning(false);
    const targetSilo = safeSiloLevel; 
    const deficit = targetSilo - publicSilo;
    
    if (deficit <= 0) {
      alert("El Silo está sano.");
      return;
    }

    const taxPerHead = Math.ceil(deficit / activePopulation);
    let gathered = 0;
    
    // Jugador
    let takenFromMe = 0;
    if (!amIExpelled && !amIBankrupt) {
       takenFromMe = Math.min(stateRef.current.myStash, taxPerHead);
       setMyStash(s => s - takenFromMe);
       gathered += takenFromMe;
    }
    setMyReputation(r => Math.max(0, r - 30));

    // Bots
    setBots(prev => prev.map(b => {
      if (b.isDead || b.isBankrupt) return b;
      const taken = Math.min(b.stash, taxPerHead);
      gathered += taken;
      return { ...b, stash: b.stash - taken };
    }));

    setPublicSilo(prev => prev + gathered);
    addNews(`📢 EXPROPIACIÓN. Se recaudaron $${gathered}.`, 'ALERT');
    alert(`Recaudado: $${gathered}`);
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
        // Buscar víctima en el estado actual para obtener el monto correcto
        const currentBots = stateRef.current.bots;
        const victim = currentBots.find(b => b.id === voteSession.targetId);
        if (victim) confiscated = Math.max(0, victim.stash);

        setBots(prev => prev.map(b => {
          if (b.id === voteSession.targetId) return { ...b, isDead: true, stash: 0 };
          return b;
        }));
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
     if (item.type === 'BANKRUPTCY_ALERT' && item.data) {
        setIsRunning(false);
        setActiveBailout(item.data);
     }
  };

  const handleRescue = (type: 'PRIVATE' | 'PUBLIC' | 'IGNORE') => {
     if (!activeBailout) return;
     const { id, name, debt } = activeBailout;
     const rescueCost = Math.abs(debt) + (costOfLiving * 7); // Deuda + 1 semana de vida

     if (type === 'PRIVATE') {
        if (myStash >= rescueCost) {
           setMyStash(s => s - rescueCost);
           setMyReputation(r => Math.min(100, r + 20));
           setMyStats(s => ({ ...s, rescued: s.rescued + 1 }));
           resolveBankrupt(id, costOfLiving * 7);
           addNews(`🤝 TÚ rescataste a ${name}.`);
        }
     } else if (type === 'PUBLIC') {
        setPublicSilo(s => s - rescueCost);
        resolveBankrupt(id, costOfLiving * 7);
        addNews(`🏛️ Rescate PÚBLICO para ${name}.`);
     } else {
        resolveBankrupt(id, -1);
        addNews(`💀 ${name} exiliado por deudas.`, 'ALERT');
     }
     setActiveBailout(null);
     setIsRunning(true);
  };

  const resolveBankrupt = (id: number, finalStash: number) => {
     if (id === 999) {
        if (finalStash === -1) setAmIExpelled(true);
        else { setMyStash(finalStash); setAmIBankrupt(false); }
     } else {
        setBots(prev => prev.map(b => {
           if (b.id === id) {
              return finalStash === -1 ? { ...b, isDead: true, stash: 0 } : { ...b, stash: finalStash, isBankrupt: false };
           }
           return b;
        }));
     }
  };

  // --- BUCLE IA & TIEMPO ---
  useEffect(() => {
    let interval: any;
    if (isRunning && gamePhase === 'PLAYING') {
      interval = setInterval(() => {
        const currentData = stateRef.current;
        
        // 1. AUTO-COLABORACIÓN (MATEMÁTICA IDÉNTICA)
        if (!currentData.hasActed && !currentData.amIExpelled && !currentData.amIBankrupt) {
           setPublicSilo(s => s + 25); 
           // Gana 10, pero paga costo de vida
           setMyStash(s => s + 10 - costOfLiving); 
           setMyStats(s => ({ ...s, collaborated: s.collaborated + 1 }));
        } else if (!currentData.amIExpelled && !currentData.amIBankrupt) {
           setMyStash(prev => prev - costOfLiving);
        }

        // 2. CHECK JUGADOR
        if (!currentData.amIBankrupt && currentData.myStash < 0 && !currentData.amIExpelled) {
           setAmIBankrupt(true);
           addNews("¡ESTÁS EN QUIEBRA! Revisa NOTICIAS.", 'BANKRUPTCY_ALERT', { id: 999, name: 'TÚ', debt: currentData.myStash });
        }

        setDay(d => d + 1);
        setHasActed(false);

        // 3. IA DE BOTS (NUEVA LÓGICA BASADA EN NECESIDAD)
        setBots(currentBots => currentBots.map(bot => {
          if (bot.isDead) return bot;
          if (bot.isBankrupt) return bot;

          let newStash = bot.stash - costOfLiving;
          
          if (newStash < 0) {
             addNews(`🆘 ${bot.name} pide rescate.`, 'BANKRUPTCY_ALERT', { id: bot.id, name: bot.name, debt: newStash });
             return { ...bot, isBankrupt: true, stash: newStash };
          }

          let currentStats = { ...bot.stats };
          let newRep = bot.reputation;
          
          // --- CEREBRO DEL BOT ---
          const financialStress = costOfLiving / (Math.max(1, bot.stash)); // >1 = Pobreza extrema
          const socialPanic = 1 - Math.min(1, currentData.publicSilo / (activePopulation * 50)); // >0.7 = Pánico
          const roll = Math.random();
          
          let decision = 'PRIVATE'; // Decisión por defecto (Cautela)

          // Escenario 1: Desesperación (Pobreza)
          if (financialStress > 0.8) {
             // Si es pobre, tiene alta probabilidad de robar para sobrevivir
             if (roll < 0.7) decision = 'STEAL'; 
             else decision = 'PRIVATE';
          } 
          // Escenario 2: Pánico Social (Silo Vacío)
          else if (socialPanic > 0.8) {
             // Si todo se derrumba, sálvese quien pueda
             if (roll < 0.6) decision = 'PRIVATE'; 
             else if (roll < 0.9) decision = 'STEAL';
             else decision = 'COLLABORATE'; // Pocos héroes
          }
          // Escenario 3: Tiempos Normales
          else {
             // Si está cómodo, colabora para mantener el sistema
             // Ajuste: 90% colabora si la vida es fácil, para no colapsar rápido
             if (roll < 0.8) decision = 'COLLABORATE';
             else decision = 'PRIVATE';
          }

          if (decision === 'STEAL') {
             newStash += 50; 
             setPublicSilo(s => s - 40); 
             newRep -= 3;
             currentStats.stole += 1;
          } else if (decision === 'PRIVATE') {
             newStash += 20; 
             currentStats.private += 1;
          } else {
             setPublicSilo(s => s + 25); 
             newRep += 1;
             newStash += 10; 
             currentStats.collaborated += 1;
          }

          return { ...bot, reputation: Math.max(0, Math.min(100, newRep)), stash: newStash, stats: currentStats };
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

      }, speed);
    }
    return () => clearInterval(interval);
  }, [isRunning, speed, gamePhase, costOfLiving]);


  // --- ACCIONES MANUALES ---
  const handleAction = (type: 'COLLABORATE' | 'PRIVATE' | 'STEAL') => {
    if (hasActed || amIExpelled || amIBankrupt) return;

    switch (type) {
      case 'COLLABORATE':
        setPublicSilo(s => s + 25);
        setMyStash(s => s + 10); 
        setMyReputation(r => Math.min(100, r + 5));
        setMyStats(s => ({ ...s, collaborated: s.collaborated + 1 }));
        break;
      case 'PRIVATE':
        setMyStash(s => s + 20);
        setMyStats(s => ({ ...s, private: s.private + 1 }));
        break;
      case 'STEAL':
        setPublicSilo(s => s - 40);
        setMyStash(s => s + 50);
        setMyReputation(r => Math.max(0, r - 10));
        setMyStats(s => ({ ...s, stole: s.stole + 1 }));
        break;
    }
    setHasActed(true);
  };

  const donateToSilo = () => {
     if (myStash < 20 || hasActed) return;
     setMyStash(s => s - 20);
     setPublicSilo(s => s + 20);
     setMyReputation(r => Math.min(100, r + 5)); // +5 Rep por donar
     setMyStats(s => ({...s, donated: s.donated + 20}));
     setHasActed(true);
  };

  // --- RENDER HELPERS ---
  const activePlayersList = [...bots.filter(b => !b.isDead), { id: 999, name: 'TÚ', reputation: myReputation, isDead: amIExpelled }];
  const sortedByRep = [...activePlayersList].sort((a,b) => b.reputation - a.reputation);
  const amITopRep = sortedByRep.slice(0, 3).some(p => p.id === 999);

  // SETUP
  if (gamePhase === 'SETUP') return (
      <div className="w-full max-w-md relative mt-10 text-center">
         <button onClick={onBack} className="absolute -top-10 left-0 text-white underline font-pixel text-xs">&lt; ATRÁS</button>
         <div className="border-4 border-farm-green p-8 bg-black bg-opacity-90">
            <h2 className="font-pixel text-gold text-xl mb-6">NUEVA SOCIEDAD</h2>
            <label className="block text-farm-green font-terminal mb-2">POBLACIÓN</label>
            <input type="range" min="10" max="200" step="10" value={botCount} onChange={(e) => setBotCount(parseInt(e.target.value))} className="w-full mb-4 accent-farm-green cursor-pointer"/>
            <p className="text-white font-pixel text-2xl mb-8">{botCount}</p>
            <button onClick={startGame} className="bg-farm-green text-black font-pixel py-4 w-full hover:scale-105 transition-transform">COMENZAR</button>
         </div>
      </div>
  );

  // GAME OVER
  if (gamePhase === 'GAMEOVER') {
    const allP = [...bots, { id: 999, name: 'TÚ', reputation: myReputation, stash: myStash, stats: myStats, isDead: amIExpelled, isMe: true }];
    const richest = [...allP].sort((a,b) => b.stash - a.stash)[0];
    const biggestThief = [...allP].sort((a,b) => b.stats.stole - a.stats.stole)[0];
    const mostCollaborative = [...allP].sort((a,b) => b.stats.collaborated - a.stats.collaborated)[0];
    
    const sortedList = [...allP].sort((a, b) => {
       if (gameOverSort === 'WEALTH') return b.stash - a.stash;
       if (gameOverSort === 'THEFT') return b.stats.stole - a.stats.stole;
       if (gameOverSort === 'SAINT') return b.stats.collaborated - a.stats.collaborated;
       return 0;
    });

    return (
      <div className="w-full max-w-md relative mt-8 animate-fade-in">
        <div className="border-4 border-danger p-4 bg-black shadow-2xl">
          <h2 className="text-center text-danger font-pixel text-2xl mb-2 animate-pulse">SOCIEDAD FALLIDA</h2>
          <div className="grid grid-cols-3 gap-2 mb-6 text-center font-terminal text-xs mt-4">
             <button onClick={() => setGameOverSort('WEALTH')} className={`bg-gray-900 p-2 border hover:scale-105 ${gameOverSort === 'WEALTH' ? 'border-white' : 'border-gold'}`}><p className="text-gold">💰 MAGNATE</p><p className="text-white">{richest.name}</p></button>
             <button onClick={() => setGameOverSort('THEFT')} className={`bg-gray-900 p-2 border hover:scale-105 ${gameOverSort === 'THEFT' ? 'border-white' : 'border-red-500'}`}><p className="text-red-500">🐀 LADRÓN</p><p className="text-white">{biggestThief.name}</p></button>
             <button onClick={() => setGameOverSort('SAINT')} className={`bg-gray-900 p-2 border hover:scale-105 ${gameOverSort === 'SAINT' ? 'border-white' : 'border-farm-green'}`}><p className="text-farm-green">😇 SANTO</p><p className="text-white">{mostCollaborative.name}</p></button>
          </div>
          <div className="h-64 overflow-y-auto border border-gray-700 custom-scrollbar"><table className="w-full font-terminal text-sm text-left"><thead className="bg-danger text-black sticky top-0"><tr><th className="pl-2">#</th><th>NOMBRE</th><th className="text-right">VALOR</th><th className="text-right pr-2">$$$</th></tr></thead><tbody>{sortedList.map((p, i) => (
             <tr key={i} className={`border-b border-gray-800 ${p.isMe ? 'text-gold' : 'text-gray-300'}`}><td className="pl-2">{i+1}</td><td>{p.name}</td><td className="text-right">{gameOverSort==='WEALTH'?p.stash:gameOverSort==='THEFT'?p.stats.stole:p.stats.collaborated}</td><td className="text-right pr-2">{p.stash}</td></tr>
          ))}</tbody></table></div>
          <button onClick={() => setGamePhase('SETUP')} className="mt-4 w-full bg-white text-black font-pixel py-3">REINICIAR</button>
        </div>
      </div>
    );
  }

  // --- RENDER JUEGO ---
  return (
    <div className="w-full max-w-md relative mt-8 h-[36rem]">
      <button onClick={onBack} className="absolute -top-10 left-0 text-soil hover:text-white underline font-pixel text-xs">&lt; SALIR</button>

      {/* MODAL RESCATE */}
      {activeBailout && (
        <div className="absolute inset-0 z-50 bg-black bg-opacity-95 flex flex-col items-center justify-center p-6 border-4 border-gold">
           <h3 className="text-gold font-pixel text-lg mb-2 text-center">RESCATE</h3>
           <p className="text-white text-center mb-4"><span className="text-blue-400">{activeBailout.name}</span> debe {Math.abs(activeBailout.debt)}</p>
           <div className="flex flex-col gap-3 w-full">
              {amITopRep && <button onClick={() => handleRescue('PUBLIC')} className="bg-farm-green text-black py-3 font-pixel text-xs">🏛️ PÚBLICO (Líder)</button>}
              <button onClick={() => handleRescue('PRIVATE')} disabled={myStash < (Math.abs(activeBailout.debt) + (costOfLiving * 7))} className="bg-gold text-black py-3 font-pixel text-xs disabled:opacity-50">🤝 PRIVADO</button>
              <button onClick={() => handleRescue('IGNORE')} className="bg-gray-700 text-white py-3 font-pixel text-xs">💀 IGNORAR</button>
           </div>
           <button onClick={() => { setActiveBailout(null); setIsRunning(true); }} className="mt-4 text-gray-500 underline text-xs">CANCELAR</button>
        </div>
      )}

      {/* MODAL JUICIO */}
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
                  <button key={b.id} onClick={() => startVoteAgainst(b.id, b.name, b.reputation, 'TÚ')} className="w-full text-left p-2 border-b border-gray-700 hover:bg-gray-800 text-danger font-terminal">{b.name} (Rep: {b.reputation}%)</button>
               ))}
            </div>
            <button onClick={() => {setShowSuspects(false); setIsRunning(true);}} className="mt-4 w-full bg-gray-600 text-white py-2 font-pixel">CANCELAR</button>
         </div>
      )}

      <div className="border-4 border-soil p-4 bg-black shadow-2xl h-full flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
          <p className="font-pixel text-xl text-white">DÍA {day}</p>
          <div className="text-right">
             <p className={`text-xs font-pixel ${amIExpelled ? 'text-danger' : 'text-green-400'}`}>{amIExpelled ? 'EXPULSADO' : amIBankrupt ? 'EN QUIEBRA' : 'ACTIVO'}</p>
             <p className="text-[10px] text-gray-400">Población: {activePopulation}/{botCount+1}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 font-terminal text-center">
            <div className="bg-gray-900 p-2 rounded border border-gray-700"><span className="text-[10px] text-gray-400 block">SILO</span><span className={`${publicSilo < (activePopulation * 10) ? 'text-danger animate-pulse' : 'text-farm-green'} text-lg`}>{publicSilo}</span></div>
            <div className="bg-gray-900 p-2 rounded border border-gray-700"><span className="text-[10px] text-gray-400 block">COSTO VIDA</span><span className="text-danger text-lg">-{costOfLiving}</span></div>
            <div className="bg-gray-900 p-2 rounded border border-gray-700"><span className="text-[10px] text-gray-400 block">DINERO</span><span className={`text-lg ${myStash < 0 ? 'text-danger animate-pulse' : 'text-gold'}`}>{myStash}</span></div>
        </div>

        <div className="flex border-b-2 border-soil mb-4 overflow-x-auto shrink-0">
          {['ACTIONS', 'STATS', 'NEWS', 'RANKING'].map(tab => (
             <button key={tab} onClick={() => {setActiveTab(tab as any); if(tab==='NEWS') setUnreadNews(false);}} className={`relative flex-1 font-pixel text-[10px] py-2 px-1 ${activeTab === tab ? 'bg-soil text-white' : 'text-gray-500'}`}>
                {tab} {tab === 'NEWS' && unreadNews && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
             </button>
          ))}
          {amITopRep && <button onClick={() => setActiveTab('LEADER')} className="flex-1 font-pixel text-[10px] py-2 px-1 bg-gold text-black">LÍDER</button>}
        </div>

        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
            {activeTab === 'ACTIONS' && (
              <div className="flex flex-col gap-3 h-full justify-center">
                 {amIExpelled ? <p className="text-danger text-center font-pixel">ESTÁS EXILIADO</p> : amIBankrupt ? (
                    <div className="text-center"><p className="text-danger font-bold mb-4">¡ESTÁS EN QUIEBRA!</p><p className="text-xs text-gray-400">Ve a NOTICIAS para ver tu estado.</p></div>
                 ) : hasActed ? (
                    <div className="text-center text-gray-500 font-terminal p-8 border-2 border-dashed border-gray-800"><p>Jornada terminada.</p><p className="text-xs text-farm-green mt-1">Ingreso Automático (+10)</p><p className="text-xs text-danger mt-1">Costo Vida: -{costOfLiving}</p></div>
                 ) : (
                    <>
                      <button onClick={donateToSilo} className="bg-blue-800 text-white font-pixel py-2 hover:scale-105 mb-2 border border-blue-500">🤝 DONAR AL PUEBLO (-20$)</button>
                      <button onClick={() => handleAction('COLLABORATE')} className="bg-farm-green text-black font-pixel py-3 hover:scale-105 text-left px-4 group relative"><div className="relative z-10 flex justify-between items-center w-full"><span className="text-sm">🔨 COLABORAR</span><span className="text-[10px] bg-black text-white px-2 py-1 rounded">+REP</span></div><div className="relative z-10 text-[10px] opacity-70 mt-1 font-terminal">+25 Silo / +10 Tú</div></button>
                      <button onClick={() => handleAction('PRIVATE')} className="bg-yellow-600 text-black font-pixel py-3 hover:scale-105 text-left px-4 relative"><div className="relative z-10 flex justify-between items-center w-full"><span className="text-sm">🏠 PRIVADO</span><span className="text-[10px] bg-black text-white px-2 py-1 rounded">=REP</span></div><div className="relative z-10 text-[10px] opacity-70 mt-1 font-terminal">+0 Silo / +20 Tú</div></button>
                      <button onClick={() => handleAction('STEAL')} className="bg-red-600 text-white font-pixel py-3 hover:scale-105 text-left px-4 group relative"><div className="relative z-10 flex justify-between items-center w-full"><span className="text-sm">😈 ROBAR</span><span className="text-[10px] bg-black text-white px-2 py-1 rounded">-REP</span></div><div className="relative z-10 text-[10px] opacity-80 mt-1 font-terminal">-40 Silo / +50 Tú</div></button>
                    </>
                 )}
              </div>
            )}

            {activeTab === 'LEADER' && amITopRep && (
               <div className="flex flex-col gap-4 p-4 items-center justify-center h-full border border-gold bg-gray-900">
                  <h3 className="text-gold font-pixel text-center">FUNCIONES DE ÉLITE</h3>
                  <button onClick={() => { setIsRunning(false); setShowSuspects(true); }} className="w-full bg-purple-800 text-white font-pixel py-4 border-2 border-purple-500 hover:scale-105">⚖️ INICIAR JUICIO</button>
                  <button onClick={triggerExpropriation} className="w-full bg-red-900 text-white font-pixel py-4 border-2 border-red-500 hover:scale-105 animate-pulse">📢 EXPROPIACIÓN</button>
               </div>
            )}

            {activeTab === 'STATS' && (
               <div className="font-terminal space-y-4 p-2 text-center">
                  <div className="bg-gray-900 p-3 border border-gray-700">
                     <p className="text-xs text-gray-400 mb-2">TERMÓMETRO SOCIAL</p>
                     <p className={`text-4xl ${sentiment.color}`}>{sentiment.icon}</p>
                     <p className={`text-lg font-bold ${sentiment.color}`}>{sentiment.text}</p>
                  </div>
                  <div className="bg-gray-900 p-3 border border-gray-700">
                     <p className="text-xs text-gray-400 mb-1">DISTRIBUCIÓN RIQUEZA</p>
                     <div className="w-full h-4 bg-gray-700 rounded-full flex overflow-hidden"><div style={{ width: `${publicRatio}%` }} className="bg-farm-green"></div><div style={{ width: `${100-parseFloat(publicRatio)}%` }} className="bg-gold"></div></div>
                     <div className="flex justify-between text-xs mt-1"><span className="text-farm-green">PÚBLICO ({publicRatio}%)</span><span className="text-gold">PRIVADO</span></div>
                  </div>
                  <div className="bg-gray-900 p-3 border border-gray-700"><p className="text-xs text-gray-400 mb-1">GINI (TOP 10%)</p><p className="text-white text-sm"><span className="text-gold font-bold">{inequalityPercentage}%</span> posesión.</p></div>
               </div>
            )}

            {activeTab === 'NEWS' && <div className="font-terminal text-xs space-y-2 p-2">
               {newsLog.map((item) => (
                  <button key={item.id} disabled={item.type !== 'BANKRUPTCY_ALERT'} onClick={() => openBailoutModal(item)} className={`w-full text-left p-2 border-b border-gray-800 ${item.type === 'BANKRUPTCY_ALERT' ? 'bg-red-900 text-white animate-pulse' : 'text-gray-300'}`}>
                     {item.text} {item.type === 'BANKRUPTCY_ALERT' && <span className="float-right underline">VER ➡️</span>}
                  </button>
               ))}
            </div>}

            {activeTab === 'RANKING' && (
               <table className="w-full font-terminal text-sm text-left"><thead className="text-gray-500 border-b border-gray-700 sticky top-0 bg-black"><tr><th className="pb-2 pl-2">#</th><th>CIUDADANO</th><th className="text-right">REP</th><th className="text-right pr-2">$$$</th></tr></thead><tbody>
                  {[...bots, {id:999, name:'TÚ', reputation:myReputation, stash:myStash, isDead:amIExpelled, isMe:true}].filter(p => !p.isDead).sort((a,b) => b.reputation - a.reputation).map((player, index) => (
                     <tr key={player.id} className={`border-b border-gray-900 ${player.isMe ? 'text-gold bg-gray-900' : 'text-gray-300'} ${player.isBankrupt ? 'opacity-50 text-red-500' : ''}`}><td className="py-2 pl-2">{index + 1}</td><td className="py-2">{player.isMe ? '⭐ TÚ' : player.name} {player.isBankrupt && '(SOS)'}</td><td className={`py-2 text-right ${player.reputation < 30 ? 'text-danger' : 'text-farm-green'}`}>{player.reputation}%</td><td className="py-2 text-right pr-2 font-mono">{player.isMe ? player.stash : '🔒???'}</td></tr>
                  ))}
               </tbody></table>
            )}
        </div>

        <div className="flex gap-2 justify-center border-t border-gray-700 pt-4 shrink-0">
          <button disabled={amIExpelled} onClick={() => setIsRunning(!isRunning)} className={`font-pixel text-xs border border-gray-500 px-4 py-2 hover:bg-gray-800 ${isRunning ? 'text-danger' : 'text-white'} disabled:opacity-50`}>{isRunning ? '⏸ PAUSAR' : '▶ INICIAR'}</button>
          <button onClick={() => setSpeed(speed === 2000 ? 200 : 2000)} className="text-gold font-pixel text-xs border border-gold px-4 py-2 hover:bg-gray-800">{speed === 2000 ? '⏩ VELOCIDAD x10' : '🐌 NORMAL'}</button>
        </div>
      </div>
    </div>
  );
}

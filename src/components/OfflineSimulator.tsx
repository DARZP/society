import { useState, useEffect, useRef } from 'react';

// --- TIPOS DE DATOS ---
interface PlayerStats {
  stole: number;
  collaborated: number;
  private: number;
  rescued: number;
}

interface BotPlayer {
  id: number;
  name: string;
  reputation: number;
  stash: number;
  stats: PlayerStats;
  isDead: boolean;
}

interface VoteSession {
  targetId: number;
  targetName: string;
  accusedBy: string;
  isOpen: boolean;
  bailCost: number; // Costo para anular el juicio
}

interface BailoutRequest {
  targetId: number;
  targetName: string;
  debt: number;
  reputation: number;
}

export default function OfflineSimulator({ onBack }: { onBack: () => void }) {
  // --- FASES ---
  const [gamePhase, setGamePhase] = useState<'SETUP' | 'PLAYING' | 'GAMEOVER'>('SETUP');
  const [botCount, setBotCount] = useState(50);
  
  // --- MUNDO ---
  const [day, setDay] = useState(1);
  const [publicSilo, setPublicSilo] = useState(1000);
  
  // --- JUGADOR ---
  const [myStash, setMyStash] = useState(50);
  const [myReputation, setMyReputation] = useState(50);
  const [myStats, setMyStats] = useState<PlayerStats>({ stole: 0, collaborated: 0, private: 0, rescued: 0 });
  const [amIExpelled, setAmIExpelled] = useState(false);
  
  // --- UI & SISTEMAS ---
  const [hasActed, setHasActed] = useState(false);
  // AÑADIDO: 'LEADER' tab
  const [activeTab, setActiveTab] = useState<'ACTIONS' | 'RANKING' | 'STATS' | 'NEWS' | 'LEADER'>('ACTIONS');
  const [newsLog, setNewsLog] = useState<string[]>([]);
  
  // Modales
  const [voteSession, setVoteSession] = useState<VoteSession | null>(null);
  const [bailoutRequest, setBailoutRequest] = useState<BailoutRequest | null>(null);
  const [showSuspects, setShowSuspects] = useState(false);

  // --- MOTORES ---
  const [bots, setBots] = useState<BotPlayer[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(2000);

  // Refs
  const stateRef = useRef({ bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, gamePhase });
  useEffect(() => {
    stateRef.current = { bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, gamePhase };
  }, [bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, gamePhase]);

  // --- CÁLCULOS ---
  const activePopulation = bots.filter(b => !b.isDead).length + (amIExpelled ? 0 : 1);
  const inflationThreshold = activePopulation * 10;
  const inflation = Math.max(1, inflationThreshold / (publicSilo + 1)).toFixed(2);
  const costOfLiving = Math.floor(5 * parseFloat(inflation));

  // GINI
  const activeBots = bots.filter(b => !b.isDead);
  const totalPrivateWealth = activeBots.reduce((acc, bot) => acc + bot.stash, 0) + (amIExpelled ? 0 : myStash);
  const allStashes = [...activeBots.map(b => b.stash), (amIExpelled ? 0 : myStash)].sort((a, b) => b - a);
  const top10Count = Math.ceil(allStashes.length * 0.1);
  const wealthTop10 = allStashes.slice(0, top10Count).reduce((a, b) => a + b, 0);
  const inequalityPercentage = ((wealthTop10 / (totalPrivateWealth || 1)) * 100).toFixed(1);

  const addNews = (msg: string) => setNewsLog(prev => [`Día ${day}: ${msg}`, ...prev].slice(0, 20));

  // --- INICIO ---
  const startGame = () => {
    const newBots: BotPlayer[] = Array.from({ length: botCount }).map((_, i) => ({
      id: i,
      name: `Ciudadano #${i + 1}`,
      reputation: Math.floor(Math.random() * 40) + 40,
      stash: Math.floor(Math.random() * 20) + 10,
      stats: { stole: 0, collaborated: 0, private: 0, rescued: 0 },
      isDead: false
    }));
    setBots(newBots);
    setPublicSilo(botCount * 50); 
    setGamePhase('PLAYING');
    setDay(1);
    setMyStats({ stole: 0, collaborated: 0, private: 0, rescued: 0 });
    setMyReputation(50);
    setMyStash(50);
    setAmIExpelled(false);
    setNewsLog(["Bienvenido. La sociedad inicia hoy."]);
    setIsRunning(false);
    setHasActed(false);
  };

  // --- JUICIOS ---
  const startVoteAgainst = (targetId: number, targetName: string, accuser: string) => {
      setIsRunning(false);
      setShowSuspects(false);
      // El costo de la fianza es 50 monedas fijas por ahora
      setVoteSession({ targetId, targetName, accusedBy: accuser, isOpen: true, bailCost: 50 });
      addNews(`⚖️ JUICIO INICIADO: ${accuser} acusa a ${targetName}.`);
  };

  const payBailoutInTrial = () => {
    if (!voteSession) return;
    const cost = voteSession.bailCost;
    
    if (myStash >= cost) {
      setMyStash(s => s - cost);
      setMyReputation(r => Math.min(100, r + 10)); // Subes reputación por "benevolente"
      addNews(`💸 FIANZA PAGADA: TÚ anulaste el juicio de ${voteSession.targetName}.`);
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
       const justiceSense = bot.reputation / 100; 
       if (Math.random() < justiceSense) yes++; else no++;
    });

    if (yes > no) {
      let confiscated = 0;
      if (voteSession.targetId === 999) {
        setAmIExpelled(true);
        confiscated = Math.max(0, stateRef.current.myStash);
        setMyStash(0);
        addNews(`🛑 VEREDICTO: CULPABLE. Has sido EXPULSADO. Confiscado: ${confiscated}.`);
      } else {
        setBots(prev => prev.map(b => {
          if (b.id === voteSession.targetId) {
            confiscated = Math.max(0, b.stash);
            return { ...b, isDead: true, stash: 0 };
          }
          return b;
        }));
        addNews(`🔨 VEREDICTO: ${voteSession.targetName} fue EXPULSADO. Se incautaron ${confiscated}.`);
      }
      setPublicSilo(s => s + confiscated);
    } else {
      addNews(`🛡️ VEREDICTO: ${voteSession.targetName} declarado INOCENTE (${yes} votos vs ${no}).`);
    }
    setVoteSession(null);
    setIsRunning(true);
  };

  // --- BANCARROTA ---
  const handleBailoutAction = (action: 'PUBLIC_BAILOUT' | 'PRIVATE_RESCUE' | 'EXPEL') => {
    if (!bailoutRequest) return;
    const { targetId, debt, targetName } = bailoutRequest;
    const cost = Math.abs(debt) + 10;

    if (action === 'PUBLIC_BAILOUT') {
      setPublicSilo(s => s - cost);
      addNews(`🏛️ Rescate PÚBLICO aprobado para ${targetName}.`);
      resolveBailout(targetId, 10);
    } else if (action === 'PRIVATE_RESCUE') {
      setMyStash(s => s - cost);
      setMyReputation(r => Math.min(100, r + 15));
      setMyStats(s => ({ ...s, rescued: s.rescued + 1 }));
      addNews(`🤝 TÚ rescataste a ${targetName} con fondos privados.`);
      resolveBailout(targetId, 10);
    } else {
      addNews(`💀 Se negó ayuda a ${targetName}. Exiliado por deudas.`);
      resolveBailout(targetId, -1);
    }
    setBailoutRequest(null);
    setIsRunning(true);
  };

  const resolveBailout = (id: number, finalStash: number) => {
    if (id === 999) {
      if (finalStash === -1) setAmIExpelled(true);
      else setMyStash(finalStash);
    } else {
      setBots(prev => prev.map(b => {
        if (b.id === id) {
          return finalStash === -1 ? { ...b, isDead: true, stash: 0 } : { ...b, stash: finalStash };
        }
        return b;
      }));
    }
  };

  // --- BUCLE ---
  useEffect(() => {
    let interval: any;
    if (isRunning && gamePhase === 'PLAYING') {
      interval = setInterval(() => {
        const currentData = stateRef.current;
        
        // 1. AUTO-COLABORACIÓN
        if (!currentData.hasActed && !currentData.amIExpelled) {
           setPublicSilo(s => s + 20); 
           setMyStash(s => s + 2); 
           setMyReputation(r => Math.min(100, r + 1)); 
           setMyStats(s => ({ ...s, collaborated: s.collaborated + 1 }));
        } else if (!currentData.amIExpelled) {
           setMyStash(prev => prev - costOfLiving);
        }

        setDay(d => d + 1);
        setHasActed(false);

        // 2. QUIEBRAS
        let bankruptcyStop = false;
        const allActive = [...currentData.bots.filter(b => !b.isDead), { id: 999, name:'TÚ', reputation: currentData.myReputation, isDead: currentData.amIExpelled, stash: currentData.myStash }];
        const leaderRep = allActive.sort((a,b) => b.reputation - a.reputation)[0];
        const iAmLeader = leaderRep.id === 999;

        setBots(currentBots => currentBots.map(bot => {
          if (bot.isDead) return bot;
          let newStash = bot.stash - costOfLiving;
          
          if (newStash < 0 && !bankruptcyStop) {
             if (iAmLeader) {
                bankruptcyStop = true;
                setIsRunning(false);
                setBailoutRequest({ targetId: bot.id, targetName: bot.name, debt: newStash, reputation: bot.reputation });
             } else {
                // IA decide
                const richestBot = currentBots.sort((a,b) => b.stash - a.stash)[0];
                if (richestBot.stash > Math.abs(newStash) + 50 && richestBot.reputation < 50) {
                   newStash = 10; // Rescate privado IA
                } else if (currentData.publicSilo > 500 && bot.reputation > 30) {
                   newStash = 10;
                   setPublicSilo(s => s - (Math.abs(newStash) + 10));
                } else {
                   return { ...bot, isDead: true, stash: 0 }; 
                }
             }
          }

          let currentStats = { ...bot.stats };
          let newRep = bot.reputation;
          
          if (!bankruptcyStop && newStash >= 0) {
             const corruptFactor = (100 - bot.reputation) / 100;
             const roll = Math.random();
             let decision = 'COLLABORATE'; 
             if (roll < (0.1 + (corruptFactor * 0.4))) decision = 'STEAL'; 
             else if (roll > 0.8) decision = 'PRIVATE';

             if (decision === 'STEAL') {
                newStash += 30;
                setPublicSilo(s => s - 30); 
                newRep -= 3;
                currentStats.stole += 1;
             } else if (decision === 'PRIVATE') {
                newStash += 15;
                currentStats.private += 1;
             } else {
                setPublicSilo(s => s + 8); 
                newRep += 1;
                currentStats.collaborated += 1;
             }
          }

          return { ...bot, reputation: Math.max(0, Math.min(100, newRep)), stash: newStash, stats: currentStats };
        }));

        setPublicSilo(prev => {
          if (prev <= 0) {
            setIsRunning(false);
            setGamePhase('GAMEOVER');
            return 0;
          }
          return prev;
        });

      }, speed);
    }
    return () => clearInterval(interval);
  }, [isRunning, speed, gamePhase, costOfLiving]);


  // --- ACCIONES MANUALES ---
  const handleAction = (type: 'COLLABORATE' | 'PRIVATE' | 'STEAL') => {
    if (publicSilo <= 0 || hasActed || amIExpelled || myStash < 0) return;

    switch (type) {
      case 'COLLABORATE':
        setPublicSilo(s => s + 25);
        setMyStash(s => s + 5);
        setMyReputation(r => Math.min(100, r + 5));
        setMyStats(s => ({ ...s, collaborated: s.collaborated + 1 }));
        break;
      case 'PRIVATE':
        setMyStash(s => s + 15);
        setMyStats(s => ({ ...s, private: s.private + 1 }));
        break;
      case 'STEAL':
        setPublicSilo(s => s - 40);
        setMyStash(s => s + 40);
        setMyReputation(r => Math.max(0, r - 10));
        setMyStats(s => ({ ...s, stole: s.stole + 1 }));
        break;
    }
    setHasActed(true);
  };

  // --- UI PREPS ---
  const activePlayers = [...bots.filter(b => !b.isDead), { id: 999, name: 'TÚ', reputation: myReputation, isDead: amIExpelled }];
  const sortedByRep = [...activePlayers].sort((a,b) => b.reputation - a.reputation);
  const top3Rep = sortedByRep.slice(0, 3);
  const amITopRep = top3Rep.some(p => p.id === 999);
  const amILeader = sortedByRep[0]?.id === 999;

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

  // GAME OVER (RESTAURADO)
  if (gamePhase === 'GAMEOVER') {
    const allP = [...bots, { id: 999, name: 'TÚ', reputation: myReputation, stash: myStash, stats: myStats, isDead: amIExpelled, isMe: true }];
    const richest = [...allP].sort((a,b) => b.stash - a.stash)[0];
    const biggestThief = [...allP].sort((a,b) => b.stats.stole - a.stats.stole)[0];
    const mostCollaborative = [...allP].sort((a,b) => b.stats.collaborated - a.stats.collaborated)[0];
    const ranking = [...allP].sort((a,b) => b.stash - a.stash);
    
    return (
      <div className="w-full max-w-md relative mt-8 animate-fade-in">
        <div className="border-4 border-danger p-4 bg-black shadow-2xl">
          <h2 className="text-center text-danger font-pixel text-2xl mb-2 animate-pulse">SOCIEDAD COLAPSADA</h2>
          <p className="text-center text-white font-terminal mb-4">SOBREVIVISTE: {day} DÍAS</p>

          <div className="grid grid-cols-3 gap-2 mb-6 text-center font-terminal text-xs">
             <div className="bg-gray-900 p-2 border border-gold">
                <p className="text-gold mb-1">💰 MAGNATE</p>
                <p className="text-white font-bold">{richest.name}</p>
                <p className="text-gold">${richest.stash}</p>
             </div>
             <div className="bg-gray-900 p-2 border border-red-500">
                <p className="text-red-500 mb-1">🐀 LADRÓN</p>
                <p className="text-white font-bold">{biggestThief.name}</p>
                <p className="text-red-400">{biggestThief.stats.stole} Robos</p>
             </div>
             <div className="bg-gray-900 p-2 border border-farm-green">
                <p className="text-farm-green mb-1">😇 SANTO</p>
                <p className="text-white font-bold">{mostCollaborative.name}</p>
                <p className="text-farm-green">{mostCollaborative.stats.collaborated} Aportes</p>
             </div>
          </div>

          <div className="h-64 overflow-y-auto border border-gray-700 custom-scrollbar mt-4">
             <table className="w-full font-terminal text-sm text-left">
                  <thead className="bg-danger text-black sticky top-0"><tr><th className="pl-2">#</th><th>NOMBRE</th><th className="text-right pr-2">$$$</th></tr></thead>
                  <tbody>{ranking.map((p, i) => (<tr key={i} className={`border-b border-gray-800 ${p.isMe ? 'text-gold' : 'text-gray-300'}`}><td className="pl-2">{i+1}</td><td>{p.name} {p.isDead && '💀'}</td><td className="text-right pr-2">{p.stash}</td></tr>))}</tbody>
             </table>
          </div>
          <button onClick={() => setGamePhase('SETUP')} className="mt-4 w-full bg-white text-black font-pixel py-3">REINICIAR</button>
        </div>
      </div>
    );
  }

  // --- RENDER JUEGO ---
  return (
    <div className="w-full max-w-md relative mt-8">
      <button onClick={onBack} className="absolute -top-10 left-0 text-soil hover:text-white underline font-pixel text-xs">&lt; SALIR</button>

      {/* MODAL 1: RESCATE */}
      {bailoutRequest && (
        <div className="absolute inset-0 z-50 bg-black bg-opacity-95 flex flex-col items-center justify-center p-6 border-4 border-gold">
           <h3 className="text-gold font-pixel text-lg mb-2 text-center">SOLICITUD DE AYUDA</h3>
           <p className="text-white text-center mb-1 font-terminal">
             <span className="text-blue-400 font-bold">{bailoutRequest.targetName}</span> está en quiebra.
           </p>
           <p className="text-danger mb-4 text-sm">Deuda: {Math.abs(bailoutRequest.debt)} + 10</p>
           
           <div className="flex flex-col gap-3 w-full">
              {amILeader && (
                  <button onClick={() => handleBailoutAction('PUBLIC_BAILOUT')} className="bg-farm-green text-black py-3 font-pixel text-xs border-b-4 border-green-900">
                    🏛️ RESCATE PÚBLICO
                  </button>
              )}
              <button onClick={() => handleBailoutAction('PRIVATE_RESCUE')} disabled={myStash < (Math.abs(bailoutRequest.debt) + 10)} className="bg-gold text-black py-3 font-pixel text-xs border-b-4 border-yellow-700 disabled:opacity-50">
                 🤝 RESCATE PRIVADO (+REP)
              </button>
              {amILeader && (
                  <button onClick={() => handleBailoutAction('EXPEL')} className="bg-danger text-white py-3 font-pixel text-xs border-b-4 border-red-900">
                    💀 DENEGAR (Exiliar)
                  </button>
              )}
           </div>
        </div>
      )}

      {/* MODAL 2: TRIBUNAL */}
      {voteSession && voteSession.isOpen && (
        <div className="absolute inset-0 z-50 bg-black bg-opacity-95 flex flex-col items-center justify-center p-6 border-4 border-gold">
           <h3 className="text-gold font-pixel text-xl mb-4 text-center">TRIBUNAL</h3>
           <p className="text-white text-center mb-4">{voteSession.accusedBy} acusa a <span className="text-danger font-bold">{voteSession.targetName}</span></p>
           
           <div className="grid grid-cols-2 gap-2 w-full mb-4">
              <button onClick={() => finalizeVote('YES')} className="bg-danger text-white py-2 font-pixel text-xs">CULPABLE</button>
              <button onClick={() => finalizeVote('NO')} className="bg-blue-600 text-white py-2 font-pixel text-xs">INOCENTE</button>
              <button onClick={() => finalizeVote('ABSTAIN')} className="bg-gray-600 text-white py-2 font-pixel text-xs col-span-2">ABSTENER</button>
           </div>
           
           <div className="border-t border-gray-700 pt-4 w-full">
              <button 
                 onClick={payBailoutInTrial} 
                 disabled={myStash < voteSession.bailCost}
                 className="w-full bg-gold text-black font-pixel py-3 text-xs disabled:opacity-50 hover:scale-105"
              >
                 💸 PAGAR FIANZA (-{voteSession.bailCost})
                 <br/><span className="text-[8px] opacity-70">Anula juicio / Ganas Reputación</span>
              </button>
           </div>
        </div>
      )}

      {/* MODAL 3: ELEGIR SOSPECHOSO */}
      {showSuspects && (
         <div className="absolute inset-0 z-50 bg-black bg-opacity-95 p-6 border-4 border-gold">
            <h3 className="text-gold font-pixel text-center mb-4">ELEGIR ACUSADO</h3>
            <div className="h-64 overflow-y-auto">
               {bots.filter(b => !b.isDead && b.reputation < 50).map(b => (
                  <button key={b.id} onClick={() => startVoteAgainst(b.id, b.name, 'TÚ')} className="w-full text-left p-2 border-b border-gray-700 hover:bg-gray-800 text-danger font-terminal">
                     {b.name} (Rep: {b.reputation}%)
                  </button>
               ))}
            </div>
            <button onClick={() => {setShowSuspects(false); setIsRunning(true);}} className="mt-4 w-full bg-gray-600 text-white py-2 font-pixel">CANCELAR</button>
         </div>
      )}

      <div className="border-4 border-soil p-4 bg-black shadow-2xl">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
          <p className="font-pixel text-xl text-white">DÍA {day}</p>
          <div className="text-right">
             <p className={`text-xs font-pixel ${amIExpelled ? 'text-danger' : 'text-green-400'}`}>
               {amIExpelled ? 'EXPULSADO' : myStash < 0 ? 'EN QUIEBRA' : 'ACTIVO'}
             </p>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-2 mb-4 font-terminal text-center">
            <div className="bg-gray-900 p-2 rounded border border-gray-700">
               <span className="text-[10px] text-gray-400 block">SILO</span>
               <span className={`${publicSilo < (activePopulation * 10) ? 'text-danger animate-pulse' : 'text-farm-green'} text-lg`}>{publicSilo}</span>
            </div>
            <div className="bg-gray-900 p-2 rounded border border-gray-700">
               <span className="text-[10px] text-gray-400 block">COSTO VIDA</span>
               <span className="text-danger text-lg">-{costOfLiving}</span>
            </div>
            <div className="bg-gray-900 p-2 rounded border border-gray-700">
               <span className="text-[10px] text-gray-400 block">TU DINERO</span>
               <span className={`text-lg ${myStash < 0 ? 'text-danger animate-pulse' : 'text-gold'}`}>{myStash}</span>
            </div>
        </div>

        {/* TABS (CON LÍDER) */}
        <div className="flex border-b-2 border-soil mb-4 overflow-x-auto">
          {['ACTIONS', 'STATS', 'NEWS', 'RANKING'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 font-pixel text-[10px] py-2 px-1 ${activeTab === tab ? 'bg-soil text-white' : 'text-gray-500'}`}>{tab}</button>
          ))}
          {amITopRep && (
             <button onClick={() => setActiveTab('LEADER')} className={`flex-1 font-pixel text-[10px] py-2 px-1 ${activeTab === 'LEADER' ? 'bg-gold text-black' : 'text-gold'}`}>LÍDER</button>
          )}
        </div>

        {/* CONTENIDO TABS */}
        <div className="h-64 overflow-y-auto mb-4 relative custom-scrollbar">
            {activeTab === 'ACTIONS' && (
              <div className="flex flex-col gap-3 h-full justify-center">
                 {amIExpelled ? (
                   <p className="text-danger text-center font-pixel">ESTÁS EXILIADO</p>
                 ) : myStash < 0 ? (
                    <div className="text-center">
                       <p className="text-danger font-bold mb-4">¡ESTÁS EN BANCARROTA!</p>
                       <button onClick={() => { addNews("📢 Solicitando rescate..."); }} className="bg-blue-600 text-white font-pixel py-3 px-6 hover:scale-105 animate-pulse">
                          🆘 PEDIR RESCATE
                       </button>
                    </div>
                 ) : hasActed ? (
                    <div className="text-center text-gray-500 font-terminal p-8 border-2 border-dashed border-gray-800">
                       <p>Jornada terminada.</p>
                       <p className="text-xs text-farm-green mt-1">Ingreso automático activo (+2)</p>
                    </div>
                 ) : (
                    <>
                      <button onClick={() => handleAction('COLLABORATE')} className="bg-farm-green text-black font-pixel py-3 hover:scale-105 text-left px-4 group relative">
                        <div className="relative z-10 flex justify-between items-center w-full">
                           <span className="text-sm">🤝 COLABORAR</span><span className="text-[10px] bg-black text-white px-2 py-1 rounded">+REP</span>
                        </div>
                        <div className="relative z-10 text-[10px] opacity-70 mt-1 font-terminal">+25 Silo / +5 Tú</div>
                      </button>

                      <button onClick={() => handleAction('PRIVATE')} className="bg-yellow-600 text-black font-pixel py-3 hover:scale-105 text-left px-4 relative">
                         <div className="relative z-10 flex justify-between items-center w-full">
                           <span className="text-sm">🏠 TRABAJO PROPIO</span><span className="text-[10px] bg-black text-white px-2 py-1 rounded">=REP</span>
                        </div>
                        <div className="relative z-10 text-[10px] opacity-70 mt-1 font-terminal">+0 Silo / +15 Tú</div>
                      </button>

                      <button onClick={() => handleAction('STEAL')} className="bg-red-600 text-white font-pixel py-3 hover:scale-105 text-left px-4 group relative">
                         <div className="relative z-10 flex justify-between items-center w-full">
                           <span className="text-sm">😈 ROBAR</span><span className="text-[10px] bg-black text-white px-2 py-1 rounded">-REP</span>
                        </div>
                        <div className="relative z-10 text-[10px] opacity-80 mt-1 font-terminal">-40 Silo / +40 Tú</div>
                      </button>
                    </>
                 )}
              </div>
            )}

            {/* TAB DE LÍDER */}
            {activeTab === 'LEADER' && amITopRep && (
               <div className="flex flex-col gap-4 p-4 items-center justify-center h-full border border-gold bg-gray-900">
                  <h3 className="text-gold font-pixel text-center">FUNCIONES DE ÉLITE</h3>
                  <p className="text-gray-400 text-center font-terminal text-xs">Como líder moral (Top 3 Rep), tienes autoridad especial.</p>
                  
                  <button onClick={() => { setIsRunning(false); setShowSuspects(true); }} className="w-full bg-purple-800 text-white font-pixel py-4 border-2 border-purple-500 hover:scale-105 shadow-[0_0_15px_rgba(128,0,128,0.5)]">
                     ⚖️ INICIAR JUICIO
                     <br/><span className="text-[10px] opacity-70 font-terminal">Acusar a ciudadanos sospechosos</span>
                  </button>
               </div>
            )}

            {activeTab === 'STATS' && (
               <div className="font-terminal space-y-4 p-2">
                  <div className="bg-gray-900 p-3 border border-gray-700">
                     <p className="text-xs text-gray-400 mb-1">COEFICIENTE GINI</p>
                     <p className="text-white text-sm">Top 10% posee: <span className="text-gold font-bold">{inequalityPercentage}%</span></p>
                  </div>
                  <div className="bg-gray-900 p-3 border border-gray-700 flex justify-between items-center">
                     <span className="text-xs text-gray-400">INFLACIÓN</span>
                     <span className={`font-bold ${parseFloat(inflation) > 1.5 ? 'text-danger' : 'text-white'}`}>{inflation}x</span>
                  </div>
               </div>
            )}

            {activeTab === 'NEWS' && (
               <div className="font-terminal text-xs space-y-2 p-2">
                 {newsLog.map((msg, i) => (
                   <div key={i} className="p-2 border-b border-gray-800 text-gray-300">{msg}</div>
                 ))}
               </div>
            )}

            {activeTab === 'RANKING' && (
               <table className="w-full font-terminal text-sm text-left">
                  <thead className="text-gray-500 border-b border-gray-700 sticky top-0 bg-black">
                     <tr><th className="pb-2 pl-2">#</th><th>CIUDADANO</th><th className="text-right">REP</th><th className="text-right pr-2">$$$</th></tr>
                  </thead>
                  <tbody>
                     {[...bots, {id:999, name:'TÚ', reputation:myReputation, stash:myStash, isDead:amIExpelled, isMe:true}].filter(p => !p.isDead).sort((a,b) => b.reputation - a.reputation).map((player, index) => (
                        <tr key={player.id} className={`border-b border-gray-900 ${player.isMe ? 'text-gold bg-gray-900' : 'text-gray-300'}`}>
                           <td className="py-2 pl-2">{index + 1}</td>
                           <td className="py-2">{player.isMe ? '⭐ TÚ' : player.name}</td>
                           <td className={`py-2 text-right ${player.reputation < 30 ? 'text-danger' : 'text-farm-green'}`}>{player.reputation}%</td>
                           <td className="py-2 text-right pr-2 font-mono">{player.isMe ? player.stash : '🔒???'}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            )}
        </div>

        <div className="flex gap-2 justify-center border-t border-gray-700 pt-4">
          <button disabled={amIExpelled} onClick={() => setIsRunning(!isRunning)} className={`font-pixel text-xs border border-gray-500 px-4 py-2 hover:bg-gray-800 ${isRunning ? 'text-danger' : 'text-white'} disabled:opacity-50`}>
            {isRunning ? '⏸ PAUSAR' : '▶ INICIAR'}
          </button>
          <button onClick={() => setSpeed(speed === 2000 ? 200 : 2000)} className="text-gold font-pixel text-xs border border-gold px-4 py-2 hover:bg-gray-800">
            {speed === 2000 ? '⏩ VELOCIDAD x10' : '🐌 NORMAL'}
          </button>
        </div>

      </div>
    </div>
  );
}

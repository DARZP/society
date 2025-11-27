import { useState, useEffect, useRef } from 'react';

// --- TIPOS DE DATOS ---
interface PlayerStats {
  stole: number;
  collaborated: number;
  private: number;
}

interface BotPlayer {
  id: number;
  name: string;
  reputation: number;
  stash: number;
  stats: PlayerStats;
  isDead: boolean; // Para saber si fue expulsado
}

interface VoteSession {
  targetId: number;
  targetName: string;
  accusedBy: string;
  votesFor: number;
  votesAgainst: number;
  isOpen: boolean;
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
  const [myStats, setMyStats] = useState<PlayerStats>({ stole: 0, collaborated: 0, private: 0 });
  const [amIExpelled, setAmIExpelled] = useState(false);
  
  // --- UI & SISTEMAS ---
  const [hasActed, setHasActed] = useState(false);
  const [activeTab, setActiveTab] = useState<'ACTIONS' | 'RANKING' | 'STATS' | 'NEWS'>('ACTIONS');
  const [newsLog, setNewsLog] = useState<string[]>([]);
  const [voteSession, setVoteSession] = useState<VoteSession | null>(null);

  // --- MOTORES ---
  const [bots, setBots] = useState<BotPlayer[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(2000);

  // Referencias para el intervalo (evitar cierres obsoletos)
  const stateRef = useRef({ bots, myReputation, myStash, publicSilo, hasActed, amIExpelled });
  useEffect(() => {
    stateRef.current = { bots, myReputation, myStash, publicSilo, hasActed, amIExpelled };
  }, [bots, myReputation, myStash, publicSilo, hasActed, amIExpelled]);

  // --- CÁLCULOS EN TIEMPO REAL ---
  const activePopulation = bots.filter(b => !b.isDead).length + (amIExpelled ? 0 : 1);
  const inflationThreshold = activePopulation * 10;
  const inflation = Math.max(1, inflationThreshold / (publicSilo + 1)).toFixed(2);
  const costOfLiving = Math.floor(5 * parseFloat(inflation));

  // --- CÁLCULOS GINI (Restaurado) ---
  const activeBots = bots.filter(b => !b.isDead);
  const totalPrivateWealth = activeBots.reduce((acc, bot) => acc + bot.stash, 0) + (amIExpelled ? 0 : myStash);
  const totalResources = publicSilo + totalPrivateWealth;
  const publicRatio = ((publicSilo / (totalResources || 1)) * 100).toFixed(1);
  
  const allStashes = [...activeBots.map(b => b.stash), (amIExpelled ? 0 : myStash)].sort((a, b) => b - a);
  const top10Count = Math.ceil(allStashes.length * 0.1);
  const wealthTop10 = allStashes.slice(0, top10Count).reduce((a, b) => a + b, 0);
  const inequalityPercentage = ((wealthTop10 / (totalPrivateWealth || 1)) * 100).toFixed(1);

  // --- HELPERS ---
  const addNews = (msg: string) => {
    setNewsLog(prev => [`Día ${day}: ${msg}`, ...prev].slice(0, 20)); // Guardar últimos 20
  };

  // 1. INICIAR JUEGO
  const startGame = () => {
    const newBots: BotPlayer[] = Array.from({ length: botCount }).map((_, i) => ({
      id: i,
      name: `Ciudadano #${i + 1}`,
      reputation: Math.floor(Math.random() * 40) + 40,
      stash: Math.floor(Math.random() * 20) + 10,
      stats: { stole: 0, collaborated: 0, private: 0 },
      isDead: false
    }));
    setBots(newBots);
    setPublicSilo(botCount * 50); 
    setGamePhase('PLAYING');
    setDay(1);
    setMyStats({ stole: 0, collaborated: 0, private: 0 });
    setMyReputation(50);
    setMyStash(50);
    setAmIExpelled(false);
    setNewsLog(["Bienvenido a la simulación. La sociedad inicia hoy."]);
    setIsRunning(false);
    setHasActed(false);
  };

  // 2. SISTEMA DE VOTACIÓN (El Tribunal)
  const triggerVoting = () => {
    const { bots, myReputation, amIExpelled } = stateRef.current;
    const aliveBots = bots.filter(b => !b.isDead);
    
    // Solo el Top 3 de Reputación puede iniciar juicios
    const judges = [...aliveBots].sort((a,b) => b.reputation - a.reputation).slice(0, 3);
    const judge = judges[Math.floor(Math.random() * judges.length)];

    if (!judge) return;

    // Buscan a alguien con mala reputación (< 20)
    let targetId = -1;
    let targetName = "";
    
    // ¿Odian al jugador?
    if (!amIExpelled && myReputation < 20 && Math.random() > 0.5) {
      targetId = 999;
      targetName = "TÚ";
    } else {
      // Odian a un bot
      const criminals = aliveBots.filter(b => b.reputation < 20 && b.id !== judge.id);
      if (criminals.length > 0) {
        const victim = criminals[Math.floor(Math.random() * criminals.length)];
        targetId = victim.id;
        targetName = victim.name;
      }
    }

    if (targetName !== "") {
      setIsRunning(false); // PAUSAR JUEGO
      setVoteSession({
        targetId,
        targetName,
        accusedBy: judge.name,
        votesFor: 0, 
        votesAgainst: 0,
        isOpen: true
      });
      addNews(`⚖️ JUICIO INICIADO: ${judge.name} acusa a ${targetName} de traición.`);
    }
  };

  const finalizeVote = (playerVote: 'YES' | 'NO' | 'ABSTAIN') => {
    if (!voteSession) return;
    
    // Simular votos de los bots
    const { bots } = stateRef.current;
    let yes = 0;
    let no = 0;

    // El voto del jugador
    if (playerVote === 'YES') yes++;
    else if (playerVote === 'NO') no++;

    // Los bots votan: Si tienen buena reputación, suelen votar SÍ para castigar a los malos
    bots.filter(b => !b.isDead && b.id !== voteSession.targetId).forEach(bot => {
       // Si el acusado tiene muy mala reputación, votan que SÍ
       // Factor aleatorio de "Justicia"
       if (Math.random() > 0.3) yes++; else no++;
    });

    const passed = yes > no;
    
    if (passed) {
      // EJECUTAR EXPULSIÓN
      let confiscated = 0;
      if (voteSession.targetId === 999) {
        setAmIExpelled(true);
        confiscated = stateRef.current.myStash;
        setMyStash(0);
        addNews(`🛑 HAS SIDO EXPULSADO. Tu fortuna (${confiscated}) fue al Silo.`);
      } else {
        setBots(prev => prev.map(b => {
          if (b.id === voteSession.targetId) {
            confiscated = b.stash;
            return { ...b, isDead: true, stash: 0 };
          }
          return b;
        }));
        addNews(`🔨 ${voteSession.targetName} fue expulsado. Se incautaron ${confiscated} recursos.`);
      }
      setPublicSilo(s => s + confiscated);
    } else {
      addNews(`🛡️ ${voteSession.targetName} fue declarado INOCENTE. (Votos: ${yes} vs ${no})`);
    }

    setVoteSession(null);
    setIsRunning(true); // REANUDAR
  };


  // 3. MOTOR DEL TIEMPO
  useEffect(() => {
    let interval: any;

    if (isRunning && gamePhase === 'PLAYING') {
      interval = setInterval(() => {
        const currentData = stateRef.current;
        
        // --- AUTO-COLABORACIÓN (Si se pasó el día) ---
        if (!currentData.hasActed && !currentData.amIExpelled) {
           // Si no hiciste clic, colaboras automáticamente (pero con menos recompensa)
           setPublicSilo(s => s + 25);
           setMyStash(s => s + 2); // Menos ganancia que haciéndolo manual
           setMyReputation(r => Math.min(100, r + 2)); 
           setMyStats(s => ({ ...s, collaborated: s.collaborated + 1 }));
           // No notificamos para no spamear, pero sucede.
        }

        // --- AVANZAR DÍA ---
        setDay(d => d + 1);
        setHasActed(false);

        // A. EVENTOS ALEATORIOS (Noticias)
        const rand = Math.random();
        if (rand > 0.95) addNews("📢 Rumor: Se están formando sindicatos de acaparadores.");
        if (parseFloat(inflation) > 3 && rand > 0.8) addNews("📈 La inflación está fuera de control.");
        if (parseFloat(inequalityPercentage) > 60 && rand > 0.8) addNews("⚠️ La brecha entre ricos y pobres es crítica.");
        if (rand < 0.05) addNews("👮 La policía investiga almacenes ilegales.");

        // B. POSIBLE VOTACIÓN (10% de probabilidad por día si no hay colapso)
        if (Math.random() < 0.15) {
          triggerVoting();
        }

        // C. COBRO DE VIDA
        if (!currentData.amIExpelled) setMyStash(prev => prev - costOfLiving);

        // D. SIMULACIÓN BOTS
        setBots(currentBots => currentBots.map(bot => {
          if (bot.isDead) return bot;

          let currentStash = bot.stash - costOfLiving;
          let currentStats = { ...bot.stats };
          
          const corruptFactor = (100 - bot.reputation) / 100;
          const roll = Math.random();
          let decision = 'COLLABORATE'; 
          
          if (roll < (0.1 + (corruptFactor * 0.4))) decision = 'STEAL'; 
          else if (roll > 0.8) decision = 'PRIVATE';

          let newRep = bot.reputation;

          if (decision === 'STEAL') {
             currentStash += 30;
             setPublicSilo(s => s - 30); 
             newRep -= 3;
             currentStats.stole += 1;
          } else if (decision === 'PRIVATE') {
             currentStash += 15;
             currentStats.private += 1;
          } else {
             setPublicSilo(s => s + 8); 
             newRep += 1;
             currentStats.collaborated += 1;
          }

          return { 
            ...bot, 
            reputation: Math.max(0, Math.min(100, newRep)), 
            stash: currentStash,
            stats: currentStats
          };
        }));

        // E. COLAPSO
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
  }, [isRunning, speed, gamePhase, costOfLiving, inflation, inequalityPercentage]);


  // 4. ACCIONES MANUALES JUGADOR
  const handleAction = (type: 'COLLABORATE' | 'PRIVATE' | 'STEAL') => {
    if (publicSilo <= 0 || hasActed || amIExpelled) return;

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


  // --- RENDERIZADO: SETUP ---
  if (gamePhase === 'SETUP') {
    return (
      <div className="w-full max-w-md relative mt-10 text-center">
         <button onClick={onBack} className="absolute -top-10 left-0 text-white underline font-pixel text-xs">&lt; ATRÁS</button>
         <div className="border-4 border-farm-green p-8 bg-black bg-opacity-90">
            <h2 className="font-pixel text-gold text-xl mb-6">NUEVA SOCIEDAD</h2>
            <label className="block text-farm-green font-terminal mb-2">POBLACIÓN (BOTS)</label>
            <input type="range" min="10" max="200" step="10" value={botCount} onChange={(e) => setBotCount(parseInt(e.target.value))} className="w-full mb-4 accent-farm-green cursor-pointer"/>
            <p className="text-white font-pixel text-2xl mb-8">{botCount}</p>
            <button onClick={startGame} className="bg-farm-green text-black font-pixel py-4 w-full hover:scale-105 transition-transform">COMENZAR SIMULACIÓN</button>
         </div>
      </div>
    );
  }

  const allPlayers = [
    { id: 999, name: 'TÚ (JUGADOR)', reputation: myReputation, stash: myStash, stats: myStats, isMe: true, isDead: amIExpelled },
    ...bots
  ];

  // --- RENDERIZADO: GAME OVER ---
  if (gamePhase === 'GAMEOVER') {
    const richest = [...allPlayers].sort((a,b) => b.stash - a.stash)[0];
    const biggestThief = [...allPlayers].sort((a,b) => b.stats.stole - a.stats.stole)[0];
    const mostCollaborative = [...allPlayers].sort((a,b) => b.stats.collaborated - a.stats.collaborated)[0];
    const finalRanking = [...allPlayers].sort((a, b) => b.stash - a.stash);

    return (
      <div className="w-full max-w-md relative mt-8 animate-fade-in">
        <div className="border-4 border-danger p-4 bg-black shadow-2xl">
          <h2 className="text-center text-danger font-pixel text-2xl mb-2 animate-pulse">SOCIEDAD COLAPSADA</h2>
          <p className="text-center text-white font-pixel text-lg mb-6">SOBREVIVISTE {day} DÍAS</p>

          <div className="grid grid-cols-3 gap-2 mb-6 text-center font-terminal text-xs">
             <div className="bg-gray-900 p-2 border border-gold">
                <p className="text-gold mb-1">💰 MAGNATE</p>
                <p className="text-white font-bold">{richest.name}</p>
                <p className="text-gold">{richest.stash}</p>
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

          <div className="h-64 overflow-y-auto border border-gray-700 custom-scrollbar">
             <table className="w-full font-terminal text-sm text-left">
                  <thead className="bg-danger text-black sticky top-0">
                     <tr>
                        <th className="pl-2">#</th>
                        <th>NOMBRE</th>
                        <th className="text-right">ROBOS</th>
                        <th className="text-right pr-2">$$$</th>
                     </tr>
                  </thead>
                  <tbody>
                     {finalRanking.map((p, i) => (
                        <tr key={p.id} className={`border-b border-gray-800 ${p.isMe ? 'bg-gray-800 text-gold' : 'text-gray-300'} ${p.isDead ? 'opacity-50 line-through' : ''}`}>
                           <td className="pl-2 py-2">{i+1}</td>
                           <td>{p.name} {p.isDead && '(💀)'}</td>
                           <td className="text-right text-red-400">{p.stats.stole}</td>
                           <td className="text-right pr-2 font-bold">{p.stash}</td>
                        </tr>
                     ))}
                  </tbody>
             </table>
          </div>
          <button onClick={() => setGamePhase('SETUP')} className="mt-4 w-full bg-white text-black font-pixel py-3 hover:bg-gray-300">INTENTAR DE NUEVO</button>
        </div>
      </div>
    );
  }

  // --- RENDERIZADO: JUEGO ---
  const leaderboard = [...allPlayers].filter(p => !p.isDead).sort((a, b) => b.reputation - a.reputation);

  return (
    <div className="w-full max-w-md relative mt-8">
      <button onClick={onBack} className="absolute -top-10 left-0 text-soil hover:text-white underline font-pixel text-xs">&lt; SALIR</button>

      {/* MODAL DE VOTACIÓN (OVERLAY) */}
      {voteSession && voteSession.isOpen && (
        <div className="absolute inset-0 z-50 bg-black bg-opacity-95 flex flex-col items-center justify-center p-6 border-4 border-gold animate-bounce-in">
           <h3 className="text-gold font-pixel text-xl mb-4 text-center">⚖️ TRIBUNAL SOCIAL</h3>
           <p className="text-white font-terminal text-center mb-2">
             El ciudadano <span className="text-blue-400 font-bold">{voteSession.accusedBy}</span> ha solicitado la expulsión de:
           </p>
           <p className="text-danger font-pixel text-2xl mb-6">{voteSession.targetName}</p>
           
           <p className="text-gray-400 text-xs mb-6 text-center">Si es expulsado, sus bienes serán confiscados por la comunidad.</p>

           <div className="grid grid-cols-3 gap-4 w-full">
              <button onClick={() => finalizeVote('YES')} className="bg-danger text-white font-pixel py-3 hover:scale-110">SÍ (Fuera)</button>
              <button onClick={() => finalizeVote('ABSTAIN')} className="bg-gray-600 text-white font-pixel py-3 hover:scale-110">ABSTENER</button>
              <button onClick={() => finalizeVote('NO')} className="bg-blue-600 text-white font-pixel py-3 hover:scale-110">NO (Salvar)</button>
           </div>
        </div>
      )}

      <div className="border-4 border-soil p-4 bg-black shadow-2xl transition-colors duration-500">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
          <p className="font-pixel text-xl text-white">DÍA {day}</p>
          <div className="text-right">
             <p className={`text-xs font-pixel ${hasActed ? 'text-gray-500' : 'text-green-400 animate-pulse'}`}>
               {amIExpelled ? '💀 EXPULSADO' : hasActed ? '💤 AUTO-PILOTO' : '⚡ TU TURNO'}
             </p>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-2 mb-4 font-terminal text-center">
            <div className="bg-gray-900 p-2 rounded border border-gray-700">
               <span className="text-[10px] text-gray-400 block">SILO PÚBLICO</span>
               <span className={`${publicSilo < (activePopulation * 10) ? 'text-danger animate-pulse' : 'text-farm-green'} text-lg`}>{publicSilo}</span>
            </div>
            <div className="bg-gray-900 p-2 rounded border border-gray-700">
               <span className="text-[10px] text-gray-400 block">COSTO VIDA</span>
               <span className="text-danger text-lg">-{costOfLiving}</span>
            </div>
            <div className="bg-gray-900 p-2 rounded border border-gray-700">
               <span className="text-[10px] text-gray-400 block">TU DINERO</span>
               <span className="text-gold text-lg">{myStash}</span>
            </div>
        </div>

        {/* TABS */}
        <div className="flex border-b-2 border-soil mb-4 overflow-x-auto">
          <button onClick={() => setActiveTab('ACTIONS')} className={`flex-1 font-pixel text-[10px] py-2 px-1 ${activeTab === 'ACTIONS' ? 'bg-soil text-white' : 'text-gray-500'}`}>ACCIONES</button>
          <button onClick={() => setActiveTab('STATS')} className={`flex-1 font-pixel text-[10px] py-2 px-1 ${activeTab === 'STATS' ? 'bg-soil text-white' : 'text-gray-500'}`}>DATOS</button>
          <button onClick={() => setActiveTab('NEWS')} className={`flex-1 font-pixel text-[10px] py-2 px-1 ${activeTab === 'NEWS' ? 'bg-soil text-white' : 'text-gray-500'}`}>NOTICIAS</button>
          <button onClick={() => setActiveTab('RANKING')} className={`flex-1 font-pixel text-[10px] py-2 px-1 ${activeTab === 'RANKING' ? 'bg-soil text-white' : 'text-gray-500'}`}>RANKING</button>
        </div>

        {/* CONTENIDO TABS */}
        <div className="h-64 overflow-y-auto mb-4 relative custom-scrollbar">
            
            {activeTab === 'ACTIONS' && (
              <div className="flex flex-col gap-3 h-full justify-center">
                 {amIExpelled ? (
                   <div className="text-center text-danger font-pixel p-8 border border-danger">
                      HAS SIDO EXPULSADO DE LA SOCIEDAD.
                      <p className="text-xs text-gray-400 mt-2">Solo puedes observar el colapso.</p>
                   </div>
                 ) : hasActed ? (
                    <div className="text-center text-gray-500 font-terminal border-2 border-dashed border-gray-800 p-8">
                       <p>Jornada finalizada.</p>
                       <p className="text-xs mt-2 text-farm-green">Esperando nuevo día...</p>
                    </div>
                 ) : (
                    <>
                      <button onClick={() => handleAction('COLLABORATE')} className="bg-farm-green text-black font-pixel py-3 hover:scale-105 transition-transform text-left px-4 group relative overflow-hidden">
                        <div className="relative z-10 flex justify-between items-center w-full">
                           <span className="text-sm">🤝 COLABORAR</span>
                           <span className="text-[10px] bg-black text-white px-2 py-1 rounded group-hover:bg-white group-hover:text-black">+REP</span>
                        </div>
                        <div className="relative z-10 text-[10px] opacity-70 mt-1 font-terminal">Aportas +25 al Silo / Ganas +5 Tú</div>
                      </button>

                      <button onClick={() => handleAction('PRIVATE')} className="bg-yellow-600 text-black font-pixel py-3 hover:scale-105 transition-transform text-left px-4 relative overflow-hidden">
                         <div className="relative z-10 flex justify-between items-center w-full">
                           <span className="text-sm">🏠 TRABAJO PROPIO</span>
                           <span className="text-[10px] bg-black text-white px-2 py-1 rounded">=REP</span>
                        </div>
                        <div className="relative z-10 text-[10px] opacity-70 mt-1 font-terminal">Aportas +0 al Silo / Ganas +15 Tú</div>
                      </button>

                      <button onClick={() => handleAction('STEAL')} className="bg-red-600 text-white font-pixel py-3 hover:scale-105 transition-transform text-left px-4 group relative overflow-hidden">
                         <div className="relative z-10 flex justify-between items-center w-full">
                           <span className="text-sm">😈 ROBAR ALMACÉN</span>
                           <span className="text-[10px] bg-black text-white px-2 py-1 rounded group-hover:bg-red-900">-REP</span>
                        </div>
                        <div className="relative z-10 text-[10px] opacity-80 mt-1 font-terminal text-red-200">Dañas -40 al Silo / Ganas +40 Tú</div>
                      </button>
                    </>
                 )}
              </div>
            )}

            {activeTab === 'STATS' && (
               <div className="font-terminal space-y-4 p-2">
                  <div className="bg-gray-900 p-3 border border-gray-700">
                     <p className="text-xs text-gray-400 mb-1">DISTRIBUCIÓN DE RIQUEZA</p>
                     <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden flex">
                        <div style={{ width: `${publicRatio}%` }} className="bg-farm-green h-full"></div>
                        <div style={{ width: `${100 - parseFloat(publicRatio)}%` }} className="bg-gold h-full"></div>
                     </div>
                     <div className="flex justify-between text-xs mt-1">
                        <span className="text-farm-green">PÚBLICO ({publicRatio}%)</span>
                        <span className="text-gold">PRIVADO</span>
                     </div>
                  </div>
                  <div className="bg-gray-900 p-3 border border-gray-700">
                     <p className="text-xs text-gray-400 mb-1">COEFICIENTE GINI (DESIGUALDAD)</p>
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
                 {newsLog.length === 0 && <p className="text-gray-500 text-center italic">Sin novedades.</p>}
                 {newsLog.map((msg, i) => (
                   <div key={i} className={`p-2 border-b border-gray-800 ${msg.includes('JUICIO') ? 'text-gold' : msg.includes('EXPULSADO') ? 'text-danger' : 'text-gray-300'}`}>
                     {msg}
                   </div>
                 ))}
               </div>
            )}

            {activeTab === 'RANKING' && (
               <table className="w-full font-terminal text-sm text-left">
                  <thead className="text-gray-500 border-b border-gray-700 sticky top-0 bg-black">
                     <tr><th className="pb-2 pl-2">#</th><th>CIUDADANO</th><th className="text-right">REP</th><th className="text-right pr-2">$$$</th></tr>
                  </thead>
                  <tbody>
                     {leaderboard.map((player, index) => (
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

        {/* CONTROLES */}
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

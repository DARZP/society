import { useState, useEffect } from 'react';

// Interfaz mejorada para guardar historial
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
  stats: PlayerStats; // Historial de acciones del bot
}

export default function OfflineSimulator({ onBack }: { onBack: () => void }) {
  // --- FASES ---
  const [gamePhase, setGamePhase] = useState<'SETUP' | 'PLAYING' | 'GAMEOVER'>('SETUP');
  const [botCount, setBotCount] = useState(50);
  
  // --- MUNDO ---
  const [day, setDay] = useState(1);
  const [publicSilo, setPublicSilo] = useState(1000);
  
  // --- TU JUGADOR ---
  const [myStash, setMyStash] = useState(50);
  const [myReputation, setMyReputation] = useState(50);
  const [myStats, setMyStats] = useState<PlayerStats>({ stole: 0, collaborated: 0, private: 0 });
  
  // --- UI ---
  const [hasActed, setHasActed] = useState(false);
  const [activeTab, setActiveTab] = useState<'ACTIONS' | 'RANKING' | 'STATS'>('ACTIONS');

  // --- MOTORES ---
  const [bots, setBots] = useState<BotPlayer[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(2000);

  // --- CÁLCULOS ---
  const inflationThreshold = (botCount + 1) * 10;
  const inflation = Math.max(1, inflationThreshold / (publicSilo + 1)).toFixed(2);
  const costOfLiving = Math.floor(5 * parseFloat(inflation));

  // --- INFO GRÁFICA ---
  const totalPrivateWealth = bots.reduce((acc, bot) => acc + bot.stash, 0) + myStash;
  const totalResources = publicSilo + totalPrivateWealth;
  const publicRatio = ((publicSilo / (totalResources || 1)) * 100).toFixed(1);

  // 1. INICIAR
  const startGame = () => {
    const newBots: BotPlayer[] = Array.from({ length: botCount }).map((_, i) => ({
      id: i,
      name: `Ciudadano #${i + 1}`,
      reputation: Math.floor(Math.random() * 40) + 40,
      stash: Math.floor(Math.random() * 20) + 10,
      stats: { stole: 0, collaborated: 0, private: 0 }
    }));
    setBots(newBots);
    setPublicSilo(botCount * 50); 
    setGamePhase('PLAYING');
    setDay(1);
    setMyStats({ stole: 0, collaborated: 0, private: 0 });
    setMyReputation(50);
    setMyStash(50);
    setIsRunning(false);
  };

  // 2. MOTOR DEL TIEMPO
  useEffect(() => {
    let interval: any;

    if (isRunning && gamePhase === 'PLAYING') {
      interval = setInterval(() => {
        setDay(d => d + 1);
        setHasActed(false);

        // A. Cobrar al Jugador
        setMyStash(prev => prev - costOfLiving);

        // B. Simular Bots (con rastreo de stats)
        setBots(currentBots => currentBots.map(bot => {
          let currentStash = bot.stash - costOfLiving;
          let currentStats = { ...bot.stats };
          
          const corruptFactor = (100 - bot.reputation) / 100;
          const roll = Math.random();
          let decision = 'COLLABORATE'; // Default
          
          // Lógica de decisión
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

        // C. Verificar Colapso
        setPublicSilo(prev => {
          if (prev <= 0) {
            setIsRunning(false);
            setGamePhase('GAMEOVER'); // ¡Disparamos el final!
            return 0;
          }
          return prev;
        });

      }, speed);
    }
    return () => clearInterval(interval);
  }, [isRunning, speed, gamePhase, costOfLiving, botCount]);

  // 3. ACCIONES JUGADOR (Con info y rastreo)
  const handleAction = (type: 'COLLABORATE' | 'PRIVATE' | 'STEAL') => {
    if (publicSilo <= 0 || hasActed) return;

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

  // --- RENDERIZADO: CONFIGURACIÓN ---
  if (gamePhase === 'SETUP') {
    return (
      <div className="w-full max-w-md relative mt-10 text-center">
         <button onClick={onBack} className="absolute -top-10 left-0 text-white underline font-pixel text-xs">&lt; ATRÁS</button>
         <div className="border-4 border-farm-green p-8 bg-black bg-opacity-90">
            <h2 className="font-pixel text-gold text-xl mb-6">NUEVA SIMULACIÓN</h2>
            <label className="block text-farm-green font-terminal mb-2">POBLACIÓN (BOTS)</label>
            <input type="range" min="10" max="200" step="10" value={botCount} onChange={(e) => setBotCount(parseInt(e.target.value))} className="w-full mb-4 accent-farm-green cursor-pointer"/>
            <p className="text-white font-pixel text-2xl mb-8">{botCount}</p>
            <button onClick={startGame} className="bg-farm-green text-black font-pixel py-4 w-full hover:scale-105 transition-transform">COMENZAR</button>
         </div>
      </div>
    );
  }

  // LISTA UNIFICADA (Para el juego y el final)
  const allPlayers = [
    { id: 999, name: 'TÚ (JUGADOR)', reputation: myReputation, stash: myStash, stats: myStats, isMe: true },
    ...bots
  ];

  // --- RENDERIZADO: GAME OVER (LA REVELACIÓN) ---
  if (gamePhase === 'GAMEOVER') {
    // Calcular ganadores de categorías
    const richest = [...allPlayers].sort((a,b) => b.stash - a.stash)[0];
    const biggestThief = [...allPlayers].sort((a,b) => b.stats.stole - a.stats.stole)[0];
    const mostCollaborative = [...allPlayers].sort((a,b) => b.stats.collaborated - a.stats.collaborated)[0];
    
    // Ranking final por dinero
    const finalRanking = [...allPlayers].sort((a, b) => b.stash - a.stash);

    return (
      <div className="w-full max-w-md relative mt-8 animate-fade-in">
        <div className="border-4 border-danger p-4 bg-black shadow-2xl">
          <h2 className="text-center text-danger font-pixel text-2xl mb-2 animate-pulse">SOCIEDAD COLAPSADA</h2>
          <p className="text-center text-gray-400 font-terminal text-xs mb-6">ARCHIVOS CLASIFICADOS REVELADOS</p>

          {/* HALL DE LA FAMA / VERGÜENZA */}
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

          <h3 className="font-pixel text-white text-sm mb-2 text-center">RANKING FINAL REAL</h3>
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
                        <tr key={p.id} className={`border-b border-gray-800 ${p.isMe ? 'bg-gray-800 text-gold' : 'text-gray-300'}`}>
                           <td className="pl-2 py-2">{i+1}</td>
                           <td>{p.name}</td>
                           <td className="text-right text-red-400">{p.stats.stole}</td>
                           <td className="text-right pr-2 font-bold">{p.stash}</td>
                        </tr>
                     ))}
                  </tbody>
             </table>
          </div>

          <button onClick={() => setGamePhase('SETUP')} className="mt-4 w-full bg-white text-black font-pixel py-3 hover:bg-gray-300">
            INTENTAR DE NUEVO
          </button>
        </div>
      </div>
    );
  }

  // --- RENDERIZADO: JUEGO NORMAL ---
  
  // Leaderboard normal (oculto)
  const leaderboard = [...allPlayers].sort((a, b) => b.reputation - a.reputation);

  return (
    <div className="w-full max-w-md relative mt-8">
      <button onClick={onBack} className="absolute -top-10 left-0 text-soil hover:text-white underline font-pixel text-xs">&lt; SALIR</button>

      <div className="border-4 border-soil p-4 bg-black shadow-2xl transition-colors duration-500">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
          <p className="font-pixel text-xl text-white">DÍA {day}</p>
          <div className="text-right">
             <p className={`text-xs font-pixel ${hasActed ? 'text-gray-500' : 'text-green-400 animate-pulse'}`}>
               {hasActed ? '💤 ESPERANDO...' : '⚡ TU TURNO'}
             </p>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-2 mb-4 font-terminal text-center">
            <div className="bg-gray-900 p-2 rounded border border-gray-700">
               <span className="text-[10px] text-gray-400 block">SILO PÚBLICO</span>
               <span className={`${publicSilo < (botCount * 10) ? 'text-danger animate-pulse' : 'text-farm-green'} text-lg`}>{publicSilo}</span>
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
        <div className="flex border-b-2 border-soil mb-4">
          <button onClick={() => setActiveTab('ACTIONS')} className={`flex-1 font-pixel text-[10px] py-2 ${activeTab === 'ACTIONS' ? 'bg-soil text-white' : 'text-gray-500'}`}>ACCIONES</button>
          <button onClick={() => setActiveTab('STATS')} className={`flex-1 font-pixel text-[10px] py-2 ${activeTab === 'STATS' ? 'bg-soil text-white' : 'text-gray-500'}`}>DATOS</button>
          <button onClick={() => setActiveTab('RANKING')} className={`flex-1 font-pixel text-[10px] py-2 ${activeTab === 'RANKING' ? 'bg-soil text-white' : 'text-gray-500'}`}>RANKING</button>
        </div>

        {/* CONTENIDO TABS */}
        <div className="h-64 overflow-y-auto mb-4 relative custom-scrollbar">
            
            {/* TAB ACCIONES (CON INFO RESTAURADA) */}
            {activeTab === 'ACTIONS' && (
              <div className="flex flex-col gap-3 h-full justify-center">
                 {hasActed ? (
                    <div className="text-center text-gray-500 font-terminal border-2 border-dashed border-gray-800 p-8">
                       <p>Jornada finalizada.</p>
                       <p className="text-xs mt-2 text-farm-green">Espera al siguiente día...</p>
                    </div>
                 ) : (
                    <>
                      <button onClick={() => handleAction('COLLABORATE')} className="bg-farm-green text-black font-pixel py-3 hover:scale-105 transition-transform text-left px-4 group relative overflow-hidden">
                        <div className="relative z-10 flex justify-between items-center w-full">
                           <span className="text-sm">🤝 COLABORAR</span>
                           <span className="text-[10px] bg-black text-white px-2 py-1 rounded group-hover:bg-white group-hover:text-black">+REP</span>
                        </div>
                        <div className="relative z-10 text-[10px] opacity-70 mt-1 font-terminal">
                           Aportas +25 al Silo / Ganas +5 Tú
                        </div>
                      </button>

                      <button onClick={() => handleAction('PRIVATE')} className="bg-yellow-600 text-black font-pixel py-3 hover:scale-105 transition-transform text-left px-4 relative overflow-hidden">
                         <div className="relative z-10 flex justify-between items-center w-full">
                           <span className="text-sm">🏠 TRABAJO PROPIO</span>
                           <span className="text-[10px] bg-black text-white px-2 py-1 rounded">=REP</span>
                        </div>
                        <div className="relative z-10 text-[10px] opacity-70 mt-1 font-terminal">
                           Aportas +0 al Silo / Ganas +15 Tú
                        </div>
                      </button>

                      <button onClick={() => handleAction('STEAL')} className="bg-red-600 text-white font-pixel py-3 hover:scale-105 transition-transform text-left px-4 group relative overflow-hidden">
                         <div className="relative z-10 flex justify-between items-center w-full">
                           <span className="text-sm">😈 ROBAR ALMACÉN</span>
                           <span className="text-[10px] bg-black text-white px-2 py-1 rounded group-hover:bg-red-900">-REP</span>
                        </div>
                        <div className="relative z-10 text-[10px] opacity-80 mt-1 font-terminal text-red-200">
                           Dañas -40 al Silo / Ganas +40 Tú
                        </div>
                      </button>
                    </>
                 )}
              </div>
            )}

            {/* TAB STATS */}
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
                  <div className="bg-gray-900 p-3 border border-gray-700 flex justify-between items-center">
                     <span className="text-xs text-gray-400">INFLACIÓN ACTUAL</span>
                     <span className={`font-bold ${parseFloat(inflation) > 1.5 ? 'text-danger' : 'text-white'}`}>{inflation}x</span>
                  </div>
               </div>
            )}

            {/* TAB RANKING (CENSURADO) */}
            {activeTab === 'RANKING' && (
               <table className="w-full font-terminal text-sm text-left">
                  <thead className="text-gray-500 border-b border-gray-700 sticky top-0 bg-black">
                     <tr>
                        <th className="pb-2 pl-2">#</th>
                        <th className="pb-2">CIUDADANO</th>
                        <th className="pb-2 text-right">REP</th>
                        <th className="pb-2 text-right pr-2">$$$</th>
                     </tr>
                  </thead>
                  <tbody>
                     {leaderboard.map((player, index) => (
                        <tr key={player.id} className={`border-b border-gray-900 ${player.isMe ? 'text-gold bg-gray-900' : 'text-gray-300'}`}>
                           <td className="py-2 pl-2">{index + 1}</td>
                           <td className="py-2">{player.isMe ? '⭐ TÚ' : player.name}</td>
                           <td className={`py-2 text-right ${player.reputation < 30 ? 'text-danger' : 'text-farm-green'}`}>
                              {player.reputation}%
                           </td>
                           <td className="py-2 text-right pr-2 font-mono">{player.isMe ? player.stash : '🔒???'}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            )}
        </div>

        {/* CONTROLES TIEMPO */}
        <div className="flex gap-2 justify-center border-t border-gray-700 pt-4">
          <button onClick={() => setIsRunning(!isRunning)} className={`font-pixel text-xs border border-gray-500 px-4 py-2 hover:bg-gray-800 ${isRunning ? 'text-danger' : 'text-white'}`}>
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

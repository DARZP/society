import { useState, useEffect } from 'react';

interface BotPlayer {
  id: number;
  name: string;
  reputation: number;
  stash: number;
}

export default function OfflineSimulator({ onBack }: { onBack: () => void }) {
  // --- FASES Y CONFIG ---
  const [gamePhase, setGamePhase] = useState<'SETUP' | 'PLAYING'>('SETUP');
  const [botCount, setBotCount] = useState(50);
  
  // --- ESTADO DEL MUNDO ---
  const [day, setDay] = useState(1);
  const [publicSilo, setPublicSilo] = useState(1000);
  const [myStash, setMyStash] = useState(50);
  const [myReputation, setMyReputation] = useState(50);
  
  // --- TURNOS Y UI ---
  const [hasActed, setHasActed] = useState(false);
  // AÑADIDO: Nueva pestaña 'STATS'
  const [activeTab, setActiveTab] = useState<'ACTIONS' | 'RANKING' | 'STATS'>('ACTIONS');

  // --- MOTORES ---
  const [bots, setBots] = useState<BotPlayer[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(2000);

  // --- CÁLCULOS ECONÓMICOS ---
  // Inflación: Si el silo baja de (Población * 10), empieza a subir el precio
  const inflationThreshold = (botCount + 1) * 10;
  const inflation = Math.max(1, inflationThreshold / (publicSilo + 1)).toFixed(2);
  const costOfLiving = Math.floor(5 * parseFloat(inflation));

  // --- CÁLCULOS DE DESIGUALDAD (Para la pestaña de Info) ---
  const totalPrivateWealth = bots.reduce((acc, bot) => acc + bot.stash, 0) + myStash;
  const totalResources = publicSilo + totalPrivateWealth;
  const publicRatio = ((publicSilo / (totalResources || 1)) * 100).toFixed(1);
  
  // Calcular cuánto tienen el 10% más rico
  const allStashes = [...bots.map(b => b.stash), myStash].sort((a, b) => b - a);
  const top10Count = Math.ceil(allStashes.length * 0.1);
  const wealthTop10 = allStashes.slice(0, top10Count).reduce((a, b) => a + b, 0);
  const inequalityPercentage = ((wealthTop10 / (totalPrivateWealth || 1)) * 100).toFixed(1);

  // 1. INICIAR PARTIDA (Balanceado)
  const startGame = () => {
    const newBots: BotPlayer[] = Array.from({ length: botCount }).map((_, i) => ({
      id: i,
      name: `Ciudadano #${i + 1}`,
      reputation: Math.floor(Math.random() * 40) + 40, // 40-80 Rep inicial
      stash: Math.floor(Math.random() * 20) + 10
    }));
    setBots(newBots);
    // BALANCE: Damos un "colchón" de 50 unidades por habitante para empezar
    setPublicSilo(botCount * 50); 
    setGamePhase('PLAYING');
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

        // B. Simular Bots (BALANCEADO)
        setBots(currentBots => currentBots.map(bot => {
          // Si no pueden pagar, mueren (reset stash a 0) o sufren
          let currentStash = bot.stash - costOfLiving;
          
          // Decisión de la IA basada en su Reputación actual
          // Si tiene buena reputación, tiende a colaborar más.
          // Si tiene mala reputación, tiende a robar más (Círculo vicioso)
          const corruptFactor = (100 - bot.reputation) / 100; // 0.2 si es bueno, 0.8 si es malo
          const roll = Math.random();

          let decision = 'COLLABORATE';
          if (roll < (0.1 + (corruptFactor * 0.4))) decision = 'STEAL'; 
          // Ejemplo: Un buen ciudadano solo roba 18% de las veces. Un criminal roba 50%.

          let newRep = bot.reputation;

          if (decision === 'STEAL') {
             // Robar es muy rentable pero daña mucho
             currentStash += 30;
             setPublicSilo(s => s - 30); 
             newRep -= 3;
          } else {
             // Colaborar ayuda a sostener el sistema
             setPublicSilo(s => s + 8); // Aporte neto positivo si CostoVida < 8
             newRep += 1;
          }

          return { ...bot, reputation: Math.max(0, Math.min(100, newRep)), stash: currentStash };
        }));

        // C. Verificar Colapso
        setPublicSilo(prev => {
          if (prev <= 0) {
            setIsRunning(false);
            return 0;
          }
          return prev;
        });

      }, speed);
    }
    return () => clearInterval(interval);
  }, [isRunning, speed, gamePhase, costOfLiving, botCount]);

  // 3. ACCIONES DEL JUGADOR
  const handleAction = (type: 'COLLABORATE' | 'PRIVATE' | 'STEAL') => {
    if (publicSilo <= 0 || hasActed) return;

    switch (type) {
      case 'COLLABORATE':
        setPublicSilo(s => s + 25); // Tu aporte es significativo
        setMyStash(s => s + 5);     // Ganas poco
        setMyReputation(r => Math.min(100, r + 5));
        break;
      case 'PRIVATE':
        setMyStash(s => s + 15);
        // Sin impacto social
        break;
      case 'STEAL':
        setPublicSilo(s => s - 40);
        setMyStash(s => s + 40);
        setMyReputation(r => Math.max(0, r - 10));
        break;
    }
    setHasActed(true);
  };

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

  // Ordenar leaderboard para renderizar
  const leaderboard = [
    { id: 999, name: 'TÚ (JUGADOR)', reputation: myReputation, stash: myStash, isMe: true },
    ...bots
  ].sort((a, b) => b.reputation - a.reputation);

  return (
    <div className="w-full max-w-md relative mt-8">
      <button onClick={onBack} className="absolute -top-10 left-0 text-soil hover:text-white underline font-pixel text-xs">&lt; SALIR</button>

      <div className={`border-4 p-4 bg-black shadow-2xl transition-colors duration-500 ${publicSilo <= 0 ? 'border-danger' : 'border-soil'}`}>
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
          <p className="font-pixel text-xl text-white">DÍA {day}</p>
          <div className="text-right">
             <p className={`text-xs font-pixel ${hasActed ? 'text-gray-500' : 'text-green-400 animate-pulse'}`}>
               {hasActed ? '💤 DESCANSANDO' : '⚡ TU TURNO'}
             </p>
          </div>
        </div>

        {/* STATS PRINCIPALES */}
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

        {/* TABS DE NAVEGACIÓN */}
        <div className="flex border-b-2 border-soil mb-4">
          <button onClick={() => setActiveTab('ACTIONS')} className={`flex-1 font-pixel text-[10px] py-2 ${activeTab === 'ACTIONS' ? 'bg-soil text-white' : 'text-gray-500'}`}>ACCIONES</button>
          <button onClick={() => setActiveTab('STATS')} className={`flex-1 font-pixel text-[10px] py-2 ${activeTab === 'STATS' ? 'bg-soil text-white' : 'text-gray-500'}`}>DATOS</button>
          <button onClick={() => setActiveTab('RANKING')} className={`flex-1 font-pixel text-[10px] py-2 ${activeTab === 'RANKING' ? 'bg-soil text-white' : 'text-gray-500'}`}>RANKING</button>
        </div>

        {/* CONTENIDO DE TABS */}
        <div className="h-64 overflow-y-auto mb-4 relative custom-scrollbar">
            
            {/* TAB 1: ACCIONES */}
            {activeTab === 'ACTIONS' && (
              <div className="flex flex-col gap-3 h-full justify-center">
                 {publicSilo <= 0 ? (
                    <div className="text-center text-danger font-pixel animate-bounce">
                       <p className="text-3xl mb-2">💀</p>
                       <p>SOCIEDAD COLAPSADA</p>
                       <p className="text-xs font-terminal mt-2 text-gray-400">La avaricia nos consumió.</p>
                    </div>
                 ) : hasActed ? (
                    <div className="text-center text-gray-500 font-terminal border-2 border-dashed border-gray-800 p-8">
                       <p>Has finalizado tu jornada.</p>
                       <p className="text-xs mt-2 text-farm-green">Espera al siguiente día...</p>
                    </div>
                 ) : (
                    <>
                      <button onClick={() => handleAction('COLLABORATE')} className="bg-farm-green text-black font-pixel py-4 hover:scale-105 transition-transform flex justify-between px-4 items-center group">
                        <span>🤝 COLABORAR</span> <span className="text-[10px] bg-black text-white px-2 py-1 rounded">+REP</span>
                      </button>
                      <button onClick={() => handleAction('PRIVATE')} className="bg-yellow-600 text-black font-pixel py-4 hover:scale-105 transition-transform flex justify-between px-4 items-center">
                         <span>🏠 TRABAJO PROPIO</span> <span className="text-[10px] bg-black text-white px-2 py-1 rounded">=REP</span>
                      </button>
                      <button onClick={() => handleAction('STEAL')} className="bg-red-600 text-white font-pixel py-4 hover:scale-105 transition-transform flex justify-between px-4 items-center group">
                         <span>😈 ROBAR ALMACÉN</span> <span className="text-[10px] bg-black text-white px-2 py-1 rounded group-hover:bg-red-900">-REP</span>
                      </button>
                    </>
                 )}
              </div>
            )}

            {/* TAB 2: DATOS (NUEVA PESTAÑA DE INFORMACIÓN) */}
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
                        <span className="text-gold">PRIVADO ({ (100 - parseFloat(publicRatio)).toFixed(1) }%)</span>
                     </div>
                  </div>

                  <div className="bg-gray-900 p-3 border border-gray-700">
                     <p className="text-xs text-gray-400 mb-1">DESIGUALDAD (GINI SIMPLIFICADO)</p>
                     <p className="text-white text-sm mb-2">
                        El 10% más rico posee el <span className="text-gold font-bold">{inequalityPercentage}%</span> de toda la riqueza privada.
                     </p>
                     {parseFloat(inequalityPercentage) > 50 && (
                        <p className="text-xs text-danger animate-pulse">⚠️ ¡ALERTA DE OLIGARQUÍA!</p>
                     )}
                  </div>

                  <div className="bg-gray-900 p-3 border border-gray-700 flex justify-between items-center">
                     <span className="text-xs text-gray-400">INFLACIÓN ACTUAL</span>
                     <span className={`font-bold ${parseFloat(inflation) > 1.5 ? 'text-danger' : 'text-white'}`}>{inflation}x</span>
                  </div>
               </div>
            )}

            {/* TAB 3: RANKING (Con privacidad) */}
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
                           <td className="py-2">
                              {player.isMe ? '⭐ TÚ' : player.name}
                           </td>
                           <td className={`py-2 text-right ${player.reputation < 30 ? 'text-danger' : 'text-farm-green'}`}>
                              {player.reputation}%
                           </td>
                           <td className="py-2 text-right pr-2 font-mono">
                              {player.isMe ? player.stash : '🔒???'}
                           </td>
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
          <button onClick={() => setSpeed(speed === 2000 ? 500 : 2000)} className="text-gold font-pixel text-xs border border-gold px-4 py-2 hover:bg-gray-800">
            {speed === 2000 ? '⏩ VELOCIDAD x5' : '🐌 NORMAL'}
          </button>
        </div>

      </div>
    </div>
  );
}

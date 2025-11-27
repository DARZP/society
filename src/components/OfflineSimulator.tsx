import { useState, useEffect } from 'react';

// Definimos cómo se ve un Jugador (Bot)
interface BotPlayer {
  id: number;
  name: string;
  reputation: number; // +Colaborar, -Robar
  stash: number;      // Recursos guardados
}

export default function OfflineSimulator({ onBack }: { onBack: () => void }) {
  // --- FASE DEL JUEGO: 'SETUP' (Configurar) o 'PLAYING' (Jugando) ---
  const [gamePhase, setGamePhase] = useState<'SETUP' | 'PLAYING'>('SETUP');
  
  // --- CONFIGURACIÓN ---
  const [botCount, setBotCount] = useState(50); // Cantidad de IAs elegida
  
  // --- ESTADO DEL MUNDO ---
  const [day, setDay] = useState(1);
  const [publicSilo, setPublicSilo] = useState(1000);
  const [myStash, setMyStash] = useState(50);
  const [myReputation, setMyReputation] = useState(50); // Tu reputación (0-100)
  
  // --- LÓGICA DE TURNOS ---
  const [hasActed, setHasActed] = useState(false); // ¿Ya actuaste hoy?
  const [activeTab, setActiveTab] = useState<'ACTIONS' | 'RANKING'>('ACTIONS');

  // --- IAs Y SIMULACIÓN ---
  const [bots, setBots] = useState<BotPlayer[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(2000); // 2 segundos por día

  // Cálculos económicos
  const inflation = Math.max(1, (botCount * 10) / (publicSilo + 1)).toFixed(2);
  const costOfLiving = Math.floor(5 * parseFloat(inflation));

  // 1. INICIAR LA PARTIDA (Generar Bots)
  const startGame = () => {
    const newBots: BotPlayer[] = Array.from({ length: botCount }).map((_, i) => ({
      id: i,
      name: `Ciudadano #${i + 1}`,
      reputation: Math.floor(Math.random() * 60) + 20, // Empiezan normal
      stash: Math.floor(Math.random() * 50)
    }));
    setBots(newBots);
    setPublicSilo(botCount * 20); // Silo inicial proporcional a la gente
    setGamePhase('PLAYING');
  };

  // 2. MOTOR DEL TIEMPO (Pasa el día)
  useEffect(() => {
    let interval: any;

    if (isRunning && gamePhase === 'PLAYING') {
      interval = setInterval(() => {
        // --- NUEVO DÍA ---
        setDay(d => d + 1);
        setHasActed(false); // ¡Te permite volver a actuar!

        // A. Cobrar Costo de Vida al Jugador
        setMyStash(prev => prev - costOfLiving);

        // B. Simular acciones de los Bots
        setBots(currentBots => currentBots.map(bot => {
          const action = Math.random(); // Decisión de la IA
          let newRep = bot.reputation;
          let newStash = bot.stash - costOfLiving; // Ellos también pagan

          // Lógica simple de IA
          if (action > 0.7) { 
            // 30% Roban
            newRep -= 2;
            newStash += 40;
            setPublicSilo(s => s - 40);
          } else {
            // 70% Colaboran o Trabajan en casa
            newRep += 1;
            setPublicSilo(s => s + 5); // Aportan un poco
          }
          return { ...bot, reputation: Math.max(0, Math.min(100, newRep)), stash: newStash };
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
  }, [isRunning, speed, gamePhase, costOfLiving]);

  // 3. TUS ACCIONES (Solo 1 vez por día)
  const handleAction = (type: 'COLLABORATE' | 'PRIVATE' | 'STEAL') => {
    if (publicSilo <= 0 || hasActed) return; // Bloqueado si ya actuaste

    switch (type) {
      case 'COLLABORATE':
        setPublicSilo(s => s + 30);
        setMyStash(s => s + 5);
        setMyReputation(r => Math.min(100, r + 5)); // Subes rep
        break;
      case 'PRIVATE':
        setMyStash(s => s + 15);
        // Reputación no cambia
        break;
      case 'STEAL':
        setPublicSilo(s => s - 40);
        setMyStash(s => s + 40);
        setMyReputation(r => Math.max(0, r - 10)); // Bajas rep
        break;
    }
    setHasActed(true); // ¡Bloqueamos hasta mañana!
  };

  // --- PANTALLA DE CONFIGURACIÓN ---
  if (gamePhase === 'SETUP') {
    return (
      <div className="w-full max-w-md relative mt-10 text-center">
         <button onClick={onBack} className="absolute -top-10 left-0 text-white underline font-pixel text-xs">&lt; ATRÁS</button>
         <div className="border-4 border-farm-green p-8 bg-black bg-opacity-90">
            <h2 className="font-pixel text-gold text-xl mb-6">CONFIGURAR SIMULACIÓN</h2>
            
            <label className="block text-farm-green font-terminal mb-2">CANTIDAD DE HABITANTES (IA)</label>
            <input 
              type="range" min="10" max="200" step="10"
              value={botCount} 
              onChange={(e) => setBotCount(parseInt(e.target.value))}
              className="w-full mb-4 accent-farm-green cursor-pointer"
            />
            <p className="text-white font-pixel text-2xl mb-8">{botCount}</p>

            <button onClick={startGame} className="bg-farm-green text-black font-pixel py-4 w-full hover:scale-105 transition-transform">
              COMENZAR EXPERIMENTO
            </button>
         </div>
      </div>
    );
  }

  // --- PANTALLA DE JUEGO ---
  
  // Ordenar ranking: Primero Tú, luego los bots, ordenados por reputación
  const leaderboard = [
    { id: 999, name: 'TÚ (JUGADOR)', reputation: myReputation, stash: myStash, isMe: true },
    ...bots
  ].sort((a, b) => b.reputation - a.reputation); // Ordenar de mayor a menor

  return (
    <div className="w-full max-w-md relative mt-8">
      <button onClick={onBack} className="absolute -top-10 left-0 text-soil hover:text-white underline font-pixel text-xs">
        &lt; SALIR
      </button>

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

        {/* STATS RÁPIDOS */}
        <div className="grid grid-cols-3 gap-2 mb-4 font-terminal text-center">
            <div className="bg-gray-900 p-2 rounded border border-gray-700">
               <span className="text-xs text-gray-400 block">SILO</span>
               <span className={`${publicSilo < 500 ? 'text-danger' : 'text-farm-green'} text-lg`}>{publicSilo}</span>
            </div>
            <div className="bg-gray-900 p-2 rounded border border-gray-700">
               <span className="text-xs text-gray-400 block">INFLACIÓN</span>
               <span className="text-white text-lg">{inflation}x</span>
            </div>
            <div className="bg-gray-900 p-2 rounded border border-gray-700">
               <span className="text-xs text-gray-400 block">TU ALMACÉN</span>
               <span className="text-gold text-lg">{myStash}</span>
            </div>
        </div>

        {/* PESTAÑAS (TABS) */}
        <div className="flex border-b-2 border-soil mb-4">
          <button 
            onClick={() => setActiveTab('ACTIONS')}
            className={`flex-1 font-pixel text-[10px] py-2 ${activeTab === 'ACTIONS' ? 'bg-soil text-white' : 'bg-transparent text-gray-500'}`}
          >
            ACCIONES
          </button>
          <button 
            onClick={() => setActiveTab('RANKING')}
            className={`flex-1 font-pixel text-[10px] py-2 ${activeTab === 'RANKING' ? 'bg-soil text-white' : 'bg-transparent text-gray-500'}`}
          >
            RANKING ({botCount + 1})
          </button>
        </div>

        {/* CONTENIDO DE LA PESTAÑA */}
        <div className="h-64 overflow-y-auto mb-4 relative">
            
            {/* 1. PESTAÑA DE ACCIONES */}
            {activeTab === 'ACTIONS' && (
              <div className="flex flex-col gap-3 h-full justify-center">
                 {publicSilo <= 0 ? (
                    <div className="text-center text-danger font-pixel animate-bounce">
                       💀 SOCIEDAD COLAPSADA 💀
                    </div>
                 ) : hasActed ? (
                    <div className="text-center text-gray-500 font-terminal border-2 border-dashed border-gray-800 p-8">
                       <p>Has trabajado duro hoy.</p>
                       <p className="text-sm mt-2">Espera al siguiente día...</p>
                    </div>
                 ) : (
                    <>
                      <button onClick={() => handleAction('COLLABORATE')} className="bg-farm-green text-black font-pixel py-4 hover:scale-105 transition-transform flex justify-between px-4 items-center group">
                        <span>🤝 COLABORAR</span>
                        <span className="text-[10px] bg-black text-white px-2 py-1 rounded group-hover:bg-white group-hover:text-black transition-colors">+REP</span>
                      </button>

                      <button onClick={() => handleAction('PRIVATE')} className="bg-yellow-600 text-black font-pixel py-4 hover:scale-105 transition-transform flex justify-between px-4 items-center">
                         <span>🏠 TRABAJO PROPIO</span>
                         <span className="text-[10px] bg-black text-white px-2 py-1 rounded">=REP</span>
                      </button>

                      <button onClick={() => handleAction('STEAL')} className="bg-red-600 text-white font-pixel py-4 hover:scale-105 transition-transform flex justify-between px-4 items-center group">
                         <span>😈 ROBAR ALMACÉN</span>
                         <span className="text-[10px] bg-black text-white px-2 py-1 rounded group-hover:bg-red-900">-REP</span>
                      </button>
                    </>
                 )}
              </div>
            )}

            {/* 2. PESTAÑA DE RANKING */}
            {activeTab === 'RANKING' && (
               <table className="w-full font-terminal text-sm text-left">
                  <thead className="text-gray-500 border-b border-gray-700">
                     <tr>
                        <th className="pb-2">#</th>
                        <th className="pb-2">NOMBRE</th>
                        <th className="pb-2 text-right">REP</th>
                        <th className="pb-2 text-right">$$$</th>
                     </tr>
                  </thead>
                  <tbody>
                     {leaderboard.map((player, index) => (
                        <tr key={player.id} className={`border-b border-gray-900 ${player.isMe ? 'text-gold bg-gray-900' : 'text-gray-300'}`}>
                           <td className="py-2 pl-1">{index + 1}</td>
                           <td className="py-2">{player.name} {player.isMe && '(TÚ)'}</td>
                           <td className={`py-2 text-right ${player.reputation < 30 ? 'text-danger' : 'text-farm-green'}`}>
                              {player.reputation}%
                           </td>
                           <td className="py-2 text-right opacity-60">{player.stash}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            )}
        </div>

        {/* CONTROLES DE TIEMPO */}
        <div className="flex gap-2 justify-center border-t border-gray-700 pt-4">
          <button onClick={() => setIsRunning(!isRunning)} className="text-white font-pixel text-xs border border-gray-500 px-4 py-2 hover:bg-gray-800">
            {isRunning ? '⏸ PAUSAR' : '▶ INICIAR'}
          </button>
          <button onClick={() => setSpeed(speed === 2000 ? 500 : 2000)} className="text-gold font-pixel text-xs border border-gold px-4 py-2 hover:bg-gray-800">
            {speed === 2000 ? '⏩ ACELERAR' : '🐌 NORMAL'}
          </button>
        </div>

      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';

export default function OfflineSimulator({ onBack }: { onBack: () => void }) {
  // --- ESTADO DEL MUNDO ---
  const [day, setDay] = useState(1);
  const [publicSilo, setPublicSilo] = useState(1000); // Comida de todos
  const [privateStash, setPrivateStash] = useState(50); // Tu comida guardada
  const [population] = useState(100); // 100 Habitantes simulados
  
  // --- ESTADO DEL TIEMPO ---
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(2000); // Velocidad normal (2 segs por día)

  // --- MATEMÁTICAS DEL CAOS ---
  // Si hay poca comida pública, la inflación sube.
  // Base 1.0. Si el silo baja de 500, los precios se disparan.
  const inflation = Math.max(1, 1000 / (publicSilo + 1)).toFixed(2);
  const costOfLiving = Math.floor(5 * parseFloat(inflation));

  // --- EL MOTOR DE LA SIMULACIÓN (Día a Día) ---
  useEffect(() => {
    let interval: any;

    if (isRunning) {
      interval = setInterval(() => {
        // 1. Avanza el día
        setDay(d => d + 1);

        // 2. La IA consume (Simulamos 99 personas comiendo)
        // Algunos son honestos, otros roban un poco.
        const consumption = Math.floor(Math.random() * 80) + 20; 
        
        setPublicSilo(prev => {
          const newValue = prev - consumption;
          // Si llega a 0, la sociedad colapsa (detenemos el tiempo)
          if (newValue <= 0) {
            setIsRunning(false);
            return 0;
          }
          return newValue;
        });

        // 3. Tú pagas tu costo de vida automáticamente
        setPrivateStash(prev => prev - costOfLiving);

      }, speed);
    }
    return () => clearInterval(interval);
  }, [isRunning, speed, costOfLiving]);

  // --- TUS ACCIONES ---
  const handleAction = (type: 'COLLABORATE' | 'PRIVATE' | 'STEAL') => {
    if (publicSilo <= 0) return; // No puedes actuar si la sociedad murió

    switch (type) {
      case 'COLLABORATE':
        // Trabajas para la sociedad: Aumenta mucho el Silo, poco para ti
        setPublicSilo(s => s + 30);
        setPrivateStash(s => s + 5); 
        break;
      case 'PRIVATE':
        // Trabajas en casa: El silo no crece, tú ganas más
        setPrivateStash(s => s + 15);
        break;
      case 'STEAL':
        // Robas: El silo baja drásticamente, tú ganas muchísimo
        setPublicSilo(s => s - 40);
        setPrivateStash(s => s + 40);
        break;
    }
  };

  return (
    <div className="w-full max-w-md relative mt-8">
      <button onClick={onBack} className="absolute -top-10 left-0 text-soil hover:text-white underline font-pixel text-xs">
        &lt; SALIR
      </button>

      <div className={`border-4 p-6 bg-black shadow-2xl transition-colors duration-500 ${publicSilo <= 0 ? 'border-danger' : 'border-soil'}`}>
        
        {/* ENCABEZADO */}
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
          <div>
            <h2 className="text-soil font-pixel text-lg">SIMULACIÓN</h2>
            <p className="text-xs text-gray-500 font-terminal">POBLACIÓN: {population}</p>
          </div>
          <div className="text-right">
            <p className="font-pixel text-2xl text-white">DÍA {day}</p>
            <p className="text-xs text-gray-400">{isRunning ? '⏳ TIEMPO CORRIENDO' : '⏸ PAUSADO'}</p>
          </div>
        </div>

        {/* ESTADÍSTICAS CENTRALES */}
        <div className="grid grid-cols-2 gap-4 mb-8 font-terminal text-lg">
          <div className="bg-gray-900 p-3 rounded border border-gray-800">
            <p className="text-gray-400 text-sm">SILO PÚBLICO</p>
            <p className={`text-2xl ${publicSilo < 300 ? 'text-danger animate-pulse' : 'text-farm-green'}`}>
              {publicSilo} 🌾
            </p>
          </div>
          <div className="bg-gray-900 p-3 rounded border border-gray-800">
            <p className="text-gray-400 text-sm">TU ALMACÉN</p>
            <p className="text-2xl text-gold">{privateStash} 💰</p>
          </div>
          <div className="bg-gray-900 p-3 rounded border border-gray-800 col-span-2 flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-sm">INFLACIÓN</p>
              <p className="text-xl text-white">{inflation}x</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">COSTO DE VIDA</p>
              <p className="text-xl text-danger">-{costOfLiving}/día</p>
            </div>
          </div>
        </div>

        {/* GAME OVER */}
        {publicSilo <= 0 && (
          <div className="bg-danger text-white p-4 text-center font-pixel mb-4 animate-bounce">
            💀 SOCIEDAD COLAPSADA 💀
          </div>
        )}

        {/* BOTONES DE ACCIÓN */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <button 
            onClick={() => handleAction('COLLABORATE')}
            disabled={publicSilo <= 0}
            className="bg-farm-green text-black font-pixel py-4 text-[10px] hover:scale-105 transition-transform disabled:opacity-50"
          >
            🤝 COLABORAR
            <br/><span className="text-[8px] opacity-70">+30 Silo / +5 Tú</span>
          </button>

          <button 
             onClick={() => handleAction('PRIVATE')}
             disabled={publicSilo <= 0}
             className="bg-yellow-600 text-black font-pixel py-4 text-[10px] hover:scale-105 transition-transform disabled:opacity-50"
          >
            🏠 PRIVADO
            <br/><span className="text-[8px] opacity-70">+0 Silo / +15 Tú</span>
          </button>

          <button 
             onClick={() => handleAction('STEAL')}
             disabled={publicSilo <= 0}
             className="bg-red-600 text-white font-pixel py-4 text-[10px] hover:scale-105 transition-transform disabled:opacity-50"
          >
            😈 ROBAR
            <br/><span className="text-[8px] opacity-70">-40 Silo / +40 Tú</span>
          </button>
        </div>

        {/* CONTROLES DE TIEMPO */}
        <div className="flex gap-2 justify-center border-t border-gray-700 pt-4">
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className="text-white font-pixel text-xs border border-gray-500 px-4 py-2 hover:bg-gray-800"
          >
            {isRunning ? '⏸ PAUSAR' : '▶ INICIAR'}
          </button>
          
          <button 
            onClick={() => setSpeed(speed === 2000 ? 500 : 2000)}
            className="text-gold font-pixel text-xs border border-gold px-4 py-2 hover:bg-gray-800"
          >
            {speed === 2000 ? '⏩ ACELERAR' : '🐌 NORMAL'}
          </button>
        </div>

      </div>
    </div>
  );
}

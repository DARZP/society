import { useState, useEffect } from 'react';

export default function OfflineSimulator({ onBack }: { onBack: () => void }) {
  const [day, setDay] = useState(1);
  const [silo, setSilo] = useState(1000);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1000); // 1 segundo por día

  // El motor de simulación
  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(() => {
        setDay(d => d + 1);
        // Simulación: La IA roba un poco cada día aleatoriamente
        setSilo(s => Math.max(0, s - Math.floor(Math.random() * 50))); 
      }, speed);
    }
    return () => clearInterval(interval);
  }, [isRunning, speed]);

  return (
    <div className="w-full max-w-md relative">
      <button onClick={onBack} className="absolute -top-12 left-0 text-white underline font-pixel text-xs">
        &lt; VOLVER
      </button>

      <div className="border-4 border-soil p-6 bg-black bg-opacity-90 shadow-2xl">
        <h2 className="text-center text-soil font-pixel mb-2">SIMULADOR OFFLINE</h2>
        <p className="text-xs text-center text-gray-400 mb-6 font-terminal">PRACTICA CONTRA LA MÁQUINA</p>

        <div className="font-terminal text-2xl space-y-4 mb-8">
          <div className="flex justify-between">
            <span>📅 DÍA:</span> <span className="text-white">{day}</span>
          </div>
          <div className="flex justify-between">
            <span>🌾 RECURSOS:</span> <span className={`${silo < 300 ? 'text-danger animate-pulse' : 'text-farm-green'}`}>{silo}</span>
          </div>
        </div>

        {/* CONTROLES DE TIEMPO */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className={`font-pixel py-3 text-xs ${isRunning ? 'bg-danger text-white' : 'bg-farm-green text-black'}`}
          >
            {isRunning ? 'PAUSAR ⏸' : 'INICIAR ▶'}
          </button>
          
          <button 
            onClick={() => setSpeed(speed === 1000 ? 200 : 1000)}
            className="bg-gray-700 text-white font-pixel py-3 text-xs border border-gray-500"
          >
            VELOCIDAD: {speed === 1000 ? '1x' : '⚡ 5x'}
          </button>
        </div>
      </div>
    </div>
  );
}

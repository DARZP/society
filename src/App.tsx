import { useState, useEffect } from 'react';
import { db } from './firebase'; 
// AÑADIDO: Importamos 'setDoc' para poder guardar datos
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

interface GameState {
  day: number;
  publicSilo: number;
  inflation: string;
}

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchamos el documento "global"
    const unsubscribe = onSnapshot(doc(db, "gameState", "global"), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setGameState(docSnapshot.data() as GameState);
      } else {
        setGameState(null); // No existe el documento
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- NUEVA FUNCIÓN: Crea los datos si no existen ---
  const inicializarMundo = async () => {
    try {
      await setDoc(doc(db, "gameState", "global"), {
        day: 1,
        publicSilo: 1000,
        inflation: "ESTABLE"
      });
      alert("¡Mundo creado con éxito!");
    } catch (error) {
      console.error("Error creando mundo:", error);
      alert("Error al crear. Revisa la consola (F12).");
    }
  };

  return (
    <div className="min-h-screen bg-farm-dark text-farm-green font-terminal p-4 flex flex-col items-center justify-center">
      
      <h1 className="font-pixel text-4xl text-gold mb-8 text-center leading-relaxed tracking-widest drop-shadow-md">
        SOCIETY
      </h1>

      <div className="border-4 border-farm-green p-6 max-w-md w-full bg-black bg-opacity-80 shadow-2xl relative">
        
        {/* Decoración pixel art */}
        <div className="absolute top-0 left-0 w-2 h-2 bg-farm-green"></div>
        <div className="absolute top-0 right-0 w-2 h-2 bg-farm-green"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 bg-farm-green"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-farm-green"></div>

        {loading ? (
          <p className="text-center animate-pulse">CONECTANDO AL SATÉLITE...</p>
        ) : gameState ? (
          // --- SI HAY DATOS ---
          <>
            <p className="text-xl mb-6 text-center border-b-2 border-dashed border-farm-green pb-4">
              Día: <span className="text-white">{gameState.day}</span>
            </p>
            
            <div className="space-y-6 text-lg">
              <div className="flex justify-between items-end">
                <span>🌾 Silo Público:</span>
                <span className="text-2xl text-white">{gameState.publicSilo}</span>
              </div>
              
              <div className="flex justify-between items-end">
                <span>💀 Inflación:</span>
                <span className={`text-xl ${gameState.inflation === 'CRÍTICA' ? 'text-danger animate-pulse' : 'text-gold'}`}>
                  {gameState.inflation}
                </span>
              </div>
            </div>

            <button className="mt-10 w-full bg-farm-green text-farm-dark font-pixel py-4 text-sm hover:bg-white hover:scale-105 transition-all uppercase tracking-wider">
              INGRESAR AL SISTEMA
            </button>
          </>
        ) : (
          // --- SI NO HAY DATOS (El Error que tienes ahora) ---
          <div className="text-center flex flex-col items-center">
            <p className="text-danger mb-4 font-bold">ERROR: MUNDO NO ENCONTRADO</p>
            <p className="text-sm mb-6 text-gray-400">La base de datos está vacía o el ID es incorrecto.</p>
            
            {/* ESTE BOTÓN ARREGLARÁ TU PROBLEMA */}
            <button 
              onClick={inicializarMundo}
              className="bg-blue-600 text-white font-pixel py-3 px-6 text-xs hover:bg-blue-500 transition-all border-b-4 border-blue-800 active:border-b-0 active:mt-1"
            >
              🛠️ INICIALIZAR BASE DE DATOS
            </button>
          </div>
        )}

      </div>
      
      <p className="mt-8 text-xs opacity-50">SYSTEM_ID: V.0.1.0-ALPHA</p>
    </div>
  )
}

export default App

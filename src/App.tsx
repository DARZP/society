import { useState, useEffect } from 'react';
import { db } from './firebase'; // Importamos nuestra conexión
import { doc, onSnapshot } from 'firebase/firestore';

// Definimos qué forma tienen los datos del juego
interface GameState {
  day: number;
  publicSilo: number;
  inflation: string;
}

function App() {
  // Aquí guardamos el estado (al principio está cargando...)
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  // Esto se ejecuta al abrir la app: Escucha cambios en la base de datos en tiempo real
  useEffect(() => {
    // Nos conectamos al documento 'global' de la colección 'gameState'
    const unsubscribe = onSnapshot(doc(db, "gameState", "global"), (doc) => {
      if (doc.exists()) {
        setGameState(doc.data() as GameState);
      } else {
        console.log("No se encontró el estado del juego. ¿Creamos los datos?");
      }
      setLoading(false);
    });

    return () => unsubscribe(); // Limpieza al salir
  }, []);

  return (
    <div className="min-h-screen bg-farm-dark text-farm-green font-terminal p-4 flex flex-col items-center justify-center">
      
      {/* Título Actualizado */}
      <h1 className="font-pixel text-4xl text-gold mb-8 text-center leading-relaxed tracking-widest drop-shadow-md">
        SOCIETY
      </h1>

      <div className="border-4 border-farm-green p-6 max-w-md w-full bg-black bg-opacity-80 shadow-2xl relative">
        
        {/* Decoración pixel art esquinas */}
        <div className="absolute top-0 left-0 w-2 h-2 bg-farm-green"></div>
        <div className="absolute top-0 right-0 w-2 h-2 bg-farm-green"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 bg-farm-green"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-farm-green"></div>

        {loading ? (
          <p className="text-center animate-pulse">CONECTANDO AL SATÉLITE...</p>
        ) : gameState ? (
          // Si hay datos, mostramos esto:
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
              INICIAR CONEXIÓN
            </button>
          </>
        ) : (
          // Si no hay datos (porque la DB está vacía)
          <div className="text-center text-danger">
            <p>ERROR: MUNDO NO ENCONTRADO</p>
            <p className="text-sm mt-2 text-farm-green">Necesitamos inicializar la base de datos.</p>
          </div>
        )}

      </div>
      
      <p className="mt-8 text-xs opacity-50">SYSTEM_ID: V.0.1.0-ALPHA</p>
    </div>
  )
}

export default App

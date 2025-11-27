import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

interface GameState {
  day: number;
  publicSilo: number;
  inflation: string;
}

export default function OnlineGame({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Nota: Por ahora seguimos escuchando 'global', luego lo cambiaremos a la sala específica
    const unsubscribe = onSnapshot(doc(db, "gameState", "global"), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setGameState(docSnapshot.data() as GameState);
      } else {
        setGameState(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const inicializarMundo = async () => {
    try {
      await setDoc(doc(db, "gameState", "global"), {
        day: 1, publicSilo: 1000, inflation: "ESTABLE"
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="w-full max-w-md relative">
      <button onClick={onBack} className="absolute -top-12 left-0 text-white underline font-pixel text-xs">
        &lt; VOLVER
      </button>

      <div className="border-4 border-farm-green p-6 bg-black bg-opacity-80 shadow-2xl">
        <h2 className="text-center text-gold font-pixel mb-6">SERVIDOR GLOBAL</h2>
        
        {loading ? (
          <p className="text-center animate-pulse">SINTONIZANDO...</p>
        ) : gameState ? (
          <div className="space-y-6 text-lg font-terminal">
            <p className="text-center border-b border-dashed border-farm-green pb-2">Día: {gameState.day}</p>
            <div className="flex justify-between">
              <span>🌾 Silo:</span> <span className="text-white">{gameState.publicSilo}</span>
            </div>
            <div className="flex justify-between">
              <span>💀 Inflación:</span> <span className="text-danger">{gameState.inflation}</span>
            </div>
          </div>
        ) : (
          <div className="text-center">
             <p className="text-danger mb-4">NO HAY SEÑAL</p>
             <button onClick={inicializarMundo} className="bg-blue-600 text-white px-4 py-2 font-pixel text-xs">INICIALIZAR</button>
          </div>
        )}
      </div>
    </div>
  );
}

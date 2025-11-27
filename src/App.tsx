import { useState } from 'react';
import MainMenu from './components/MainMenu';
import OnlineGame from './components/OnlineGame';
import OfflineSimulator from './components/OfflineSimulator';

type ViewState = 'MENU' | 'ONLINE' | 'OFFLINE';

function App() {
  const [view, setView] = useState<ViewState>('MENU');

  return (
    <div className="min-h-screen bg-farm-dark text-farm-green font-terminal p-4 flex flex-col items-center justify-center">
      
      {/* Marco decorativo retro */}
      <div className="w-full max-w-2xl h-[600px] border-8 border-gray-800 rounded-lg p-4 bg-gray-900 shadow-2xl relative overflow-hidden">
         {/* Efecto de pantalla CRT (opcional, líneas de escaneo) */}
         <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none background-size-[100%_2px,3px_100%]"></div>

         <div className="relative z-20 h-full flex flex-col justify-center items-center">
            {view === 'MENU' && <MainMenu onSelectMode={setView} />}
            {view === 'ONLINE' && <OnlineGame onBack={() => setView('MENU')} />}
            {view === 'OFFLINE' && <OfflineSimulator onBack={() => setView('MENU')} />}
         </div>
      </div>
      
      <p className="mt-4 text-xs opacity-40 font-pixel">SYSTEM_ID: V.0.2.0-BETA</p>
    </div>
  )
}

export default App

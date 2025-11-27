interface Props {
  onSelectMode: (mode: 'ONLINE' | 'OFFLINE') => void;
}

export default function MainMenu({ onSelectMode }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-fade-in">
      <h1 className="font-pixel text-5xl text-gold text-center leading-relaxed tracking-widest drop-shadow-md">
        SOCIETY
      </h1>
      
      <div className="flex flex-col space-y-4 w-64">
        <button 
          onClick={() => onSelectMode('ONLINE')}
          className="bg-farm-green text-farm-dark font-pixel py-4 border-b-4 border-farm-dark hover:translate-y-1 hover:border-b-0 transition-all"
        >
          🌐 JUGAR ONLINE
        </button>

        <button 
          onClick={() => onSelectMode('OFFLINE')}
          className="bg-soil text-white font-pixel py-4 border-b-4 border-black hover:translate-y-1 hover:border-b-0 transition-all"
        >
          🤖 SIMULADOR IA
        </button>
      </div>

      <p className="text-xs opacity-50 font-terminal">SELECCIONA TU DESTINO</p>
    </div>
  );
}

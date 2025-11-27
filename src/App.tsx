function App() {
  return (
    <div className="min-h-screen bg-farm-dark text-farm-green font-terminal p-4 flex flex-col items-center justify-center">
      
      {/* Título en fuente pixelada gruesa */}
      <h1 className="font-pixel text-3xl text-gold mb-8 text-center leading-relaxed">
        LA ÚLTIMA<br/>COSECHA
      </h1>

      {/* Caja de estado simulando una ventana retro */}
      <div className="border-4 border-farm-green p-6 max-w-md w-full bg-black bg-opacity-50">
        <p className="text-xl mb-4 text-center">Día: 01</p>
        
        <div className="space-y-4">
          <div className="flex justify-between border-b border-farm-green pb-2">
            <span>🌾 Silo Público:</span>
            <span className="text-white">1,500</span>
          </div>
          
          <div className="flex justify-between border-b border-farm-green pb-2">
            <span>💀 Inflación:</span>
            <span className="text-danger animate-pulse">ALTA</span>
          </div>
        </div>

        <button className="mt-8 w-full bg-farm-green text-farm-dark font-pixel py-4 hover:bg-white hover:scale-105 transition-all">
          CONECTARSE
        </button>
      </div>
      
    </div>
  )
}

export default App

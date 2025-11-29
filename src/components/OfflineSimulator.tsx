import { useState, useEffect, useRef } from 'react';

// --- TIPOS ---
type Personality = 'ALTRUIST' | 'GREEDY' | 'CHAOTIC' | 'OPPORTUNIST';
type ActionType = 'COLLABORATE' | 'PRIVATE' | 'STEAL';
type TabType = 'ACTIONS' | 'RANKING' | 'STATS' | 'NEWS' | 'LEADER';

interface PlayerStats {
  stole: number;
  collaborated: number;
  private: number;
  rescued: number;
  donated: number;
}

interface BotPlayer {
  id: number;
  name: string;
  personality: Personality;
  reputation: number;
  stash: number;
  stats: PlayerStats;
  isDead: boolean;
  isBankrupt: boolean;
  daysBankrupt: number;
}

interface VoteSession {
  targetId: number;
  targetName: string;
  targetReputation: number;
  accusedBy: string;
  isOpen: boolean;
  bailCost: number;
}

interface Announcement {
  title: string;
  message: string;
  type: 'EXPROPRIATION' | 'FLAVOR' | 'CRISIS';
}

interface NewsItem {
  id: number;
  text: string;
  type: 'INFO' | 'ALERT' | 'BANKRUPTCY_ALERT' | 'DEATH' | 'DONATION' | 'FLAVOR' | 'EXPROPRIATION';
  targetId?: number;
  data?: any;
  resolved?: boolean;
}

type SortType = 'WEALTH' | 'THEFT' | 'SAINT';

// --- DATA: TEXTOS DE SABOR ---
const FLAVOR_TEXTS = [
    "🐈 Se busca al gato 'Satoshi' del vecino.",
    "🎬 Estreno: 'El Silo de la Pasión 4'.",
    "👽 Un bot dice haber visto humanos reales.",
    "🍕 La pizza hoy sabe a aceite de motor.",
    "🐋 Una ballena fue arrestada por lavado.",
    "📉 Expertos: 'Invertir en aire es el futuro'.",
    "🤖 Un Roomba se declaró Rey del Sector 7.",
    "🎨 Alguien pintó bigotes en los carteles.",
    "🌧️ Pronóstico: Lluvia de glitches.",
    "🎵 El himno fue remixado en 8-bit.",
    "👀 Alguien está minando criptos en el baño.",
    "💊 Se agotaron las pastillas de la felicidad."
];

// GENERADOR DE NOMBRES
const generateName = () => {
  const prefixes = ["Dr", "Lord", "Sir", "Lady", "Cyber", "Iron", "Dark", "Neo", "Cap", "The"];
  const bases = ["Wolf", "Fox", "Hawk", "Lion", "Ghost", "Viper", "Zero", "Prime", "Stark", "Flux"];
  return `${prefixes[Math.floor(Math.random()*prefixes.length)]}${bases[Math.floor(Math.random()*bases.length)]}_${Math.floor(Math.random()*99)}`;
};

export default function OfflineSimulator({ onBack }: { onBack: () => void }) {
  // --- ESTADOS PRINCIPALES ---
  const [gamePhase, setGamePhase] = useState<'SETUP' | 'PLAYING' | 'GAMEOVER'>('SETUP');
  const [botCount, setBotCount] = useState(50);
  const [initialPop, setInitialPop] = useState(50);
  
  // --- MUNDO & TIEMPO ---
  const [day, setDay] = useState(1);
  const [dayProgress, setDayProgress] = useState(0); 
  const [publicSilo, setPublicSilo] = useState(1000);
  const [initialTotalWealth, setInitialTotalWealth] = useState(1000); 
  const [speedMultiplier, setSpeedMultiplier] = useState(1); 
  const [isPaused, setIsPaused] = useState(true);

  // --- JUGADOR ---
  const [myStash, setMyStash] = useState(50);
  const [myReputation, setMyReputation] = useState(50);
  const [myStats, setMyStats] = useState<PlayerStats>({ stole: 0, collaborated: 0, private: 0, rescued: 0, donated: 0 });
  const [amIExpelled, setAmIExpelled] = useState(false);
  const [amIBankrupt, setAmIBankrupt] = useState(false);
  const [myDaysBankrupt, setMyDaysBankrupt] = useState(0);
  
  // --- ACCIONES & UI ---
  const [hasActed, setHasActed] = useState(false);
  const [autoPilotAction, setAutoPilotAction] = useState<ActionType | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('ACTIONS');
  const [newsLog, setNewsLog] = useState<NewsItem[]>([]);
  const [unreadNews, setUnreadNews] = useState(false);
  const [gameOverSort, setGameOverSort] = useState<SortType>('WEALTH');
  
  // Widgets Editables
  const [editMode, setEditMode] = useState(false);
  const [widgets, setWidgets] = useState({ wealth: true, sentiment: true, gini: true, distribution: true, poverty: true });

  // NOTIFICACIONES ACTIVAS
  const [voteSession, setVoteSession] = useState<VoteSession | null>(null);
  const [activeBailout, setActiveBailout] = useState<{id: number, name: string, debt: number, newsId: number} | null>(null);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);
  const [notificationTimer, setNotificationTimer] = useState(100); 
  const [showSuspects, setShowSuspects] = useState(false);

  // --- IA ---
  const [bots, setBots] = useState<BotPlayer[]>([]);

  // REFERENCIA ACTUALIZADA (Evita stale closures en el intervalo)
  const stateRef = useRef({ 
    bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, 
    gamePhase, initialPop, amIBankrupt, myDaysBankrupt, autoPilotAction,
    voteSession, activeBailout, activeAnnouncement, initialTotalWealth
  });

  useEffect(() => {
    stateRef.current = { 
      bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, 
      gamePhase, initialPop, amIBankrupt, myDaysBankrupt, autoPilotAction,
      voteSession, activeBailout, activeAnnouncement, initialTotalWealth
    };
  }, [bots, myReputation, myStash, publicSilo, hasActed, amIExpelled, gamePhase, initialPop, amIBankrupt, myDaysBankrupt, autoPilotAction, voteSession, activeBailout, activeAnnouncement, initialTotalWealth]);

  // --- 1. CÁLCULOS (Siempre al principio para que 'sentiment' exista) ---
  const activeBots = bots.filter(b => !b.isDead);
  const activePopulation = activeBots.length + (amIExpelled ? 0 : 1);
  const totalPrivateWealth = activeBots.reduce((acc, bot) => acc + bot.stash, 0) + (amIExpelled ? 0 : myStash);
  const currentTotalWealth = publicSilo + totalPrivateWealth;
  
  // Inflación y Costo
  const wealthRatio = currentTotalWealth / (initialTotalWealth || 1);
  const monetaryInflation = Math.sqrt(Math.max(0.1, wealthRatio)); // Raíz cuadrada suaviza picos
  const safeSiloLevel = activePopulation * 50; 
  const siloStress = Math.max(0, (safeSiloLevel * 0.5) - publicSilo);
  const scarcityPenalty = 1 + ((siloStress / (safeSiloLevel * 0.5 || 1)) * 2); // Max x3
  const rawCost = 5 * monetaryInflation * scarcityPenalty;
  const costOfLiving = Math.max(1, Math.floor(rawCost));

  // Estadísticas
  const publicRatio = parseFloat(((publicSilo / (currentTotalWealth || 1)) * 100).toFixed(1));
  const allStashes = [...activeBots.map(b => b.stash), (amIExpelled ? 0 : myStash)].sort((a, b) => b - a);
  const top10Count = Math.ceil(allStashes.length * 0.1);
  const wealthTop10 = allStashes.slice(0, top10Count).reduce((a, b) => a + b, 0);
  const inequalityPercentage = ((wealthTop10 / (totalPrivateWealth || 1)) * 100).toFixed(1);
  const povertyCount = activeBots.filter(b => b.stash < 20).length + (myStash < 20 ? 1 : 0);
  const povertyRate = ((povertyCount / (activePopulation || 1)) * 100).toFixed(0);

  // Sentimiento Social
  const getSocialSentiment = () => {
    if (publicSilo < safeSiloLevel * 0.1) return { icon: '🔥', text: 'ANARQUÍA', color: 'text-red-600' };
    if (costOfLiving > 20) return { icon: '🤬', text: 'INFLACIÓN', color: 'text-orange-500' };
    if (publicSilo > safeSiloLevel * 1.5) return { icon: '🤑', text: 'ABUNDANCIA', color: 'text-blue-400' };
    return { icon: '😎', text: 'ESTABLE', color: 'text-farm-green' };
  };
  const sentiment = getSocialSentiment();

  // --- 2. FUNCIONES DE LÓGICA ---
  const addNews = (text: string, type: 'INFO' | 'ALERT' | 'BANKRUPTCY_ALERT' | 'DEATH' | 'DONATION' | 'FLAVOR' | 'EXPROPRIATION' = 'INFO', data?: any) => {
    setNewsLog(prev => [{ id: Date.now() + Math.random(), text: `Día ${day}: ${text}`, type, data, resolved: false }, ...prev].slice(0, 30));
    if (activeTab !== 'NEWS') setUnreadNews(true);
  };

  const markNewsResolved = (newsId: number) => {
    setNewsLog(prev => prev.map(item => item.id === newsId ? { ...item, resolved: true } : item));
  };

  const handleNotificationTimeout = () => {
      const { voteSession, activeBailout, activeAnnouncement } = stateRef.current;
      if (voteSession) finalizeVote('ABSTAIN'); 
      else if (activeBailout) setActiveBailout(null); 
      else if (activeAnnouncement) setActiveAnnouncement(null);
  };

  const executePlayerAction = (type: ActionType, isAuto: boolean) => {
    if (isAuto || (!hasActed && !amIExpelled && !amIBankrupt)) {
        if (type === 'COLLABORATE') {
            setPublicSilo(s => s + 25); setMyStash(s => s + 10); setMyReputation(r => Math.min(100, r + 6)); setMyStats(s => ({ ...s, collaborated: s.collaborated + 1 }));
        } else if (type === 'PRIVATE') {
            setMyStash(s => s + 25); setMyStats(s => ({ ...s, private: s.private + 1 }));
        } else if (type === 'STEAL') {
            const loot = publicSilo >= 40 ? 40 : publicSilo; // Protección: No puedes robar si no hay
            setPublicSilo(s => Math.max(0, s - 40)); 
            if (loot > 0) {
                 setMyStash(s => s + (loot + 20)); 
                 setMyReputation(r => Math.max(0, r - 10)); 
                 setMyStats(s => ({ ...s, stole: s.stole + 1 }));
            } else {
                 setMyStash(s => s + 10); // Solo ingreso base si fallas
            }
        }
        if (!isAuto) setHasActed(true);
    }
  };

  const handleManualAction = (type: ActionType) => executePlayerAction(type, false);

  const donateToSilo = () => {
      if(myStash>=20 && !hasActed) { 
          setMyStash(s=>s-20); setPublicSilo(s=>s+20); setMyReputation(r=>Math.min(100,r+6)); 
          setMyStats(s => ({ ...s, donated: s.donated + 20 })); setHasActed(true); 
          addNews("💖 Has donado al pueblo.", "DONATION");
      }
  };

  // --- 3. MOTOR DE JUEGO (FIN DEL DÍA) ---
  const processDayEnd = () => {
    const currentData = stateRef.current;
    
    // Check Game Over
    const aliveCount = currentData.bots.filter(b => !b.isDead).length + (currentData.amIExpelled ? 0 : 1);
    if (aliveCount < (currentData.initialPop / 2)) {
       setIsPaused(true);
       setGamePhase('GAMEOVER');
       return;
    }

    // Noticias Random
    if (Math.random() < 0.25) { 
        const randomNews = FLAVOR_TEXTS[Math.floor(Math.random() * FLAVOR_TEXTS.length)];
        setActiveAnnouncement({ title: "📰 NOTICIA FLASH", message: randomNews, type: 'FLAVOR' });
        setNotificationTimer(100);
        addNews(randomNews, 'FLAVOR');
    }

    // Cobros Jugador
    if (!currentData.amIExpelled && !currentData.amIBankrupt) {
      if (currentData.hasActed) {
         setMyStash(prev => prev - costOfLiving);
      } else {
         if (currentData.autoPilotAction) {
            executePlayerAction(currentData.autoPilotAction, true); 
            setMyStash(prev => prev - costOfLiving);
         } else {
            setMyStash(prev => prev - costOfLiving);
            addNews("💤 Dormiste. Cobrado costo de vida.", "ALERT");
         }
      }
    }

    // Desgaste
    setMyReputation(r => Math.max(0, r - 2)); 
    setBots(prev => prev.map(b => ({ ...b, reputation: Math.max(0, b.reputation - 2) })));

    // Bancarrota check
    if (!currentData.amIBankrupt && stateRef.current.myStash < 0 && !currentData.amIExpelled) {
       setAmIBankrupt(true);
       setMyDaysBankrupt(0);
       addNews("¡ESTÁS EN QUIEBRA!", 'BANKRUPTCY_ALERT', { id: 999, name: 'TÚ', debt: stateRef.current.myStash });
    } else if (currentData.amIBankrupt) {
       setMyDaysBankrupt(days => {
           if (days >= 5) {
               setAmIExpelled(true);
               addNews("Has muerto de inanición.", 'DEATH');
               return days;
           }
           return days + 1;
       });
    }

    // Turno Bots
    processBotsTurn(currentData);

    setDay(d => d + 1);
    setHasActed(false);
    setDayProgress(0); 
  };

  const processBotsTurn = (currentData: any) => {
      const activeList = [...currentData.bots.filter((b:any) => !b.isDead), { id: 999, name: 'TÚ', reputation: currentData.myReputation, isDead: currentData.amIExpelled }];
      const topRep = activeList.sort((a,b) => b.reputation - a.reputation)[0];
      
      // Expropiación IA
      if (topRep && topRep.id !== 999 && currentData.publicSilo < (activePopulation * 20)) {
          if (Math.random() < 0.2) executeExpropriation(true, "Líder Bot");
      }

      // Juicios IA
      const top3Bots = currentData.bots.filter((b:any) => !b.isDead).sort((a:any,b:any) => b.reputation - a.reputation).slice(0, 3);
      if (top3Bots.length > 0 && Math.random() < 0.10) { 
         const judge = top3Bots[Math.floor(Math.random() * top3Bots.length)];
         const criminals = currentData.bots.filter((b:any) => !b.isDead && b.reputation < 30 && b.id !== judge.id);
         if (criminals.length > 0) {
            const victim = criminals[0];
            startVoteAgainst(victim.id, victim.name, victim.reputation, judge.name);
         }
      }

      // IA Individual
      setBots(currentBots => currentBots.map(bot => {
         if (bot.isDead) return bot;
         if (bot.isBankrupt) {
            const richBots = currentBots.filter(b => !b.isDead && !b.isBankrupt && b.stash > 300);
            if (richBots.length > 0 && Math.random() < 0.2) {
                 const savior = richBots[0];
                 const debt = Math.abs(bot.stash) + (costOfLiving * 7);
                 if (savior.stash > debt + 50) {
                    bot.stash = costOfLiving * 7; bot.isBankrupt = false; bot.daysBankrupt = 0;
                    savior.stash -= debt; savior.reputation = Math.min(100, savior.reputation + 20);
                    addNews(`🤝 ${savior.name} rescató a ${bot.name}.`);
                    return bot; 
                 }
            }
            if (bot.daysBankrupt >= 5) { addNews(`✝️ ${bot.name} murió.`, 'DEATH'); return { ...bot, isDead: true, stash: 0 }; }
            return { ...bot, daysBankrupt: bot.daysBankrupt + 1 };
         }
         
         let newStash = bot.stash - costOfLiving;
         if (newStash < 0) {
            addNews(`🆘 ${bot.name} pide rescate.`, 'BANKRUPTCY_ALERT', { id: bot.id, name: bot.name, debt: newStash });
            return { ...bot, isBankrupt: true, stash: newStash, daysBankrupt: 0 };
         }
         
         const roll = Math.random();
         const isCrisis = currentData.publicSilo < (activePopulation * 10);
         let decision: ActionType = 'PRIVATE';

         if (isCrisis && bot.personality !== 'GREEDY') {
             decision = roll < 0.8 ? 'COLLABORATE' : 'PRIVATE';
         } else {
             if (bot.personality === 'GREEDY') decision = roll < 0.6 ? 'STEAL' : 'PRIVATE';
             else if (bot.personality === 'ALTRUIST') decision = roll < 0.6 ? 'COLLABORATE' : 'PRIVATE';
             else decision = roll < 0.3 ? 'STEAL' : roll < 0.6 ? 'PRIVATE' : 'COLLABORATE';
         }

         let currentStats = { ...bot.stats };
         let newRep = bot.reputation;
         
         if (decision === 'STEAL') { 
             const loot = currentData.publicSilo >= 40 ? 40 : currentData.publicSilo;
             if (loot > 0) {
                 newStash += (loot + 20); 
                 setPublicSilo(s => Math.max(0, s - loot)); 
                 newRep -= 3; currentStats.stole += 1;
             } else {
                 newStash += 10; 
             }
         }
         else if (decision === 'PRIVATE') { newStash += 25; currentStats.private += 1; }
         else { setPublicSilo(s => s + 25); newRep += 6; newStash += 10; currentStats.collaborated += 1; }
         
         return { ...bot, reputation: Math.max(0, Math.min(100, newRep)), stash: newStash, stats: currentStats };
      }));
  };

  // --- 4. EVENTOS (Expropiación, Juicios, Rescates) ---
  const executeExpropriation = (isBotAction: boolean, leaderName: string) => {
    const targetSilo = safeSiloLevel; 
    const deficit = targetSilo - stateRef.current.publicSilo;
    if (deficit <= 0 && isBotAction) return;
    const taxPerHead = Math.ceil(deficit / activePopulation);
    let gathered = 0;
    
    if (!stateRef.current.amIExpelled && !stateRef.current.amIBankrupt) {
       const taken = Math.min(stateRef.current.myStash, taxPerHead);
       setMyStash(s => s - taken); gathered += taken;
    }
    if (!isBotAction) setMyReputation(r => Math.max(0, r - 30));

    setBots(prev => prev.map(b => {
      if (b.isDead || b.isBankrupt) return b;
      const taken = Math.min(b.stash, taxPerHead);
      gathered += taken;
      return { ...b, stash: b.stash - taken };
    }));
    setPublicSilo(prev => prev + gathered);
    
    setActiveAnnouncement({ title: "📢 EXPROPIACIÓN", message: `${leaderName} ha confiscado $${gathered}.`, type: 'EXPROPRIATION' });
    setNotificationTimer(100);
    addNews(`📢 EXPROPIACIÓN por ${leaderName}. Recaudado: $${gathered}.`, 'EXPROPRIATION');
  };

  const startVoteAgainst = (targetId: number, targetName: string, targetRep: number, accuser: string) => {
      setShowSuspects(false);
      setNotificationTimer(100);
      setVoteSession({ targetId, targetName, targetReputation: targetRep, accusedBy: accuser, isOpen: true, bailCost: costOfLiving * 5 });
  };

  const finalizeVote = (playerVote: 'YES' | 'NO' | 'ABSTAIN') => {
    if (!voteSession) return;
    if (playerVote === 'ABSTAIN') {
        addNews(`⚖️ Juicio anulado (Tiempo agotado).`, 'INFO');
        setVoteSession(null);
        return;
    }

    const { bots } = stateRef.current;
    let yes = playerVote === 'YES' ? 1 : 0; let no = playerVote === 'NO' ? 1 : 0;
    bots.filter(b => !b.isDead && b.id !== voteSession.targetId).forEach(bot => {
       const prejudice = (100 - voteSession.targetReputation) / 100;
       if (Math.random() < (prejudice - 0.1)) yes++; else no++;
    });
    if (yes > no) {
      if (voteSession.targetId === 999) { setAmIExpelled(true); setMyStash(0); addNews(`🛑 EXPULSADO.`, 'ALERT'); }
      else { setBots(prev => prev.map(b => b.id === voteSession.targetId ? { ...b, isDead: true, stash: 0 } : b)); addNews(`🔨 EXPULSADO: ${voteSession.targetName}.`, 'ALERT'); }
      setPublicSilo(prev => prev + 50); 
    } else { addNews(`🛡️ INOCENTE: ${voteSession.targetName}.`); }
    setVoteSession(null);
  };

  const openBailoutModal = (item: NewsItem) => {
     if (item.type === 'BANKRUPTCY_ALERT' && item.data && !item.resolved) {
        setNotificationTimer(100);
        setActiveBailout({ ...item.data, newsId: item.id });
     }
  };

  const handleRescue = (type: 'PRIVATE' | 'PUBLIC') => {
     if (!activeBailout) return;
     const { id, name, debt, newsId } = activeBailout;
     const emergencyFund = costOfLiving * 7;
     const totalCost = Math.abs(debt) + emergencyFund;

     if (type === 'PRIVATE') {
        if (myStash >= totalCost) {
           setMyStash(s => s - totalCost);
           setMyReputation(r => Math.min(100, r + 20)); setMyStats(s => ({ ...s, rescued: s.rescued + 1 }));
           resolveBankrupt(id, emergencyFund); addNews(`🤝 TÚ rescataste a ${name}.`);
           markNewsResolved(newsId);
        }
     } else {
        setPublicSilo(s => s - totalCost);
        resolveBankrupt(id, emergencyFund); addNews(`🏛️ Rescate PÚBLICO para ${name}.`);
        markNewsResolved(newsId);
     }
     setActiveBailout(null);
  };

  const resolveBankrupt = (id: number, finalStash: number) => {
     if (id === 999) { setMyStash(finalStash); setAmIBankrupt(false); setMyDaysBankrupt(0); }
     else { setBots(prev => prev.map(b => b.id === id ? { ...b, stash: finalStash, isBankrupt: false, daysBankrupt: 0 } : b)); }
  };

  // --- 5. BUCLE DE TIEMPO (TICK) ---
  useEffect(() => {
    let tickInterval: any;
    if (!isPaused && gamePhase === 'PLAYING') {
      const tickRate = 50; 
      tickInterval = setInterval(() => {
        setDayProgress(prev => {
          const increment = 0.5 * speedMultiplier; 
          if (prev + increment >= 100) {
            processDayEnd();
            return 0;
          }
          return prev + increment;
        });

        if (stateRef.current.voteSession || stateRef.current.activeBailout || stateRef.current.activeAnnouncement) {
            setNotificationTimer(prev => {
                const decrement = 0.8 * speedMultiplier; 
                if (prev - decrement <= 0) {
                    handleNotificationTimeout();
                    return 0;
                }
                return prev - decrement;
            });
        }
      }, tickRate);
    }
    return () => clearInterval(tickInterval);
  }, [isPaused, gamePhase, speedMultiplier]);

  // --- START GAME ---
  const startGame = () => {
    const siloStart = botCount * 100;
    const initialWealth = (botCount * 70) + 60 + siloStart; 
    
    const newBots: BotPlayer[] = Array.from({ length: botCount }).map((_, i) => ({
        id: i, name: generateName(), personality: ['ALTRUIST','GREEDY','CHAOTIC','OPPORTUNIST'][Math.floor(Math.random()*4)] as Personality,
        reputation: Math.floor(Math.random() * 30) + 40, stash: Math.floor(Math.random() * 40) + 30,
        stats: { stole: 0, collaborated: 0, private: 0, rescued: 0, donated: 0 }, isDead: false, isBankrupt: false, daysBankrupt: 0
    }));
    setBots(newBots); setPublicSilo(siloStart); setInitialPop(botCount + 1); setGamePhase('PLAYING');
    setInitialTotalWealth(initialWealth);
    setDay(1); setMyStash(60); setMyReputation(50); setIsPaused(false); setSpeedMultiplier(1);
    setAmIExpelled(false); setAmIBankrupt(false); setHasActed(false); setDayProgress(0); setAutoPilotAction(null);
    setNewsLog([{ id: 1, text: "Bienvenido a SOCIETY OS", type: 'INFO', resolved: false }]);
  };

  // --- RENDER ---

  // 1. SETUP
  if (gamePhase === 'SETUP') return (
     <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 font-pixel text-farm-green">
        <div className="w-full max-w-md border-0 sm:border-[16px] sm:border-gray-800 sm:rounded-[3rem] bg-gray-900 p-8 shadow-2xl relative overflow-hidden h-full sm:h-auto">
            <h1 className="text-4xl mb-8 text-gold text-center mt-8">SOCIETY_OS</h1>
            <label className="block mb-2 text-farm-green">POBLACIÓN: {botCount}</label>
            <input type="range" min="10" max="200" step="10" value={botCount} onChange={(e) => setBotCount(parseInt(e.target.value))} className="w-full mb-8 accent-farm-green"/>
            <button onClick={startGame} className="w-full py-4 bg-farm-green text-black font-bold rounded-xl shadow-lg hover:scale-105 transition-transform">INICIAR SIMULACIÓN</button>
            <button onClick={onBack} className="mt-8 text-center w-full text-gray-500 underline text-xs">APAGAR DISPOSITIVO</button>
        </div>
     </div>
  );

  // 2. GAME OVER
  if (gamePhase === 'GAMEOVER') {
    const allP = [...bots, { id: 999, name: 'TÚ', reputation: myReputation, stash: myStash, stats: myStats, isDead: amIExpelled, isMe: true }];
    const richest = [...allP].sort((a:any,b:any) => b.stash - a.stash)[0];
    const biggestThief = [...allP].sort((a:any,b:any) => b.stats.stole - a.stats.stole)[0];
    const mostCollaborative = [...allP].sort((a:any,b:any) => b.stats.collaborated - a.stats.collaborated)[0];
    
    const sortedList = [...allP].sort((a:any, b:any) => {
       if (gameOverSort === 'WEALTH') return b.stash - a.stash;
       if (gameOverSort === 'THEFT') return b.stats.stole - a.stats.stole;
       return b.stats.collaborated - a.stats.collaborated;
    });

    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 font-pixel">
         <div className="border-4 border-red-500 bg-gray-900 p-6 w-full max-w-md shadow-2xl rounded-xl">
            <h2 className="text-3xl text-red-500 mb-4 text-center animate-pulse">SOCIEDAD FALLIDA</h2>
            <div className="grid grid-cols-3 gap-2 mb-6">
                {[{l:'MAGNATE',v:richest,k:'WEALTH'},{l:'LADRÓN',v:biggestThief,k:'THEFT'},{l:'SANTO',v:mostCollaborative,k:'SAINT'}].map((cat:any) => (
                    <button key={cat.l} onClick={() => setGameOverSort(cat.k as any)} className={`p-2 border rounded text-xs ${gameOverSort===cat.k ? 'bg-white text-black' : 'bg-black text-gray-400'}`}>
                        <div className="font-bold">{cat.l}</div>
                        <div>{cat.v.name}</div>
                    </button>
                ))}
            </div>
            <div className="h-48 overflow-y-auto border border-gray-700 mb-4 bg-black p-2">
                <table className="w-full text-xs text-left">
                    <thead><tr><th className="text-gray-500">NOMBRE</th><th className="text-right text-gray-500">VALOR</th></tr></thead>
                    <tbody>
                        {sortedList.map((p:any,i) => (
                            <tr key={i} className={`border-b border-gray-800 ${p.isMe?'text-gold':''}`}>
                                <td>{i+1}. {p.name} {p.isDead && '💀'}</td>
                                <td className="text-right">{gameOverSort==='WEALTH'?p.stash:gameOverSort==='THEFT'?p.stats.stole:p.stats.collaborated}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={() => setGamePhase('SETUP')} className="w-full py-4 bg-red-600 text-white font-bold hover:bg-red-500 rounded">REINICIAR SISTEMA</button>
         </div>
      </div>
    );
  }

  // 3. MAIN GAME
  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center p-0 sm:p-4 font-pixel select-none">
      <div className="relative w-full max-w-md h-full sm:h-[90vh] sm:max-h-[900px] bg-black sm:border-[12px] sm:border-gray-800 sm:rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col sm:ring-2 sm:ring-gray-700">
         
         {/* NOTCH */}
         <div className="hidden sm:flex absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-5 bg-gray-800 rounded-b-xl z-50 justify-center items-center">
            <div className="w-12 h-1 bg-gray-900 rounded-full"></div>
         </div>

         {/* TOP BAR */}
         <div className="h-16 bg-gray-900 border-b border-soil flex items-center px-4 justify-between shrink-0 relative z-20 pt-2 sm:pt-4">
            <div className="flex flex-col">
               <span className="text-gold text-lg leading-none">DÍA {day}</span>
               <span className="text-[10px] text-gray-400">Población: {activePopulation}</span>
            </div>
            <div className="flex-1 mx-3 flex flex-col justify-center">
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                   <div className={`h-full transition-all duration-100 ease-linear ${dayProgress > 80 ? 'bg-red-500' : 'bg-blue-400'}`} style={{ width: `${dayProgress}%` }} />
                </div>
            </div>
            <div className="text-right">
                <span className={`block text-xl leading-none ${amIBankrupt ? 'text-red-500 animate-pulse' : 'text-farm-green'}`}>${myStash}</span>
                <span className="text-[10px] text-danger">COSTO: -{costOfLiving}</span>
            </div>
         </div>

         {/* DYNAMIC ISLAND */}
         {(voteSession?.isOpen || activeBailout || activeAnnouncement) && (
            <div className="absolute top-16 left-0 right-0 z-40 p-2 animate-slide-down">
                <div className={`bg-gray-800 border-2 rounded-xl shadow-2xl p-3 overflow-hidden ${activeAnnouncement?.type === 'FLAVOR' ? 'border-pink-500' : activeAnnouncement?.type === 'EXPROPRIATION' ? 'border-red-500' : 'border-gold'}`}>
                    <div className={`absolute top-0 left-0 h-1 transition-all duration-75 ease-linear ${activeAnnouncement?.type === 'FLAVOR' ? 'bg-pink-500' : 'bg-gold'}`} style={{ width: `${notificationTimer}%` }}></div>

                    {voteSession && (
                        <div className="flex flex-col gap-2">
                             <div className="flex justify-between items-center"><span className="text-[10px] text-gold font-bold uppercase">🚨 JUICIO</span></div>
                             <p className="text-xs text-white text-center">{voteSession.accusedBy} acusa a <span className="font-bold text-red-400">{voteSession.targetName}</span></p>
                             <div className="flex gap-2 mt-1">
                                 <button onClick={() => finalizeVote('YES')} className="flex-1 bg-red-900 text-red-100 text-[10px] py-2 rounded">CULPABLE</button>
                                 <button onClick={() => finalizeVote('NO')} className="flex-1 bg-blue-900 text-blue-100 text-[10px] py-2 rounded">INOCENTE</button>
                                 <button onClick={() => finalizeVote('ABSTAIN')} className="px-2 bg-gray-700 text-gray-300 text-[10px] py-2 rounded">OMITIR</button>
                             </div>
                        </div>
                    )}

                    {activeBailout && (
                        <div className="flex flex-col gap-2">
                             <div className="flex justify-between items-center"><span className="text-[10px] text-gold font-bold uppercase">🚑 SOS DEUDA</span></div>
                             <p className="text-xs text-white text-center">Rescatar a <span className="text-blue-400">{activeBailout.name}</span> cuesta <span className="text-gold font-bold">${Math.abs(activeBailout.debt) + (costOfLiving * 7)}</span></p>
                             <div className="flex gap-2 mt-1">
                                 <button disabled={myStash < (Math.abs(activeBailout.debt) + (costOfLiving * 7))} onClick={() => handleRescue('PRIVATE')} className="flex-1 bg-gold text-black text-[10px] py-2 rounded disabled:opacity-50">PAGAR</button>
                                 <button onClick={() => setActiveBailout(null)} className="px-2 bg-gray-700 text-gray-300 text-[10px] py-2 rounded">IGNORAR</button>
                             </div>
                        </div>
                    )}

                    {activeAnnouncement && (
                        <div className="flex flex-col gap-1">
                             <div className="flex justify-between items-center">
                                 <span className={`text-[10px] font-bold uppercase ${activeAnnouncement.type==='FLAVOR'?'text-pink-400':'text-red-400'}`}>{activeAnnouncement.title}</span>
                             </div>
                             <p className="text-xs text-white">{activeAnnouncement.message}</p>
                        </div>
                    )}
                </div>
            </div>
         )}

         {/* MAIN CONTENT AREA */}
         <div className="flex-1 overflow-y-auto relative bg-gray-950 p-2 scrollbar-hide pb-32">
            {amIExpelled && <div className="p-4 bg-red-900 text-white text-center border-2 border-red-500 mb-4 animate-pulse">🛑 EXPULSADO</div>}
            {amIBankrupt && <div className="p-4 bg-yellow-900 text-yellow-200 text-center border-2 border-yellow-500 mb-4">⚠ CUENTA CONGELADA</div>}

            {activeTab === 'ACTIONS' && (
               <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                     <div className="bg-gray-900 p-3 border border-gray-700 rounded shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                        <p className="text-gray-400 text-[10px] uppercase">Silo Público</p>
                        <p className={`text-2xl ${publicSilo < (activePopulation*10) ? 'text-red-500' : 'text-farm-green'}`}>{publicSilo}</p>
                     </div>
                     <div className="bg-gray-900 p-3 border border-gray-700 rounded">
                        <p className="text-gray-400 text-[10px] uppercase">Reputación</p>
                        <p className="text-2xl text-blue-400">{myReputation}</p>
                     </div>
                  </div>

                  <button onClick={donateToSilo} disabled={hasActed || myStash < 20} className="w-full py-2 bg-blue-900 border border-blue-500 text-blue-200 text-xs rounded hover:bg-blue-800 disabled:opacity-50">💝 DONAR AL PUEBLO (-$20 / +Rep)</button>

                  <div className="flex flex-col gap-3">
                     {[
                       { id: 'COLLABORATE', label: 'COLABORAR', sub: '+25 Silo / +10 Tú', color: 'bg-farm-green', text: 'text-black', border: 'border-green-600' },
                       { id: 'PRIVATE', label: 'TRABAJO PRIVADO', sub: '+0 Silo / +25 Tú', color: 'bg-gold', text: 'text-black', border: 'border-yellow-600' },
                       { id: 'STEAL', label: 'ROBAR RECURSOS', sub: `-${publicSilo>=40?40:publicSilo} Silo / +${publicSilo>=40?60:'10 (Vacío)'} Tú`, color: 'bg-red-600', text: 'text-white', border: 'border-red-800' }
                     ].map((action) => (
                       <div key={action.id} className={`flex items-stretch bg-gray-900 border ${action.border} rounded-lg overflow-hidden relative transition-transform active:scale-95 shadow-lg`}>
                          <button onClick={() => handleManualAction(action.id as ActionType)} disabled={hasActed || amIBankrupt} className={`flex-1 p-4 text-left hover:brightness-110 ${hasActed ? 'opacity-40 grayscale' : ''}`}>
                             <div className={`text-sm font-bold ${action.id === 'STEAL' ? 'text-red-400' : action.id === 'PRIVATE' ? 'text-yellow-400' : 'text-green-400'}`}>{action.label}</div>
                             <div className="text-[10px] text-gray-400">{action.sub}</div>
                          </button>
                          <div className="w-16 bg-black flex flex-col items-center justify-center border-l border-gray-700">
                             <span className="text-[8px] text-gray-500 mb-1">AUTO</span>
                             <button onClick={() => setAutoPilotAction(prev => prev === action.id ? null : action.id as ActionType)} className={`w-8 h-4 rounded-full relative transition-colors ${autoPilotAction === action.id ? action.color : 'bg-gray-700'}`}>
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${autoPilotAction === action.id ? 'right-0.5' : 'left-0.5'}`}></div>
                             </button>
                          </div>
                          {hasActed && !amIBankrupt && <div className="absolute inset-0 bg-black bg-opacity-50 pointer-events-none" />}
                       </div>
                     ))}
                  </div>
                  {hasActed && <div className="text-center text-xs text-gray-500 mt-2">✅ JORNADA COMPLETADA</div>}
                  {!hasActed && !autoPilotAction && <div className="text-center text-[10px] text-red-400 mt-2 animate-pulse">⚠ SI NO ACTÚAS, PERDERÁS EL TURNO</div>}
               </div>
            )}

            {activeTab === 'STATS' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h2 className="text-gray-500 text-xs">PANEL DE DATOS</h2>
                      <button onClick={() => setEditMode(!editMode)} className={`text-xs px-2 py-1 rounded ${editMode ? 'bg-gold text-black' : 'bg-gray-800 text-gray-400'}`}>✏️ EDITAR</button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {widgets.wealth && (
                            <div className={`bg-gray-800 p-4 rounded text-center col-span-1 relative ${editMode?'animate-pulse border border-gold':''}`}>
                                {editMode && <button onClick={()=>setWidgets(w=>({...w, wealth:false}))} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-xs">x</button>}
                                <h3 className="text-gray-400 text-[10px] mb-2">CALIDAD DE VIDA</h3>
                                <div className="text-4xl mb-1">{costOfLiving > 30 ? '🤬' : costOfLiving > 15 ? '😨' : '😎'}</div>
                                <p className="text-xs text-danger">Cost: ${costOfLiving}</p>
                            </div>
                        )}
                        {widgets.sentiment && (
                            <div className={`bg-gray-800 p-4 rounded text-center col-span-1 relative ${editMode?'animate-pulse border border-gold':''}`}>
                                {editMode && <button onClick={()=>setWidgets(w=>({...w, sentiment:false}))} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-xs">x</button>}
                                <h3 className="text-gray-400 text-[10px] mb-2">CLIMA SOCIAL</h3>
                                <div className="text-4xl mb-1">{sentiment.icon}</div>
                                <p className={`text-xs ${sentiment.color}`}>{sentiment.text}</p>
                            </div>
                        )}
                        {widgets.gini && (
                            <div className={`bg-gray-800 p-4 rounded col-span-2 relative ${editMode?'animate-pulse border border-gold':''}`}>
                                {editMode && <button onClick={()=>setWidgets(w=>({...w, gini:false}))} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-xs">x</button>}
                                <p className="text-[10px] text-gray-400 uppercase mb-1">GINI (Riqueza Top 10%):</p>
                                <div className="w-full bg-gray-700 h-3 rounded-full overflow-hidden relative"><div className="h-full bg-gold absolute left-0" style={{width: `${inequalityPercentage}%`}}></div></div>
                                <p className="text-right text-xs text-gold mt-1">{inequalityPercentage}%</p>
                            </div>
                        )}
                        {widgets.distribution && (
                           <div className={`bg-gray-800 p-4 rounded col-span-2 relative ${editMode?'animate-pulse border border-gold':''}`}>
                              {editMode && <button onClick={()=>setWidgets(w=>({...w, distribution:false}))} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-xs">x</button>}
                              <p className="text-[10px] text-gray-400 uppercase mb-2">DISTRIBUCIÓN TOTAL</p>
                              <div className="flex h-6 w-full rounded overflow-hidden">
                                  <div style={{width: `${publicRatio}%`}} className="bg-farm-green flex items-center justify-center text-[9px] text-black">PÚBLICO {publicRatio}%</div>
                                  <div style={{width: `${100-publicRatio}%`}} className="bg-gold flex items-center justify-center text-[9px] text-black">PRIVADO</div>
                              </div>
                           </div>
                        )}
                        {widgets.poverty && (
                           <div className={`bg-gray-800 p-4 rounded col-span-2 relative ${editMode?'animate-pulse border border-gold':''}`}>
                              {editMode && <button onClick={()=>setWidgets(w=>({...w, poverty:false}))} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-xs">x</button>}
                              <div className="flex justify-between items-center">
                                 <div><p className="text-[10px] text-gray-400 uppercase">INDICE DE POBREZA</p><p className="text-xs text-gray-500">Bots con &lt; $20</p></div>
                                 <p className={`text-2xl font-bold ${parseInt(povertyRate) > 30 ? 'text-red-500' : 'text-white'}`}>{povertyRate}%</p>
                              </div>
                           </div>
                        )}
                        {editMode && (
                             <div className="col-span-2 flex gap-2 flex-wrap justify-center border-t border-gray-700 pt-4">
                                 {!widgets.wealth && <button onClick={()=>setWidgets(w=>({...w, wealth:true}))} className="bg-gray-700 px-2 py-1 text-xs text-green-400">+ CALIDAD</button>}
                                 {!widgets.sentiment && <button onClick={()=>setWidgets(w=>({...w, sentiment:true}))} className="bg-gray-700 px-2 py-1 text-xs text-green-400">+ CLIMA</button>}
                                 {!widgets.gini && <button onClick={()=>setWidgets(w=>({...w, gini:true}))} className="bg-gray-700 px-2 py-1 text-xs text-green-400">+ GINI</button>}
                                 {!widgets.distribution && <button onClick={()=>setWidgets(w=>({...w, distribution:true}))} className="bg-gray-700 px-2 py-1 text-xs text-green-400">+ DISTRIB.</button>}
                                 {!widgets.poverty && <button onClick={()=>setWidgets(w=>({...w, poverty:true}))} className="bg-gray-700 px-2 py-1 text-xs text-green-400">+ POBREZA</button>}
                             </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'NEWS' && (
                <div className="space-y-2">
                    {newsLog.map(n => (
                       <div key={n.id} onClick={() => openBailoutModal(n)} className={`p-3 text-xs border-l-4 rounded bg-gray-900 ${n.type==='EXPROPRIATION'?'border-orange-500 text-orange-200':n.type==='DONATION'?'border-purple-500 text-purple-200':n.type==='DEATH'?'border-gray-500':n.type==='ALERT'?'border-red-500':n.type==='FLAVOR'?'border-pink-500 text-pink-200':'border-blue-500'} ${n.type==='BANKRUPTCY_ALERT'&&!n.resolved?'cursor-pointer hover:bg-gray-800':''}`}>
                          <p>{n.text}</p>
                          {n.resolved && <span className="text-[9px] text-green-500 font-bold">RESUELTO</span>}
                       </div>
                    ))}
                </div>
            )}
            
            {activeTab === 'RANKING' && (
                <div className="pb-20">
                   <div className="p-2 mb-2 bg-gray-800 text-[10px] text-center text-gray-400">🔒 ACTIVOS PRIVADOS OCULTOS</div>
                   <table className="w-full text-xs text-left">
                      <thead className="text-gray-500 border-b border-gray-700"><tr><th className="p-2">#</th><th>CIUDADANO</th><th className="text-right">REP</th><th className="text-right">$$</th></tr></thead>
                      <tbody>
                         {[...bots, {id:999, name:'⭐ TÚ', stash:myStash, reputation:myReputation} as any].filter(p => !p.isDead).sort((a,b)=>b.reputation - a.reputation).map((p,i) => (
                            <tr key={p.id} className={`border-b border-gray-800 ${p.id===999 ? 'text-gold bg-gray-900' : 'text-gray-400'}`}>
                               <td className="p-2 flex items-center gap-1">{i===0 && '🥇'} {i===1 && '🥈'} {i===2 && '🥉'} {i+1}</td>
                               <td>{p.name} {p.isBankrupt && '(SOS)'}</td>
                               <td className="text-right text-blue-300">{p.reputation}</td>
                               <td className="text-right font-mono pl-2">{p.id === 999 ? p.stash : '🔒'}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
            )}

            {activeTab === 'LEADER' && (
                <div className="grid grid-cols-2 gap-4 p-4">
                    <button onClick={() => { setShowSuspects(true); }} className="bg-purple-900 p-6 border border-purple-500 rounded text-center"><span className="text-2xl block mb-2">⚖️</span> JUICIOS</button>
                    <button onClick={() => executeExpropriation(false, "JUGADOR")} className="bg-red-900 p-6 border border-red-500 rounded text-center"><span className="text-2xl block mb-2">📢</span> EXPROPIAR</button>
                </div>
            )}
         </div>

         {/* SPEED CONTROL */}
         <div className="absolute bottom-[4.5rem] right-4 z-30 flex gap-1 bg-black bg-opacity-90 px-3 py-2 rounded-full border border-gray-700 backdrop-blur-sm shadow-xl">
             {[0, 0.5, 1, 3, 5, 10].map(s => (
                 <button key={s} onClick={() => { setSpeedMultiplier(s); setIsPaused(s === 0); }} className={`w-6 h-6 rounded-full text-[8px] flex items-center justify-center font-bold transition-all ${speedMultiplier === s && !isPaused ? 'bg-farm-green text-black scale-110' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{s === 0 ? '⏸' : `x${s}`}</button>
             ))}
         </div>

         {/* DOCK */}
         <div className="h-16 bg-gray-900 border-t border-soil shrink-0 flex items-center justify-around z-30 pb-safe sm:rounded-b-[2rem]">
            {[
              { id: 'ACTIONS', icon: '⚡', label: 'ACCIONES' },
              { id: 'STATS', icon: '📊', label: 'DATOS' },
              { id: 'NEWS', icon: '📡', label: 'RED', alert: unreadNews },
              { id: 'RANKING', icon: '🏆', label: 'RANGO' },
              { id: 'LEADER', icon: '👑', label: 'MANDO', hidden: ![...bots, {id:999,reputation:myReputation} as any].sort((a,b)=>b.reputation-a.reputation).slice(0,3).some(p=>p.id===999) }
            ].map(tab => !tab.hidden && (
               <button 
                  key={tab.id} 
                  onClick={() => { setActiveTab(tab.id as TabType); if(tab.id === 'NEWS') setUnreadNews(false); }} 
                  className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === tab.id ? 'text-farm-green bg-gray-800' : 'text-gray-500'}`}
               >
                  <div className="relative">
                     <span className="text-xl mb-1 block">{tab.icon}</span>
                     {tab.alert && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                  </div>
                  <span className="text-[9px] font-terminal">{tab.label}</span>
               </button>
            ))}
         </div>

         {/* MODAL SUSPECTS */}
         {showSuspects && (
           <div className="absolute inset-0 z-50 bg-black bg-opacity-90 p-8 flex flex-col animate-fade-in">
               <h2 className="text-xl text-danger mb-4 text-center">SELECCIONAR ACUSADO</h2>
               <div className="flex-1 overflow-y-auto border border-gray-700">
                   {bots.filter(b => !b.isDead).map(b => (
                       <button key={b.id} onClick={() => startVoteAgainst(b.id, b.name, b.reputation, 'TÚ')} className="w-full text-left p-4 border-b border-gray-800 text-white hover:bg-red-900 flex justify-between"><span>{b.name}</span><span className="text-gray-400">{b.reputation} Rep</span></button>
                   ))}
               </div>
               <button onClick={() => { setShowSuspects(false); }} className="p-4 bg-gray-800 mt-4 text-white">CANCELAR</button>
           </div>
         )}
      </div>
    </div>
  );
}

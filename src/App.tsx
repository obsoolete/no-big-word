/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Trophy, Shield, Users, Info, ChevronRight, RotateCcw, AlertTriangle, Hammer, Trash2, Plus, Minus, User, Swords, Settings, X, LogOut, RefreshCw, PlayCircle } from 'lucide-react';
import { INITIAL_CARDS, CardItem } from './constants';
import { countSyllables } from './gameService';

const SAVE_KEY = 'no_big_word_v3';

const playSound = (type: 'tick' | 'buzzer' | 'bop' | 'correct') => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  const now = ctx.currentTime;
  
  if (type === 'tick') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'buzzer') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === 'bop') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'correct') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.2); // C6
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }
};

type GameMode = 'teams' | 'solo';
type GameState = 'welcome' | 'setup' | 'playing' | 'confirming' | 'round_end' | 'game_over';

interface Participant {
  id: number;
  name: string;
  color: string;
  members: string[];
  score: number;
  totalCorrect: number;
  totalBops: number;
}

const TEAM_COLORS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#facc15' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Cyan', hex: '#22d3ee' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Teal', hex: '#2dd4bf' },
  { name: 'Lime', hex: '#a3e635' },
  { name: 'Amber', hex: '#fbbf24' },
  { name: 'Rose', hex: '#fb7185' },
  { name: 'Fuchsia', hex: '#e879f9' },
  { name: 'Violet', hex: '#c084fc' },
  { name: 'Sky', hex: '#38bdf8' },
  { name: 'Emerald', hex: '#34d399' },
  { name: 'Mint', hex: '#4ade80' },
  { name: 'Gold', hex: '#d4af37' },
  { name: 'Bronze', hex: '#cd7f32' }
];

type FeedbackType = 'easy' | 'hard' | 'skip' | 'bop';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [gameState, setGameState] = useState<GameState>('welcome');
  const [gameMode, setGameMode] = useState<GameMode>('teams');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState(0);
  const [roundsPerParticipant, setRoundsPerParticipant] = useState(2);
  
  const [cards, setCards] = useState<CardItem[]>(INITIAL_CARDS);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [roundPoints, setRoundPoints] = useState(0);
  const [roundStats, setRoundStats] = useState({ easy: 0, hard: 0, skip: 0, bops: 0 });
  const [isBopActive, setIsBopActive] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState<FeedbackType | null>(null);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Load state on mount
  useEffect(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setGameState(data.gameState || 'welcome');
        setGameMode(data.gameMode || 'teams');
        setParticipants(data.participants || []);
        setCurrentParticipantIndex(data.currentParticipantIndex || 0);
        setRoundsPerParticipant(data.roundsPerParticipant || 2);
        setCards(data.cards || INITIAL_CARDS);
        setCurrentCardIndex(data.currentCardIndex || 0);
        setRoundsPlayed(data.roundsPlayed || 0);
        setTimeLeft(data.timeLeft ?? 60);
        setRoundPoints(data.roundPoints ?? 0);
        const savedStats = data.roundStats || {};
        setRoundStats({
          easy: savedStats.easy ?? 0,
          hard: savedStats.hard ?? 0,
          skip: savedStats.skip ?? 0,
          bops: savedStats.bops ?? 0
        });
      } catch (e) {
        console.error("Failed to load saved game", e);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save state on change
  useEffect(() => {
    if (!isInitialized) return;
    const data = {
      gameState,
      gameMode,
      participants,
      currentParticipantIndex,
      roundsPerParticipant,
      cards,
      currentCardIndex,
      roundsPlayed,
      timeLeft,
      roundPoints,
      roundStats
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }, [isInitialized, gameState, gameMode, participants, currentParticipantIndex, roundsPerParticipant, cards, currentCardIndex, roundsPlayed, timeLeft, roundPoints, roundStats]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const maxTotalRounds = participants.length * roundsPerParticipant;

  const handleSetupComplete = (mode: GameMode, parts: Participant[], totalRounds: number) => {
    setGameMode(mode);
    setParticipants(parts);
    setRoundsPerParticipant(totalRounds);
    setRoundsPlayed(0);
    setCurrentParticipantIndex(0);
    setGameState('round_end');
  };

  const startRound = () => {
    setRoundPoints(0);
    setRoundStats({ easy: 0, hard: 0, skip: 0, bops: 0 });
    setTimeLeft(60);
    setGameState('playing');
    setCards(prev => [...prev].sort(() => Math.random() - 0.5));
    setCurrentCardIndex(0);
  };

  const handleNextCard = (points: number, isSkip = false) => {
    setRoundPoints(prev => prev + points);
    if (points === 1) {
      setRoundStats(prev => ({ ...prev, easy: prev.easy + 1 }));
      playSound('correct');
      triggerFeedback('easy');
    } else if (points === 3) {
      setRoundStats(prev => ({ ...prev, hard: prev.hard + 1 }));
      playSound('correct');
      triggerFeedback('hard');
    } else if (points < 0) {
      if (isSkip) {
        setRoundStats(prev => ({ ...prev, skip: prev.skip + 1 }));
        triggerFeedback('skip');
      } else {
        setRoundStats(prev => ({ ...prev, bops: prev.bops + 1 }));
        playSound('bop');
        triggerFeedback('bop');
      }
    }
    setCurrentCardIndex(prev => (prev + 1) % cards.length);
  };

  const triggerFeedback = (type: FeedbackType) => {
    setActiveFeedback(type);
    if (type === 'bop') {
      setIsBopActive(true);
      setTimeout(() => setIsBopActive(false), 500);
    }
    setTimeout(() => setActiveFeedback(null), 400);
  };

  const endRound = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState('confirming');
  }, []);

  const confirmRoundResults = (finalRoundScore: number, lastMinutePoints: number) => {
    const totalWithLastSecond = finalRoundScore + lastMinutePoints;
    const roundCorrect = roundStats.easy + roundStats.hard;
    const finalCorrect = roundCorrect + (lastMinutePoints > 0 ? 1 : 0);
    const finalBops = roundStats.bops + (lastMinutePoints < 0 ? 1 : 0);

    setParticipants(prev => prev.map((p, idx) => {
      if (idx === currentParticipantIndex) {
        return {
          ...p,
          score: p.score + totalWithLastSecond,
          totalCorrect: p.totalCorrect + finalCorrect,
          totalBops: p.totalBops + finalBops
        };
      }
      return p;
    }));

    const nextRoundCount = roundsPlayed + 1;
    setRoundsPlayed(nextRoundCount);

    if (nextRoundCount >= maxTotalRounds) {
      setGameState('game_over');
    } else {
      const nextIdx = (currentParticipantIndex + 1) % participants.length;
      setCurrentParticipantIndex(nextIdx);
      setGameState('round_end');
    }
  };

  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const nextTime = prev - 1;
          if (nextTime <= 5 && nextTime > 0) {
            playSound('tick');
          }
          return nextTime;
        });
      }, 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      playSound('buzzer');
      endRound();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, timeLeft, endRound]);

  const resetGame = () => {
    setParticipants([]);
    setCurrentParticipantIndex(0);
    setRoundsPlayed(0);
    setGameState('welcome');
    setShowSettings(false);
    localStorage.removeItem(SAVE_KEY);
  };

  const restartCurrentRound = () => {
    startRound();
    setShowSettings(false);
  };

  const restartFullGame = () => {
    // Reset scores and rounds but keep participants
    setParticipants(prev => prev.map(p => ({ ...p, score: 0, totalCorrect: 0, totalBops: 0 })));
    setRoundsPlayed(0);
    setCurrentParticipantIndex(0);
    setGameState('round_end');
    setShowSettings(false);
  };

  const currentParticipant = participants[currentParticipantIndex];

  if (!isInitialized) return null;

  return (
    <div className="min-h-screen bg-[#FFD700] text-[#1a1a1a] font-sans selection:bg-[#FF4500]">
      {/* Background Decal */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
      
      {/* Top Bar with Settings */}
      <div className="fixed top-0 left-0 right-0 p-4 flex justify-end z-50 pointer-events-none">
        <button 
          onClick={() => setShowSettings(true)}
          className="pointer-events-auto w-12 h-12 bg-white border-4 border-[#1a1a1a] rounded-2xl flex items-center justify-center shadow-[4px_4px_0_#1a1a1a] active:translate-y-1 active:shadow-none transition-all hover:bg-gray-50"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#1a1a1a]/80 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white border-8 border-[#1a1a1a] rounded-[3rem] p-8 shadow-[12px_12px_0_#FF4500]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Settings</h3>
                <button onClick={() => setShowSettings(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="space-y-4">
                {gameState === 'playing' && (
                  <button 
                    onClick={restartCurrentRound}
                    className="w-full flex items-center gap-4 bg-blue-50 text-blue-600 p-4 rounded-3xl font-black uppercase tracking-tight text-lg border-4 border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    <RefreshCw className="w-6 h-6" />
                    Restart Round
                  </button>
                )}

                {gameState !== 'welcome' && gameState !== 'setup' && (
                  <button 
                    onClick={restartFullGame}
                    className="w-full flex items-center gap-4 bg-orange-50 text-orange-600 p-4 rounded-3xl font-black uppercase tracking-tight text-lg border-4 border-orange-200 hover:bg-orange-100 transition-colors"
                  >
                    <PlayCircle className="w-6 h-6" />
                    Restart Game
                  </button>
                )}

                <button 
                  onClick={resetGame}
                  className="w-full flex items-center gap-4 bg-red-50 text-red-600 p-4 rounded-3xl font-black uppercase tracking-tight text-lg border-4 border-red-200 hover:bg-red-100 transition-colors"
                >
                  <LogOut className="w-6 h-6" />
                  Quit to Title
                </button>

                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-[#1a1a1a] text-white p-4 rounded-3xl font-black uppercase tracking-tight text-lg shadow-[0_4px_0_#4F46E5] active:translate-y-1 active:shadow-none transition-all mt-4"
                >
                  Close
                </button>

                <div className="mt-8 text-center text-[10px] font-black uppercase tracking-widest opacity-20">
                  Version 1.0.1
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative max-w-lg mx-auto min-h-screen flex flex-col p-6">
        <AnimatePresence mode="wait">
          {gameState === 'welcome' && (
            <WelcomeView onGoToSetup={() => setGameState('setup')} />
          )}

          {gameState === 'setup' && (
            <SetupView 
              onComplete={handleSetupComplete} 
              onBack={() => setGameState('welcome')}
            />
          )}

          {gameState === 'confirming' && (
            <RoundConfirmationView 
              roundPoints={roundPoints}
              roundStats={roundStats}
              participants={participants}
              currentIdx={currentParticipantIndex}
              onConfirm={confirmRoundResults}
            />
          )}

          {gameState === 'round_end' && (() => {
            const currentLap = Math.floor(roundsPlayed / participants.length);
            const nextIdx = (currentParticipantIndex + 1) % participants.length;
            const nextParticipant = participants[nextIdx];
            
            let talkerName = "";
            let bopperName = "";
            
            if (gameMode === 'solo') {
              talkerName = currentParticipant.name;
              bopperName = nextParticipant?.name || 'Someone';
            } else {
              const talkerMemberIdx = currentLap % Math.max(1, currentParticipant.members.length);
              talkerName = currentParticipant.members[talkerMemberIdx] || currentParticipant.name;
              
              const bopperMemberIdx = currentLap % Math.max(1, nextParticipant?.members.length || 1);
              bopperName = nextParticipant?.members[bopperMemberIdx] || nextParticipant?.name || 'Someone';
            }

            return (
              <RoundPromptView 
                participant={currentParticipant} 
                onStart={startRound} 
                roundNumber={currentLap + 1}
                isSolo={gameMode === 'solo'}
                talkerName={talkerName}
                bopperName={bopperName}
              />
            );
          })()}

          {gameState === 'playing' && (
            <PlayView 
              card={cards[currentCardIndex]} 
              timeLeft={timeLeft} 
              roundPoints={roundPoints}
              onNext={handleNextCard}
              participantName={currentParticipant?.name}
              participantColor={currentParticipant?.color}
              isBopActive={isBopActive}
            />
          )}

          {gameState === 'game_over' && (
            <GameOverView participants={participants} onReset={resetGame} />
          )}
        </AnimatePresence>
      </main>

      {/* FEEDBACK OVERLAY */}
      <AnimatePresence>
        {activeFeedback && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{ scale: 1.2, opacity: 1, rotate: activeFeedback === 'easy' ? 6 : activeFeedback === 'hard' ? -6 : activeFeedback === 'bop' ? 12 : 0 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className={`px-12 py-6 rounded-full font-black text-6xl shadow-2xl border-8 border-white tracking-tighter ${
              activeFeedback === 'easy' ? 'bg-[#22c55e] text-white shadow-[#166534]' : 
              activeFeedback === 'hard' ? 'bg-[#3b82f6] text-white shadow-[#1e40af]' : 
              activeFeedback === 'skip' ? 'bg-gray-500 text-white shadow-gray-700' : 
              'bg-red-600 text-white shadow-red-900'
            }`}>
              {activeFeedback.toUpperCase()}!
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoundConfirmationView({ roundPoints, roundStats, participants, currentIdx, onConfirm }: { 
  roundPoints: number, roundStats: { easy: number, hard: number, skip: number, bops: number }, participants: Participant[], currentIdx: number, onConfirm: (p: number, extra: number) => void 
}) {
  const [lastSecondAward, setLastSecondAward] = useState<0 | 1 | 3 | -1>(0);
  const currentP = participants[currentIdx];

  const displayPoints = roundPoints + lastSecondAward;
  const displayEasy = roundStats.easy + (lastSecondAward === 1 ? 1 : 0);
  const displayHard = roundStats.hard + (lastSecondAward === 3 ? 1 : 0);
  const displayBops = roundStats.bops + (lastSecondAward === -1 ? 1 : 0);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col gap-6 py-4"
    >
      <div className="flex flex-col items-center text-center space-y-2 w-full">
        <div className="inline-block px-4 py-1 rounded-full text-[10px] font-black text-white uppercase mb-2" style={{ backgroundColor: currentP?.color || '#1a1a1a' }}>
          {currentP?.name}'s Result
        </div>
        <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter text-[#1a1a1a]">
          Turn Over!
        </h2>
      </div>

      <div className="bg-white border-4 border-[#1a1a1a] rounded-[2rem] p-8 text-center shadow-[8px_8px_0_#1a1a1a] relative overflow-hidden transition-colors">
        <div className="text-6xl font-black text-[#4F46E5] relative z-10 transition-transform">
          {displayPoints}
        </div>
        <div className="text-xs font-black uppercase opacity-60 relative z-10">Points Won This Turn</div>
        {lastSecondAward !== 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`absolute top-4 right-8 text-2xl font-black ${lastSecondAward > 0 ? 'text-green-500' : 'text-red-500'}`}
          >
            {lastSecondAward > 0 ? '+' : ''}{lastSecondAward}
          </motion.div>
        )}
      </div>

      <div className="bg-white border-4 border-[#1a1a1a] rounded-[2rem] p-4 shadow-[8px_8px_0_#1a1a1a]">
        <h3 className="text-[10px] font-black uppercase mb-3 text-center opacity-40 italic">Round Statistics</h3>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className={`text-xl font-black transition-colors ${lastSecondAward === 1 ? 'text-green-600 scale-110' : 'text-[#22c55e]'}`}>{displayEasy || 0}</div>
            <div className="text-[8px] font-black uppercase opacity-60">Easy</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-black transition-colors ${lastSecondAward === 3 ? 'text-blue-600 scale-110' : 'text-[#3b82f6]'}`}>{displayHard || 0}</div>
            <div className="text-[8px] font-black uppercase opacity-60">Hard</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-gray-400">{roundStats.skip || 0}</div>
            <div className="text-[8px] font-black uppercase opacity-60">Skip</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-black transition-colors ${lastSecondAward === -1 ? 'text-red-600 scale-110' : 'text-red-500'}`}>{displayBops || 0}</div>
            <div className="text-[8px] font-black uppercase opacity-60">Bop</div>
          </div>
        </div>
      </div>

      <div className="bg-white border-4 border-[#1a1a1a] rounded-[2rem] p-6 shadow-[8px_8px_0_#059669]">
        <h3 className="text-xs font-black uppercase mb-4 text-center">Last Second Guess?</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => setLastSecondAward(0)} className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 border-[#1a1a1a] transition-all ${lastSecondAward === 0 ? 'bg-[#1a1a1a] text-white shadow-inner translate-y-0.5' : 'bg-transparent text-[#1a1a1a]'}`}>No</button>
          <button onClick={() => setLastSecondAward(1)} className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 border-[#1a1a1a] transition-all ${lastSecondAward === 1 ? 'bg-[#22c55e] text-white shadow-inner translate-y-0.5' : 'bg-transparent text-[#1a1a1a] border-[#22c55e]/30'}`}>Easy (+1)</button>
          <button onClick={() => setLastSecondAward(3)} className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 border-[#1a1a1a] transition-all ${lastSecondAward === 3 ? 'bg-[#3b82f6] text-white shadow-inner translate-y-0.5' : 'bg-transparent text-[#1a1a1a] border-[#3b82f6]/30'}`}>Hard (+3)</button>
          <button onClick={() => setLastSecondAward(-1)} className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 border-[#1a1a1a] transition-all ${lastSecondAward === -1 ? 'bg-[#ef4444] text-white shadow-inner translate-y-0.5' : 'bg-transparent text-[#1a1a1a] border-[#ef4444]/30'}`}>Bop (-1)</button>
        </div>
      </div>

      <div className="flex-1 bg-[#1a1a1a] rounded-[2.5rem] p-6 text-white border-4 border-white shadow-xl overflow-y-auto max-h-[30vh] custom-scrollbar">
        <h4 className="text-center text-[10px] font-black uppercase tracking-widest mb-6 opacity-40">Overall Leaderboard</h4>
        <div className="space-y-4">
          {[...participants].sort((a, b) => {
            const scoreA = a.id === currentP?.id ? a.score + displayPoints : a.score;
            const scoreB = b.id === currentP?.id ? b.score + displayPoints : b.score;
            return scoreB - scoreA;
          }).map((p, i) => {
            const isCurrent = p.id === currentP?.id;
            return (
              <div key={p.id} className={`flex justify-between items-center transition-all ${isCurrent ? 'scale-105' : 'opacity-80'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-black text-[8px]" style={{ backgroundColor: p.color }}>{i+1}</div>
                  <span className={`font-black uppercase tracking-tight text-xs ${isCurrent ? 'text-[#FFD700]' : 'text-white'}`}>{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isCurrent && (
                    <span className="text-[10px] font-black opacity-60 text-[#FFD700]">
                      {p.score} + {displayPoints} =
                    </span>
                  )}
                  <span className={`text-xl font-black ${isCurrent ? 'text-[#FFD700]' : 'text-white'}`}>
                    {isCurrent ? p.score + displayPoints : p.score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button 
        onClick={() => onConfirm(roundPoints, lastSecondAward)}
        className="bg-[#1a1a1a] text-white py-6 rounded-full font-black text-2xl uppercase tracking-tighter shadow-[0_8px_0_0_#4F46E5] active:translate-y-2 active:shadow-none transition-all flex items-center justify-center gap-2 border-2 border-white"
      >
        Continue Hunt <ChevronRight className="w-6 h-6" />
      </button>
    </motion.div>
  );
}

function WelcomeView({ onGoToSetup }: { onGoToSetup: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      className="flex-1 flex flex-col justify-center gap-10"
    >
      <div className="flex flex-col items-center text-center space-y-2 w-full">
        <h1 className="text-6xl sm:text-7xl font-black tracking-tighter uppercase leading-none text-[#1a1a1a] drop-shadow-[0_8px_0_px_#FF4500] w-full break-words">
          NO BIG WORD
        </h1>
        <p className="text-sm font-mono uppercase tracking-[0.3em] text-[#1a1a1a] font-black">Syllable Challenge</p>
      </div>

      <div className="bg-white border-[6px] border-[#1a1a1a] p-8 rounded-[3rem] shadow-[16px_16px_0px_0px_#4F46E5] space-y-6">
        <h2 className="text-3xl font-black flex items-center gap-2 uppercase italic text-[#1a1a1a]">
          <Info className="w-8 h-8 text-[#4F46E5]" /> Rules
        </h2>
        <ul className="space-y-6 text-sm font-bold">
          <li className="flex gap-4 items-start">
            <span className="bg-[#4F46E5] text-white w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm rotate-3">1</span>
            <span className="leading-tight pt-1">Describe words using <strong className="text-[#4F46E5] uppercase">ONLY ONE SYLLABLE</strong>.</span>
          </li>
          <li className="flex gap-4 items-start">
            <span className="bg-[#E11D48] text-white w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm -rotate-3">2</span>
            <span className="leading-tight pt-1">Accidentally use a big word? <strong className="text-[#E11D48] uppercase">PENALTY!</strong></span>
          </li>
          <li className="flex gap-4 items-start">
            <span className="bg-[#059669] text-white w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm rotate-6">3</span>
            <span className="leading-tight pt-1">Higher points for <strong className="text-[#059669] uppercase">Hard Targets</strong>. Win the hunt!</span>
          </li>
        </ul>
      </div>

      <button 
        onClick={onGoToSetup}
        className="w-full bg-[#1a1a1a] text-white py-8 rounded-full font-black text-4xl uppercase tracking-tighter shadow-[0_12px_0_0_#4F46E5] active:translate-y-2 active:shadow-none transition-all flex items-center justify-center gap-4 border-4 border-white"
      >
        Play Hunt <ChevronRight className="w-10 h-10" />
      </button>
    </motion.div>
  );
}

function RoundPromptView({ participant, onStart, roundNumber, isSolo, talkerName, bopperName }: { 
  participant: Participant, onStart: () => void, roundNumber: number, isSolo: boolean, talkerName: string, bopperName: string 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      className="flex-1 flex flex-col justify-center text-center gap-10"
    >
      <div className="space-y-4">
        <div className="inline-block bg-[#1a1a1a] text-[#FFD700] px-6 py-2 rounded-xl text-sm font-black uppercase tracking-widest -rotate-2">Round {roundNumber}</div>
        <h2 className="text-6xl font-black text-[#1a1a1a] leading-none tracking-tighter uppercase" style={{ filter: `drop-shadow(0 8px 0 ${participant?.color + '44'})` }}>
          Go <br/> {talkerName}!
        </h2>
        {!isSolo && (
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Playing for: {participant.name}</p>
        )}
      </div>

      <div className="flex justify-center gap-8 py-8">
        {!isSolo ? (
          <>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 bg-white border-[6px] border-[#1a1a1a] rounded-[2rem] flex items-center justify-center shadow-[6px_6px_0_#C5B358] rotate-3" style={{ borderLeftColor: participant?.color, borderRightColor: participant?.color }}>
                <Users className="w-10 h-10" style={{ color: participant?.color }} />
              </div>
              <div className="text-center">
                <div className="text-[10px] font-black uppercase opacity-60">Talker</div>
                <div className="text-[12px] font-black uppercase tracking-tight">{talkerName}</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 bg-white border-[6px] border-[#1a1a1a] rounded-[2rem] flex items-center justify-center shadow-[6px_6px_0_#E11D48] -rotate-3">
                <Hammer className="w-10 h-10 text-[#E11D48]" />
              </div>
              <div className="text-center">
                <div className="text-[10px] font-black uppercase opacity-60">Bopper</div>
                <div className="text-[12px] font-black uppercase tracking-tight">{bopperName}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 bg-white border-[6px] border-[#1a1a1a] rounded-[2.5rem] flex items-center justify-center shadow-[8px_8px_0_#4F46E5] rotate-3">
                  <User className="w-12 h-12" style={{ color: participant?.color }} />
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase opacity-60">The Hunter</div>
                  <div className="text-[12px] font-black uppercase tracking-tight">{talkerName}</div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 bg-white border-[6px] border-[#1a1a1a] rounded-[2.5rem] flex items-center justify-center shadow-[8px_8px_0_#E11D48] -rotate-3">
                  <Hammer className="w-10 h-10 text-[#E11D48]" />
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase opacity-60">The Bopper</div>
                  <div className="text-[12px] font-black uppercase tracking-tight">{bopperName}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={onStart}
        className="bg-[#1a1a1a] text-white py-8 rounded-[2.5rem] font-black text-4xl uppercase tracking-tighter shadow-[0_10px_0_0_#4F46E5] active:translate-y-2 active:shadow-none transition-all border-4 border-white"
      >
        Let's Rock!
      </button>
    </motion.div>
  );
}

function PlayView({ card, timeLeft, roundPoints, onNext, participantName, participantColor, isBopActive }: { 
  card: CardItem, timeLeft: number, roundPoints: number, onNext: (p: number, skip?: boolean) => void, participantName: string, participantColor: string, isBopActive: boolean 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col gap-6"
    >
      <div className="flex justify-between items-center bg-white p-4 rounded-[1.5rem] border-[4px] border-[#1a1a1a] shadow-[6px_6px_0_0_#1a1a1a]">
        <div className="flex items-center gap-2">
          <Timer className={`w-6 h-6 ${timeLeft < 10 ? 'text-red-500 animate-bounce' : 'text-[#4F46E5]'}`} />
          <span className={`font-mono text-2xl font-black ${timeLeft < 10 ? 'text-red-500' : 'text-[#1a1a1a]'}`}>{timeLeft}s</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-black opacity-40">{participantName} Score</span>
            <span className="font-black text-2xl leading-none">{roundPoints}</span>
          </div>
          <div className="w-8 h-8 rounded-lg border-2 border-[#1a1a1a]" style={{ backgroundColor: participantColor }} />
        </div>
      </div>

      <motion.div 
        key={card.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.1 }}
        className={`flex-1 bg-white border-[10px] border-[#1a1a1a] rounded-[3rem] flex flex-col overflow-hidden shadow-[16px_16px_0px_0px_#1a1a1a] relative transition-transform ${isBopActive ? 'shake' : ''}`}
      >
        <div className="bg-[#1a1a1a] text-white p-3 text-center">
          <div className="text-[12px] uppercase font-black tracking-[0.3em]">NO BIG WORD</div>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-10">
          <div className="text-center">
            <div className="inline-block bg-[#22c55e] text-white px-3 py-0.5 rounded text-[10px] font-black uppercase mb-3">Easy (1 Point)</div>
            <div className="text-5xl font-black text-[#1a1a1a] tracking-tighter uppercase leading-none break-words">
              {card.word}
            </div>
          </div>

          <div className="w-1/2 h-2 bg-[#1a1a1a] rounded-full opacity-10" />

          <div className="text-center">
            <div className="inline-block bg-[#3b82f6] text-white px-3 py-0.5 rounded text-[10px] font-black uppercase mb-3">Hard (3 Points)</div>
            <div className="text-3xl font-black text-slate-600 leading-tight italic">
              {card.phrase}
            </div>
          </div>
        </div>

        <div className="p-4 bg-yellow-50 text-center text-[11px] uppercase font-black text-[#1a1a1a] border-t-[4px] border-[#1a1a1a]">
          ONE SYLLABLE WORDS ONLY!
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 pb-8">
        <button onClick={() => onNext(1)} className="bg-[#22c55e] text-white py-6 rounded-[2rem] font-black text-2xl uppercase tracking-tighter border-4 border-[#1a1a1a] shadow-[0_6px_0_0_#1a1a1a] active:translate-y-1 active:shadow-none transition-all">EASY</button>
        <button onClick={() => onNext(3)} className="bg-[#3b82f6] text-white py-6 rounded-[2rem] font-black text-2xl uppercase tracking-tighter border-4 border-[#1a1a1a] shadow-[0_6px_0_0_#1a1a1a] active:translate-y-1 active:shadow-none transition-all">HARD</button>
        <button onClick={() => onNext(-1, true)} className="col-span-1 bg-white text-[#1a1a1a] py-6 rounded-[2rem] font-black flex items-center justify-center gap-2 border-4 border-[#1a1a1a] shadow-[0_6px_0_0_#1a1a1a] active:translate-y-1 active:shadow-none transition-all text-xl uppercase tracking-tighter">
          SKIP
        </button>
        <button onClick={() => onNext(-1)} className="col-span-1 bg-[#E11D48] text-white py-6 rounded-[2rem] font-black flex items-center justify-center gap-2 border-4 border-[#1a1a1a] shadow-[0_6px_0_0_#1a1a1a] active:translate-y-1 active:shadow-none transition-all text-xl uppercase tracking-tighter">
          BOP!
        </button>
      </div>

      <style>{`
        .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </motion.div>
  );
}

function GameOverView({ participants, onReset }: { participants: Participant[], onReset: () => void }) {
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  const winner = sorted[0].score > (sorted[1]?.score ?? -1) ? sorted[0] : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col justify-center items-center text-center gap-8 py-4"
    >
      <div className="relative">
        <Trophy className="w-32 h-32 text-[#FFD700] drop-shadow-[0_10px_0_#1a1a1a] relative z-10" />
        <div className="absolute inset-0 bg-[#4F46E5] rounded-full blur-3xl opacity-20 animate-pulse" />
      </div>
      
      <div>
        <h2 className="text-6xl sm:text-7xl font-black text-[#1a1a1a] tracking-tighter uppercase leading-none drop-shadow-[0_6px_0_#FF4500]">
          {winner ? 'Winner!' : 'It\'s a Tie!'}
        </h2>
        {winner && (
          <div className="mt-4 rotate-2">
            <span className="text-2xl font-black text-white px-8 py-3 rounded-2xl inline-block shadow-[8px_8px_0_#1a1a1a] border-2 border-white uppercase tracking-tighter" style={{ backgroundColor: winner.color }}>
              {winner.name} Wins!
            </span>
          </div>
        )}
      </div>

      <div className="w-full space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
        {sorted.map((p, i) => (
          <div key={p.id} className="border-[6px] border-[#1a1a1a] p-6 rounded-[2.5rem] flex flex-col shadow-[8px_8px_0_#1a1a1a]" style={{ backgroundColor: p.color }}>
            <div className="flex justify-between items-center w-full mb-2">
              <div className="text-left font-black leading-none">
                <div className="text-[10px] uppercase text-white/70">Place #{i+1}</div>
                <div className="text-3xl text-white tracking-tighter">{p.name}</div>
              </div>
              <div className="text-5xl font-black text-white">{p.score}</div>
            </div>
            <div className="flex justify-start gap-4 text-[10px] font-black uppercase text-white/70">
              <span>{p.totalCorrect} Correct</span>
              <span>{p.totalBops} Bops</span>
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={onReset}
        className="w-full bg-[#1a1a1a] text-white py-6 rounded-full font-black text-3xl uppercase tracking-tighter shadow-[0_8px_0_0_#4F46E5] active:translate-y-2 active:shadow-none transition-all flex items-center justify-center gap-4 mt-auto border-2 border-white"
      >
        <RotateCcw className="w-8 h-8" /> New Game
      </button>
    </motion.div>
  );
}
function SetupView({ onComplete, onBack }: { onComplete: (mode: GameMode, parts: Participant[], rounds: number) => void, onBack: () => void }) {
  const [mode, setMode] = useState<GameMode>('teams');
  const [count, setCount] = useState(2);
  const [rounds, setRounds] = useState(2);
  const [names, setNames] = useState<string[]>(Array(20).fill(''));
  const [memberInputs, setMemberInputs] = useState<string[][]>(Array(20).fill(null).map(() => ['']));

  const handleStart = () => {
    const participants: Participant[] = [];
    for (let i = 0; i < count; i++) {
      const name = names[i].trim() || (mode === 'teams' ? `${TEAM_COLORS[i].name} Team` : `Player ${i + 1}`);
      participants.push({
        id: i,
        name,
        color: TEAM_COLORS[i].hex,
        members: mode === 'teams' ? memberInputs[i].filter(m => m.trim() !== '') : [],
        score: 0,
        totalCorrect: 0,
        totalBops: 0
      });
    }
    onComplete(mode, participants, rounds);
  };

  const updateMember = (pIdx: number, mIdx: number, val: string) => {
    const newMembers = [...memberInputs];
    newMembers[pIdx][mIdx] = val;
    setMemberInputs(newMembers);
  };

  const addMember = (pIdx: number) => {
    const newMembers = [...memberInputs];
    newMembers[pIdx].push('');
    setMemberInputs(newMembers);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col gap-6 py-4"
    >
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2 bg-white/20 rounded-full"><RotateCcw className="w-5 h-5"/></button>
        <h2 className="text-3xl font-black uppercase tracking-tighter">Game Setup</h2>
        <div className="w-9" />
      </div>

      <div className="grid grid-cols-2 gap-2 p-1 bg-[#1a1a1a] rounded-2xl">
        <button 
          onClick={() => setMode('teams')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase text-xs transition-all ${mode === 'teams' ? 'bg-[#FFD700] text-[#1a1a1a]' : 'text-white hover:bg-white/10'}`}
        >
          <Swords className="w-4 h-4" /> Teams
        </button>
        <button 
          onClick={() => setMode('solo')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase text-xs transition-all ${mode === 'solo' ? 'bg-[#FFD700] text-[#1a1a1a]' : 'text-white hover:bg-white/10'}`}
        >
          <User className="w-4 h-4" /> Solo
        </button>
      </div>

      <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase opacity-60 ml-2">Number of {mode === 'teams' ? 'Teams' : 'Players'}</label>
          <div className="flex items-center gap-4 bg-white border-4 border-[#1a1a1a] p-3 rounded-2xl justify-between">
            <button onClick={() => setCount(Math.max(1, count - 1))} className="p-2 bg-[#1a1a1a] text-white rounded-lg active:scale-95"><Minus className="w-5 h-5"/></button>
            <span className="text-2xl font-black">{count}</span>
            <button onClick={() => setCount(Math.min(20, count + 1))} className="p-2 bg-[#1a1a1a] text-white rounded-lg active:scale-95"><Plus className="w-5 h-5"/></button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase opacity-60 ml-2">Turns per {mode === 'teams' ? 'Team' : 'Player'}</label>
          <div className="flex items-center gap-4 bg-white border-4 border-[#1a1a1a] p-3 rounded-2xl justify-between">
            <button onClick={() => setRounds(Math.max(1, rounds - 1))} className="p-2 bg-[#1a1a1a] text-white rounded-lg active:scale-95"><Minus className="w-5 h-5"/></button>
            <span className="text-2xl font-black">{rounds}</span>
            <button onClick={() => setRounds(Math.min(10, rounds + 1))} className="p-2 bg-[#1a1a1a] text-white rounded-lg active:scale-95"><Plus className="w-5 h-5"/></button>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase opacity-60 ml-2">{mode === 'teams' ? 'Team' : 'Player'} Details</label>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-white border-4 border-[#1a1a1a] p-4 rounded-[2rem] shadow-[4px_4px_0_#1a1a1a] space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#1a1a1a]" style={{ backgroundColor: TEAM_COLORS[i].hex }} />
                <input 
                  type="text" 
                  placeholder={`${TEAM_COLORS[i].name} ${mode === 'teams' ? 'Team' : ''}`}
                  value={names[i]}
                  onChange={(e) => {
                    const newNames = [...names];
                    newNames[i] = e.target.value;
                    setNames(newNames);
                  }}
                  className="flex-1 font-black uppercase tracking-tight outline-none bg-transparent"
                />
              </div>
              {mode === 'teams' && (
                <div className="space-y-2">
                  <div className="text-[9px] font-black uppercase opacity-40">Members</div>
                  {memberInputs[i].map((m, mIdx) => (
                    <input 
                      key={mIdx}
                      type="text"
                      placeholder={`Member ${mIdx + 1}`}
                      value={m}
                      onChange={(e) => updateMember(i, mIdx, e.target.value)}
                      className="w-full text-xs font-bold border-b border-[#1a1a1a]/10 outline-none pb-1 bg-transparent"
                    />
                  ))}
                  <button onClick={() => addMember(i)} className="text-[9px] font-black uppercase text-[#4F46E5] flex items-center gap-1 hover:underline"><Plus className="w-3 h-3"/> Add Member</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={handleStart}
        className="w-full bg-[#1a1a1a] text-[#FFD700] py-6 rounded-full font-black text-3xl uppercase tracking-tighter shadow-[0_8px_0_0_#4F46E5] active:translate-y-2 active:shadow-none transition-all flex items-center justify-center gap-4 border-2 border-white mt-auto"
      >
        Let's Play <ChevronRight className="w-8 h-8" />
      </button>
    </motion.div>
  );
}

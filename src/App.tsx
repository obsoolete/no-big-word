/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Trophy, Shield, Users, Info, ChevronRight, ChevronLeft, RotateCcw, AlertTriangle, Hammer, Trash2, Plus, Minus, User, Swords, Settings, X, LogOut, RefreshCw, PlayCircle } from 'lucide-react';
import { INITIAL_CARDS, CardItem } from './constants';
import { countSyllables } from './gameService';

const SAVE_KEY = 'no_big_word_v3';

const playSound = (type: 'tick' | 'buzzer' | 'penalty' | 'correct') => {
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
  } else if (type === 'penalty') {
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
type GameState = 'welcome' | 'setup' | 'playing' | 'confirming' | 'round_end' | 'game_over' | 'reconfiguring' | 'scoreboard';

interface PlayerStats {
  score: number;
  easy: number;
  hard: number;
  skip: number;
  penalties: number;
}

interface Participant {
  id: number;
  name: string;
  color: string;
  members: string[];
  score: number;
  totalCorrect: number;
  totalPenalties: number;
  playerStats: { [playerName: string]: PlayerStats };
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

type FeedbackType = 'easy' | 'hard' | 'skip' | 'penalty';

interface HistoryItem {
  card: CardItem;
  result: FeedbackType | 'none';
}

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [gameState, setGameState] = useState<GameState>('welcome');
  const [gameMode, setGameMode] = useState<GameMode>('teams');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState(0);
  const [roundsPerParticipant, setRoundsPerParticipant] = useState(2);
  const [minTurnsPerPlayer, setMinTurnsPerPlayer] = useState(2);
  const [roundDuration, setRoundDuration] = useState(60);
  
  const [cards, setCards] = useState<CardItem[]>(INITIAL_CARDS);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [roundPoints, setRoundPoints] = useState(0);
  const [roundStats, setRoundStats] = useState({ easy: 0, hard: 0, skip: 0, penalties: 0 });
  const [isPenaltyActive, setIsPenaltyActive] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState<FeedbackType | null>(null);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [roundHistory, setRoundHistory] = useState<HistoryItem[]>([]);
  const [usedCardIds, setUsedCardIds] = useState<number[]>([]);
  const [previousGameState, setPreviousGameState] = useState<GameState | null>(null);

  // Load state on mount
  useEffect(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setGameState(data.gameState || 'welcome');
        setGameMode(data.gameMode || 'teams');
        const loadedParticipants = (data.participants || []).map((p: any) => ({
          ...p,
          totalPenalties: p.totalPenalties ?? 0,
          playerStats: p.playerStats || {}
        }));
        setParticipants(loadedParticipants);
        setCurrentParticipantIndex(data.currentParticipantIndex || 0);
        setRoundsPerParticipant(data.roundsPerParticipant || 2);
        setMinTurnsPerPlayer(data.minTurnsPerPlayer || 2);
        setRoundDuration(data.roundDuration || 60);
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
          penalties: savedStats.penalties ?? 0
        });
        setRoundHistory(data.roundHistory || []);
        setUsedCardIds(data.usedCardIds || []);
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
      minTurnsPerPlayer,
      roundDuration,
      cards,
      currentCardIndex,
      roundsPlayed,
      timeLeft,
      roundPoints,
      roundStats,
      roundHistory,
      usedCardIds
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }, [isInitialized, gameState, gameMode, participants, currentParticipantIndex, roundsPerParticipant, minTurnsPerPlayer, cards, currentCardIndex, roundsPlayed, timeLeft, roundPoints, roundStats, roundHistory, usedCardIds]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const maxTotalRounds = participants.length * roundsPerParticipant;

  const handleSetupComplete = (mode: GameMode, parts: Participant[], turnsPerTeam: number, duration: number, minTurns: number) => {
    setGameMode(mode);
    setParticipants(parts);
    setRoundsPerParticipant(turnsPerTeam);
    setMinTurnsPerPlayer(minTurns);
    setRoundDuration(duration);
    setRoundsPlayed(0);
    setCurrentParticipantIndex(0);
    setGameState('round_end');
  };

  const handleReconfigureComplete = (mode: GameMode, parts: Participant[], turnsPerTeam: number, duration: number, minTurns: number) => {
    // Preserve existing scores and stats for existing participants
    const updatedParts = parts.map(newP => {
      const existing = participants.find(p => p.id === newP.id);
      if (existing) {
        return {
          ...newP,
          score: existing.score,
          totalCorrect: existing.totalCorrect,
          totalPenalties: existing.totalPenalties,
          playerStats: existing.playerStats || {}
        };
      }
      return newP;
    });

    setGameMode(mode);
    setParticipants(updatedParts);
    setRoundsPerParticipant(turnsPerTeam);
    setMinTurnsPerPlayer(minTurns);
    setRoundDuration(duration);
    
    if (gameState === 'game_over') {
      setRoundsPlayed(0);
      setCurrentParticipantIndex(0);
      setGameState('round_end');
    } else {
      setGameState('round_end'); 
    }
    
    setShowSettings(false);
  };

  const startRound = () => {
    setRoundPoints(0);
    setRoundStats({ easy: 0, hard: 0, skip: 0, penalties: 0 });
    setTimeLeft(roundDuration);
    setGameState('playing');
    
    // Filter out used cards
    let available = INITIAL_CARDS.filter(c => !usedCardIds.includes(c.id));
    
    // If not enough cards (e.g. less than 10% of total or enough for a round), reset the pool
    // 30 seems like a safe minimum for a 1-minute round
    if (available.length < 30) {
      setUsedCardIds([]);
      available = [...INITIAL_CARDS];
    }
    
    setCards(available.sort(() => Math.random() - 0.5));
    setCurrentCardIndex(0);
    setRoundHistory([]);
  };

  const handleNextCard = (points: number, isSkip = false) => {
    const currentCard = cards[currentCardIndex];
    let result: FeedbackType = 'easy';
    if (points === 1) result = 'easy';
    else if (points === 3) result = 'hard';
    else if (isSkip) result = 'skip';
    else result = 'penalty';

    setRoundHistory(prev => [...prev, { card: currentCard, result }]);
    
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
        setRoundStats(prev => ({ ...prev, penalties: prev.penalties + 1 }));
        playSound('penalty');
        triggerFeedback('penalty');
      }
    }
    setCurrentCardIndex(prev => (prev + 1) % cards.length);
  };

  const triggerFeedback = (type: FeedbackType) => {
    setActiveFeedback(type);
    if (type === 'penalty') {
      setIsPenaltyActive(true);
      setTimeout(() => setIsPenaltyActive(false), 500);
    }
    setTimeout(() => setActiveFeedback(null), 400);
  };

  const endRound = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Add current card to history as 'none' if it's not already handled
    setRoundHistory(prev => {
      const currentCard = cards[currentCardIndex];
      // Check if the card is already the last one in history to avoid doubles if button was pressed right at 0
      if (prev.length > 0 && prev[prev.length - 1].card.id === currentCard.id) {
        return prev;
      }
      return [...prev, { card: currentCard, result: 'none' }];
    });

    setGameState('confirming');
  }, [cards, currentCardIndex]);

  const confirmRoundResults = (finalScore: number, finalEasy: number, finalHard: number, finalSkip: number, finalPenalties: number) => {
    setParticipants(prev => prev.map((p, idx) => {
      if (idx === currentParticipantIndex) {
        const stats: PlayerStats = p.playerStats[talkerName] || { score: 0, easy: 0, hard: 0, skip: 0, penalties: 0 };
        
        return {
          ...p,
          score: p.score + finalScore,
          totalCorrect: p.totalCorrect + finalEasy + finalHard,
          totalPenalties: p.totalPenalties + finalPenalties,
          playerStats: {
            ...p.playerStats,
            [talkerName]: {
              score: stats.score + finalScore,
              easy: stats.easy + finalEasy,
              hard: stats.hard + finalHard,
              skip: stats.skip + finalSkip,
              penalties: stats.penalties + finalPenalties
            }
          }
        };
      }
      return p;
    }));

    const nextRoundCount = roundsPlayed + 1;
    setRoundsPlayed(nextRoundCount);

    // Track used cards
    const usedThisRound = roundHistory.filter(h => h.result !== 'none').map(h => h.card.id);
    if (usedThisRound.length > 0) {
      setUsedCardIds(prev => {
        const next = [...prev, ...usedThisRound];
        // Ensure no duplicates
        return Array.from(new Set(next));
      });
    }

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

  const rematch = () => {
    setParticipants(prev => prev.map(p => ({ ...p, score: 0, totalCorrect: 0, totalPenalties: 0, playerStats: {} })));
    setRoundsPlayed(0);
    setCurrentParticipantIndex(0);
    setGameState('round_end');
    setShowSettings(false);
  };

  const restartCurrentRound = () => {
    startRound();
    setShowSettings(false);
  };

  const restartFullGame = () => {
    // Reset scores and rounds but keep participants
    setParticipants(prev => prev.map(p => ({ ...p, score: 0, totalCorrect: 0, totalPenalties: 0, playerStats: {} })));
    setRoundsPlayed(0);
    setCurrentParticipantIndex(0);
    setGameState('round_end');
    setShowSettings(false);
  };

  const currentParticipant = participants[currentParticipantIndex];
  const currentLap = Math.floor(roundsPlayed / (participants.length || 1));
  const nextIdx = (currentParticipantIndex + 1) % (participants.length || 1);
  const nextParticipant = participants[nextIdx];
  
  let talkerName = "";
  let judgeName = "";
  let judgeColor = nextParticipant?.color || "#E11D48";
  
  if (currentParticipant) {
    if (gameMode === 'solo') {
      talkerName = currentParticipant.name;
      judgeName = nextParticipant?.name || 'Someone';
    } else {
      const talkerMemberIdx = currentLap % Math.max(1, currentParticipant.members.length);
      talkerName = currentParticipant.members[talkerMemberIdx] || currentParticipant.name;
      
      const judgeMemberIdx = currentLap % Math.max(1, nextParticipant?.members.length || 1);
      judgeName = nextParticipant?.members[judgeMemberIdx] || nextParticipant?.name || 'Someone';
    }
  }

  if (!isInitialized) return null;

  return (
    <div className="min-h-screen bg-[#FFD700] text-[#1a1a1a] font-sans selection:bg-[#FF4500]">
      {/* Background Decal */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
      
      {/* Top Bar with Settings */}
      <div className="fixed top-0 left-0 right-0 p-4 flex justify-end z-50 pointer-events-none">
        <button 
          onClick={() => setShowSettings(true)}
          className="pointer-events-auto w-10 h-10 flex items-center justify-center transition-all opacity-20 hover:opacity-100 active:scale-95"
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
                className="w-full max-w-sm bg-white border-8 border-[#1a1a1a] rounded-[3rem] p-8 shadow-[12px_12px_0_#1a1a1a] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-3xl font-black uppercase tracking-tighter">Settings</h3>
                      <button onClick={() => setShowSettings(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                        <X className="w-8 h-8" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {gameState !== 'welcome' && gameState !== 'setup' && (
                        <button 
                          onClick={() => {
                            setPreviousGameState(gameState);
                            setGameState('scoreboard');
                            setShowSettings(false);
                          }}
                          className="w-full flex items-center gap-4 bg-emerald-50 text-emerald-600 p-4 rounded-3xl font-black uppercase tracking-tight text-lg border-4 border-emerald-200 hover:bg-emerald-100 transition-colors"
                        >
                          <Trophy className="w-6 h-6" />
                          Scoreboard
                        </button>
                      )}

                      {gameState === 'playing' && (
                        <button 
                          onClick={restartCurrentRound}
                          className="w-full flex items-center gap-4 bg-blue-50 text-blue-600 p-4 rounded-3xl font-black uppercase tracking-tight text-lg border-4 border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <RefreshCw className="w-6 h-6" />
                          Restart Round
                        </button>
                      )}

                      {gameState === 'round_end' && (
                        <button 
                          onClick={() => {
                            setGameState('reconfiguring');
                            setShowSettings(false);
                          }}
                          className="w-full flex items-center gap-4 bg-indigo-50 text-indigo-600 p-4 rounded-3xl font-black uppercase tracking-tight text-lg border-4 border-indigo-200 hover:bg-indigo-100 transition-colors"
                        >
                          <Users className="w-6 h-6" />
                          Reconfigure Teams
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

                      {gameState !== 'welcome' && (
                        <button 
                          onClick={resetGame}
                          className="w-full flex items-center gap-4 bg-red-50 text-red-600 p-4 rounded-3xl font-black uppercase tracking-tight text-lg border-4 border-red-200 hover:bg-red-100 transition-colors"
                        >
                          <LogOut className="w-6 h-6" />
                          Quit to Title
                        </button>
                      )}

                      <button 
                        onClick={() => setShowSettings(false)}
                        className="w-full bg-[#1a1a1a] text-white p-4 rounded-3xl font-black uppercase tracking-tight text-lg shadow-[0_4px_0_#1a1a1a] active:translate-y-1 active:shadow-none transition-all mt-4"
                      >
                        Close
                      </button>

                      <div className="mt-8 text-center text-[10px] font-black uppercase tracking-widest opacity-20">
                        Version 1.0.2
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
              participants={participants}
              currentIdx={currentParticipantIndex}
              initialHistory={roundHistory}
              onConfirm={confirmRoundResults}
            />
          )}

          {gameState === 'round_end' && (
            <RoundPromptView 
              participant={currentParticipant} 
              onStart={startRound} 
              roundNumber={currentLap + 1}
              isSolo={gameMode === 'solo'}
              talkerName={talkerName}
              judgeName={judgeName}
              judgeColor={judgeColor}
            />
          )}

          {gameState === 'playing' && (
            <PlayView 
              card={cards[currentCardIndex]} 
              timeLeft={timeLeft} 
              roundPoints={roundPoints}
              onNext={handleNextCard}
              participantName={currentParticipant?.name}
              participantColor={currentParticipant?.color}
              isPenaltyActive={isPenaltyActive}
              talkerName={talkerName}
            />
          )}


          {gameState === 'reconfiguring' && (
            <SetupView 
              initialData={{
                mode: gameMode,
                participants,
                minTurnsPerPlayer,
                duration: roundDuration
              }}
              onComplete={handleReconfigureComplete}
              onBack={() => setGameState('round_end')}
              isEditing
            />
          )}

          {gameState === 'scoreboard' && (
            <ScoreboardView 
              participants={participants} 
              onBack={() => {
                if (previousGameState) setGameState(previousGameState);
                setPreviousGameState(null);
              }}
            />
          )}

          {gameState === 'game_over' && (
            <GameOverView 
              participants={participants} 
              onReset={resetGame}
              onRematch={rematch}
              onReconfigure={() => setGameState('reconfiguring')}
            />
          )}
        </AnimatePresence>
      </main>

      {/* FEEDBACK OVERLAY */}
      <AnimatePresence>
        {activeFeedback && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{ scale: 1.2, opacity: 1, rotate: activeFeedback === 'easy' ? 6 : activeFeedback === 'hard' ? -6 : activeFeedback === 'penalty' ? 12 : 0 }}
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

function RoundConfirmationView({ participants, currentIdx, initialHistory, onConfirm }: { 
  participants: Participant[], 
  currentIdx: number, 
  initialHistory: HistoryItem[], 
  onConfirm: (score: number, easy: number, hard: number, skip: number, penalties: number) => void 
}) {
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const currentP = participants[currentIdx];

  const stats = history.reduce((acc, item) => {
    if (item.result === 'easy') { acc.score += 1; acc.easy += 1; }
    else if (item.result === 'hard') { acc.score += 3; acc.hard += 1; }
    else if (item.result === 'skip') { acc.score -= 1; acc.skip += 1; }
    else if (item.result === 'penalty') { acc.score -= 1; acc.penalties += 1; }
    return acc;
  }, { score: 0, easy: 0, hard: 0, skip: 0, penalties: 0 });

  const updateResult = (idx: number, result: FeedbackType | 'none') => {
    const newHistory = [...history];
    newHistory[idx] = { ...newHistory[idx], result };
    setHistory(newHistory);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col gap-6 py-4 h-full"
    >
      <div className="flex flex-col items-center text-center space-y-2 w-full">
        <div className="inline-block px-4 py-1 rounded-full text-[10px] font-black text-white uppercase mb-1" style={{ backgroundColor: currentP?.color || '#1a1a1a' }}>
          {currentP?.name}'s Result
        </div>
        <h2 className="text-4xl font-black uppercase tracking-tighter text-[#1a1a1a]">
          Review Turn
        </h2>
      </div>

      <div className="bg-white border-4 border-[#1a1a1a] rounded-[2rem] p-6 text-center shadow-[6px_6px_0_#1a1a1a]">
        <div className="text-5xl font-black text-[#4F46E5]">{stats.score}</div>
        <div className="text-[10px] font-black uppercase opacity-60">Total Points Won This Turn</div>
      </div>

      <div className="bg-white border-4 border-[#1a1a1a] rounded-[2rem] p-4 shadow-[6px_6px_0_#1a1a1a]">
        <h3 className="text-[10px] font-black uppercase mb-3 text-center opacity-40 italic">Turn Statistics</h3>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-xl font-black text-[#22c55e]">{stats.easy}</div>
            <div className="text-[8px] font-black uppercase opacity-60">Easy</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-[#3b82f6]">{stats.hard}</div>
            <div className="text-[8px] font-black uppercase opacity-60">Hard</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-gray-400">{stats.skip}</div>
            <div className="text-[8px] font-black uppercase opacity-60">Skip</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-[#ef4444]">{stats.penalties}</div>
            <div className="text-[8px] font-black uppercase opacity-60">Penalty</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-1 min-h-0">
        <h3 className="text-[10px] font-black uppercase opacity-40 ml-2">Review All Cards</h3>
        {history.map((item, idx) => (
          <div key={idx} className="bg-white border-4 border-[#1a1a1a] rounded-[2rem] p-5 shadow-[6px_6px_0_#1a1a1a] space-y-4">
            <div className="space-y-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[7px] font-black uppercase tracking-widest text-[#22c55e]">Easy Word</span>
                <div className="text-xl font-black tracking-tighter leading-none text-[#1a1a1a]">{item.card.word}</div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[7px] font-black uppercase tracking-widest text-[#3b82f6]">Hard Phrase</span>
                <div className="text-sm font-bold text-slate-600 italic tracking-tight leading-none">{item.card.phrase}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: 'none', label: 'None', active: 'bg-gray-200 text-gray-600', inactive: 'bg-gray-50 text-gray-400' },
                { id: 'easy', label: 'Easy', active: 'bg-[#22c55e] text-white', inactive: 'bg-[#22c55e]/10 text-[#22c55e]' },
                { id: 'hard', label: 'Hard', active: 'bg-[#3b82f6] text-white', inactive: 'bg-[#3b82f6]/10 text-[#3b82f6]' },
                { id: 'skip', label: 'Skip', active: 'bg-gray-500 text-white', inactive: 'bg-gray-500/10 text-gray-500' },
                { id: 'penalty', label: 'Penalty', active: 'bg-[#ef4444] text-white', inactive: 'bg-[#ef4444]/10 text-[#ef4444]' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => updateResult(idx, opt.id as any)}
                  className={`py-2 rounded-lg font-black text-[8px] uppercase transition-all border-2 ${
                    item.result === opt.id 
                      ? `${opt.active} border-[#1a1a1a] translate-y-0.5 shadow-none` 
                      : `${opt.inactive} border-transparent opacity-60 hover:opacity-100 hover:border-[#1a1a1a]/10`
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="pb-8" />
      </div>

      <div className="bg-white rounded-[2rem] p-6 text-[#1a1a1a] border-4 border-[#1a1a1a] shadow-[6px_6px_0_#1a1a1a] overflow-y-auto max-h-[25vh] no-scrollbar shrink-0">
        <h4 className="text-center text-[10px] font-black uppercase tracking-widest mb-4 opacity-40">Leaderboard Preview</h4>
        <div className="space-y-3">
          {[...participants].sort((a, b) => {
            const scoreA = a.id === currentP?.id ? a.score + stats.score : a.score;
            const scoreB = b.id === currentP?.id ? b.score + stats.score : b.score;
            return scoreB - scoreA;
          }).map((p, i) => {
            const isCurrent = p.id === currentP?.id;
            return (
              <div key={p.id} className={`flex justify-between items-center transition-all ${isCurrent ? 'scale-105' : 'opacity-80'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full border-2 border-[#1a1a1a] flex items-center justify-center font-black text-[8px]" style={{ backgroundColor: p.color }}>{i+1}</div>
                  <span className={`font-black uppercase tracking-tight text-[10px] ${isCurrent ? 'text-[#4F46E5]' : 'text-[#1a1a1a]'}`}>{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isCurrent && <span className="text-[9px] font-black opacity-40 text-[#4F46E5]">{p.score} + {stats.score} =</span>}
                  <span className={`text-sm font-black ${isCurrent ? 'text-[#4F46E5]' : 'text-[#1a1a1a]'}`}>
                    {isCurrent ? p.score + stats.score : p.score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button 
        onClick={() => onConfirm(stats.score, stats.easy, stats.hard, stats.skip, stats.penalties)}
        className="bg-[#1a1a1a] text-white py-6 rounded-full font-black text-2xl uppercase tracking-tighter shadow-[0_8px_0_0_#1a1a1a] active:translate-y-2 active:shadow-none transition-all flex items-center justify-center gap-2 border-2 border-white mb-2"
      >
        Confirm Score <ChevronRight className="w-6 h-6" />
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

      <div className="bg-white border-[6px] border-[#1a1a1a] p-8 rounded-[3rem] shadow-[8px_8px_0_0_#1a1a1a] space-y-6">
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
            <span className="leading-tight pt-1">Higher points for <strong className="text-[#059669] uppercase">Harder Words!</strong></span>
          </li>
        </ul>
      </div>

      <button 
        onClick={onGoToSetup}
        className="w-full bg-[#1a1a1a] text-white py-8 rounded-full font-black text-4xl uppercase tracking-tighter shadow-[0_12px_0_0_#1a1a1a] active:translate-y-2 active:shadow-none transition-all flex items-center justify-center gap-4 border-4 border-white"
      >
        Setup Game <ChevronRight className="w-10 h-10" />
      </button>
    </motion.div>
  );
}

function RoundPromptView({ participant, onStart, roundNumber, isSolo, talkerName, judgeName, judgeColor }: { 
  participant: Participant, onStart: () => void, roundNumber: number, isSolo: boolean, talkerName: string, judgeName: string, judgeColor: string 
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
              <div className="w-20 h-20 bg-white border-[6px] border-[#1a1a1a] rounded-[2rem] flex items-center justify-center rotate-3" style={{ borderLeftColor: participant?.color, borderRightColor: participant?.color, boxShadow: '6px 6px 0 #1a1a1a15' }}>
                <Users className="w-10 h-10" style={{ color: participant?.color }} />
              </div>
              <div className="text-center">
                <div className="text-[10px] font-black uppercase opacity-60">Talker</div>
                <div className="text-[12px] font-black uppercase tracking-tight">{talkerName}</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 bg-white border-[6px] border-[#1a1a1a] rounded-[2rem] flex items-center justify-center -rotate-3" style={{ borderLeftColor: judgeColor, borderRightColor: judgeColor, boxShadow: '6px 6px 0 #1a1a1a15' }}>
                <Hammer className="w-10 h-10" style={{ color: judgeColor }} />
              </div>
              <div className="text-center">
                <div className="text-[10px] font-black uppercase opacity-60">Judge</div>
                <div className="text-[12px] font-black uppercase tracking-tight">{judgeName}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 bg-white border-[6px] border-[#1a1a1a] rounded-[2.5rem] flex items-center justify-center rotate-3" style={{ borderLeftColor: participant?.color, borderRightColor: participant?.color, boxShadow: '8px 8px 0 #1a1a1a15' }}>
                  <User className="w-12 h-12" style={{ color: participant?.color }} />
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase opacity-60">Talker</div>
                  <div className="text-[12px] font-black uppercase tracking-tight">{talkerName}</div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 bg-white border-[6px] border-[#1a1a1a] rounded-[2.5rem] flex items-center justify-center -rotate-3" style={{ borderLeftColor: judgeColor, borderRightColor: judgeColor, boxShadow: '8px 8px 0 #1a1a1a15' }}>
                  <Hammer className="w-10 h-10" style={{ color: judgeColor }} />
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase opacity-60">Judge</div>
                  <div className="text-[12px] font-black uppercase tracking-tight">{judgeName}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={onStart}
        className="bg-[#1a1a1a] text-white py-8 rounded-[2.5rem] font-black text-4xl uppercase tracking-tighter shadow-[0_10px_0_0_#1a1a1a] active:translate-y-2 active:shadow-none transition-all border-4 border-white"
      >
        Start Turn
      </button>
    </motion.div>
  );
}

function PlayView({ card, timeLeft, roundPoints, onNext, participantName, participantColor, isPenaltyActive, talkerName }: { 
  card: CardItem, timeLeft: number, roundPoints: number, onNext: (p: number, skip?: boolean) => void, participantName: string, participantColor: string, isPenaltyActive: boolean, talkerName: string 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col gap-6"
    >
      <div className="flex justify-between items-center bg-white p-4 rounded-[1.5rem] border-[4px] border-[#1a1a1a] shadow-[8px_8px_0_0_#1a1a1a]">
        <div className="flex items-center gap-2">
          <Timer className={`w-6 h-6 ${timeLeft < 10 ? 'text-red-500 animate-bounce' : 'text-[#4F46E5]'}`} />
          <span className={`font-mono text-2xl font-black ${timeLeft < 10 ? 'text-red-500' : 'text-[#1a1a1a]'}`}>{timeLeft}s</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-black opacity-40">{talkerName} ({participantName}) Score</span>
            <span className="font-black text-2xl leading-none">{roundPoints}</span>
          </div>
          <div className="w-8 h-8 rounded-lg border-2 border-[#1a1a1a]" style={{ backgroundColor: participantColor }} />
        </div>
      </div>

      <motion.div 
        key={card.id}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.1 }}
        className={`flex-1 bg-white border-[10px] border-[#1a1a1a] rounded-[3rem] flex flex-col overflow-hidden shadow-[8px_8px_0_0_#1a1a1a] relative transition-transform ${isPenaltyActive ? 'shake' : ''}`}
      >
        <div className="bg-[#1a1a1a] text-white p-3 text-center">
          <div className="text-[12px] uppercase font-black tracking-[0.3em]">NO BIG WORD</div>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-10">
          <div className="text-center">
            <div className="inline-block bg-[#22c55e] text-white px-3 py-0.5 rounded text-[10px] font-black uppercase mb-3">Easy (1 Point)</div>
            <div className="text-5xl font-black text-[#1a1a1a] tracking-tighter leading-none break-words">
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
          PENALTY!
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

function GameOverView({ participants, onReset, onRematch, onReconfigure }: { 
  participants: Participant[], onReset: () => void, onRematch: () => void, onReconfigure: () => void 
}) {
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  const winner = sorted[0].score > (sorted[1]?.score ?? -1) ? sorted[0] : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col justify-center items-center text-center gap-6 py-4"
    >
      <div className="relative">
        <Trophy className="w-24 h-24 text-[#FFD700] drop-shadow-[0_8px_0_#1a1a1a] relative z-10" />
        <div className="absolute inset-0 bg-[#4F46E5] rounded-full blur-3xl opacity-20 animate-pulse" />
      </div>
      
      <div>
        <h2 className="text-5xl font-black text-[#1a1a1a] tracking-tighter uppercase leading-none drop-shadow-[0_4px_0_#FF4500]">
          {winner ? 'Winner!' : 'It\'s a Tie!'}
        </h2>
        {winner && (
          <div className="mt-3 rotate-1">
            <span className="text-xl font-black text-white px-6 py-2 rounded-2xl inline-block shadow-[6px_6px_0_#1a1a1a] border-2 border-white uppercase tracking-tighter" style={{ backgroundColor: winner.color }}>
              {winner.name} Wins!
            </span>
          </div>
        )}
      </div>

      <div className="w-full space-y-3 max-h-[50vh] overflow-y-auto pr-4 pb-4 no-scrollbar">
        {sorted.map((p, i) => (
          <div key={p.id} className="border-[4px] border-[#1a1a1a] p-4 rounded-[2rem] flex flex-col shadow-[6px_6px_0_#1a1a1a] bg-white relative overflow-hidden">
            {/* Color Ribbon */}
            <div className="absolute top-0 left-0 w-3 h-full" style={{ backgroundColor: p.color }} />
            
            <div className="flex justify-between items-center w-full mb-1 pl-4">
              <div className="text-left font-black leading-none">
                <div className="text-[8px] uppercase text-[#1a1a1a]/40">Place #{i+1}</div>
                <div className="text-2xl text-[#1a1a1a] tracking-tighter leading-none">{p.name}</div>
                {p.members.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.members.map((m, mi) => (
                      <span key={mi} className="text-[7px] bg-[#1a1a1a]/5 px-2 py-0.5 rounded-full font-black uppercase text-[#1a1a1a]/40">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-3xl font-black text-[#1a1a1a]">{p.score}</div>
            </div>
            <div className="flex justify-start gap-4 text-[9px] font-black uppercase text-[#1a1a1a]/60 border-b border-[#1a1a1a]/10 pb-3 mb-3 pl-4">
              <span>{p.totalCorrect} Correct</span>
              <span>{p.totalPenalties} Penalties</span>
            </div>

            {/* PLAYER BREAKDOWN */}
            <div className="space-y-3 pl-4">
              {Object.entries(p.playerStats).length > 0 ? (
                Object.entries(p.playerStats).map(([playerName, stats]) => (
                  <div key={playerName} className="flex flex-col gap-1 text-left bg-[#1a1a1a]/5 rounded-xl p-2 px-3">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black uppercase text-[#1a1a1a] tracking-tight leading-none">{playerName}</span>
                      <span className="text-sm font-black text-[#1a1a1a] leading-none">{stats.score} <span className="text-[8px] opacity-40 uppercase">Pts</span></span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-[#22c55e] leading-none">{stats.easy}</span>
                        <span className="text-[7px] font-bold text-[#1a1a1a]/40 uppercase">Easy</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-[#3b82f6] leading-none">{stats.hard}</span>
                        <span className="text-[7px] font-bold text-[#1a1a1a]/40 uppercase">Hard</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-orange-400 leading-none">{stats.skip}</span>
                        <span className="text-[7px] font-bold text-[#1a1a1a]/40 uppercase">Skip</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-red-500 leading-none">{stats.penalties}</span>
                        <span className="text-[7px] font-bold text-[#1a1a1a]/40 uppercase">Penalty</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] font-black uppercase text-[#1a1a1a]/20 italic py-2">No individual stats recorded</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="w-full grid grid-cols-2 gap-3">
        <button 
          onClick={onRematch}
          className="bg-[#22c55e] text-white py-4 rounded-3xl font-black uppercase tracking-tight text-lg shadow-[0_6px_0_#166534] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 border-2 border-white"
        >
          <RotateCcw className="w-5 h-5" /> Rematch
        </button>
        <button 
          onClick={onReconfigure}
          className="bg-[#6366f1] text-white py-4 rounded-3xl font-black uppercase tracking-tight text-lg shadow-[0_6px_0_#3730a3] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 border-2 border-white"
        >
          <Settings className="w-5 h-5" /> Edit
        </button>
      </div>

      <button 
        onClick={onReset}
        className="w-full bg-[#1a1a1a] text-white py-4 rounded-3xl font-black uppercase tracking-tight text-lg shadow-[0_6px_0_#000000] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 border-2 border-white"
      >
        <LogOut className="w-5 h-5" /> Quit to Title
      </button>
    </motion.div>
  );
}
function ScoreboardView({ participants, onBack }: { participants: Participant[], onBack: () => void }) {
  const sorted = [...participants].sort((a, b) => b.score - a.score);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="flex-1 flex flex-col gap-6 py-4"
    >
      <div className="flex flex-col items-center text-center space-y-1 w-full mt-4">
        <h2 className="text-4xl font-black text-[#1a1a1a] tracking-tight uppercase leading-none drop-shadow-[0_4px_0_#FF4500]">
          Scoreboard
        </h2>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#1a1a1a] font-bold opacity-40">Current Standings & Teams</p>
      </div>

      <div className="w-full space-y-4 max-h-[60vh] overflow-y-auto pr-2 pb-4 no-scrollbar">
        {sorted.map((p, i) => (
          <div key={p.id} className="border-[4px] border-[#1a1a1a] p-5 rounded-[2.5rem] flex flex-col shadow-[8px_8px_0_#1a1a1a] bg-white relative overflow-hidden">
            {/* Color Ribbon */}
            <div className="absolute top-0 left-0 w-3 h-full" style={{ backgroundColor: p.color }} />
            
            <div className="flex justify-between items-start w-full mb-3 pl-3">
              <div className="text-left font-black">
                <div className="text-[9px] uppercase text-[#1a1a1a]/40">Rank #{i+1}</div>
                <div className="text-2xl text-[#1a1a1a] tracking-tight leading-none mb-2">{p.name}</div>
                {p.members.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.members.map((m, mi) => (
                      <span key={mi} className="text-[8px] bg-gray-100 px-2 py-1 rounded-lg font-black uppercase text-gray-500 border border-gray-200">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-4xl font-black text-[#1a1a1a] drop-shadow-[0_2px_0_white]">{p.score}</div>
            </div>

            <div className="flex justify-start gap-4 text-[9px] font-black uppercase text-[#1a1a1a]/60 border-t border-b border-gray-100 py-3 mb-4 pl-3">
              <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> {p.totalCorrect} Correct</span>
              <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /> {p.totalPenalties} Penalties</span>
            </div>

            {/* PLAYER BREAKDOWN */}
            <div className="space-y-2 pl-3">
              {Object.entries(p.playerStats).length > 0 ? (
                Object.entries(p.playerStats).map(([playerName, stats]) => (
                  <div key={playerName} className="flex flex-col gap-1 text-left bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-[10px] font-black uppercase text-[#1a1a1a] tracking-tight">{playerName}</span>
                      <span className="text-[10px] font-black text-[#1a1a1a] opacity-40">{stats.score} PTS</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="text-[10px] font-black text-[#22c55e] leading-none">{stats.easy}</div>
                        <div className="text-[6px] font-bold text-gray-400 uppercase">Easy</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-[#3b82f6] leading-none">{stats.hard}</div>
                        <div className="text-[6px] font-bold text-gray-400 uppercase">Hard</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-orange-400 leading-none">{stats.skip}</div>
                        <div className="text-[6px] font-bold text-gray-400 uppercase">Skip</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-red-500 leading-none">{stats.penalties}</div>
                        <div className="text-[6px] font-bold text-gray-400 uppercase">Pen</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[9px] font-black uppercase text-gray-300 italic py-1">No turns recorded</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={onBack}
        className="w-full bg-[#1a1a1a] text-white py-5 rounded-[2rem] font-black text-xl uppercase tracking-tighter shadow-[0_6px_0_#000000] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 border-2 border-white"
      >
        <ChevronLeft className="w-5 h-5" /> Return To Game
      </button>
    </motion.div>
  );
}

function SetupView({ onComplete, onBack, initialData, isEditing = false }: { 
  onComplete: (mode: GameMode, parts: Participant[], turnsPerTeam: number, duration: number, minTurns: number) => void, 
  onBack: () => void,
  initialData?: {
    mode: GameMode,
    participants: Participant[],
    minTurnsPerPlayer: number,
    duration: number
  },
  isEditing?: boolean
}) {
  const [mode, setMode] = useState<GameMode>(initialData?.mode || 'teams');
  const [count, setCount] = useState(initialData?.participants.length || 2);
  const [rounds, setRounds] = useState(initialData?.minTurnsPerPlayer || 2);
  const [duration, setDuration] = useState(initialData?.duration || 60);

  const [names, setNames] = useState<string[]>(() => {
    const arr = Array(20).fill('');
    if (initialData) {
      initialData.participants.forEach((p, i) => {
        if (i < 20) arr[i] = p.name;
      });
    }
    return arr;
  });

  const [memberInputs, setMemberInputs] = useState<string[][]>(() => {
    const arr = Array(20).fill(null).map(() => ['']);
    if (initialData) {
      initialData.participants.forEach((p, i) => {
        if (i < 20) arr[i] = p.members.length > 0 ? p.members : [''];
      });
    }
    return arr;
  });

  const getTeamMemberCount = (i: number) => {
    if (mode === 'solo') return 1;
    const list = memberInputs[i].filter(m => m.trim() !== '');
    return list.length || 1;
  };

  const maxPlayersOnAnyTeam = mode === 'solo' 
    ? 1 
    : Math.max(...Array.from({ length: count }, (_, i) => getTeamMemberCount(i)));
  
  const turnsPerTeam = maxPlayersOnAnyTeam * rounds;
  const totalRounds = turnsPerTeam * count;

  const handleStart = () => {
    const parts: Participant[] = [];
    for (let i = 0; i < count; i++) {
      const name = names[i].trim() || (mode === 'teams' ? `${TEAM_COLORS[i].name} Team` : `Player ${i + 1}`);
      const existingId = initialData?.participants[i]?.id;
      parts.push({
        id: existingId ?? i,
        name,
        color: TEAM_COLORS[i].hex,
        members: mode === 'teams' ? memberInputs[i].filter(m => m.trim() !== '') : [],
        score: 0,
        totalCorrect: 0,
        totalPenalties: 0,
        playerStats: {}
      });
    }
    onComplete(mode, parts, turnsPerTeam, duration, rounds);
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
    <div className="flex-1 flex flex-col gap-6 py-4 h-full">
      <div className="flex justify-between items-center px-4">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors">
          <X className="w-8 h-8" />
        </button>
        <h2 className="text-3xl font-black uppercase tracking-tighter">{isEditing ? 'Reconfigure' : 'Game Setup'}</h2>
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

      <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-4 pb-8">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase opacity-60 ml-2">Number of {mode === 'teams' ? 'Teams' : 'Players'}</label>
          <div className="flex items-center gap-4 bg-white border-4 border-[#1a1a1a] p-3 rounded-2xl justify-between">
            <button onClick={() => setCount(Math.max(2, count - 1))} className="p-2 bg-[#1a1a1a] text-white rounded-lg active:scale-95"><Minus className="w-5 h-5"/></button>
            <span className="text-2xl font-black">{count}</span>
            <button onClick={() => setCount(Math.min(20, count + 1))} className="p-2 bg-[#1a1a1a] text-white rounded-lg active:scale-95"><Plus className="w-5 h-5"/></button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase opacity-60 ml-2">Min Turns per player</label>
          <div className="flex items-center gap-4 bg-white border-4 border-[#1a1a1a] p-3 rounded-2xl justify-between">
            <button onClick={() => setRounds(Math.max(1, rounds - 1))} className="p-2 bg-[#1a1a1a] text-white rounded-lg active:scale-95"><Minus className="w-5 h-5"/></button>
            <span className="text-2xl font-black">{rounds}</span>
            <button onClick={() => setRounds(Math.min(10, rounds + 1))} className="p-2 bg-[#1a1a1a] text-white rounded-lg active:scale-95"><Plus className="w-5 h-5"/></button>
          </div>
          <div className="bg-[#FFD700] border-4 border-[#1a1a1a] p-3 rounded-2xl mx-1 shadow-[4px_4px_0_#1a1a1a]">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase">Total Game Rounds</span>
              <span className="text-xl font-black">{totalRounds}</span>
            </div>
            <p className="text-[9px] font-bold mt-1 opacity-70 leading-tight">
              {mode === 'teams' 
                ? `Each team plays ${turnsPerTeam} times so every member gets at least ${rounds} turns.` 
                : `Each player plays ${rounds} turns for a total of ${totalRounds} rounds.`}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase opacity-60 ml-2">Round Duration (Seconds)</label>
          <div className="flex items-center gap-4 bg-white border-4 border-[#1a1a1a] p-3 rounded-2xl justify-between">
            <button onClick={() => setDuration(Math.max(10, duration - 10))} className="p-2 bg-[#1a1a1a] text-white rounded-lg active:scale-95"><Minus className="w-5 h-5"/></button>
            <span className="text-2xl font-black">{duration}s</span>
            <button onClick={() => setDuration(Math.min(180, duration + 10))} className="p-2 bg-[#1a1a1a] text-white rounded-lg active:scale-95"><Plus className="w-5 h-5"/></button>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase opacity-60 ml-2">{mode === 'teams' ? 'Team' : 'Player'} Details</label>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-white border-4 border-[#1a1a1a] p-4 rounded-[2rem] shadow-[8px_8px_0_#1a1a1a] space-y-3">
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
        className="w-full bg-[#1a1a1a] text-[#FFD700] py-6 rounded-full font-black text-3xl uppercase tracking-tighter shadow-[0_8px_0_0_#1a1a1a] active:translate-y-2 active:shadow-none transition-all flex items-center justify-center gap-4 border-2 border-white mt-auto"
      >
        {isEditing ? 'Save Changes' : 'Start Game'} <ChevronRight className="w-8 h-8" />
      </button>
    </div>
  );
}

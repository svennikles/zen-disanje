/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Cloud, RefreshCw, 
  Clock, CheckCircle, Wind, Square, Calendar, 
  Bell, BellOff, ChevronLeft, ChevronRight, X, Droplets
} from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBD5MaJpTSfhJ5Qh4oLXKHOqcWVuvi-R8o",
  authDomain: "sven-nikles-md-breathing-app.firebaseapp.com",
  projectId: "sven-nikles-md-breathing-app",
  storageBucket: "sven-nikles-md-breathing-app.firebasestorage.app",
  messagingSenderId: "256476569366",
  appId: "1:256476569366:web:1cf195758bbc021b553a37",
  measurementId: "G-MSJ3CTZSTR"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

const BREATH_CONFIGS = {
  '478': {
    phases: ['UDAHNITE (NA NOS)', 'ZADRŽITE (PUNIM PLUĆIMA)', 'IZDAHNITE (NA USTA)'],
    times: [4, 7, 8],
    colors: ['rgba(186, 230, 253, 0.45)', 'rgba(167, 243, 208, 0.45)', 'rgba(254, 205, 211, 0.45)']
  },
  'box': {
    phases: ['UDAHNITE (NA NOS)', 'ZADRŽITE (PUNIM PLUĆIMA)', 'IZDAHNITE (NA USTA)', 'ZADRŽITE (PRAZNIM PLUĆIMA)'],
    times: [4, 4, 4, 4],
    colors: ['rgba(186, 230, 253, 0.45)', 'rgba(167, 243, 208, 0.45)', 'rgba(254, 205, 211, 0.45)', 'rgba(209, 213, 219, 0.35)']
  }
};

const DURATIONS = [3, 5, 7, 9, 12, 15];
const TRANSITION_PAUSE = 0.8;

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('technique');
  const [technique, setTechnique] = useState('478');
  const [totalSessionDuration, setTotalSessionDuration] = useState(0); 
  const [sessionTimeLeft, setSessionTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [phase, setPhase] = useState('SPREMNI?'); 
  const [nextPhase, setNextPhase] = useState('UDAHNITE (NA NOS)');
  const [timeLeft, setTimeLeft] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const backgroundNodesRef = useRef([]); 

  useEffect(() => {
    signInAnonymously(auth).catch(() => {});
    return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'breathing_sessions', user.uid, 'history');
    return onSnapshot(q, s => setSessions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  const initAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AC();
        masterGainRef.current = audioCtxRef.current.createGain();
        masterGainRef.current.connect(audioCtxRef.current.destination);
      }
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      masterGainRef.current.gain.setValueAtTime(isMuted ? 0 : 0.15, audioCtxRef.current.currentTime);
    } catch (e) {}
  }, [isMuted]);

  const playBackgroundSound = useCallback((active) => {
    if (!audioCtxRef.current) return;
    if (active && !isMuted) {
      if (backgroundNodesRef.current.length > 0) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer; noise.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 450;
      const gain = ctx.createGain(); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.04, now + 3);
      noise.connect(filter); filter.connect(gain); gain.connect(masterGainRef.current);
      noise.start();
      backgroundNodesRef.current = [{ node: noise, gain }];
    } else {
      backgroundNodesRef.current.forEach(item => {
        item.gain.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 1);
        setTimeout(() => item.node.stop(), 1100);
      });
      backgroundNodesRef.current = [];
    }
  }, [isMuted]);

  const playPhaseSound = useCallback((type) => {
    if (isMuted || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(masterGainRef.current);
    osc.frequency.setValueAtTime(type.includes('UDAHNITE') ? 220 : 330, ctx.currentTime);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.1);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
    osc.start(); osc.stop(ctx.currentTime + 2);
  }, [isMuted]);

  const saveSession = useCallback(async () => {
    const spent = totalSessionDuration - sessionTimeLeft;
    setIsActive(false); setView('finished'); playBackgroundSound(false);
    if (user && spent > 5) {
      try {
        await addDoc(collection(db, 'breathing_sessions', user.uid, 'history'), {
          timestamp: serverTimestamp(), technique, durationSeconds: Math.floor(spent)
        });
      } catch (e) {}
    }
  }, [user, technique, totalSessionDuration, sessionTimeLeft, playBackgroundSound]);

  useEffect(() => {
    let timer;
    if (isActive && view === 'exercise') {
      if (sessionTimeLeft > 0) {
        if (timeLeft > 0) {
          timer = setTimeout(() => {
            setTimeLeft(p => parseFloat((p - 0.1).toFixed(1)));
            setSessionTimeLeft(p => parseFloat((p - 0.1).toFixed(1)));
          }, 100);
        } else {
          const config = BREATH_CONFIGS[technique];
          if (phase === 'PAUZA') {
            const idx = config.phases.indexOf(nextPhase);
            setPhase(nextPhase); setTimeLeft(config.times[idx]);
            if (nextPhase.includes('UDAHNITE') || nextPhase.includes('IZDAHNITE')) playPhaseSound(nextPhase);
          } else {
            const idx = (config.phases.indexOf(phase) + 1) % config.phases.length;
            setPhase('PAUZA'); setNextPhase(config.phases[idx]); setTimeLeft(TRANSITION_PAUSE);
          }
        }
      } else { saveSession(); }
    }
    return () => clearTimeout(timer);
  }, [isActive, timeLeft, phase, nextPhase, sessionTimeLeft, view, technique, saveSession, playPhaseSound]);

  const handleStart = (m) => {
    initAudio(); setTotalSessionDuration(m * 60); setSessionTimeLeft(m * 60);
    setView('exercise'); setIsActive(true); playBackgroundSound(true);
    setPhase('PAUZA'); setNextPhase(BREATH_CONFIGS[technique].phases[0]); setTimeLeft(TRANSITION_PAUSE);
  };

  const getCircleStyles = () => {
    if (view === 'finished' || phase === 'PAUZA') return { transform: 'scale(1.1)', backgroundColor: 'rgba(255,255,255,0.1)' };
    const config = BREATH_CONFIGS[technique];
    const idx = config.phases.indexOf(phase);
    const color = config.colors[idx];
    let scale = 1;
    if (phase.includes('UDAHNITE')) scale = 1 + ((config.times[idx] - timeLeft) / config.times[idx]) * 0.5;
    else if (phase.includes('PUNIM')) scale = 1.5;
    else if (phase.includes('IZDAHNITE')) scale = 1.5 - ((config.times[idx] - timeLeft) / config.times[idx]) * 0.5;
    return { transform: `scale(${scale})`, backgroundColor: color };
  };

  const renderCalendar = () => {
    const days = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const offset = start === 0 ? 6 : start - 1;
    const res = [];
    const map = {};
    sessions.forEach(s => {
      const d = s.timestamp?.toDate() || new Date();
      if (d.getMonth() === currentMonth.getMonth()) map[d.getDate()] = (map[d.getDate()] || 0) + 1;
    });
    for (let i = 0; i < offset; i++) res.push(<div key={`e-${i}`} className="w-10 h-10" />);
    for (let d = 1; d <= days; d++) {
      res.push(
        <div key={d} className="w-12 h-12 flex flex-col items-center justify-center bg-white/5 rounded-lg border border-white/5">
          <span className="text-[10px] opacity-30">{d}</span>
          {map[d] && <CheckCircle size={14} className="text-emerald-400" />}
        </div>
      );
    }
    return res;
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white uppercase tracking-widest overflow-hidden relative">
      <style>{`
        @keyframes cloud { 0% { transform: translateX(-200px); } 100% { transform: translateX(100vw); } }
        .c-1 { animation: cloud 100s linear infinite; top: 10%; }
        .c-2 { animation: cloud 70s linear infinite; top: 40%; }
      `}</style>
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <Cloud className="absolute c-1" size={150} /><Cloud className="absolute c-2" size={120} />
      </div>
      
      <div className="absolute top-8 right-8 flex gap-4">
        <button onClick={() => setView('stats')} className="p-2 bg-white/5 rounded-full"><Calendar size={24}/></button>
      </div>

      {view === 'technique' && (
        <div className="flex flex-col items-center gap-12">
          <h1 className="text-2xl font-bold text-center px-4">VJEŽBE DISANJA ZA OPUŠTANJE</h1>
          <div className="flex flex-col md:flex-row gap-6">
            <button onClick={() => { setTechnique('478'); setView('duration'); initAudio(); }} className="p-10 bg-white/5 border border-white/10 rounded-3xl w-64 text-center hover:bg-white/10 transition-all">
              <Wind size={40} className="mx-auto mb-4 text-blue-300"/> 4-7-8 TEHNIKA
            </button>
            <button onClick={() => { setTechnique('box'); setView('duration'); initAudio(); }} className="p-10 bg-white/5 border border-white/10 rounded-3xl w-64 text-center hover:bg-white/10 transition-all">
              <Square size={40} className="mx-auto mb-4 text-emerald-300"/> BOX DISANJE
            </button>
          </div>
        </div>
      )}

      {view === 'duration' && (
        <div className="flex flex-col items-center gap-10">
          <h2 className="text-xl">TRAJANJE VJEŽBE</h2>
          <div className="grid grid-cols-3 gap-4">
            {DURATIONS.map(d => (
              <button key={d} onClick={() => handleStart(d)} className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{d}</span><span className="text-[10px] opacity-40">MIN</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'exercise' && (
        <div className="flex flex-col items-center gap-12 text-center">
          <div className="text-[10px] opacity-40">PREOSTALO: {Math.floor(sessionTimeLeft/60)}:{(Math.floor(sessionTimeLeft%60)).toString().padStart(2,'0')}</div>
          <div className="p-8 bg-white/5 rounded-3xl border border-white/10 min-w-[300px]">
            <h2 className="text-xl font-bold">{phase === 'PAUZA' ? 'PRIPREMITE SE...' : phase}</h2>
          </div>
          <div className="w-64 h-64 relative flex items-center justify-center">
            <div className="absolute rounded-full w-full h-full border border-white/5 transition-all" style={getCircleStyles()} />
            <div className="text-6xl font-light z-10">{Math.ceil(timeLeft)}</div>
          </div>
          <div className="flex gap-6 items-center p-4 bg-white/5 rounded-full border border-white/10">
            <button onClick={() => { setIsActive(false); setView('technique'); playBackgroundSound(false); }} className="opacity-40 hover:opacity-100"><RefreshCw size={24}/></button>
            <button onClick={() => setIsActive(!isActive)} className="w-16 h-16 bg-white text-slate-900 rounded-full flex items-center justify-center">{isActive ? <Pause size={30}/> : <Play size={30} className="ml-1"/>}</button>
            <button onClick={() => saveSession()} className="opacity-40 hover:opacity-100"><Square size={24}/></button>
            <button onClick={() => setIsMuted(!isMuted)} className="opacity-40 hover:opacity-100">{isMuted ? <VolumeX size={24}/> : <Volume2 size={24}/>}</button>
          </div>
        </div>
      )}

      {view === 'stats' && (
        <div className="p-8 bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-sm">
          <div className="flex justify-between mb-8"><h3>STATISTIKA</h3><button onClick={() => setView('technique')}><X/></button></div>
          <div className="grid grid-cols-7 gap-1 text-center mb-4 opacity-30 text-[10px]">
            {['P','U','S','Č','P','S','N'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">{renderCalendar()}</div>
        </div>
      )}

      {view === 'finished' && (
        <div className="text-center flex flex-col items-center gap-8">
          <CheckCircle size={80} className="text-emerald-400" />
          <h2 className="text-xl">VJEŽBA ZAVRŠENA!</h2>
          <button onClick={() => setView('technique')} className="px-10 py-3 bg-white text-slate-900 rounded-full font-bold">NASTAVI</button>
        </div>
      )}

      <div className="absolute bottom-8 opacity-20 text-[10px]">SVEN NIKLES, MD.</div>
    </div>
  );
}
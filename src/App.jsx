/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- JEDNOSTAVNE IKONICE (SVG) - Zamjena za lucide-react kako build ne bi padao ---
const Icons = {
  Play: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>,
  Pause: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>,
  Volume2: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>,
  VolumeX: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>,
  Cloud: ({ className, size = 24 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M17.5 19c3.037 0 5.5-2.463 5.5-5.5 0-2.77-2.056-5.06-4.735-5.441C17.658 5.061 15.015 3 12 3c-3.136 0-5.789 2.232-6.382 5.208C2.593 8.783 0 11.344 0 14.5c0 3.037 2.463 5.5 5.5 5.5h12z"></path></svg>,
  Refresh: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Check: ({ size = 24, className }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"></polyline></svg>,
  Wind: ({ size = 40, className }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path></svg>,
  Square: ({ size = 24, className }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>,
  Calendar: ({ size = 24 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
  X: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  ChevronL: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
  ChevronR: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
};

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
        if (item.gain) item.gain.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 1);
        setTimeout(() => { try { item.node.stop(); } catch(e) {} }, 1100);
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
          {map[d] && <Icons.Check size={14} className="text-emerald-400" />}
        </div>
      );
    }
    return res;
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white uppercase tracking-widest overflow-hidden relative font-sans selection:bg-blue-500/30">
      <style>{`
        @keyframes cloud { 0% { transform: translateX(-200px); } 100% { transform: translateX(100vw); } }
        .c-1 { animation: cloud 100s linear infinite; top: 10%; }
        .c-2 { animation: cloud 70s linear infinite; top: 40%; }
      `}</style>
      
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <Icons.Cloud className="absolute c-1" size={150} />
        <Icons.Cloud className="absolute c-2" size={120} />
      </div>
      
      <div className="absolute top-8 right-8 flex gap-4">
        <button onClick={() => setView('stats')} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <Icons.Calendar size={24}/>
        </button>
      </div>

      {view === 'technique' && (
        <div className="flex flex-col items-center gap-12 animate-in fade-in zoom-in duration-500">
          <h1 className="text-2xl font-bold text-center px-4">VJEŽBE DISANJA ZA OPUŠTANJE</h1>
          <div className="flex flex-col md:flex-row gap-6">
            <button onClick={() => { setTechnique('478'); setView('duration'); initAudio(); }} className="p-10 bg-white/5 border border-white/10 rounded-3xl w-64 text-center hover:bg-white/10 hover:scale-105 transition-all group">
              <Icons.Wind className="mx-auto mb-4 text-blue-300 group-hover:scale-110 transition-transform"/> 4-7-8 TEHNIKA
            </button>
            <button onClick={() => { setTechnique('box'); setView('duration'); initAudio(); }} className="p-10 bg-white/5 border border-white/10 rounded-3xl w-64 text-center hover:bg-white/10 hover:scale-105 transition-all group">
              <Icons.Square className="mx-auto mb-4 text-emerald-300 group-hover:scale-110 transition-transform"/> BOX DISANJE
            </button>
          </div>
        </div>
      )}

      {view === 'duration' && (
        <div className="flex flex-col items-center gap-10 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-xl">TRAJANJE VJEŽBE</h2>
          <div className="grid grid-cols-3 gap-4">
            {DURATIONS.map(d => (
              <button key={d} onClick={() => handleStart(d)} className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center hover:bg-white/10 hover:scale-110 transition-all">
                <span className="text-xl font-bold">{d}</span><span className="text-[10px] opacity-40">MIN</span>
              </button>
            ))}
          </div>
          <button onClick={() => setView('technique')} className="text-[10px] opacity-40 underline">POVRATAK</button>
        </div>
      )}

      {view === 'exercise' && (
        <div className="flex flex-col items-center gap-12 text-center animate-in fade-in duration-700">
          <div className="flex items-center gap-2 text-[10px] opacity-40">
            <Icons.Clock /> PREOSTALO: {Math.floor(sessionTimeLeft/60)}:{(Math.floor(sessionTimeLeft%60)).toString().padStart(2,'0')}
          </div>
          <div className="p-8 bg-white/5 rounded-3xl border border-white/10 min-w-[300px]">
            <h2 className="text-xl font-bold">{phase === 'PAUZA' ? 'PRIPREMITE SE...' : phase}</h2>
          </div>
          <div className="w-64 h-64 relative flex items-center justify-center">
            <div className="absolute rounded-full w-full h-full border border-white/5 transition-all duration-100" style={getCircleStyles()} />
            <div className="text-6xl font-light z-10">{Math.ceil(timeLeft)}</div>
          </div>
          <div className="flex gap-6 items-center p-4 bg-white/5 rounded-full border border-white/10 shadow-2xl">
            <button onClick={() => { setIsActive(false); setView('technique'); playBackgroundSound(false); }} className="opacity-40 hover:opacity-100"><Icons.Refresh/></button>
            <button onClick={() => setIsActive(!isActive)} className="w-16 h-16 bg-white text-slate-900 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
              {isActive ? <Icons.Pause/> : <Icons.Play/>}
            </button>
            <button onClick={() => saveSession()} className="opacity-40 hover:opacity-100"><Icons.Square size={20}/></button>
            <button onClick={() => setIsMuted(!isMuted)} className="opacity-40 hover:opacity-100">{isMuted ? <Icons.VolumeX/> : <Icons.Volume2/>}</button>
          </div>
        </div>
      )}

      {view === 'stats' && (
        <div className="p-8 bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-sm animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex justify-between mb-8">
            <h3 className="font-bold">STATISTIKA</h3>
            <button onClick={() => setView('technique')} className="opacity-40 hover:opacity-100"><Icons.X/></button>
          </div>
          <div className="flex justify-between items-center mb-6">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}><Icons.ChevronL/></button>
            <span className="text-xs font-bold">{currentMonth.toLocaleString('hr-HR', { month: 'long', year: 'numeric' }).toUpperCase()}</span>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}><Icons.ChevronR/></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-4 opacity-30 text-[10px] font-bold">
            {['P','U','S','Č','P','S','N'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">{renderCalendar()}</div>
        </div>
      )}

      {view === 'finished' && (
        <div className="text-center flex flex-col items-center gap-8 animate-in zoom-in">
          <Icons.Check size={80} className="text-emerald-400" />
          <h2 className="text-xl font-bold">VJEŽBA ZAVRŠENA!</h2>
          <button onClick={() => setView('technique')} className="px-10 py-3 bg-white text-slate-900 rounded-full font-bold shadow-xl">NASTAVI</button>
        </div>
      )}

      <div className="absolute bottom-8 opacity-20 text-[10px]">SVEN NIKLES, MD.</div>
    </div>
  );
}
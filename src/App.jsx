import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Cloud, RefreshCw, 
  Clock, CheckCircle, Wind, Square, Calendar as CalendarIcon, 
  Bell, BellOff, ChevronLeft, ChevronRight, X, Droplets
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';

// --- KONFIGURACIJA ---
const firebaseConfig = {
  apiKey: "AIzaSyBD5MaJpTSfhJ5Qh4oLXKHOqcWVuvi-R8o",
  authDomain: "sven-nikles-md-breathing-app.firebaseapp.com",
  projectId: "sven-nikles-md-breathing-app",
  storageBucket: "sven-nikles-md-breathing-app.firebasestorage.app",
  messagingSenderId: "256476569366",
  appId: "1:256476569366:web:1cf195758bbc021b553a37",
  measurementId: "G-MSJ3CTZSTR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

  const configs = useMemo(() => ({
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
  }), []);

  const durations = useMemo(() => [3, 5, 7, 9, 12, 15], []);
  const TRANSITION_PAUSE = 0.8;

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (e) { console.error(e); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const sessionsRef = collection(db, 'breathing_sessions', user.uid, 'history');
    return onSnapshot(sessionsRef, (snapshot) => {
      setSessions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  const initAudio = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current && AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
        masterGainRef.current = audioCtxRef.current.createGain();
        masterGainRef.current.connect(audioCtxRef.current.destination);
        masterGainRef.current.gain.setValueAtTime(isMuted ? 0 : 0.15, audioCtxRef.current.currentTime);
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch (e) { console.warn(e); }
  }, [isMuted]);

  const playBackgroundSound = useCallback((active) => {
    if (!audioCtxRef.current) return;
    if (active && !isMuted) {
      if (backgroundNodesRef.current.length > 0) return;
      const now = audioCtxRef.current.currentTime;
      const bufferSize = 2 * audioCtxRef.current.sampleRate;
      const noiseBuffer = audioCtxRef.current.createBuffer(1, bufferSize, audioCtxRef.current.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      const noiseSource = audioCtxRef.current.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      const noiseFilter = audioCtxRef.current.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(450, now);
      const noiseGain = audioCtxRef.current.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.04, now + 3);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGainRef.current);
      noiseSource.start();
      const padOsc = audioCtxRef.current.createOscillator();
      const padGain = audioCtxRef.current.createGain();
      padOsc.type = 'sine';
      padOsc.frequency.setValueAtTime(110, now); 
      padGain.gain.setValueAtTime(0, now);
      padGain.gain.linearRampToValueAtTime(0.02, now + 5);
      padOsc.connect(padGain);
      padGain.connect(masterGainRef.current);
      padOsc.start();
      backgroundNodesRef.current = [{ node: noiseSource, gain: noiseGain }, { node: padOsc, gain: padGain }];
    } else {
      const now = audioCtxRef.current.currentTime;
      backgroundNodesRef.current.forEach(({ node, gain }) => {
        if (gain) { gain.gain.cancelScheduledValues(now); gain.gain.linearRampToValueAtTime(0, now + 1.5); }
        setTimeout(() => { try { node.stop(); } catch(e) {} }, 1600);
      });
      backgroundNodesRef.current = [];
    }
  }, [isMuted]);

  const playPhaseSound = useCallback((type) => {
    if (isMuted || !audioCtxRef.current) return;
    const osc = audioCtxRef.current.createOscillator();
    const g = audioCtxRef.current.createGain();
    const filter = audioCtxRef.current.createBiquadFilter();
    osc.connect(filter); filter.connect(g); g.connect(masterGainRef.current);
    osc.type = 'sine'; filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, audioCtxRef.current.currentTime);
    const now = audioCtxRef.current.currentTime;
    const duration = type.includes('UDAHNITE') ? 4 : (technique === '478' ? 8 : 4);
    if (type.includes('UDAHNITE')) {
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(329.63, now + duration);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.06, now + 1); g.gain.linearRampToValueAtTime(0, now + duration);
    } else if (type.includes('IZDAHNITE')) {
      osc.frequency.setValueAtTime(329.63, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + duration);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.06, now + 1); g.gain.linearRampToValueAtTime(0, now + duration);
    }
    osc.start(); osc.stop(now + duration + 0.1);
  }, [isMuted, technique]);

  const saveSession = useCallback(async () => {
    const secondsSpent = totalSessionDuration - sessionTimeLeft;
    setIsActive(false); setView('finished'); playBackgroundSound(false);
    if (user && secondsSpent > 5) {
      try {
        const sessionsRef = collection(db, 'breathing_sessions', user.uid, 'history');
        await addDoc(sessionsRef, { timestamp: serverTimestamp(), technique, durationSeconds: Math.floor(secondsSpent) });
      } catch (e) { console.error(e); }
    }
  }, [user, technique, totalSessionDuration, sessionTimeLeft, playBackgroundSound]);

  useEffect(() => {
    let timer;
    if (isActive && view === 'exercise') {
      if (sessionTimeLeft > 0) {
        if (timeLeft > 0) {
          timer = setTimeout(() => {
            setTimeLeft(prev => parseFloat((prev - 0.1).toFixed(1)));
            setSessionTimeLeft(prev => parseFloat((prev - 0.1).toFixed(1)));
          }, 100);
        } else {
          if (phase === 'PAUZA') {
            const config = configs[technique];
            const phaseIdx = config.phases.indexOf(nextPhase);
            setPhase(nextPhase); setTimeLeft(config.times[phaseIdx]);
            if (nextPhase.includes('UDAHNITE') || nextPhase.includes('IZDAHNITE')) playPhaseSound(nextPhase);
          } else {
            const config = configs[technique];
            const currentIdx = config.phases.indexOf(phase);
            const nextIdx = (currentIdx + 1) % config.phases.length;
            setPhase('PAUZA'); setNextPhase(config.phases[nextIdx]); setTimeLeft(TRANSITION_PAUSE);
          }
        }
      } else { saveSession(); }
    }
    return () => clearTimeout(timer);
  }, [isActive, timeLeft, phase, nextPhase, sessionTimeLeft, view, technique, configs, saveSession, playPhaseSound]);

  const handleSelectTechnique = (t) => { initAudio(); setTechnique(t); setView('duration'); };
  
  const handleStartSession = (mins) => {
    initAudio(); const totalSecs = mins * 60;
    setTotalSessionDuration(totalSecs); setSessionTimeLeft(totalSecs);
    setView('exercise'); setIsActive(true); playBackgroundSound(true);
    setPhase('PAUZA'); setNextPhase(configs[technique].phases[0]); setTimeLeft(TRANSITION_PAUSE);
  };

  const getCircleStyles = () => {
    if (view === 'finished' || phase === 'PAUZA') return { transform: 'scale(1.1)', backgroundColor: 'rgba(255, 255, 255, 0.08)', transition: 'all 0.8s ease-in-out' };
    const config = configs[technique];
    const phaseIdx = config.phases.indexOf(phase);
    const color = config.colors[phaseIdx] || 'rgba(255, 255, 255, 0.1)';
    if (phase.includes('UDAHNITE')) {
      const p = 1 + ((config.times[phaseIdx] - timeLeft) / config.times[phaseIdx]) * 0.5;
      return { transform: `scale(${p})`, backgroundColor: color, transition: 'transform 0.1s linear' };
    }
    if (phase.includes('PUNIM')) return { transform: 'scale(1.5)', backgroundColor: color, transition: 'all 0.5s ease-out' };
    if (phase.includes('IZDAHNITE')) {
      const p = 1.5 - ((config.times[phaseIdx] - timeLeft) / config.times[phaseIdx]) * 0.5;
      return { transform: `scale(${p})`, backgroundColor: color, transition: 'transform 0.1s linear' };
    }
    return { transform: 'scale(1)', backgroundColor: color };
  };

  const renderCalendar = () => {
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1; 
    const days = [];
    const sessionMap = {};
    sessions.forEach(s => {
      const d = s.timestamp ? s.timestamp.toDate() : new Date();
      if (d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear()) {
        const dateKey = d.getDate(); sessionMap[dateKey] = (sessionMap[dateKey] || 0) + 1;
      }
    });
    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} className="h-10 w-10"></div>);
    for (let d = 1; d <= daysInMonth; d++) {
      const count = sessionMap[d];
      days.push(
        <div key={d} className="h-12 w-12 flex flex-col items-center justify-center relative rounded-lg bg-white/5 border border-white/5">
          <span className="text-[10px] text-white/40 absolute top-1 left-1">{d}</span>
          {count > 0 && <div className="flex flex-col items-center justify-center"><CheckCircle size={14} className="text-emerald-400" />{count > 1 && <span className="text-[9px] font-bold text-emerald-200">{count}</span>}</div>}
        </div>
      );
    }
    return days;
  };

  const formatTime = (seconds) => {
    const s = Math.max(0, seconds);
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const toggleReminder = async () => {
    if (!reminderEnabled) {
      if (typeof window.Notification !== 'undefined') {
        const permission = await window.Notification.requestPermission();
        if (permission === 'granted') {
          setReminderEnabled(true);
          new window.Notification("VJEŽBE DISANJA", { body: "DNEVNI PODSJETNIK JE UKLJUČEN." });
        }
      }
    } else {
      setReminderEnabled(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden font-sans bg-gradient-to-tr from-slate-950 via-blue-950 to-slate-900 text-white uppercase tracking-[0.2em]">
      <style>{`
        @keyframes cloudFloat { 0% { transform: translateX(-250px); } 100% { transform: translateX(110vw); } }
        .animate-cloud-slow { animation: cloudFloat 120s linear infinite; }
        .animate-cloud-medium { animation: cloudFloat 80s linear infinite; }
        .animate-cloud-fast { animation: cloudFloat 50s linear infinite; }
      `}</style>

      {/* Background Clouds */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20">
        <div className="absolute top-20 animate-cloud-slow left-[-10%]"><Cloud size={140} fill="white" color="white" /></div>
        <div className="absolute top-60 animate-cloud-medium left-[-20%]"><Cloud size={200} fill="white" color="white" /></div>
        <div className="absolute bottom-40 animate-cloud-fast right-[-15%]"><Cloud size={180} fill="white" color="white" /></div>
      </div>

      <div className="absolute top-8 right-8 flex items-center space-x-6 z-40">
        <button onClick={toggleReminder} className={`transition-all p-2 rounded-full bg-white/5 hover:bg-white/10 ${reminderEnabled ? 'text-emerald-400' : 'text-white/40'}`}>
          {reminderEnabled ? <Bell size={24} /> : <BellOff size={24} />}
        </button>
        <button onClick={() => setView('stats')} className="text-white/40 hover:text-white transition-all p-2 rounded-full bg-white/5 hover:bg-white/10">
          <CalendarIcon size={24} />
        </button>
      </div>

      <div className="relative z-20 w-full flex flex-col items-center justify-center px-4">
        {view === 'technique' && (
          <div className="flex flex-col items-center space-y-12 w-full max-w-4xl">
            <div className="text-center space-y-4 px-6">
              <h2 className="text-3xl font-bold tracking-[0.3em] drop-shadow-xl text-white">VJEŽBE DISANJA ZA OPUŠTANJE</h2>
              <p className="text-white/50 text-xs tracking-[0.4em]">ODABERITE TEHNIKU DISANJA</p>
            </div>
            <div className="flex flex-col md:flex-row gap-8 w-full justify-center">
              <button onClick={() => handleSelectTechnique('478')} className="flex flex-col items-center justify-center p-10 rounded-[3rem] bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-[1.02] transition-all w-full md:w-72 group shadow-2xl">
                <Wind className="text-blue-300 mb-6 group-hover:scale-110 transition-transform" size={48} /><span className="text-xl font-bold tracking-widest">4-7-8 TEHNIKA</span>
                <span className="text-[10px] text-white/40 mt-3 text-center tracking-[0.2em] leading-relaxed">DUBOKO OPUŠTANJE I SAN</span>
              </button>
              <button onClick={() => handleSelectTechnique('box')} className="flex flex-col items-center justify-center p-10 rounded-[3rem] bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-[1.02] transition-all w-full md:w-72 group shadow-2xl">
                <Square className="text-emerald-300 mb-6 group-hover:scale-110 transition-transform" size={48} /><span className="text-xl font-bold tracking-widest">BOX DISANJE</span>
                <span className="text-[10px] text-white/40 mt-3 text-center tracking-[0.2em] leading-relaxed">(4-4-4) SMIRIVANJE I FOKUS</span>
              </button>
            </div>
          </div>
        )}

        {view === 'duration' && (
          <div className="flex flex-col items-center space-y-12">
            <h2 className="text-3xl font-bold tracking-[0.3em] text-white text-center">TRAJANJE VJEŽBE</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {durations.map(mins => (
                <button key={mins} onClick={() => handleStartSession(mins)} className="flex flex-col items-center justify-center w-28 h-28 rounded-[2rem] bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-105 transition-all shadow-xl font-sans text-white">
                  <span className="text-3xl font-bold">{mins}</span><span className="text-[10px] text-white/40 tracking-widest mt-1">MIN</span>
                </button>
              ))}
            </div>
            <button onClick={() => setView('technique')} className="text-white/30 text-[11px] underline underline-offset-8 tracking-[0.3em] hover:text-white transition-colors">POVRATAK</button>
          </div>
        )}

        {view === 'exercise' && (
          <div className="flex flex-col items-center space-y-12">
            <div className="flex items-center space-x-3 px-6 py-2 bg-white/5 rounded-full border border-white/5 text-[11px] text-white/40 tracking-[0.3em]"><Clock size={14} /><span>PREOSTALO: {formatTime(sessionTimeLeft)}</span></div>
            <div className="px-12 py-8 bg-white/5 backdrop-blur-3xl rounded-[3.5rem] border border-white/10 shadow-2xl min-w-[380px] text-center">
               <h1 className="text-2xl font-bold tracking-[0.3em] font-sans text-white">{phase === 'PAUZA' ? 'PRIPREMITE SE...' : phase}</h1>
            </div>
            <div className="relative flex items-center justify-center w-80 h-80">
              <div className="absolute inset-[-50px] rounded-full bg-blue-500/10 blur-3xl animate-pulse"></div>
              <div className="absolute rounded-full flex items-center justify-center border border-white/5 shadow-2xl" style={{ width: '100%', height: '100%', ...getCircleStyles() }}><div className="w-4/5 h-4/5 rounded-full border border-white/5 backdrop-blur-md"></div></div>
              <div className="z-20 text-center"><div className="text-8xl font-extralight tracking-tighter font-sans text-white">{Math.ceil(timeLeft)}</div></div>
            </div>
            <div className="flex items-center space-x-8 px-8 py-5 bg-white/5 backdrop-blur-2xl rounded-full border border-white/10 shadow-2xl">
              <button onClick={() => { setIsActive(false); playBackgroundSound(false); setView('technique'); }} className="text-white/40 hover:text-white transition-all p-2"><RefreshCw size={24} /></button>
              <button onClick={() => setIsActive(!isActive)} className="flex items-center justify-center w-16 h-16 bg-white rounded-full text-slate-900 shadow-xl hover:scale-110 active:scale-95 transition-all">
                {isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
              </button>
              <button onClick={() => saveSession()} className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-full text-white hover:bg-rose-500/20 border border-white/10"><Square size={20} fill="currentColor" /></button>
              <button onClick={() => setIsMuted(!isMuted)} className="text-white/40 hover:text-white transition-all p-2">{isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}</button>
            </div>
            <div className="flex items-center space-x-2 text-white/20 text-[10px] tracking-[0.4em] uppercase"><Droplets size={12} /><span>ZEN AMBIJENT AKTIVAN</span></div>
          </div>
        )}

        {view === 'stats' && (
          <div className="relative z-50 bg-slate-900/95 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-white/10 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between mb-10"><h2 className="text-xl font-bold tracking-[0.2em] text-white">MOJA STATISTIKA</h2><button onClick={() => setView('technique')} className="text-white/40 hover:text-white p-2"><X size={28}/></button></div>
            <div className="flex items-center justify-between mb-6 px-2">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="text-white"><ChevronLeft size={24}/></button>
              <span className="text-sm font-bold tracking-[0.3em] font-sans text-white">{currentMonth.toLocaleString('hr-HR', { month: 'long', year: 'numeric' }).toUpperCase()}</span>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="text-white"><ChevronRight size={24}/></button>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-4 text-center text-white">{['P', 'U', 'S', 'Č', 'P', 'S', 'N'].map(day => <div key={day} className="text-[11px] text-white/30 font-bold">{day}</div>)}{renderCalendar()}</div>
            <div className="mt-10 pt-8 border-t border-white/5 flex justify-between items-center px-4 text-white">
              <div className="text-center"><div className="text-[10px] text-white/40 mb-2">UKUPNO</div><div className="text-3xl font-bold">{sessions.length}</div></div>
              <div className="text-center"><div className="text-[10px] text-white/40 mb-2">TEHNIKA</div><div className="text-sm font-bold uppercase">{technique === '478' ? '4-7-8' : 'BOX'}</div></div>
            </div>
          </div>
        )}

        {view === 'finished' && (
          <div className="flex flex-col items-center space-y-10 text-white">
            <CheckCircle size={80} className="text-emerald-400" />
            <h2 className="text-2xl font-bold tracking-[0.3em] text-center">VJEŽBA ZAVRŠENA i SPREMLJENA</h2>
            <button onClick={() => setView('technique')} className="px-14 py-4 bg-white text-slate-950 rounded-full font-bold shadow-2xl tracking-[0.3em]">NASTAVI</button>
          </div>
        )}
      </div>

      <div className="absolute bottom-8 left-0 right-0 z-10 text-white/30 text-[11px] tracking-[0.6em] text-center font-sans pointer-events-none uppercase">
        SVEN NIKLES, MD.{view !== 'technique' && <><br /><span className="font-bold opacity-60">{technique === '478' ? '4-7-8 BREATHING' : 'BOX BREATHING'}</span></>}
      </div>
    </div>
  );
}
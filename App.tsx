
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import HomeScreen from './components/HomeScreen';
import ChatScenario from './components/ChatScenario';
import HistoryScreen from './components/HistoryScreen';
import { BrainCircuitIcon, HistoryIcon, SunIcon, MoonIcon } from './components/icons';

const App: React.FC = () => {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedTheme = window.localStorage.getItem('theme');
      if (savedTheme) return savedTheme;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col transition-colors duration-300">
        <header className="p-4 border-b border-slate-200 dark:border-slate-700/50 sticky top-0 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
          <div className="container mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 text-xl font-bold text-slate-900 dark:text-white hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
              <BrainCircuitIcon className="w-8 h-8 text-cyan-500 dark:text-cyan-400" />
              <h1>Model Context Explorer</h1>
            </Link>
            <div className="flex items-center gap-4">
               <Link to="/history" title="View Chat History" className="text-slate-600 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                 <HistoryIcon className="w-6 h-6" />
               </Link>
               <button onClick={toggleTheme} title="Toggle Theme" className="text-slate-600 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
               </button>
            </div>
          </div>
        </header>
        <main className="flex-grow container mx-auto p-4 md:p-6">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/chat/:scenario" element={<ChatScenario />} />
            <Route path="/history" element={<HistoryScreen />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
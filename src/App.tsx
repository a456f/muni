import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import type { User } from './services/authService';

const SESSION_KEY = 'oisgo_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 días

function App() {
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  // Restaurar sesión desde localStorage si existe y no ha expirado
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session.user;
    } catch {
      return null;
    }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
    setJustLoggedIn(true);
    // Guardar sesión por 7 días
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      user: userData,
      expiresAt: Date.now() + SESSION_DURATION
    }));
  };

  const handleLogout = () => {
    setUser(null);
    setJustLoggedIn(false);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <>
      {user ? (
        <Dashboard
          user={user}
          onLogout={handleLogout}
          toggleTheme={toggleTheme}
          isDarkMode={theme === 'dark'}
          justLoggedIn={justLoggedIn}
        />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </>
  );
}

export default App;

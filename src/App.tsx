import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import type { User } from './services/authService';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <>
      {user ? (
        <Dashboard 
          user={user} 
          onLogout={() => setUser(null)} 
          toggleTheme={toggleTheme}
          isDarkMode={theme === 'dark'}
        />
      ) : (
        <Login onLogin={(userData) => setUser(userData)} />
      )}
    </>
  );
}

export default App;

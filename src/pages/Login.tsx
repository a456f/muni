import React, { useState } from 'react';
import '../styles/Login.css';
import { loginUser, testConnection, type User } from '../services/authService';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await loginUser(username, password);
      if (result.success) {
        onLogin(result.user!);
      } else {
        setError(result.message);
      }
    } catch (submitError) {
      console.error(submitError);
      setError('Ocurrio un error inesperado al procesar el login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckConnection = async () => {
    setConnectionStatus({ success: false, message: 'Verificando...' });
    const result = await testConnection();
    setConnectionStatus(result);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Header verde con gradiente */}
        <div className="login-brand">
          <div className="login-brand-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <span className="login-brand-text">OISGO</span>
        </div>

        {/* Formulario */}
        <div className="login-body">
          <h2 className="login-title">Iniciar Sesión</h2>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label>Correo Electrónico</label>
              <div className="login-input-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-input-icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="admin@ejemplo.com"
                />
              </div>
            </div>

            <div className="login-field">
              <label>Contraseña</label>
              <div className="login-input-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-input-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={isLoading}>
              {isLoading ? 'Cargando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <a href="#" className="login-forgot">¿Olvidaste tu contraseña?</a>
          <div className="login-version">Versión 1.0.0</div>
        </div>

        {/* Footer con olas verdes */}
        <div className="login-wave-footer">
          <svg viewBox="0 0 440 100" preserveAspectRatio="none">
            <path d="M0,60 C100,20 200,80 300,40 C360,15 420,50 440,30 L440,100 L0,100 Z" fill="rgba(46,125,50,0.15)"/>
            <path d="M0,70 C80,40 180,90 280,50 C360,25 420,60 440,45 L440,100 L0,100 Z" fill="rgba(46,125,50,0.3)"/>
            <path d="M0,80 C120,50 200,95 320,65 C380,45 430,70 440,60 L440,100 L0,100 Z" fill="#2E7D32"/>
          </svg>
          <div className="login-copyright">
            © 2024 OISGO.<br/>Todos los derechos reservados.
          </div>
        </div>
      </div>

      {/* Test connection flotante */}
      <button type="button" onClick={handleCheckConnection} className="login-test-btn">
        {connectionStatus ? (connectionStatus.success ? 'Conectado' : connectionStatus.message) : 'Probar conexión'}
      </button>
    </div>
  );
};

export default Login;

import { useAuthStore } from '../store/authStore';
import { Link, useLocation } from 'react-router-dom';
import api from '../lib/axios';

export const Chat = () => {
  const { refreshToken, logout: clearStore } = useAuthStore();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refresh_token: refreshToken });
      }
    } catch (e) {}
    clearStore();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Chat</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>
      
      <div className="nav-links">
        <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
        <Link to="/chat" className={location.pathname === '/chat' ? 'active' : ''}>Chat</Link>
        <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>Profile</Link>
      </div>

      <div>
        <p>This is a protected chat page.</p>
        <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '20px', minHeight: '200px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No messages yet...</p>
        </div>
      </div>
    </div>
  );
};

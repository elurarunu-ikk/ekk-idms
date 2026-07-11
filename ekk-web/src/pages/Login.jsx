import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginUser } from '../services/apiService';
import { saveSession } from '../services/session';

const FEATURES = [
  'Real-time project progress tracking',
  'Multi-stage approval workflows',
  'AI-powered insights & analytics',
  'Role-based access control',
];

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      toast.error('Username and password are required');
      return;
    }
    setLoading(true);
    try {
      const response = await loginUser(username, password);
      saveSession({ accessToken: response.access_token, session: response.session });
      toast.success('Login successful');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel — hidden on mobile */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col items-center justify-center bg-gradient-to-br from-primary-800 via-primary-700 to-primary-500 p-12 text-white">
        {/* Decorative blobs */}
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/3 h-48 w-48 -translate-y-1/2 rounded-full bg-white/5" />

        <div className="relative max-w-sm text-center">
          {/* Logo mark */}
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
            <span className="text-2xl font-black tracking-tight">EKK</span>
          </div>

          <h1 className="mb-1 text-4xl font-black tracking-tight">IDMS</h1>
            <p className="mb-2 text-lg font-semibold text-primary-100">Intelligence Data Management</p>
          <p className="text-sm leading-relaxed text-primary-200">
            A complete platform for tracking, approving, and analyzing infrastructure project progress.
          </p>

          <ul className="mt-10 space-y-3 text-left">
            {FEATURES.map((label) => (
              <li key={label} className="flex items-center gap-3 text-sm text-primary-100">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                  ✓
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-surface-50 px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white text-lg font-black">
              EKK
            </div>
            <h1 className="text-2xl font-black text-gray-900">IDMS</h1>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-card">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="mt-1 text-sm text-gray-500">Sign in to your account to continue</p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Username or Email
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your username"
                  autoComplete="username"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-11 text-sm text-gray-900 placeholder-gray-400 transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2
                               text-gray-400 hover:text-gray-600 transition"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                           viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                           viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            EKK Infrastructure Ltd · IDMS v1.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

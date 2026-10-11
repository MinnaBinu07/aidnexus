import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerUser } from '../api/auth';
import { formatApiError } from '../utils/formatError';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const user = await login(email, password);
      const from = location.state?.from?.pathname || location.state?.from || null;
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'investigator') {
        navigate('/investigate', { replace: true });
      } else if (user.role === 'member') {
        navigate('/status', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(formatApiError(err, 'Incorrect email or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 font-body">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-[#dac0c4]/40 shadow-xl">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-full bg-[#f1dee3] text-[#7a1f3d] mb-3">
            <span className="material-symbols-outlined text-[28px]">lock</span>
          </div>
          <h2 className="font-headline text-3xl font-bold text-[#0b1c30]">Sign in to AidNexus</h2>
          <p className="font-body text-xs text-[#554245] mt-1">
            Civil disaster verification & autonomous relief protocol
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#ffdad6] border border-[#ffdad6] text-[#93000a] text-xs font-semibold rounded-2xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#554245] uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.org"
              className="w-full px-4 h-11 text-sm bg-[#eff4ff] border border-[#dac0c4]/40 rounded-2xl text-[#0b1c30] focus:outline-none focus:border-[#7a1f3d]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#554245] uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 h-11 text-sm bg-[#eff4ff] border border-[#dac0c4]/40 rounded-2xl text-[#0b1c30] focus:outline-none focus:border-[#7a1f3d]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 text-sm font-bold bg-[#7a1f3d] hover:bg-[#5c0427] text-white rounded-full shadow-md transition disabled:opacity-50 mt-2 cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-[#554245] mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#7a1f3d] font-bold hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};

export const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await registerUser({ name, email, password, role, phone: phone || null });
      const user = await login(email, password);
      const from = location.state?.from?.pathname || location.state?.from || null;
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'investigator') {
        navigate('/investigate', { replace: true });
      } else if (user.role === 'member') {
        navigate('/status', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(formatApiError(err, 'Failed to register account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 font-body">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-[#dac0c4]/40 shadow-xl">
        <div className="text-center mb-6">
          <h2 className="font-headline text-3xl font-bold text-[#0b1c30]">Create an Account</h2>
          <p className="font-body text-xs text-[#554245] mt-1">Select your role to get started</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#ffdad6] border border-[#ffdad6] text-[#93000a] text-xs font-semibold rounded-2xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#554245] uppercase tracking-wider mb-1">
              Your Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`py-2.5 text-xs font-bold rounded-full border text-center transition cursor-pointer ${
                  role === 'admin'
                    ? 'bg-[#7a1f3d] border-[#7a1f3d] text-white'
                    : 'border-[#dac0c4]/60 text-[#554245] hover:bg-[#eff4ff]'
                }`}
              >
                Relief Coordinator
              </button>
              <button
                type="button"
                onClick={() => setRole('member')}
                className={`py-2.5 text-xs font-bold rounded-full border text-center transition cursor-pointer ${
                  role === 'member'
                    ? 'bg-[#7a1f3d] border-[#7a1f3d] text-white'
                    : 'border-[#dac0c4]/60 text-[#554245] hover:bg-[#eff4ff]'
                }`}
              >
                Household Member
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#554245] uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full px-4 h-11 text-sm bg-[#eff4ff] border border-[#dac0c4]/40 rounded-2xl text-[#0b1c30] focus:outline-none focus:border-[#7a1f3d]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#554245] uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 h-11 text-sm bg-[#eff4ff] border border-[#dac0c4]/40 rounded-2xl text-[#0b1c30] focus:outline-none focus:border-[#7a1f3d]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#554245] uppercase tracking-wider mb-1">
              Phone (Optional)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              className="w-full px-4 h-11 text-sm bg-[#eff4ff] border border-[#dac0c4]/40 rounded-2xl text-[#0b1c30] focus:outline-none focus:border-[#7a1f3d]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#554245] uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-4 h-11 text-sm bg-[#eff4ff] border border-[#dac0c4]/40 rounded-2xl text-[#0b1c30] focus:outline-none focus:border-[#7a1f3d]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 text-sm font-bold bg-[#7a1f3d] hover:bg-[#5c0427] text-white rounded-full shadow-md transition disabled:opacity-50 mt-2 cursor-pointer"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p className="text-center text-xs text-[#554245] mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-[#7a1f3d] font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

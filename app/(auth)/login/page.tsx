'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "dulgn6@gmail.com";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { loginWithEmail } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Admin email шалгах
    if (email !== ADMIN_EMAIL) {
      setError('Unauthorized: Only admin can access');
      setLoading(false);
      return;
    }

    try {
      // Firebase login дуудах
      await loginWithEmail(email, password);
      // AuthProvider автоматаар redirect хийнэ
    } catch (err: any) {
      console.error('Login error:', err.code);
      
      if (err.code === 'auth/wrong-password') {
        setError('Буруу нууц үг');
      } else if (err.code === 'auth/user-not-found') {
        setError('Хэрэглэгч олдсонгүй');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Буруу мэйл эсвэл нууц үг');
      } else {
        setError('Нэвтрэлт амжилтгүй: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="max-w-md w-full p-8 bg-zinc-800 rounded-lg shadow-xl border border-zinc-700">
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-zinc-300">
              Admin Email
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-zinc-300">
              Password
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>

          <button 
              type="submit"
              disabled={loading}
              className="w-full p-3 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 transition font-medium"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="loader" style={{ width: '20px', height: '20px', borderWidth: '3px' }}></span>
                  Нэвтэрч байна...
                </span>
              ) : (
                'Нэвтрэх'
              )}
            </button>
        </form>
      </div>
    </div>
  );
}
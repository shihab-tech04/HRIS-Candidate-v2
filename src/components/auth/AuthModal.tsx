import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CandidateLocaleSwitch, useCandidateLocale } from '../../context/CandidateLocaleContext';
import { X, Mail, Lock, User, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  returnNotice?: string;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
  returnNotice,
  onSuccess
}) => {
  const { signIn, signUp, resetPassword, signInAsDemoCandidate } = useAuth();
  const { t } = useCandidateLocale();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (!res.success) {
          setError(res.error || 'Invalid email or password.');
        } else {
          onClose();
          if (onSuccess) onSuccess();
        }
      } else if (mode === 'signup') {
        if (!fullName.trim()) {
          setError('Please provide your full legal name.');
          setLoading(false);
          return;
        }
        const res = await signUp(email, password, fullName);
        if (res.verificationRequired) {
          setSuccessMsg(res.error || 'Account created. Verify your email before signing in.');
        } else if (!res.success) {
          setError(res.error || 'Registration failed. Please check details.');
        } else {
          onClose();
          if (onSuccess) onSuccess();
        }
      } else if (mode === 'forgot') {
        const res = await resetPassword(email);
        if (!res.success) {
          setError(res.error || 'Password recovery request failed.');
        } else {
          setSuccessMsg('Password reset instructions sent. Please check your inbox.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoCandidate = async () => {
    setLoading(true);
    await signInAsDemoCandidate();
    setLoading(false);
    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header pattern */}
        <div className="bg-[#085587] text-white px-6 py-5 relative">
          <button
            onClick={onClose}
            aria-label={t('Close authentication dialog')}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider font-semibold text-sky-200">
              {t('Synesis Careers Portal')}
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {mode === 'signin' && t('Welcome Back')}
            {mode === 'signup' && t('Create Candidate Account')}
            {mode === 'forgot' && t('Reset Your Password')}
          </h2>
          <p className="text-xs text-sky-100/90 mt-1">
            {mode === 'signin' && t('Sign in to access your applications, interviews, and profile.')}
            {mode === 'signup' && t('Register once to apply to opportunities and manage your recruitment journey.')}
            {mode === 'forgot' && t('Enter your email address to receive password reset instructions.')}
          </p>
        </div>

        <div className="p-6">
          <div className="flex justify-end mb-3">
            <CandidateLocaleSwitch />
          </div>
          {returnNotice && (
            <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#085587] shrink-0 mt-0.5" />
              <span>{t(returnNotice)}</span>
            </div>
          )}

          {/* Local-only developer preview; never offer production identity impersonation. */}
          {import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === 'true' && (
          <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#085587]" />
                {t('Evaluation / Reviewer Quick Access')}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2.5">
              {t('Instant sign-in with verified sample candidate profile, active applications, interview invitation, and offer record.')}
            </p>
            <button
              type="button"
              onClick={handleDemoCandidate}
              disabled={loading}
              className="w-full py-2 px-3 text-xs font-medium text-[#085587] bg-white border border-[#085587]/30 hover:border-[#085587] hover:bg-sky-50/50 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              {t('Sign In as Farhan Rahman (Demo Candidate)')}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          )}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-slate-500 font-medium">{t('Or enter credentials')}</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{t(error)}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{t(successMsg)}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('Full Legal Name')}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('e.g. Farhan Rahman')}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#085587] focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Email Address')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('candidate@example.com')}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#085587] focus:border-transparent"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">{t('Password')}</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[11px] text-[#085587] hover:underline"
                    >
                      {t('Forgot password?')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#085587] focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#085587] text-white text-xs font-semibold rounded-lg hover:bg-[#074771] transition-colors shadow-sm disabled:opacity-50 mt-2"
            >
              {loading ? (
                t('Processing...')
              ) : mode === 'signin' ? (
                t('Sign In to Synesis Careers')
              ) : mode === 'signup' ? (
                t('Create Candidate Account')
              ) : (
                t('Send Recovery Email')
              )}
            </button>
          </form>

          {/* Toggle modes */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-600">
            {mode === 'signin' && (
              <p>
                {t("Don't have an account yet?")}{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="font-semibold text-[#085587] hover:underline ml-1"
                >
                  {t('Create one now')}
                </button>
              </p>
            )}

            {mode === 'signup' && (
              <p>
                {t('Already have an account?')}{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="font-semibold text-[#085587] hover:underline ml-1"
                >
                  {t('Sign in')}
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <p>
                {t('Remembered your credentials?')}{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="font-semibold text-[#085587] hover:underline ml-1"
                >
                  {t('Back to Sign In')}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

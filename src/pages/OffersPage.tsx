import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCandidateLocale } from '../context/CandidateLocaleContext';
import { JobOffer } from '../types';
import { getRecruitmentContext, respondToOffer } from '../lib/api';
import {
  Gift,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Download,
  PenTool
} from 'lucide-react';

interface OffersPageProps {
  onNavigate: (tab: string) => void;
}

export const OffersPage: React.FC<OffersPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { locale, t } = useCandidateLocale();
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Response modal state
  const [selectedOffer, setSelectedOffer] = useState<JobOffer | null>(null);
  const [responseType, setResponseType] = useState<'accepted' | 'declined' | null>(null);
  const [signatureText, setSignatureText] = useState('');
  const [responseNotes, setResponseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOffers();
  }, [user]);

  const loadOffers = async () => {
    if (!user) { setOffers([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const ctx = await getRecruitmentContext(user.id);
      setOffers(ctx.offers || []);
    } catch {
      setOffers([]);
      setLoadError('Unable to load offers. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAction = (offer: JobOffer, type: 'accepted' | 'declined') => {
    setSelectedOffer(offer);
    setResponseType(type);
    setSignatureText(user?.user_metadata?.full_name || '');
    setResponseNotes('');
    setError(null);
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffer || !responseType) return;

    if (responseType === 'accepted' && !signatureText.trim()) {
      setError('Please type your legal full name as digital signature acknowledgment.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await respondToOffer(
      selectedOffer.id,
      responseType,
      signatureText.trim(),
      responseNotes.trim()
    );

    setSubmitting(false);

    if (!res.success) {
      const serverMessage = res.error?.trim() || '';
      setError(serverMessage && t(serverMessage) !== serverMessage
        ? serverMessage
        : 'Unable to submit your offer response. Please retry.');
    } else {
      setSelectedOffer(null);
      setResponseType(null);
      await loadOffers();
      if (responseType === 'accepted') {
        onNavigate('preboarding');
      }
    }
  };

  const formatSalary = (amt: number, curr = 'BDT', period = 'monthly') => {
    const formatted = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', { maximumFractionDigits: 0 }).format(amt);
    return `${curr} ${formatted} / ${t(period === 'monthly' ? 'month' : 'year')}`;
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  if (loadError) return <main className="max-w-4xl mx-auto px-4 py-16">
    <h1 className="text-xl font-semibold">{t('Unable to load records')}</h1>
    <p role="alert" className="mt-3 text-sm text-red-700">{t(loadError)}</p>
    <button type="button" className="min-h-11 mt-4 px-4 rounded-lg border" onClick={() => void loadOffers()}>{t('Retry')}</button>
  </main>;
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="h-60 bg-white rounded-2xl border border-slate-200 animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-[#085587]">
            {t('Official Decision')}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{t('Employment Offers')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('Authorized employer-issued offer terms, compensation breakdown, and digital acceptance records.')}
          </p>
        </div>

        {offers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Gift className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-800 mb-1">{t('No Active Offers')}</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {t('When an official offer is approved by hiring executives in Main HRIS, it will appear here for your review and formal response.')}
            </p>
            <button
              onClick={() => onNavigate('applications')}
              className="py-2 px-4 bg-[#085587] text-white text-xs font-semibold rounded-lg"
            >
              {t('Track Applications')}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {offers.map((offer) => {
              const isExtended = offer.status === 'extended';
              const isAccepted = offer.status === 'accepted';
              const isDeclined = offer.status === 'declined';
              const isExpired = new Date(offer.expiry_date).getTime() < Date.now();

              return (
                <div
                  key={offer.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                >
                  {/* Top Badge Banner */}
                  <div className="bg-gradient-to-r from-[#085587] to-[#123d60] text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wider text-sky-200 font-semibold">
                        Synesis IT Limited · {t('Official Employment Offer')}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                        {offer.job_title}
                      </h2>
                      <p className="text-xs text-sky-100">
                        {t('Department: {department} · Reference ID: {reference}', { department: offer.department, reference: offer.id })}
                      </p>
                    </div>

                    <div className="self-start sm:self-center">
                      <span
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ${
                          isAccepted
                            ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                            : isDeclined
                            ? 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
                            : isExpired
                            ? 'bg-slate-500/20 text-slate-300 border border-slate-400/30'
                            : 'bg-amber-400 text-slate-900 font-bold'
                        }`}
                      >
                        {isAccepted
                          ? t('Offer Accepted & Signed')
                          : isDeclined
                          ? t('Offer Declined')
                          : isExpired
                          ? t('Offer Expired')
                          : t('Action Required (Extended)')}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8 space-y-6">
                    {/* Authorized Financial Terms (Strictly Non-Editable by Candidate) */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-[#085587]" />
                        {t('Authorized Compensation Structure')}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl text-xs border border-slate-100">
                        <div>
                          <p className="text-slate-500 text-[11px]">{t('Gross Fixed Salary')}</p>
                          <p className="text-base font-bold text-slate-900 font-mono mt-0.5">
                            {formatSalary(offer.salary, offer.currency, offer.salary_period)}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {t('Subject to applicable statutory tax deduction')}
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[11px]">{t('Proposed Start Date')}</p>
                          <p className="text-base font-bold text-slate-900 mt-0.5">
                            {formatDate(offer.start_date)}
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[11px]">{t('Response Expiry Date')}</p>
                          <p
                            className={`text-base font-bold mt-0.5 ${
                              isExpired && isExtended ? 'text-rose-600' : 'text-slate-900'
                            }`}
                          >
                            {formatDate(offer.expiry_date)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {offer.terms?.trim() && <section aria-label={t('Offer terms')} className="rounded-xl border border-[#B9DCE2] bg-[#F4FAFB] p-4 sm:p-5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{t('Offer terms')}</h3>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{offer.terms}</p>
                    </section>}

                    {/* Benefits Package */}
                    {offer.benefits_summary && offer.benefits_summary.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                          {t('Benefits & Provisions Included')}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                          {offer.benefits_summary.map((b, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-snug">{b}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Acceptance Signature Record */}
                    {isAccepted && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between font-semibold text-emerald-900">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            {t('Digital Legal Acknowledgment Recorded')}
                          </span>
                          <span>{t('Signed: {date}', { date: offer.signed_at ? formatDate(offer.signed_at) : '—' })}</span>
                        </div>
                        <p className="text-slate-700">
                          {t('Electronic Signee:')} <strong>{offer.candidate_signature}</strong>
                        </p>
                        <div className="pt-2">
                          <button
                            onClick={() => onNavigate('preboarding')}
                            className="py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs inline-flex items-center gap-2"
                          >
                            {t('Proceed to Preboarding Verification')} <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    {isExtended && !isExpired && (
                      <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                        <div className="text-xs text-slate-500">
                          <span>{t('Please submit your decision before the deadline date.')}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenAction(offer, 'declined')}
                            className="py-2 px-4 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors"
                          >
                            {t('Decline Offer')}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenAction(offer, 'accepted')}
                            className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-2"
                          >
                            <PenTool className="w-4 h-4" />
                            {t('Accept & Sign Offer')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Sign / Accept or Decline */}
        {selectedOffer && responseType && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-base font-bold text-slate-900">
                {responseType === 'accepted'
                  ? t('Accept & Digitally Sign Employment Offer')
                  : t('Decline Employment Offer')}
              </h3>

              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                <p>
                  <strong>{t('Role:')}</strong> {selectedOffer.job_title}
                </p>
                <p>
                  <strong>{t('Salary:')}</strong>{' '}
                  {formatSalary(selectedOffer.salary, selectedOffer.currency)}
                </p>
                <p>
                  <strong>{t('Start Date:')}</strong> {formatDate(selectedOffer.start_date)}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {t(error)}
                </div>
              )}

              <form onSubmit={handleSubmitResponse} className="space-y-4">
                {responseType === 'accepted' ? (
                  <>
                    <div>
                      <label htmlFor="offer-signature" className="block text-xs font-semibold text-slate-700 mb-1">
                        {t('Type Legal Full Name (Digital Signature) *')}
                      </label>
                      <input
                        id="offer-signature"
                        type="text"
                        required
                        value={signatureText}
                        onChange={(e) => setSignatureText(e.target.value)}
                        placeholder={t('e.g. Farhan Rahman')}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 font-serif"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        {t('By typing your full legal name, you execute an electronic acceptance of the terms specified in this offer document.')}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="offer-acceptance-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                        {t('Optional Acceptance Message to Hiring Team')}
                      </label>
                      <textarea
                        id="offer-acceptance-notes"
                        rows={3}
                        value={responseNotes}
                        onChange={(e) => setResponseNotes(e.target.value)}
                        placeholder={t('e.g. I am thrilled to accept the offer and excited to join the engineering team at Synesis IT...')}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label htmlFor="offer-decline-reason" className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('Reason for Declining Offer *')}
                    </label>
                    <textarea
                      id="offer-decline-reason"
                      rows={3}
                      required
                      value={responseNotes}
                      onChange={(e) => setResponseNotes(e.target.value)}
                      placeholder={t('Please share feedback or reason for declining (e.g., competing offer, timing, relocated)...')}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-600"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOffer(null);
                      setResponseType(null);
                    }}
                    className="py-2 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`py-2 px-6 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 ${
                      responseType === 'accepted'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {submitting
                      ? t('Processing...')
                      : responseType === 'accepted'
                      ? t('Confirm & Sign Offer')
                      : t('Decline Offer')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

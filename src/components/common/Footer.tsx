import React from 'react';

interface FooterProps {
  onNavigate: (tab: string) => void;
  onOpenConfig: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenConfig }) => {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#085587] text-white flex items-center justify-center font-bold text-sm">
                S
              </div>
              <span className="text-white font-bold text-sm tracking-tight">Synesis Careers</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-xs">
              Public recruitment and candidate management platform integrated with Synesis HRIS Main.
            </p>
            <p className="text-[11px] text-slate-500">
              Enterprise HRMIS Ecosystem · Project reference: oslgwxaqfbteqtwqvdzs
            </p>
          </div>

          {/* Col 2 */}
          <div>
            <h4 className="text-white font-semibold text-xs tracking-wider uppercase mb-3">Opportunities</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('jobs')}
                  className="hover:text-white transition-colors"
                >
                  All Published Openings
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('jobs')}
                  className="hover:text-white transition-colors"
                >
                  Engineering & Cloud Roles
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('jobs')}
                  className="hover:text-white transition-colors"
                >
                  Product & Design
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('saved-jobs')}
                  className="hover:text-white transition-colors"
                >
                  Saved Jobs & Job Alerts
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h4 className="text-white font-semibold text-xs tracking-wider uppercase mb-3">Candidate Workspace</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('applications')}
                  className="hover:text-white transition-colors"
                >
                  Application Status & Tracking
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('cv-builder')}
                  className="hover:text-white transition-colors"
                >
                  Structured CV Builder
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('interviews')}
                  className="hover:text-white transition-colors"
                >
                  Interview Invitations
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('offers')}
                  className="hover:text-white transition-colors"
                >
                  Job Offers & Preboarding
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4 */}
          <div>
            <h4 className="text-white font-semibold text-xs tracking-wider uppercase mb-3">System & Trust</h4>
            <ul className="space-y-2">
              {import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === 'true' && <li>
                <button
                  onClick={onOpenConfig}
                  className="hover:text-white transition-colors text-left"
                >
                  Supabase Backend Connection
                </button>
              </li>}
              <li>
                <span className="text-slate-400">Equal Employment Opportunity</span>
              </li>
              <li>
                <span className="text-slate-400">Candidate Privacy</span>
              </li>
              <li>
                <span className="text-slate-400">Synesis IT Headquarters, Dhaka</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-[11px]">
            © {new Date().getFullYear()} Synesis IT Limited. All rights reserved. Synesis Careers Candidate Platform.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span>Security: Row Level Security (RLS)</span>
            <span>·</span>
            <span>Auth: Unified Identity Handoff</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

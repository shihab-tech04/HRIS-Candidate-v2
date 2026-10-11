import React from 'react';
import { CheckCircle2, ArrowRight, ShieldCheck, Award, Users, Globe } from 'lucide-react';

interface AboutPageProps {
  onNavigate: (tab: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-[#085587]">
            Work with Synesis IT
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            Empowering Digital Bangladesh Through World-Class Engineering
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            For over two decades, Synesis IT has stood at the forefront of nationwide digital transformations, delivering mission-critical enterprise systems, healthcare tech platforms, and citizen-facing digital services.
          </p>
        </div>

        {/* Culture Workspace Photo */}
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm max-h-96">
          <img
            src="/src/assets/images/synesis_culture_workspace_1791597892615.jpg"
            alt="Synesis workplace collaboration"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* 4 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#085587] flex items-center justify-center font-bold">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">National Impact at Scale</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Our applications touch the lives of tens of millions every single day. When you ship code here, it matters at a national scale.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#085587] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Modern Architecture Standards</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              We advocate strongly for TypeScript, clean system architecture, automated CI/CD testing, strict database schemas, and zero-trust security.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#085587] flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">People-First Employee Lifecycle</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              From transparent candidate screening to continuous career progression, we support work-life harmony, health insurance, and learning budgets.
            </p>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs text-center sm:text-left">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Explore Open Opportunities</h2>
            <p className="text-xs text-slate-500 mt-1">
              Find a role that matches your skills and start your application journey.
            </p>
          </div>
          <button
            onClick={() => onNavigate('jobs')}
            className="py-2.5 px-6 bg-[#085587] text-white text-xs font-semibold rounded-xl hover:bg-[#074771] transition-colors shadow-xs flex items-center gap-2 whitespace-nowrap"
          >
            Browse Open Roles
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

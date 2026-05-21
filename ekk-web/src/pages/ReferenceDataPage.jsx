import { useState } from 'react';
import GPSTab from '../components/reference/GPSTab';
import LevelRegisterTab from '../components/reference/LevelRegisterTab';
import OGLAnalysisTab from '../components/reference/OGLAnalysisTab';
import OGLTab from '../components/reference/OGLTab';
import useProjectSession from '../hooks/useProjectSession';

const TABS = [
  {
    id: 'level-register',
    label: 'Level Register',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    accentColor: '#3B82F6',
  },
  {
    id: 'ogl',
    label: 'OGL',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064',
    accentColor: '#10B981',
  },
  {
    id: 'ogl-analysis',
    label: 'Cut/Fill Analysis',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    accentColor: '#F59E0B',
  },
  {
    id: 'gps',
    label: 'GPS Coordinates',
    icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
    accentColor: '#38BDF8',
  },
];

const ReferenceDataPage = () => {
  const [activeTab, setActiveTab] = useState('level-register');
  const { selectedProject } = useProjectSession();
  const projectId = selectedProject?.project_code ?? null;

  const activeTabDef = TABS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen bg-[#080C14] p-6 text-[#E2E8F0]">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Reference Data</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            {projectId
              ? `Project: ${projectId} — Grade Sheet Survey Data`
              : 'Select a project to view reference data'}
          </p>
        </div>
        {projectId && (
          <span className="rounded-full border border-[#1E3A5F] bg-[#0D1F3C] px-3 py-1 text-xs font-semibold text-[#60A5FA]">
            {projectId}
          </span>
        )}
      </div>

      {!projectId ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-[#1E293B] bg-[#0D1420] text-[#64748B]">
          No project selected. Choose a project from the sidebar.
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="mb-5 flex gap-1 rounded-xl border border-[#1E293B] bg-[#0D1420] p-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#1E293B] text-[#F1F5F9] shadow-sm'
                      : 'text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                  style={isActive ? { borderBottom: `2px solid ${tab.accentColor}` } : undefined}
                >
                  <svg
                    className="h-4 w-4 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isActive ? tab.accentColor : 'currentColor'}
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={tab.icon} />
                  </svg>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab accent line */}
          <div
            className="mb-4 h-0.5 w-full rounded-full opacity-30"
            style={{ background: activeTabDef?.accentColor ?? '#3B82F6' }}
          />

          {/* Tab content */}
          <div className="rounded-xl border border-[#1E293B] bg-[#0D1420] p-5">
            {activeTab === 'level-register' && <LevelRegisterTab projectId={projectId} />}
            {activeTab === 'ogl'            && <OGLTab projectId={projectId} />}
            {activeTab === 'ogl-analysis'   && <OGLAnalysisTab projectId={projectId} />}
            {activeTab === 'gps'            && <GPSTab projectId={projectId} />}
          </div>
        </>
      )}
    </div>
  );
};

export default ReferenceDataPage;

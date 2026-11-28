import { Suspense } from 'react';
import CommunicationsClient from './CommunicationsClient';

export default function CommunicationsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell w-full mx-auto space-y-6 font-sans animate-pulse">
          <div className="bg-white/[0.04] backdrop-blur-md border border-white/15 rounded-2xl p-6 h-24" />
          <div className="bg-white/[0.04] backdrop-blur-md border border-white/15 rounded-2xl p-6 h-64" />
        </div>
      }
    >
      <CommunicationsClient />
    </Suspense>
  );
}

import React from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-text">
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-0" />
      <div className="fixed top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5 pointer-events-none z-0" />
      
      <Sidebar />
      
      <main className="pl-64 min-h-screen relative z-10">
        <div className="container mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

import React from 'react';
import { Outlet } from 'react-router-dom';

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-dark-950 text-slate-100">
      <Outlet />
    </div>
  );
}

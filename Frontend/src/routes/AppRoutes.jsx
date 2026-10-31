import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { AdminLayout } from '../layouts/AdminLayout';

// Guest Pages
import { Home } from '../pages/Home';
import { Lobby } from '../pages/Lobby';
import { GameView } from '../pages/GameView';
import { PassAndPlay } from '../pages/PassAndPlay';
import { Leaderboard } from '../pages/Leaderboard';

// Admin Pages
import { AdminLogin } from '../pages/AdminLogin';
import { AdminDashboard } from '../pages/AdminDashboard';

export function AppRoutes() {
  return (
    <Routes>
      {/* Guest & Player Routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/lobby/:roomCode" element={<Lobby />} />
        <Route path="/game/:roomCode" element={<GameView />} />
        <Route path="/pass-and-play" element={<PassAndPlay />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Route>

      {/* Admin Portal Routes (Separated) */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminLogin />} />
        <Route path="dashboard" element={<AdminDashboard />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

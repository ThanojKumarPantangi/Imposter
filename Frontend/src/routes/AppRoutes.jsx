import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';

// Guest & Player Pages
import { Home } from '../pages/Home';
import { Lobby } from '../pages/Lobby';
import { GameView } from '../pages/GameView';
import { PassAndPlay } from '../pages/PassAndPlay';
import { Leaderboard } from '../pages/Leaderboard';

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

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

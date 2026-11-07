import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';

export interface ToastItem {
  message: string;
  isError?: boolean;
}

type ToastListener = (toast: ToastItem | null) => void;
const listeners = new Set<ToastListener>();

let currentToastTimeout: ReturnType<typeof setTimeout> | null = null;
let currentVisibleKey: string | null = null;
const recentHistory = new Map<string, number>();

const DEDUPE_WINDOW_MS = 4000; // Ignore duplicate messages within 4 seconds

function normalizeMessage(msg: string): string {
  return msg.trim().replace(/\s+/g, ' ').toLowerCase();
}

export const showToast = (message: string) => {
  if (!message || typeof message !== 'string') return;
  const cleanMessage = message.trim();
  if (!cleanMessage) return;

  const key = normalizeMessage(cleanMessage);
  const now = Date.now();

  // Prune history older than 10 seconds
  for (const [k, time] of recentHistory.entries()) {
    if (now - time > 10000) {
      recentHistory.delete(k);
    }
  }

  // Prevent duplicate if same message is currently visible or recently shown
  const lastTime = recentHistory.get(key) || 0;
  if (currentVisibleKey === key || now - lastTime < DEDUPE_WINDOW_MS) {
    return;
  }

  recentHistory.set(key, now);
  currentVisibleKey = key;

  if (currentToastTimeout) {
    clearTimeout(currentToastTimeout);
  }

  listeners.forEach((listener) => listener({ message: cleanMessage }));

  currentToastTimeout = setTimeout(() => {
    currentVisibleKey = null;
    listeners.forEach((listener) => listener(null));
  }, 4000);
};

export const showError = (message: string) => {
  if (!message || typeof message !== 'string') return;
  const cleanMessage = message.trim();
  if (!cleanMessage) return;

  const formatted = cleanMessage.startsWith('⚠️') ? cleanMessage : `⚠️ ${cleanMessage}`;
  const key = normalizeMessage(formatted);
  const rawKey = normalizeMessage(cleanMessage);
  const now = Date.now();

  // Prune history older than 10 seconds
  for (const [k, time] of recentHistory.entries()) {
    if (now - time > 10000) {
      recentHistory.delete(k);
    }
  }

  // Prevent duplicate if same error is currently visible or recently shown
  const lastTime = Math.max(recentHistory.get(key) || 0, recentHistory.get(rawKey) || 0);
  if (currentVisibleKey === key || currentVisibleKey === rawKey || now - lastTime < DEDUPE_WINDOW_MS) {
    return;
  }

  recentHistory.set(key, now);
  recentHistory.set(rawKey, now);
  currentVisibleKey = key;

  if (currentToastTimeout) {
    clearTimeout(currentToastTimeout);
  }

  listeners.forEach((listener) => listener({ message: formatted, isError: true }));

  currentToastTimeout = setTimeout(() => {
    currentVisibleKey = null;
    listeners.forEach((listener) => listener(null));
  }, 4000);
};

export const Toast: React.FC = () => {
  const [toast, setToast] = useState<ToastItem | null>(null);

  useEffect(() => {
    const handler: ToastListener = (newToast) => {
      setToast(newToast);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  if (!toast) return null;

  return (
    <View style={styles.toastContainer} pointerEvents="none">
      <View style={[styles.toastCard, toast.isError && styles.toastCardError]}>
        <Text style={[styles.toastText, toast.isError && styles.toastTextError]}>
          {toast.message}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 70,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toastCard: {
    backgroundColor: COLORS.dark[850],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  toastCardError: {
    borderColor: 'rgba(244, 63, 94, 0.6)',
    backgroundColor: 'rgba(30, 15, 20, 0.98)',
  },
  toastText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  toastTextError: {
    color: '#fda4af',
  },
});


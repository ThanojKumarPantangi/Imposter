import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  BackHandler,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, ServerOff, WifiOff, RefreshCw } from 'lucide-react-native';
import { GradientButton } from '../../components/common/GradientButton';
import { Card } from '../../components/common/Card';
import { COLORS } from '../../theme/colors';
import { RADIUS, SPACING } from '../../theme/spacing';

interface MaintenanceScreenProps {
  message?: string;
  onRetry: () => void;
  isRetrying: boolean;
  isOffline?: boolean;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  message,
  onRetry,
  isRetrying,
  isOffline = false,
}) => {
  const insets = useSafeAreaInsets();

  // Strictly prevent hardware back press from closing or bypassing maintenance
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const defaultMessage = isOffline
    ? 'Unable to connect to our servers right now. Please check your internet connection and try again.'
    : "Our servers are temporarily unavailable. We're working to bring Imposter back online. Thank you for your patience!";

  const displayMessage = message?.trim() ? message.trim() : defaultMessage;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, SPACING.lg),
          paddingBottom: Math.max(insets.bottom, SPACING.lg),
          paddingLeft: Math.max(insets.left, SPACING.lg),
          paddingRight: Math.max(insets.right, SPACING.lg),
        },
      ]}
    >
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Status Tag */}
        <View style={styles.brandingHeader}>
          <View style={[styles.statusBadge, isOffline ? styles.offlineBadge : styles.maintenanceBadge]}>
            <View style={[styles.statusDot, isOffline ? styles.offlineDot : styles.maintenanceDot]} />
            <Text style={[styles.statusBadgeText, isOffline ? styles.offlineBadgeText : styles.maintenanceBadgeText]}>
              {isOffline ? 'NETWORK OFFLINE' : 'SCHEDULED MAINTENANCE'}
            </Text>
          </View>
        </View>

        {/* Hero Visual */}
        <View style={styles.visualContainer}>
          <View style={styles.glowOuterCircle}>
            <View style={styles.glowInnerCircle}>
              {isOffline ? (
                <WifiOff size={44} color={COLORS.accent.amber} />
              ) : (
                <ServerOff size={44} color={COLORS.imposter.default} />
              )}
            </View>
          </View>
        </View>

        {/* Center Card */}
        <Card variant={isOffline ? 'default' : 'imposter'} style={styles.card}>
          <View style={styles.alertHeaderRow}>
            <AlertTriangle
              size={20}
              color={isOffline ? COLORS.accent.amber : COLORS.imposter.default}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.alertCategory, isOffline && { color: COLORS.accent.amber }]}>
              {isOffline ? 'CONNECTION UNAVAILABLE' : 'SERVERS UNDER MAINTENANCE'}
            </Text>
          </View>

          <Text style={styles.title}>We'll Be Back Soon!</Text>
          <Text style={styles.message}>{displayMessage}</Text>

          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              All active game rooms and scores will resume once server maintenance completes.
            </Text>
          </View>
        </Card>

        {/* Bottom Actions */}
        <View style={styles.actionsContainer}>
          <GradientButton
            title={isRetrying ? 'CONNECTING...' : 'TRY AGAIN'}
            onPress={onRetry}
            variant={isOffline ? 'cyan' : 'primary'}
            loading={isRetrying}
            size="lg"
            icon={<RefreshCw size={18} color={COLORS.white} />}
            iconPosition="right"
            style={styles.retryButton}
          />

          <Text style={styles.supportingText}>
            Tap 'Try Again' to re-verify server availability.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark[950],
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  brandingHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.round,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  maintenanceBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  offlineBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 8,
  },
  maintenanceDot: {
    backgroundColor: COLORS.imposter.default,
  },
  offlineDot: {
    backgroundColor: COLORS.accent.amber,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  maintenanceBadgeText: {
    color: COLORS.imposter.default,
  },
  offlineBadgeText: {
    color: COLORS.accent.amber,
  },
  visualContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.md,
  },
  glowOuterCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  glowInnerCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.imposter.default,
  },
  card: {
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  alertCategory: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.imposter.default,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: SPACING.sm,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 14,
    color: COLORS.slate[300],
    lineHeight: 21,
    marginBottom: SPACING.lg,
  },
  infoBanner: {
    backgroundColor: 'rgba(13, 17, 23, 0.8)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
  },
  infoBannerText: {
    fontSize: 12,
    color: COLORS.slate[400],
    lineHeight: 18,
  },
  actionsContainer: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  retryButton: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  supportingText: {
    fontSize: 12,
    color: COLORS.slate[500],
    textAlign: 'center',
    lineHeight: 17,
  },
});

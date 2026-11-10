import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  BackHandler,
  Linking,
  Alert,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DownloadCloud, ShieldAlert, Sparkles } from 'lucide-react-native';
import { AppUpdateConfig } from '../../services/startup/types';
import { GradientButton } from '../../components/common/GradientButton';
import { Card } from '../../components/common/Card';
import { COLORS } from '../../theme/colors';
import { RADIUS, SPACING } from '../../theme/spacing';

interface HardUpdateScreenProps {
  appUpdate: AppUpdateConfig;
  installedVersionCode: number;
}

export const HardUpdateScreen: React.FC<HardUpdateScreenProps> = ({
  appUpdate,
  installedVersionCode,
}) => {
  const insets = useSafeAreaInsets();
  const [isUpdating, setIsUpdating] = useState(false);

  // Strictly prevent hardware back press on Android from bypassing update screen
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const handleUpdatePress = async () => {
    if (isUpdating) return;

    const url = appUpdate.updateUrl?.trim();
    if (!url || !url.startsWith('https://')) {
      Alert.alert(
        'Invalid Update Link',
        'The update download link provided by the server is not valid. Please try again later or contact support.'
      );
      return;
    }

    try {
      setIsUpdating(true);
      const supported = await Linking.canOpenURL(url).catch(() => false);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (err: any) {
      console.error('[HardUpdateScreen] Failed to open update link:', err);
      Alert.alert(
        'Download Error',
        'Could not open the update link in your browser. Please ensure you have a browser installed and try again.'
      );
    } finally {
      // Re-enable button after delay so user can tap again if download failed to start
      setTimeout(() => setIsUpdating(false), 2000);
    }
  };

  const displayTitle = appUpdate.title?.trim() || 'An Update Is Required';
  const displayMessage =
    appUpdate.message?.trim() ||
    "You're running an older version of Imposter. Update now to continue playing and experience the latest improvements.";

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
        {/* Top Branding */}
        <View style={styles.brandingHeader}>
          <View style={styles.brandBadge}>
            <Sparkles size={14} color={COLORS.imposter.default} style={{ marginRight: 6 }} />
            <Text style={styles.brandBadgeText}>IMPOSTER MULTIPLAYER</Text>
          </View>
        </View>

        {/* Hero Visual */}
        <View style={styles.visualContainer}>
          <View style={styles.glowOuterCircle}>
            <View style={styles.glowInnerCircle}>
              <DownloadCloud size={48} color={COLORS.imposter.default} />
            </View>
          </View>
        </View>

        {/* Center Card */}
        <Card variant="imposter" style={styles.card}>
          <View style={styles.alertHeaderRow}>
            <ShieldAlert size={20} color={COLORS.imposter.default} style={{ marginRight: 8 }} />
            <Text style={styles.alertCategory}>MANDATORY UPDATE</Text>
          </View>

          <Text style={styles.title}>{displayTitle}</Text>
          <Text style={styles.message}>{displayMessage}</Text>

          {/* Version Comparison Badges */}
          <View style={styles.versionRow}>
            <View style={styles.versionBox}>
              <Text style={styles.versionLabel}>INSTALLED</Text>
              <Text style={styles.versionValueCurrent}>v{installedVersionCode}</Text>
            </View>
            <View style={styles.versionDivider} />
            <View style={styles.versionBox}>
              <Text style={styles.versionLabel}>REQUIRED</Text>
              <Text style={styles.versionValueTarget}>v{appUpdate.latestVersionCode}</Text>
            </View>
          </View>
        </Card>

        {/* Bottom Actions */}
        <View style={styles.actionsContainer}>
          <GradientButton
            title={isUpdating ? 'OPENING DOWNLOAD...' : 'UPDATE NOW'}
            onPress={handleUpdatePress}
            variant="primary"
            loading={isUpdating}
            size="lg"
            icon={<DownloadCloud size={20} color={COLORS.white} />}
            iconPosition="right"
            style={styles.updateButton}
          />

          <Text style={styles.supportingText}>
            Updating is required to continue. Older versions cannot connect to multiplayer matches.
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
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: RADIUS.round,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.imposter.default,
    letterSpacing: 2,
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
    marginBottom: SPACING.xl,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(13, 17, 23, 0.8)',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
  },
  versionBox: {
    alignItems: 'center',
    flex: 1,
  },
  versionDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
  },
  versionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate[400],
    letterSpacing: 1,
    marginBottom: 4,
  },
  versionValueCurrent: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate[300],
  },
  versionValueTarget: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.civilian.glow,
  },
  actionsContainer: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  updateButton: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  supportingText: {
    fontSize: 12,
    color: COLORS.slate[500],
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: SPACING.md,
  },
});

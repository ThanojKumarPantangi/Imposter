import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { ShieldCheck, Mail, Lock, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { GradientButton } from '../components/common/GradientButton';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';

export const AdminLoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { adminLogin, isAdminAuthenticated } = useAuth();
  const [email, setEmail] = useState<string>('admin@imposter.game');
  const [password, setPassword] = useState<string>('AdminSecret123!');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isAdminAuthenticated) {
      navigation.replace('AdminDashboard');
    }
  }, [isAdminAuthenticated, navigation]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      sounds.playClick();
      await adminLogin(email.trim(), password);
      navigation.replace('AdminDashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid administrative credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card variant="imposter" style={styles.loginCard}>
          <View style={styles.shieldCircle}>
            <ShieldCheck size={32} color={COLORS.imposter.default} />
          </View>

          <Text style={styles.title}>Admin Portal</Text>
          <Text style={styles.subtitle}>
            Authorized personnel only. Manage word packs, categories, and database seeding.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Admin Email</Text>
            <View style={styles.inputRow}>
              <Mail size={16} color={COLORS.slate[500]} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="admin@imposter.game"
                placeholderTextColor={COLORS.slate[500]}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.textInput}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Admin Password</Text>
            <View style={styles.inputRow}>
              <Lock size={16} color={COLORS.slate[500]} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.slate[500]}
                secureTextEntry
                style={styles.textInput}
              />
            </View>
          </View>

          <GradientButton
            title={loading ? 'Authenticating...' : 'Sign In as Admin'}
            onPress={handleLogin}
            loading={loading}
            variant="primary"
            icon={<ArrowRight size={16} color={COLORS.white} />}
            style={styles.submitBtn}
          />
        </Card>
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
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginCard: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    padding: SPACING.xl,
  },
  shieldCircle: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.slate[400],
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: SPACING.lg,
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    width: '100%',
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.imposter.default,
    fontWeight: '700',
    textAlign: 'center',
  },
  fieldBlock: {
    width: '100%',
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    height: 44,
  },
  textInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 14,
  },
  submitBtn: {
    width: '100%',
    marginTop: SPACING.sm,
  },
});


import { StyleSheet } from 'react-native';
import { COLORS } from '../../../theme/colors';
import { RADIUS, SPACING } from '../../../theme/spacing';

export const resultsStyles = StyleSheet.create({
  skullCircle: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.xxl,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  eliminationBox: {
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    width: '100%',
    marginVertical: SPACING.md,
  },
  eliminatedTag: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
  },
  eliminatedPlayerName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.imposter.default,
    marginVertical: 4,
  },
  eliminatedRoleBadge: {
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  eliminatedRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate[300],
    textTransform: 'uppercase',
  },
  tieBox: {
    backgroundColor: COLORS.dark[950],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginVertical: SPACING.md,
    width: '100%',
  },
  tieText: {
    fontSize: 12,
    color: COLORS.accent.amber,
    fontWeight: '700',
    textAlign: 'center',
  },
  trophyCircle: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xxl,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  winnerHeadline: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  imposterWinText: {
    color: COLORS.imposter.default,
  },
  civilianWinText: {
    color: COLORS.civilian.default,
  },
  winConditionDesc: {
    fontSize: 13,
    color: COLORS.slate[300],
    textAlign: 'center',
    marginVertical: SPACING.sm,
    lineHeight: 18,
  },
  secretRevealBox: {
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: '100%',
    gap: SPACING.md,
    marginVertical: SPACING.md,
  },
  secretRevealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secretRevealCol: {
    flex: 1,
  },
  revealLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  revealSecretWord: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.civilian.default,
  },
  revealHint: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate[200],
  },
  finishedContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  winHeader: {
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  winHeadline: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 36,
    // Add fontFamily: 'serif' here if you have a serif font loaded in your project
  },
  textImposter: {
    color: '#F43F5E', // Red for Imposter
  },
  textCivilian: {
    color: '#38BDF8', // Blue for Civilian
  },
  illustrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    minHeight: 200,
  },
  placeholderGraphic: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  bottomInfoCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  secretWordLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  secretWordValue: {
    fontSize: 42,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 8,
    // Add fontFamily: 'serif' here if you want it to match the screenshot perfectly
  },
  impostersListSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  imposterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  winnerActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  halfBtn: {
    flex: 1,
  },
});


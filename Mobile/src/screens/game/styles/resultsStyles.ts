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
  impostersListSection: {
    gap: 4,
  },
  imposterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  winnerActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.sm,
  },
  halfBtn: {
    flex: 1,
  },
});


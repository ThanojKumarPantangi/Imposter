import { StyleSheet } from 'react-native';
import { COLORS } from '../../../theme/colors';
import { RADIUS, SPACING } from '../../../theme/spacing';

export const clueStyles = StyleSheet.create({
  clueRoundContainer: {
    gap: SPACING.md,
  },
  myTurnCard: {
    borderWidth: 1.5,
    borderColor: COLORS.civilian.default,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  otherTurnCard: {
    backgroundColor: COLORS.dark[900],
  },
  clueForm: {
    gap: SPACING.sm,
  },
  inputAndSubmitRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  clueTextInput: {
    flex: 1,
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  clueSendBtn: {
    backgroundColor: COLORS.civilian.default,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSendBtn: {
    opacity: 0.45,
  },
  imposterTipBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  imposterTipText: {
    fontSize: 10,
    color: '#fb7185',
  },
  turnOrderCard: {
    width: '100%',
  },
  turnOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  turnOrderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  roundPill: {
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
  },
  roundPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  playersClueList: {
    gap: SPACING.sm,
  },
  playerClueRow: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  playerClueRowActive: {
    backgroundColor: '#007BFF',
    borderWidth: 0,
  },
  playerClueRowInactive: {
    backgroundColor: '#1A1A1A',
    borderWidth: 0,
  },
  playerClueRowDisconnected: {
    opacity: 0.7,
  },
  playerClueRowEliminated: {
    opacity: 0.5,
  },
  playerAvatarWrapper: {
    flexShrink: 0,
  },
  playerInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  clueRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  cluePlayerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  cluePlayerNameActive: {
    color: '#FFFFFF',
  },
  cluePlayerNameInactive: {
    color: '#9CA3AF',
  },
  youTagActive: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
    fontSize: 12,
  },
  youTagInactive: {
    color: '#6B7280',
    fontWeight: '400',
    fontSize: 12,
  },
  clueWordText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  clueWordTextActive: {
    color: '#FFFFFF',
  },
  clueWordTextInactive: {
    color: '#38bdf8',
  },
  skippedWordText: {
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 2,
  },
  skippedWordTextActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  skippedWordTextInactive: {
    color: '#f59e0b',
  },
  statusColRight: {
    alignItems: 'flex-end',
  },
  statusDeparted: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.slate[500],
    textTransform: 'uppercase',
  },
  statusEliminated: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.slate[500],
    textTransform: 'uppercase',
  },
  statusSubmitted: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.accent.emerald,
    textTransform: 'uppercase',
  },
  statusSkipped: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.accent.amber,
    textTransform: 'uppercase',
  },
  statusThinking: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.civilian.default,
    textTransform: 'uppercase',
  },
  statusWaiting: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.slate[500],
  },
  clueTextRow: {
    paddingLeft: 34,
  },
  clueBubbleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38bdf8',
  },
  skippedClueText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.accent.amber,
  },
  noClueYetText: {
    fontSize: 11,
    color: COLORS.slate[600],
  },
  prevRoundsBox: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate[800],
  },
  prevRoundsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  prevClueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  prevClueText: {
    fontSize: 11,
    color: COLORS.slate[400],
  },
  boldWhite: {
    color: COLORS.white,
    fontWeight: '700',
  },
  skippedAmber: {
    color: COLORS.accent.amber,
    fontStyle: 'italic',
  },
  prevRoundNum: {
    fontSize: 9,
    color: COLORS.slate[500],
    fontWeight: '700',
  },
});


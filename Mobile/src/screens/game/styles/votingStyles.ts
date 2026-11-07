import { StyleSheet } from 'react-native';
import { COLORS } from '../../../theme/colors';
import { RADIUS, SPACING } from '../../../theme/spacing';

export const votingStyles = StyleSheet.create({
  votingContainerCard: {
    width: '100%',
    gap: SPACING.md,
  },
  votingHeader: {
    alignItems: 'center',
    gap: 4,
  },
  eyeIconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  progressContainer: {
    backgroundColor: COLORS.dark[950],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate[300],
  },
  progressCount: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.accent.emerald,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: COLORS.slate[800],
    borderRadius: RADIUS.round,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent.emerald,
    borderRadius: RADIUS.round,
  },
  notVotedSection: {
    marginTop: 6,
  },
  notVotedLabel: {
    fontSize: 10,
    color: COLORS.slate[400],
    marginBottom: 4,
  },
  notVotedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  notVotedChip: {
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.round,
  },
  notVotedChipText: {
    fontSize: 10,
    color: COLORS.slate[300],
    fontWeight: '600',
  },
  votingGrid: {
    gap: SPACING.sm,
  },
  voteTargetCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  voteTargetSelected: {
    backgroundColor: '#007BFF',
    borderWidth: 0,
  },
  voteTargetSelf: {
    opacity: 0.5,
  },
  targetAvatarWrapper: {
    flexShrink: 0,
  },
  targetInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  targetName: {
    fontSize: 15,
    fontWeight: '700',
  },
  targetNameSelected: {
    color: '#FFFFFF',
  },
  targetNameUnselected: {
    color: '#9CA3AF',
  },
  targetSubSelected: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    marginTop: 2,
  },
  targetSubUnselected: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  targetSub: {
    fontSize: 11,
    color: COLORS.slate[400],
    marginTop: 1,
  },
  youTagSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
    fontSize: 12,
  },
  youTagUnselected: {
    color: '#6B7280',
    fontWeight: '400',
    fontSize: 12,
  },
  voteActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  voteConfirmBtn: {
    flex: 2,
  },
  skipVoteBtn: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  skipVoteDisabled: {
    opacity: 0.4,
  },
  skipVoteText: {
    color: COLORS.accent.amber,
    fontWeight: '800',
    fontSize: 13,
  },
  spectatorVoteList: {
    gap: SPACING.sm,
  },
  spectatorVoteItem: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  voterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  voterName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  voterTarget: {
    alignItems: 'flex-end',
  },
  targetSkipText: {
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
    color: COLORS.accent.amber,
    marginTop: 2,
  },
  targetVotedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38bdf8',
    marginTop: 2,
  },
  targetUndecided: {
    fontSize: 11,
    color: COLORS.slate[500],
    fontStyle: 'italic',
  },
});


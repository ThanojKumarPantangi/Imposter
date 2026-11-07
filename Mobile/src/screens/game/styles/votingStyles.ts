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
    backgroundColor: COLORS.dark[850],
    borderWidth: 1.5,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  voteTargetSelected: {
    borderColor: COLORS.imposter.default,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  voteTargetSelf: {
    opacity: 0.5,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  targetName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  targetSub: {
    fontSize: 11,
    color: COLORS.slate[400],
    marginTop: 1,
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
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: RADIUS.lg,
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
    backgroundColor: COLORS.dark[950],
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  spectatorVoteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate[800],
  },
  voterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  voterName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate[200],
  },
  voterTarget: {
    alignItems: 'flex-end',
  },
  targetSkipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent.amber,
  },
  targetVotedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fb7185',
  },
  targetUndecided: {
    fontSize: 11,
    color: COLORS.slate[500],
    fontStyle: 'italic',
  },
});


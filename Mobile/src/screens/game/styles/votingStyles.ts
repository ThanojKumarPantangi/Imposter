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

  // --- NEW PROGRESS UI ---
  progressContainer: {
    backgroundColor: '#1A1A1A', // Matches the new player card background
    borderRadius: 24,           // Sleek, pill-like rounding
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  progressCount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#34D399', // Bright emerald green
  },
  progressCountMuted: {
    color: '#6B7280', // Slate 500
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#34D399', // Bright emerald green
    borderRadius: 8,
  },
  notVotedSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 12,
  },
  notVotedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  notVotedChipsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16, // Breathing room at the end of the scroll
  },
  notVotedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16, // Pill shape
    gap: 6,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B', // Amber color indicating 'waiting'
  },
  notVotedChipText: {
    fontSize: 11,
    color: '#D1D5DB', // Light slate
    fontWeight: '600',
  },

  // --- EXISTING VOTING GRID/TARGET STYLES ---
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
    backgroundColor: '#007BFF', // Matches active player blue
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
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  skipVoteDisabled: {
    opacity: 0.4,
  },
  skipVoteText: {
    color: COLORS.accent.amber,
    fontWeight: '800',
    fontSize: 14,
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
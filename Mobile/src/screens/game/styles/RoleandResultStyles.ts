import { StyleSheet, Platform } from 'react-native';

export const RoleandResultStyles = StyleSheet.create({
    centerPhaseCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 24,
        paddingHorizontal: 24,
        paddingVertical: 32,
        alignItems: 'center',
        width: '100%',
        gap: 16,
    },

    // Icons
    skullCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(244, 63, 94, 0.15)', // Red tint
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    sparkleIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(56, 189, 248, 0.15)', // Light blue tint
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },

    // Typography
    phaseMainTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    phaseSubTitle: {
        fontSize: 13,
        fontWeight: '500',
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 12,
    },

    // Result Boxes
    eliminationBox: {
        width: '100%',
        backgroundColor: 'rgba(244, 63, 94, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(244, 63, 94, 0.25)',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        gap: 12,
        marginVertical: 8,
    },
    eliminatedTag: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FB7185',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    eliminatedPlayerName: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    eliminatedRoleBadge: {
        backgroundColor: '#000000',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    eliminatedRoleText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#F43F5E',
        textTransform: 'uppercase',
    },

    tieBox: {
        width: '100%',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginVertical: 8,
    },
    tieText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FBBF24',
        textAlign: 'center',
        lineHeight: 22,
    },

    countdownBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#0A0E17',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.3)',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginTop: 6,
    },
    countdownBadgeResults: {
        borderColor: 'rgba(244, 63, 94, 0.3)',
        marginTop: 12,
    },
    countdownText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#CBD5E1',
    },
    countdownNumberCyan: {
        color: '#38BDF8',
        fontWeight: '900',
    },
    countdownNumberRose: {
        color: '#F43F5E',
        fontWeight: '900',
    },

    resultsWrapper: {
        width: '100%',
        alignItems: 'center',
    },
    impostersRemainPill: {
        marginTop: 24,
        paddingHorizontal: 28,
        paddingVertical: 10,
        borderRadius: 9999,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: 'rgba(5, 11, 20, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
    },
    impostersRemainText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
        textAlign: 'center',
        letterSpacing: 0.5,
    },

    // Votes Tally Section
    votesTallyContainer: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 14,
        gap: 10,
        marginVertical: 4,
    },
    votesTallyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 2,
    },
    votesTallyTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    votesTallyList: {
        gap: 8,
    },
    voteItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    voteItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        marginRight: 8,
    },
    skipVoteIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    voteItemName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        flexShrink: 1,
    },
    eliminatedTagSmall: {
        backgroundColor: 'rgba(244, 63, 94, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(244, 63, 94, 0.4)',
    },
    eliminatedTagSmallText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#FB7185',
        textTransform: 'uppercase',
    },
    voteCountBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    voteCountBadgeEliminated: {
        backgroundColor: 'rgba(244, 63, 94, 0.15)',
        borderColor: 'rgba(244, 63, 94, 0.35)',
    },
    voteCountBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#E2E8F0',
    },
    voteCountBadgeTextEliminated: {
        color: '#FB7185',
    },
});
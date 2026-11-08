import { StyleSheet } from 'react-native';

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
});
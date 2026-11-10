import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MessageSquare, MessageSquareDot } from 'lucide-react-native';
import { useChat } from '../context/ChatContext';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';

interface Props {
  compact?: boolean;
}

export const ChatButton: React.FC<Props> = ({ compact = false }) => {
  const { openChat, totalUnreadCount } = useChat();

  return (
    <TouchableOpacity
      onPress={() => openChat()}
      style={[styles.button, compact && styles.buttonCompact]}
      activeOpacity={0.7}
      accessibilityLabel={`Open chat${totalUnreadCount > 0 ? `, ${totalUnreadCount} unread messages` : ''}`}
    >
      <View style={styles.iconWrapper}>
        {totalUnreadCount > 0 ? (
          <MessageSquareDot size={compact ? 16 : 18} color={COLORS.civilian.default} />
        ) : (
          <MessageSquare size={compact ? 16 : 18} color={COLORS.slate[300]} />
        )}

        {totalUnreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 38,
    minWidth: 38,
    paddingHorizontal: 10,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.dark[850],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: {
    height: 34,
    minWidth: 34,
    paddingHorizontal: 8,
    borderRadius: RADIUS.md,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.imposter.default,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.dark[900],
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
});


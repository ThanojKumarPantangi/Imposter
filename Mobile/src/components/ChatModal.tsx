import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import {
  MessageSquare,
  MessageSquareDot,
  Send,
  X,
  Shield,
  Skull,
  Users,
  Lock,
  EyeOff,
} from 'lucide-react-native';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { ChatMessage } from '../types';

export const ChatModal: React.FC = () => {
  const {
    isOpen,
    closeChat,
    activeTab,
    setActiveTab,
    isLobby,
    myRole,
    isImposterChatEnabled,
    lobbyMessages,
    gameGlobalMessages,
    teamMessages,
    unreadGlobalCount,
    unreadTeamCount,
    sendMessage,
  } = useChat();

  const { player } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const messages: ChatMessage[] = isLobby
    ? lobbyMessages
    : activeTab === 'GLOBAL'
    ? gameGlobalMessages
    : teamMessages;

  const isTeamDisabled =
    !isLobby && activeTab === 'TEAM' && myRole === 'IMPOSTER' && !isImposterChatEnabled;

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [isOpen, messages.length, activeTab]);

  const handleSend = async () => {
    if (!inputText.trim() || isSending || isTeamDisabled) return;
    setErrorNotice(null);
    setIsSending(true);
    const textToSend = inputText.trim();
    setInputText('');

    const res = await sendMessage(textToSend);
    setIsSending(false);
    if (!res.success) {
      setErrorNotice(res.error || 'Failed to send message');
      setInputText(textToSend);
    }
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isSelf = Boolean(player?.id && item.senderId && item.senderId === player.id);
    const isCivilianTeamChat = item.channel === 'GAME_CIVILIAN';

    if (isCivilianTeamChat) {
      // STRICTLY ANONYMOUS: No username, no avatar, no sender ID
      return (
        <View style={[styles.messageRow, styles.messageRowLeft]}>
          <View style={[styles.messageBubble, styles.messageBubbleCivilian]}>
            <View style={styles.anonHeaderRow}>
              <Shield size={12} color={COLORS.civilian.default} />
              <Text style={styles.anonLabel}>Civilian</Text>
              <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
            </View>
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    if (isSelf) {
      return (
        <View style={[styles.messageRow, styles.messageRowRight]}>
          <View style={[styles.messageBubble, styles.messageBubbleSelf]}>
            <View style={styles.selfHeaderRow}>
              <Text style={styles.messageTimeSelf}>{formatTime(item.createdAt)}</Text>
              <Text style={styles.selfLabel}>You</Text>
            </View>
            <Text style={styles.messageTextSelf}>{item.text}</Text>
          </View>
        </View>
      );
    }

    // Other player's message in Global or Imposter Chat
    const isImposterMsg = item.channel === 'GAME_IMPOSTER';

    return (
      <View style={[styles.messageRow, styles.messageRowLeft]}>
        <View
          style={[
            styles.messageBubble,
            isImposterMsg ? styles.messageBubbleImposter : styles.messageBubbleOther,
          ]}
        >
          <View style={styles.otherHeaderRow}>
            {isImposterMsg && <Skull size={12} color={COLORS.imposter.default} />}
            <Text
              style={[
                styles.senderName,
                isImposterMsg ? styles.senderNameImposter : styles.senderNameOther,
              ]}
              numberOfLines={1}
            >
              {item.senderUsername || 'Player'}
            </Text>
            <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.messageText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  const getTeamLabel = () => {
    if (myRole === 'IMPOSTER') return 'Imposter Chat';
    if (myRole === 'CIVILIAN') return 'Civilian Chat';
    return 'Team Chat';
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={closeChat}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <View style={styles.chatSheet}>
            {/* Header */}
            <View style={styles.chatHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.chatIconBox}>
                  <MessageSquare size={18} color={COLORS.civilian.default} />
                </View>
                <View>
                  <Text style={styles.chatTitle}>
                    {isLobby ? 'Lobby Chat' : 'In-Game Chat'}
                  </Text>
                  <Text style={styles.chatSubtitle}>
                    {isLobby
                      ? 'Global communication with all players'
                      : activeTab === 'GLOBAL'
                      ? 'Visible to everyone in game'
                      : myRole === 'IMPOSTER'
                      ? 'Private imposter communication'
                      : 'Anonymous civilian communication'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={closeChat}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={COLORS.slate[400]} />
              </TouchableOpacity>
            </View>

            {/* Channels Tab Bar (In-Game only) */}
            {!isLobby && (
              <View style={styles.tabBar}>
                {/* Global Tab */}
                <TouchableOpacity
                  onPress={() => setActiveTab('GLOBAL')}
                  style={[styles.tabButton, activeTab === 'GLOBAL' && styles.tabButtonActive]}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabContent}>
                    {unreadGlobalCount > 0 ? (
                      <MessageSquareDot size={15} color={activeTab === 'GLOBAL' ? COLORS.civilian.default : COLORS.slate[400]} />
                    ) : (
                      <Users size={15} color={activeTab === 'GLOBAL' ? COLORS.civilian.default : COLORS.slate[400]} />
                    )}
                    <Text
                      style={[
                        styles.tabText,
                        activeTab === 'GLOBAL' && styles.tabTextActive,
                      ]}
                    >
                      Global
                    </Text>
                    {unreadGlobalCount > 0 && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{unreadGlobalCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Team Tab */}
                <TouchableOpacity
                  onPress={() => setActiveTab('TEAM')}
                  style={[
                    styles.tabButton,
                    activeTab === 'TEAM' && styles.tabButtonActive,
                    isTeamDisabled && styles.tabButtonDisabled,
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabContent}>
                    {myRole === 'IMPOSTER' ? (
                      <Skull
                        size={15}
                        color={
                          isTeamDisabled
                            ? COLORS.slate[500]
                            : activeTab === 'TEAM'
                            ? COLORS.imposter.default
                            : COLORS.slate[400]
                        }
                      />
                    ) : (
                      <Shield
                        size={15}
                        color={
                          activeTab === 'TEAM'
                            ? COLORS.civilian.default
                            : COLORS.slate[400]
                        }
                      />
                    )}
                    <Text
                      style={[
                        styles.tabText,
                        activeTab === 'TEAM' && styles.tabTextActive,
                        isTeamDisabled && styles.tabTextDisabled,
                      ]}
                      numberOfLines={1}
                    >
                      {getTeamLabel()}
                    </Text>
                    {isTeamDisabled && <Lock size={12} color={COLORS.slate[500]} />}
                    {unreadTeamCount > 0 && !isTeamDisabled && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{unreadTeamCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Civilian Anonymous Banner */}
            {!isLobby && activeTab === 'TEAM' && myRole === 'CIVILIAN' && (
              <View style={styles.anonBanner}>
                <EyeOff size={14} color={COLORS.civilian.default} />
                <Text style={styles.anonBannerText}>
                  Anonymous Channel • Usernames are hidden for all civilians
                </Text>
              </View>
            )}

            {/* Imposter Disabled Banner */}
            {isTeamDisabled && (
              <View style={styles.disabledBanner}>
                <Lock size={16} color={COLORS.accent.amber} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.disabledBannerTitle}>Imposter Chat Disabled</Text>
                  <Text style={styles.disabledBannerSubtitle}>
                    Imposter Chat is only available when there are 2 or more imposters in the game.
                  </Text>
                </View>
              </View>
            )}

            {/* Error Notice */}
            {errorNotice && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorNotice}</Text>
              </View>
            )}

            {/* Messages List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.messageListContent}
              style={styles.messageList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {isTeamDisabled
                      ? 'Channel disabled for single imposter match.'
                      : 'No messages yet. Send a message to get started!'}
                  </Text>
                </View>
              }
            />

            {/* Input Bar */}
            <View style={styles.inputContainer}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={
                  isTeamDisabled
                    ? 'Chat disabled for single imposter game'
                    : isLobby
                    ? 'Message lobby...'
                    : activeTab === 'GLOBAL'
                    ? 'Message everyone in game...'
                    : myRole === 'IMPOSTER'
                    ? 'Message fellow imposters...'
                    : 'Send anonymous civilian clue/message...'
                }
                placeholderTextColor={COLORS.slate[500]}
                style={[styles.textInput, isTeamDisabled && styles.textInputDisabled]}
                maxLength={500}
                editable={!isTeamDisabled && !isSending}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />

              <TouchableOpacity
                onPress={handleSend}
                disabled={!inputText.trim() || isSending || isTeamDisabled}
                style={[
                  styles.sendButton,
                  (!inputText.trim() || isSending || isTeamDisabled) && styles.sendButtonDisabled,
                ]}
              >
                <Send size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 11, 20, 0.75)',
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chatSheet: {
    height: '75%',
    backgroundColor: COLORS.dark[900],
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate[800],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  chatIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  chatSubtitle: {
    fontSize: 11,
    color: COLORS.slate[400],
  },
  closeBtn: {
    padding: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.slate[800],
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.dark[950],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate[800],
    gap: SPACING.xs,
  },
  tabButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: COLORS.dark[850],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
  },
  tabButtonDisabled: {
    opacity: 0.6,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  tabTextActive: {
    color: COLORS.white,
  },
  tabTextDisabled: {
    color: COLORS.slate[500],
  },
  tabBadge: {
    backgroundColor: COLORS.imposter.default,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 2,
  },
  tabBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  anonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
  },
  anonBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.civilian.default,
  },
  disabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  disabledBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.accent.amber,
  },
  disabledBannerSubtitle: {
    fontSize: 11,
    color: COLORS.slate[300],
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244, 63, 94, 0.3)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
  },
  errorBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.imposter.default,
    textAlign: 'center',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: 10,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.slate[500],
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.xl,
  },
  messageBubbleOther: {
    backgroundColor: COLORS.dark[800],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderBottomLeftRadius: 4,
  },
  messageBubbleImposter: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderBottomLeftRadius: 4,
  },
  messageBubbleCivilian: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    borderBottomLeftRadius: 4,
  },
  messageBubbleSelf: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderBottomRightRadius: 4,
  },
  selfHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: 2,
  },
  selfLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.accent.emerald,
    textTransform: 'uppercase',
  },
  messageTextSelf: {
    fontSize: 14,
    color: COLORS.white,
    lineHeight: 19,
  },
  messageTimeSelf: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  otherHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
  },
  senderNameOther: {
    color: COLORS.slate[300],
  },
  senderNameImposter: {
    color: COLORS.imposter.default,
  },
  anonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  anonLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.civilian.default,
  },
  messageText: {
    fontSize: 14,
    color: COLORS.slate[100],
    lineHeight: 19,
  },
  messageTime: {
    fontSize: 10,
    color: COLORS.slate[500],
    marginLeft: 'auto',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.dark[950],
    borderTopWidth: 1,
    borderTopColor: COLORS.slate[800],
    gap: SPACING.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.xl,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: COLORS.white,
    fontSize: 13,
  },
  textInputDisabled: {
    backgroundColor: COLORS.dark[950],
    borderColor: COLORS.slate[800],
    color: COLORS.slate[600],
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.civilian.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.slate[700],
    opacity: 0.4,
  },
});

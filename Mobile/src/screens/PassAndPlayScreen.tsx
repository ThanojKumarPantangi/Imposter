import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Smartphone,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { Card } from '../components/common/Card';
import { GradientButton } from '../components/common/GradientButton';
import { Badge } from '../components/common/Badge';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';

const DEFAULT_CATEGORIES = [
  {
    name: 'Fruits',
    words: [
      { word: 'Apple', hint: 'Crisp fruit, often red or green' },
      { word: 'Banana', hint: 'Yellow peel with curved fruit' },
      { word: 'Mango', hint: 'Sweet tropical fruit with a flat stone' },
    ],
  },
  {
    name: 'Vegetables',
    words: [
      { word: 'Carrot', hint: 'Orange root crunchy in salads' },
      { word: 'Potato', hint: 'Starchy tuber, great for fries' },
    ],
  },
  {
    name: 'Snacks',
    words: [
      { word: 'Pizza', hint: 'Baked crust topped with cheese and tomato sauce' },
      { word: 'Taco', hint: 'Folded tortilla packed with seasoned fillings' },
    ],
  },
];

interface PlayerLocal {
  id: number;
  name: string;
  role: 'IMPOSTER' | 'CIVILIAN';
  isAlive: boolean;
}

export const PassAndPlayScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [phase, setPhase] = useState<'SETUP' | 'PASS' | 'REVEAL' | 'PLAY'>('SETUP');
  const [playerNames, setPlayerNames] = useState<string[]>([
    'Alice',
    'Bob',
    'Charlie',
    'David',
  ]);
  const [newPlayerName, setNewPlayerName] = useState<string>('');
  const [impostersCount, setImpostersCount] = useState<number>(1);
  const [currentRevealIndex, setCurrentRevealIndex] = useState<number>(0);

  const [gameState, setGameState] = useState<{
    secretWord: string;
    hint: string;
    players: PlayerLocal[];
  }>({
    secretWord: '',
    hint: '',
    players: [],
  });

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    setPlayerNames([...playerNames, newPlayerName.trim()]);
    setNewPlayerName('');
  };

  const handleRemovePlayer = (idx: number) => {
    setPlayerNames(playerNames.filter((_, i) => i !== idx));
  };

  const startPassAndPlayGame = () => {
    if (playerNames.length < 3) return;
    sounds.playClick();

    const cat = DEFAULT_CATEGORIES[Math.floor(Math.random() * DEFAULT_CATEGORIES.length)];
    const wordItem = cat.words[Math.floor(Math.random() * cat.words.length)];

    const shuffled = [...playerNames].sort(() => Math.random() - 0.5);
    const imposterNames = new Set(shuffled.slice(0, impostersCount));

    const players: PlayerLocal[] = playerNames.map((name, i) => ({
      id: i,
      name,
      role: imposterNames.has(name) ? 'IMPOSTER' : 'CIVILIAN',
      isAlive: true,
    }));

    setGameState({
      secretWord: wordItem.word,
      hint: wordItem.hint,
      players,
    });

    setCurrentRevealIndex(0);
    setPhase('PASS');
  };

  const currentPlayer = gameState.players[currentRevealIndex];

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            sounds.playClick();
            navigation.navigate('Home');
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={16} color={COLORS.slate[300]} />
          <Text style={styles.backBtnText}>Home</Text>
        </TouchableOpacity>

        <Badge label="Local Party Mode" variant="purple" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* SETUP PHASE */}
        {phase === 'SETUP' && (
          <Card variant="purple" style={styles.cardSection}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBoxPurple}>
                <Smartphone size={24} color={COLORS.accent.purple} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Pass & Play</Text>
                <Text style={styles.cardSub}>Pass this single device between friends</Text>
              </View>
            </View>

            {/* Players List */}
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Players ({playerNames.length})</Text>
              <View style={styles.namesList}>
                {playerNames.map((name, idx) => (
                  <View key={idx} style={styles.nameRow}>
                    <Text style={styles.nameText}>{name}</Text>
                    {playerNames.length > 3 && (
                      <TouchableOpacity
                        onPress={() => handleRemovePlayer(idx)}
                        style={styles.trashBtn}
                      >
                        <Trash2 size={16} color={COLORS.slate[500]} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              <View style={styles.addPlayerRow}>
                <TextInput
                  value={newPlayerName}
                  onChangeText={setNewPlayerName}
                  placeholder="Add friend's name..."
                  placeholderTextColor={COLORS.slate[500]}
                  style={styles.addPlayerInput}
                />
                <TouchableOpacity onPress={handleAddPlayer} style={styles.addBtn}>
                  <Plus size={16} color={COLORS.white} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Imposter Count */}
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Number of Imposters</Text>
              <View style={styles.segmentedRow}>
                {[1, 2].map((n) => {
                  const isSelected = impostersCount === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setImpostersCount(n)}
                      style={[
                        styles.segmentBtn,
                        isSelected && styles.segmentBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          isSelected && styles.segmentBtnTextActive,
                        ]}
                      >
                        {n} Imposter{n > 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <GradientButton
              title="Start Pass & Play"
              onPress={startPassAndPlayGame}
              disabled={playerNames.length < 3}
              variant="purple"
              icon={<ArrowRight size={16} color={COLORS.white} />}
              style={styles.fullWidth}
            />
          </Card>
        )}

        {/* PASS PHASE */}
        {phase === 'PASS' && currentPlayer && (
          <Card style={styles.centerCard}>
            <View style={styles.iconBoxPurpleLg}>
              <Smartphone size={36} color={COLORS.accent.purple} />
            </View>

            <Text style={styles.passHeader}>Pass Device To:</Text>
            <Text style={styles.passPlayerName}>{currentPlayer.name}</Text>
            <Text style={styles.passWarning}>
              Ensure no other player can view the screen before tapping to reveal!
            </Text>

            <GradientButton
              title={`I Am ${currentPlayer.name} (Reveal Role)`}
              onPress={() => {
                sounds.playClick();
                setPhase('REVEAL');
              }}
              variant="purple"
              icon={<Eye size={16} color={COLORS.white} />}
              style={styles.fullWidth}
            />
          </Card>
        )}

        {/* REVEAL PHASE */}
        {phase === 'REVEAL' && currentPlayer && (
          <Card style={styles.centerCard}>
            <Text style={styles.secretRoleTag}>Secret Role for {currentPlayer.name}</Text>
            <Badge
              label={currentPlayer.role}
              variant={currentPlayer.role === 'IMPOSTER' ? 'imposter' : 'civilian'}
              style={styles.revealBadge}
            />

            <View style={styles.secretBox}>
              {currentPlayer.role === 'IMPOSTER' ? (
                <View>
                  <Text style={styles.secretPrefixRose}>Your Persistent Hint:</Text>
                  <Text style={styles.secretHint}>{gameState.hint}</Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.secretPrefixCyan}>Your Secret Word:</Text>
                  <Text style={styles.secretWord}>{gameState.secretWord}</Text>
                </View>
              )}
            </View>

            <GradientButton
              title={
                currentRevealIndex + 1 < gameState.players.length
                  ? 'Hide & Pass to Next Player'
                  : 'All Roles Revealed — Start Game!'
              }
              onPress={() => {
                sounds.playClick();
                if (currentRevealIndex + 1 < gameState.players.length) {
                  setCurrentRevealIndex(currentRevealIndex + 1);
                  setPhase('PASS');
                } else {
                  setPhase('PLAY');
                }
              }}
              variant="cyan"
              icon={<EyeOff size={16} color={COLORS.white} />}
              style={styles.fullWidth}
            />
          </Card>
        )}

        {/* PLAY PHASE */}
        {phase === 'PLAY' && (
          <Card style={styles.cardSection}>
            <Text style={styles.cardTitle}>Clue & Discussion Round</Text>
            <Text style={styles.cardSub}>
              Go around the circle! Each player enters or speaks aloud a word related to their secret.
            </Text>

            <View style={styles.playPlayerList}>
              {gameState.players.map((p, idx) => (
                <View key={idx} style={styles.playPlayerRow}>
                  <Text style={styles.playPlayerName}>
                    {idx + 1}. {p.name}
                  </Text>
                  <Text style={styles.playPlayerRoleStatus}>Participant</Text>
                </View>
              ))}
            </View>

            <View style={styles.playActionRow}>
              <GradientButton
                title="Restart Mode"
                onPress={() => setPhase('SETUP')}
                variant="secondary"
                style={styles.halfBtn}
              />

              <GradientButton
                title="Reveal & Finish"
                onPress={() => {
                  Alert.alert(
                    'Match Results',
                    `Secret Word was: ${gameState.secretWord}\nImposters were: ${gameState.players
                      .filter((p) => p.role === 'IMPOSTER')
                      .map((p) => p.name)
                      .join(', ')}`,
                    [{ text: 'OK', onPress: () => setPhase('SETUP') }]
                  );
                }}
                variant="primary"
                style={styles.halfBtn}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark[950],
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.7)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.dark[900],
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.slate[800],
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate[300],
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  cardSection: {
    width: '100%',
    gap: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconBoxPurple: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxPurpleLg: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.xxl,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  cardSub: {
    fontSize: 11,
    color: COLORS.slate[400],
    marginTop: 2,
  },
  block: {
    gap: SPACING.xs,
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
  },
  namesList: {
    gap: 6,
    marginBottom: SPACING.sm,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  nameText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  trashBtn: {
    padding: 4,
  },
  addPlayerRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  addPlayerInput: {
    flex: 1,
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    color: COLORS.white,
    fontSize: 13,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dark[800],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: COLORS.imposter.default,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  segmentBtnTextActive: {
    color: '#fb7185',
  },
  fullWidth: {
    width: '100%',
  },
  centerCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  passHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  passPlayerName: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.accent.purple,
    marginVertical: 4,
  },
  passWarning: {
    fontSize: 12,
    color: COLORS.slate[400],
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 18,
  },
  secretRoleTag: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slate[400],
    textTransform: 'uppercase',
  },
  revealBadge: {
    marginVertical: 4,
  },
  secretBox: {
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  secretPrefixRose: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fb7185',
    textAlign: 'center',
    marginBottom: 2,
  },
  secretHint: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fecdd3',
    textAlign: 'center',
  },
  secretPrefixCyan: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
    textAlign: 'center',
    marginBottom: 2,
  },
  secretWord: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.civilian.default,
    textAlign: 'center',
  },
  playPlayerList: {
    gap: 6,
    marginVertical: SPACING.md,
  },
  playPlayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.dark[950],
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.slate[800],
  },
  playPlayerName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  playPlayerRoleStatus: {
    fontSize: 11,
    color: COLORS.slate[500],
  },
  playActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  halfBtn: {
    flex: 1,
  },
});


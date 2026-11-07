import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { PlayerAvatar } from '../../../components/PlayerAvatar';
import { sounds } from '../../../utils/sound';
import { votingStyles } from '../styles/votingStyles';
import { VotePlayerCardProps } from '../types/gameComponentTypes';

export const VotePlayerCard: React.FC<VotePlayerCardProps> = ({
  player,
  isSelf,
  isSelected,
  hasVoted,
  isSpeaking,
  onSelect,
}) => {
  const handlePress = () => {
    sounds.playClick();
    onSelect(player.id);
  };

  return (
    <TouchableOpacity
      disabled={isSelf || hasVoted}
      onPress={handlePress}
      style={[
        votingStyles.voteTargetCard,
        isSelected && votingStyles.voteTargetSelected,
        isSelf && votingStyles.voteTargetSelf,
      ]}
    >
      <View style={votingStyles.targetRow}>
        <PlayerAvatar
          player={player}
          size="sm"
          showStatus={false}
          isSpeaking={isSpeaking}
        />
        <View>
          <Text style={votingStyles.targetName}>{player.username}</Text>
          <Text style={votingStyles.targetSub}>
            {isSelf ? '(Cannot vote self)' : 'Vote to Eliminate'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};


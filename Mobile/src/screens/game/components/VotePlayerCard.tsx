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
      activeOpacity={0.8}
      disabled={isSelf || hasVoted}
      onPress={handlePress}
      style={[
        votingStyles.voteTargetCard,
        isSelected && votingStyles.voteTargetSelected,
        isSelf && votingStyles.voteTargetSelf,
      ]}
    >
      <View style={votingStyles.targetAvatarWrapper}>
        <PlayerAvatar
          player={player}
          size="md"
          showStatus={false}
          isSpeaking={isSpeaking}
        />
      </View>

      <View style={votingStyles.targetInfoCol}>
        <Text
          style={[
            votingStyles.targetName,
            isSelected ? votingStyles.targetNameSelected : votingStyles.targetNameUnselected,
          ]}
          numberOfLines={1}
        >
          {player.username}
          {isSelf ? (
            <Text style={isSelected ? votingStyles.youTagSelected : votingStyles.youTagUnselected}>
              {' '}(You)
            </Text>
          ) : null}
        </Text>

        {isSelected && (
          <Text style={votingStyles.targetSubSelected} numberOfLines={1}>
            Selected
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};


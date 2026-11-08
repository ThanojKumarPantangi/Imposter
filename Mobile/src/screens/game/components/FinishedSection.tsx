import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, Image, Animated, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Skull, Trophy, RotateCcw, Home as HomeIcon } from 'lucide-react-native';
import { GradientButton } from '../../../components/common/GradientButton';
import { Badge } from '../../../components/common/Badge';
import { COLORS } from '../../../theme/colors';
import { resultsStyles } from '../styles/resultsStyles';
import { FinishedSectionProps } from '../types/gameComponentTypes';

const IMPOSTER_VIDEO = require('../../../../assets/Imposter-Win-Video.mp4');
const CIVILIAN_VIDEO = require('../../../../assets/Civilan-Win-Video.mp4');
const IMPOSTER_FALLBACK = require('../../../../assets/Imposter-win.png');
const CIVILIAN_FALLBACK = require('../../../../assets/Civilian-win.png');

export const FinishedSection: React.FC<FinishedSectionProps> = ({
  winnerResult,
  onLeaveGame,
  onReturnToLobby,
}) => {
  const insets = useSafeAreaInsets();
  const isImposterWin = winnerResult.winnerRole === 'IMPOSTER';

  // Video assets mapping
  const videoSource = isImposterWin ? IMPOSTER_VIDEO : CIVILIAN_VIDEO;
  const fallbackImage = isImposterWin ? IMPOSTER_FALLBACK : CIVILIAN_FALLBACK;

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);

  // Entrance animation for victory screen
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Video player configuration using expo-video
  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    if (!player) return;

    try {
      player.loop = true;
      player.muted = true;
      player.play();
    } catch (err) {
      console.warn('Video play error:', err);
    }

    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        setIsVideoReady(true);
        setHasVideoError(false);
      } else if (status === 'error') {
        setHasVideoError(true);
        setIsVideoReady(false);
      }
    });

    return () => {
      subscription.remove();
      try {
        player.pause();
      } catch {
        // Safe cleanup on unmount
      }
    };
  }, [player]);

  // Win condition copy preserving all game rules
  const winConditionSubtitle = useMemo(() => {
    switch (winnerResult.winCondition) {
      case 'IMPOSTER_GUESSED_WORD':
        return 'An imposter guessed the word!';
      case 'ALL_IMPOSTERS_ELIMINATED':
        return 'All imposters eliminated!';
      case 'IMPOSTERS_PARITY':
        return 'Imposters took over!';
      default:
        return isImposterWin ? 'Imposters win!' : 'Civilians win!';
    }
  }, [winnerResult.winCondition, isImposterWin]);

  const imposters = winnerResult.imposters || [];

  return (
    <Animated.View
      style={[
        resultsStyles.finishedContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Subtle Ambient Glow Behind Centerpiece */}
      <View
        pointerEvents="none"
        style={[
          resultsStyles.ambientGlow,
          isImposterWin
            ? resultsStyles.ambientGlowImposter
            : resultsStyles.ambientGlowCivilian,
        ]}
      />

      {/* Victory Header */}
      <View style={resultsStyles.winHeader}>
        <View
          style={[
            resultsStyles.iconBadge,
            isImposterWin
              ? resultsStyles.iconBadgeImposter
              : resultsStyles.iconBadgeCivilian,
          ]}
        >
          {isImposterWin ? (
            <Skull size={28} color="#f43f5e" />
          ) : (
            <Trophy size={28} color="#38bdf8" />
          )}
        </View>

        <Text
          style={[
            resultsStyles.winHeadline,
            isImposterWin ? resultsStyles.textImposter : resultsStyles.textCivilian,
          ]}
        >
          {isImposterWin ? 'Imposters Win!' : 'Civilians Win!'}
        </Text>

        <Text style={resultsStyles.winSubtitle}>{winConditionSubtitle}</Text>
      </View>

      {/* Victory Video Centerpiece */}
      <View
        style={[
          resultsStyles.videoContainer,
          isImposterWin
            ? resultsStyles.videoContainerImposter
            : resultsStyles.videoContainerCivilian,
        ]}
      >
        {!hasVideoError && (
          <VideoView
            player={player}
            style={resultsStyles.videoPlayer}
            contentFit="contain"
            nativeControls={false}
          />
        )}

        {/* Fallback & Loading Overlay */}
        {(!isVideoReady || hasVideoError) && (
          <View style={resultsStyles.fallbackOverlay}>
            <Image
              source={fallbackImage}
              style={resultsStyles.fallbackImage}
              resizeMode="contain"
            />
            {!hasVideoError && (
              <View style={resultsStyles.loadingSpinnerBox}>
                <ActivityIndicator
                  size="small"
                  color={isImposterWin ? '#f43f5e' : '#06b6d4'}
                />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Results Information Card */}
      <LinearGradient
        colors={
          isImposterWin
            ? ['rgba(244, 63, 94, 0.08)', 'rgba(18, 22, 31, 0.95)']
            : ['rgba(6, 182, 212, 0.08)', 'rgba(18, 22, 31, 0.95)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          resultsStyles.resultsCard,
          isImposterWin
            ? resultsStyles.resultsCardImposter
            : resultsStyles.resultsCardCivilian,
        ]}
      >
        <View style={resultsStyles.secretWordHeader}>
          <Text style={resultsStyles.secretWordLabel}>SECRET WORD</Text>
          <Text style={resultsStyles.secretWordValue}>{winnerResult.secretWord}</Text>
        </View>

        <View style={resultsStyles.cardDivider} />

        <View style={resultsStyles.impostersSection}>
          <View style={resultsStyles.impostersHeaderRow}>
            <Skull size={13} color="#f43f5e" />
            <Text style={resultsStyles.impostersLabel}>
              {imposters.length === 1 ? 'THE IMPOSTER' : 'THE IMPOSTERS'}
            </Text>
          </View>

          <View style={resultsStyles.imposterChipsRow}>
            {imposters.length > 0 ? (
              imposters.map((imp) => (
                <Badge
                  key={imp.id}
                  label={imp.username}
                  variant="imposter"
                  icon={<Skull size={11} color="#f43f5e" />}
                />
              ))
            ) : (
              <Text style={resultsStyles.noImpostersText}>No imposters recorded</Text>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Bottom Action Buttons */}
      <View
        style={[
          resultsStyles.winnerActionsRow,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <GradientButton
          title="Home"
          onPress={onLeaveGame}
          variant="secondary"
          icon={<HomeIcon size={18} color={COLORS.slate[300]} />}
          iconPosition="left"
          style={resultsStyles.halfBtn}
        />

        <GradientButton
          title="Play Again"
          onPress={onReturnToLobby}
          variant={isImposterWin ? 'primary' : 'cyan'}
          icon={<RotateCcw size={18} color={COLORS.white} />}
          iconPosition="left"
          style={resultsStyles.halfBtn}
        />
      </View>
    </Animated.View>
  );
};

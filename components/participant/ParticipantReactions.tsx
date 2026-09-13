import { useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

import { QUICK_REACTIONS } from "../room/reactions/reactions"
import {
  useReactions,
  type EphemeralReaction,
} from "../room/reactions/ReactionsProvider"

interface ParticipantReactionsProps {
  // LiveKit identity whose reaction state is rendered.
  identity: string
  // Participant name used by the provider's announcement contract.
  displayName: string
}

interface AnimatedReactionProps {
  // Live quick reaction to animate.
  reaction: EphemeralReaction
}

const AnimatedReaction = ({ reaction }: AnimatedReactionProps) => {
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0.5)).current
  const scale = useRef(new Animated.Value(0.5)).current
  const horizontalOffset = useRef(16 + Math.floor(Math.random() * 65)).current

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 2_000,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1_600,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 1_000,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1_000,
          useNativeDriver: true,
        }),
      ]),
    ])
    animation.start()
    return () => animation.stop()
  }, [opacity, scale, translateY])

  return (
    <Animated.Text
      testID="quick-reaction-glyph"
      accessible={false}
      style={[
        styles.quickReaction,
        {
          left: horizontalOffset,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {QUICK_REACTIONS[reaction.type].glyph}
    </Animated.Text>
  )
}

export const ParticipantReactions = ({
  identity,
}: ParticipantReactionsProps) => {
  const { participants } = useReactions()
  const state = participants[identity]
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState<
    boolean | null
  >(null)

  useEffect(() => {
    let isMounted = true
    const readPreference = async (): Promise<void> => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled()
        if (isMounted) setIsReduceMotionEnabled(enabled)
      } catch {
        if (isMounted) setIsReduceMotionEnabled(false)
      }
    }
    readPreference()
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setIsReduceMotionEnabled,
    )

    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [])

  if (!state) return null

  return (
    <View
      testID="participant-reactions"
      pointerEvents="none"
      style={styles.overlay}
    >
      {state.isHandRaised ? (
        <Text testID="raised-hand" style={styles.raisedHand} accessible={false}>
          🖐️
        </Text>
      ) : null}

      {isReduceMotionEnabled === null
        ? null
        : state.ephemeralReactions.map(reaction =>
            isReduceMotionEnabled ? (
              <Text
                key={reaction.id}
                testID="quick-reaction-static"
                style={styles.quickReaction}
                accessible={false}
              >
                {QUICK_REACTIONS[reaction.type].glyph}
              </Text>
            ) : (
              <AnimatedReaction key={reaction.id} reaction={reaction} />
            ),
          )}
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  raisedHand: {
    position: "absolute",
    top: 8,
    left: 8,
    padding: 6,
    borderRadius: 18,
    backgroundColor: BACKGROUND_COLORS.participantBadge,
    color: TEXT_COLORS.light,
    fontSize: 24,
  },
  quickReaction: {
    position: "absolute",
    bottom: 12,
    color: TEXT_COLORS.light,
    fontSize: 32,
  },
})

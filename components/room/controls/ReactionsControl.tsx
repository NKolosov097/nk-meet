import { useCallback, useState } from "react"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"

import { useLocalParticipant } from "@livekit/react-native"

import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import {
  BACKGROUND_COLORS,
  BORDER_COLORS,
  TEXT_COLORS,
} from "@/constants/colors"

import { QUICK_REACTIONS, type QuickReactionType } from "../reactions/reactions"
import { useReactions } from "../reactions/ReactionsProvider"

const QUICK_REACTION_ENTRIES = Object.entries(QUICK_REACTIONS) as [
  QuickReactionType,
  (typeof QUICK_REACTIONS)[QuickReactionType],
][]

export const ReactionsControl = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { localParticipant } = useLocalParticipant()
  const {
    participants,
    canSendQuickReactions,
    canUpdateHand,
    isHandUpdatePending,
    sendQuickReaction,
    toggleHand,
  } = useReactions()
  const isHandRaised =
    participants[localParticipant.identity]?.isHandRaised === true
  const handLabel = isHandRaised ? "Lower hand" : "Raise hand"
  // Blocks hand changes without metadata permission or during an in-flight update.
  const isHandDisabled = !canUpdateHand || isHandUpdatePending
  const triggerAccessibilityState = {
    disabled: !canSendQuickReactions,
    expanded: isOpen,
  }
  const handAccessibilityState = {
    selected: isHandRaised,
    disabled: isHandDisabled,
  }
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={open}
        disabled={!canSendQuickReactions}
        accessibilityLabel="Open reactions"
        accessibilityRole="button"
        accessibilityState={triggerAccessibilityState}
      >
        <Text style={styles.triggerGlyph} accessible={false}>
          😊
        </Text>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.root}>
          <Pressable
            style={styles.backdrop}
            onPress={close}
            accessibilityLabel="Dismiss reactions"
            accessibilityRole="button"
          />

          <View
            testID="reactions-card"
            style={styles.card}
            accessibilityViewIsModal
          >
            <Text style={styles.title} accessibilityRole="header">
              Reactions
            </Text>

            <View style={styles.quickActions}>
              {QUICK_REACTION_ENTRIES.map(([type, reaction]) => (
                <Pressable
                  key={type}
                  style={styles.action}
                  onPress={() => sendQuickReaction(type)}
                  accessibilityLabel={reaction.label}
                  accessibilityRole="button"
                >
                  <Text style={styles.glyph} accessible={false}>
                    {reaction.glyph}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[
                styles.action,
                styles.wideAction,
                isHandRaised ? styles.selected : undefined,
              ]}
              onPress={toggleHand}
              disabled={isHandDisabled}
              accessibilityLabel={handLabel}
              accessibilityRole="button"
              accessibilityState={handAccessibilityState}
            >
              <Text style={styles.actionText}>{handLabel}</Text>
            </Pressable>

            <Pressable
              style={[styles.action, styles.wideAction]}
              onPress={close}
              accessibilityLabel="Close reactions"
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUSES.medium,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BACKGROUND_COLORS.secondary,
  },
  triggerGlyph: {
    color: TEXT_COLORS.light,
    fontSize: 24,
  },
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: BACKGROUND_COLORS.overlay,
  },
  card: {
    width: 280,
    padding: 20,
    borderRadius: BORDER_RADIUSES.large,
    backgroundColor: BACKGROUND_COLORS.secondary,
  },
  title: {
    marginBottom: 16,
    color: TEXT_COLORS.light,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  action: {
    minWidth: 44,
    minHeight: 44,
    margin: 4,
    borderWidth: 1,
    borderColor: BORDER_COLORS.selectionIndicator,
    borderRadius: BORDER_RADIUSES.medium,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BACKGROUND_COLORS.elevated,
  },
  wideAction: {
    marginHorizontal: 4,
    marginTop: 8,
  },
  selected: {
    backgroundColor: BACKGROUND_COLORS.primary,
  },
  glyph: {
    color: TEXT_COLORS.light,
    fontSize: 24,
  },
  actionText: {
    color: TEXT_COLORS.light,
    fontWeight: "600",
  },
})

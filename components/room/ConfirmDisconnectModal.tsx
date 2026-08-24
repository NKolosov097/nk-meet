import { Modal, Pressable, StyleSheet, Text, View } from "react-native"

import { BORDER_RADIUSES } from "@/constants/borderRadiuses"
import { BACKGROUND_COLORS, TEXT_COLORS } from "@/constants/colors"

interface ConfirmDisconnectModalProps {
  // Whether the confirmation modal is currently shown
  visible: boolean
  // Called when the user confirms they want to disconnect
  onConfirm: VoidFunction
  // Called when the user cancels, via the Cancel button or by tapping outside the card
  onCancel: VoidFunction
}

export const ConfirmDisconnectModal = ({
  visible,
  onConfirm,
  onCancel,
}: ConfirmDisconnectModalProps) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onCancel}
          accessibilityLabel="Close disconnect confirmation"
          accessibilityRole="button"
        />

        <View style={styles.card}>
          <Text style={styles.title}>Disconnect?</Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.disconnectButton]}
              onPress={onConfirm}
              accessibilityLabel="Confirm disconnect"
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, styles.disconnectButtonText]}>
                Disconnect
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BACKGROUND_COLORS.overlay,
    zIndex: 0,
  },
  card: {
    backgroundColor: BACKGROUND_COLORS.secondary,
    borderRadius: BORDER_RADIUSES.large,
    paddingHorizontal: 24,
    paddingVertical: 20,
    minWidth: 260,
    zIndex: 1,
  },
  title: {
    color: TEXT_COLORS.light,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUSES.medium,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: BACKGROUND_COLORS.elevated,
    marginRight: 8,
  },
  disconnectButton: {
    backgroundColor: BACKGROUND_COLORS.dangerAction,
    marginLeft: 8,
  },
  buttonText: {
    color: TEXT_COLORS.light,
    fontWeight: "600",
  },
  disconnectButtonText: {
    color: TEXT_COLORS.onDanger,
  },
})

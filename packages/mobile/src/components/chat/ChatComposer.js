import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActionSheetIOS,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

export default function ChatComposer({
  inputText,
  onChangeText,
  onSend,
  onShareLocation,
  onSendMedia,
  sharingLocation = false,
  sendingMedia = false,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef(null);
  const durationTimer = useRef(null);

  const pickImage = async (useCamera) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to share photos in chat.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
          allowsEditing: true,
        });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onSendMedia?.({
        uri: asset.uri,
        name: `photo_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        width: asset.width,
        height: asset.height,
      });
    }
  };

  const showAttachMenu = () => {
    const options = ['Photo library', 'Take photo', 'Cancel'];
    const cancelIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        (index) => {
          if (index === 0) pickImage(false);
          if (index === 1) pickImage(true);
        }
      );
    } else {
      Alert.alert('Share photo', 'Choose a source', [
        { text: 'Gallery', onPress: () => pickImage(false) },
        { text: 'Camera', onPress: () => pickImage(true) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access to send voice notes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      durationTimer.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      Alert.alert('Recording failed', error.message);
    }
  };

  const stopRecording = async (shouldSend) => {
    clearInterval(durationTimer.current);
    setIsRecording(false);

    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (shouldSend && uri && recordingDuration >= 1) {
        onSendMedia?.({
          uri,
          name: `voice_${Date.now()}.m4a`,
          mimeType: 'audio/m4a',
          duration: status.durationMillis ? status.durationMillis / 1000 : recordingDuration,
        });
      }
    } catch {
      // ignore unload errors
    } finally {
      setRecordingDuration(0);
    }
  };

  return (
    <View style={styles.container}>
      {isRecording && (
        <View style={styles.recordingBanner}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording {recordingDuration}s</Text>
          <TouchableOpacity
            onPress={() => stopRecording(false)}
            style={styles.recordingCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.recordingCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => stopRecording(true)}
            style={styles.recordingSend}
            activeOpacity={0.8}
          >
            <Text style={styles.recordingSendText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.row}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={showAttachMenu}
          disabled={sendingMedia || isRecording}
          activeOpacity={0.8}
        >
          {sendingMedia ? (
            <ActivityIndicator size="small" color="#0284C7" />
          ) : (
            <Text style={styles.iconEmoji}>📎</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, sharingLocation ? styles.locationActive : styles.locationIdle]}
          onPress={onShareLocation}
          disabled={isRecording}
          activeOpacity={0.8}
        >
          <Text style={styles.iconEmoji}>{sharingLocation ? '⏹' : '📍'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, isRecording ? styles.micRecording : styles.micIdle]}
          onPressIn={startRecording}
          onPressOut={() => {
            if (isRecording && recordingDuration >= 1) {
              stopRecording(true);
            } else if (isRecording) {
              stopRecording(false);
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.iconEmoji}>{isRecording ? '🔴' : '🎤'}</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor="#94A3B8"
          multiline
          value={inputText}
          onChangeText={onChangeText}
          editable={!isRecording}
        />

        <TouchableOpacity
          style={[styles.sendButton, inputText.trim() ? styles.sendActive : styles.sendDisabled]}
          onPress={onSend}
          disabled={!inputText.trim() || isRecording}
          activeOpacity={0.85}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#EF4444',
    fontWeight: '500',
    marginRight: 8,
  },
  recordingCancel: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    marginRight: 8,
  },
  recordingCancelText: {
    color: '#334155',
    fontSize: 12,
  },
  recordingSend: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#0284C7',
  },
  recordingSendText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  iconEmoji: {
    fontSize: 18,
  },
  locationIdle: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  locationActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  micIdle: {
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
  },
  micRecording: {
    backgroundColor: '#EF4444',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 96,
    backgroundColor: '#F8FAFC',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendActive: {
    backgroundColor: '#0284C7',
  },
  sendDisabled: {
    backgroundColor: '#E2E8F0',
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

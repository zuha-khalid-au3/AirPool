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
    <View className="px-4 py-3 border-t border-secondary-100 bg-white">
      {isRecording && (
        <View className="flex-row items-center justify-center mb-3 bg-danger/10 rounded-xl py-2 px-4">
          <View className="w-2 h-2 rounded-full bg-danger mr-2" />
          <Text className="text-danger font-medium mr-2">Recording {recordingDuration}s</Text>
          <TouchableOpacity
            onPress={() => stopRecording(false)}
            className="px-3 py-1 rounded-lg bg-secondary-200 mr-2"
          >
            <Text className="text-secondary-700 text-xs">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => stopRecording(true)}
            className="px-3 py-1 rounded-lg bg-primary"
          >
            <Text className="text-white text-xs font-medium">Send</Text>
          </TouchableOpacity>
        </View>
      )}

      <View className="flex-row items-end">
        <TouchableOpacity
          className="w-10 h-10 rounded-full items-center justify-center bg-secondary-100 mr-1.5"
          onPress={showAttachMenu}
          disabled={sendingMedia || isRecording}
          activeOpacity={0.8}
        >
          {sendingMedia ? (
            <ActivityIndicator size="small" color="#0284C7" />
          ) : (
            <Text className="text-lg">📎</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className={`w-10 h-10 rounded-full items-center justify-center mr-1.5 ${
            sharingLocation ? 'bg-danger/15' : 'bg-success/10'
          }`}
          onPress={onShareLocation}
          disabled={isRecording}
          activeOpacity={0.8}
        >
          <Text className="text-base">{sharingLocation ? '⏹' : '📍'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`w-10 h-10 rounded-full items-center justify-center mr-2 ${
            isRecording ? 'bg-danger' : 'bg-primary/10'
          }`}
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
          <Text className="text-base">{isRecording ? '🔴' : '🎤'}</Text>
        </TouchableOpacity>

        <TextInput
          className="flex-1 border border-secondary-200 rounded-2xl px-4 py-3 text-base max-h-24 bg-secondary-50"
          placeholder="Message..."
          placeholderTextColor="#94A3B8"
          multiline
          value={inputText}
          onChangeText={onChangeText}
          editable={!isRecording}
        />

        <TouchableOpacity
          className={`w-11 h-11 rounded-full items-center justify-center ml-2 ${
            inputText.trim() ? 'bg-primary shadow-md' : 'bg-secondary-200'
          }`}
          onPress={onSend}
          disabled={!inputText.trim() || isRecording}
          activeOpacity={0.85}
        >
          <Text className="text-white text-lg font-bold">↑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import Avatar from '../../components/ui/Avatar';
import { socketService } from '../../services/socket.service';
import { useCallStore } from '../../store/callStore';

function formatCallDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function CallScreen({ navigation, route }) {
  const {
    callId,
    chatRoomId,
    peerName,
    peerPhone,
    isOutgoing = false,
    status: initialStatus = 'connected',
  } = route.params || {};

  const { clearCall } = useCallStore();
  const [status, setStatus] = useState(initialStatus);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let timer;
    if (status === 'connected') {
      timer = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    const handleAccepted = (data) => {
      if (data.callId === callId) setStatus('connected');
    };
    const handleRejected = (data) => {
      if (data.callId === callId) {
        Alert.alert('Call declined', 'The other person declined your call.');
        endCall(false);
      }
    };
    const handleEnded = (data) => {
      if (data.callId === callId) endCall(false);
    };

    socketService.on('call_accepted', handleAccepted);
    socketService.on('call_connected', handleAccepted);
    socketService.on('call_rejected', handleRejected);
    socketService.on('call_ended', handleEnded);

    if (isOutgoing) {
      setStatus('ringing');
    }

    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    }).catch(() => {});

    return () => {
      socketService.off('call_accepted', handleAccepted);
      socketService.off('call_connected', handleAccepted);
      socketService.off('call_rejected', handleRejected);
      socketService.off('call_ended', handleEnded);
    };
  }, [callId, isOutgoing]);

  const endCall = (notify = true) => {
    if (notify && callId) {
      socketService.endCall(callId);
    }
    clearCall();
    navigation.goBack();
  };

  const dialPhone = () => {
    if (!peerPhone) {
      Alert.alert('Phone unavailable', 'This member has not shared a phone number.');
      return;
    }
    const phone = peerPhone.startsWith('+') ? peerPhone : `+91${peerPhone}`;
    Linking.openURL(`tel:${phone}`);
  };

  const statusLabel =
    status === 'ringing'
      ? isOutgoing
        ? 'Calling…'
        : 'Connecting…'
      : status === 'connected'
        ? formatCallDuration(duration)
        : 'Call ended';

  return (
    <SafeAreaView className="flex-1 bg-secondary-900">
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-28 h-28 rounded-full bg-primary/20 items-center justify-center mb-6">
          <Avatar name={peerName} size={96} className="border-4 border-primary/30" />
        </View>
        <Text className="text-white text-2xl font-bold text-center">{peerName || 'Pool member'}</Text>
        <Text className="text-primary-300 text-base mt-2">{statusLabel}</Text>
        {status === 'connected' && (
          <Text className="text-secondary-400 text-sm mt-6 text-center leading-5">
            Connected in AirPool. Use speakerphone or tap below to dial their number.
          </Text>
        )}
      </View>

      <View className="px-8 pb-10">
        {status === 'connected' && peerPhone && (
          <TouchableOpacity
            className="bg-primary/20 border border-primary py-4 rounded-2xl items-center mb-4"
            onPress={dialPhone}
            activeOpacity={0.85}
          >
            <Text className="text-primary-300 text-lg font-semibold">📞 Dial phone number</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          className="bg-danger w-20 h-20 rounded-full items-center justify-center self-center shadow-lg"
          onPress={() => endCall(true)}
          activeOpacity={0.85}
        >
          <Text className="text-white text-2xl">📵</Text>
        </TouchableOpacity>
        <Text className="text-secondary-400 text-center text-sm mt-4">End call</Text>
      </View>
    </SafeAreaView>
  );
}

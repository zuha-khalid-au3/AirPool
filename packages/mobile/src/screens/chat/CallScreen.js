import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../../components/ui/Avatar';
import { socketService } from '../../services/socket.service';
import { webrtcCallService, isWebRTCAvailable } from '../../services/webrtcCall.service';
import { useCallStore } from '../../store/callStore';

function formatCallDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function CallScreen({ navigation, route }) {
  const {
    callId: initialCallId,
    chatRoomId,
    peerName,
    peerPhone,
    isOutgoing = false,
    status: initialStatus = 'connected',
  } = route.params || {};

  const { clearCall, outgoingCall, setActiveCall } = useCallStore();
  const [activeCallId, setActiveCallId] = useState(initialCallId || outgoingCall?.callId || null);
  const [status, setStatus] = useState(isOutgoing ? 'ringing' : initialStatus);
  const [duration, setDuration] = useState(0);
  const [mediaStatus, setMediaStatus] = useState('idle');
  const [mediaError, setMediaError] = useState(null);
  const hasStartedMedia = useRef(false);

  useEffect(() => {
    if (initialCallId) {
      setActiveCallId(initialCallId);
    }
  }, [initialCallId]);

  useEffect(() => {
    if (outgoingCall?.callId) {
      setActiveCallId(outgoingCall.callId);
    }
  }, [outgoingCall?.callId]);

  useEffect(() => {
    if (!activeCallId) return undefined;
    webrtcCallService.onIceCandidate = (candidate) => {
      socketService.sendCallIceCandidate(activeCallId, candidate);
    };
    return undefined;
  }, [activeCallId]);

  useEffect(() => {
    let timer;
    if (status === 'connected') {
      timer = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  const endCall = useCallback(
    (notify = true) => {
      if (notify && activeCallId) {
        socketService.endCall(activeCallId);
      }
      webrtcCallService.hangup();
      hasStartedMedia.current = false;
      clearCall();
      navigation.goBack();
    },
    [activeCallId, clearCall, navigation]
  );

  const beginWebRtc = useCallback(
    async (asCaller) => {
      if (hasStartedMedia.current || !activeCallId) return;
      hasStartedMedia.current = true;
      setMediaStatus('connecting');
      setMediaError(null);

      webrtcCallService.onIceCandidate = (candidate) => {
        socketService.sendCallIceCandidate(activeCallId, candidate);
      };
      webrtcCallService.onRemoteStream = () => {
        setMediaStatus('connected');
      };

      try {
        if (!isWebRTCAvailable()) {
          throw new Error(
            'In-app voice requires a development build. Expo Go cannot run WebRTC. Use npx expo run:ios, or tap below to dial their phone number.'
          );
        }

        if (asCaller) {
          const offer = await webrtcCallService.startAsCaller();
          socketService.sendCallOffer(activeCallId, offer);
        } else {
          setMediaStatus('waiting');
        }
      } catch (error) {
        hasStartedMedia.current = false;
        setMediaStatus('error');
        setMediaError(error.message || 'Could not start voice connection.');
      }
    },
    [activeCallId]
  );

  useEffect(() => {
    const matchesCall = (data) => !activeCallId || data.callId === activeCallId;

    const handleRinging = (data) => {
      if (isOutgoing && data.chatRoomId === chatRoomId) {
        setActiveCallId(data.callId);
      }
    };

    const handleAccepted = (data) => {
      if (!matchesCall(data)) return;
      setActiveCallId(data.callId);
      setStatus('connected');
      setActiveCall(data);
      beginWebRtc(true);
    };

    const handleConnected = (data) => {
      if (!matchesCall(data)) return;
      setActiveCallId(data.callId);
      setStatus('connected');
      setActiveCall(data);
      beginWebRtc(false);
    };

    const handleRejected = (data) => {
      if (!matchesCall(data)) return;
      Alert.alert('Call declined', 'The other person declined your call.');
      endCall(false);
    };

    const handleEnded = (data) => {
      if (!matchesCall(data)) return;
      endCall(false);
    };

    const handleOffer = async (data) => {
      if (!matchesCall(data)) return;
      if (data.callId) setActiveCallId(data.callId);
      try {
        setMediaStatus('connecting');
        const answer = await webrtcCallService.handleRemoteOffer(data.offer);
        socketService.sendCallAnswer(data.callId, answer);
        setMediaStatus('connected');
      } catch (error) {
        setMediaStatus('error');
        setMediaError(error.message || 'Could not connect voice.');
      }
    };

    const handleAnswer = async (data) => {
      if (!matchesCall(data)) return;
      try {
        await webrtcCallService.handleRemoteAnswer(data.answer);
        setMediaStatus('connected');
      } catch (error) {
        setMediaStatus('error');
        setMediaError(error.message || 'Could not connect voice.');
      }
    };

    const handleIce = async (data) => {
      if (!matchesCall(data)) return;
      await webrtcCallService.handleRemoteIceCandidate(data.candidate);
    };

    socketService.on('call_ringing', handleRinging);
    socketService.on('call_accepted', handleAccepted);
    socketService.on('call_connected', handleConnected);
    socketService.on('call_rejected', handleRejected);
    socketService.on('call_ended', handleEnded);
    socketService.on('call_webrtc_offer', handleOffer);
    socketService.on('call_webrtc_answer', handleAnswer);
    socketService.on('call_webrtc_ice', handleIce);

    return () => {
      socketService.off('call_ringing', handleRinging);
      socketService.off('call_accepted', handleAccepted);
      socketService.off('call_connected', handleConnected);
      socketService.off('call_rejected', handleRejected);
      socketService.off('call_ended', handleEnded);
      socketService.off('call_webrtc_offer', handleOffer);
      socketService.off('call_webrtc_answer', handleAnswer);
      socketService.off('call_webrtc_ice', handleIce);
    };
  }, [activeCallId, beginWebRtc, chatRoomId, endCall, isOutgoing, setActiveCall]);

  useEffect(() => {
    if (status === 'connected' && !isOutgoing && !hasStartedMedia.current) {
      beginWebRtc(false);
    }
  }, [status, isOutgoing, beginWebRtc]);

  useEffect(() => {
    if (!isOutgoing && initialStatus === 'connecting' && activeCallId) {
      setStatus('connected');
    }
  }, [isOutgoing, initialStatus, activeCallId]);

  useEffect(
    () => () => {
      webrtcCallService.hangup();
    },
    []
  );

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

  const mediaLabel =
    mediaStatus === 'connected'
      ? 'Voice connected'
      : mediaStatus === 'connecting' || mediaStatus === 'waiting'
        ? 'Connecting voice…'
        : mediaStatus === 'error'
          ? mediaError || 'Voice unavailable'
          : status === 'connected'
            ? 'Starting voice…'
            : '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <View style={styles.avatarRing}>
          <Avatar name={peerName} size={96} />
        </View>
        <Text style={styles.peerName}>{peerName || 'Pool member'}</Text>
        <Text style={styles.statusLabel}>{statusLabel}</Text>
        {!!mediaLabel && (
          <Text style={[styles.mediaLabel, mediaStatus === 'error' && styles.mediaError]}>
            {mediaLabel}
          </Text>
        )}
        {status === 'connected' && (
          <Text style={styles.hint}>
            Speak normally — audio routes through your phone speaker.
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        {status === 'connected' && peerPhone && (
          <TouchableOpacity style={styles.dialFallback} onPress={dialPhone} activeOpacity={0.85}>
            <Text style={styles.dialFallbackText}>📞 Dial phone number instead</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.endButton}
          onPress={() => endCall(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.endIcon}>📵</Text>
        </TouchableOpacity>
        <Text style={styles.endLabel}>End call</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  avatarRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(2,132,199,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  peerName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusLabel: {
    color: '#7DD3FC',
    fontSize: 16,
    marginTop: 8,
  },
  mediaLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  mediaError: {
    color: '#FCA5A5',
  },
  hint: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 8 : 24,
  },
  dialFallback: {
    backgroundColor: 'rgba(2,132,199,0.15)',
    borderWidth: 1,
    borderColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  dialFallbackText: {
    color: '#7DD3FC',
    fontSize: 16,
    fontWeight: '600',
  },
  endButton: {
    backgroundColor: '#EF4444',
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  endIcon: {
    fontSize: 28,
  },
  endLabel: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 13,
    marginTop: 12,
  },
});

import { Audio } from 'expo-av';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const WEBRTC_UNAVAILABLE_MESSAGE =
  'In-app voice needs a development build (Expo Go does not support WebRTC). Run: npx expo run:ios';

let webrtcLibCache = undefined;

function loadWebRTCLib() {
  if (webrtcLibCache !== undefined) {
    if (!webrtcLibCache) {
      throw new Error(WEBRTC_UNAVAILABLE_MESSAGE);
    }
    return webrtcLibCache;
  }

  try {
    // Lazy require so Expo Go can load the app without crashing at startup.
    webrtcLibCache = require('react-native-webrtc');
    return webrtcLibCache;
  } catch {
    webrtcLibCache = null;
    throw new Error(WEBRTC_UNAVAILABLE_MESSAGE);
  }
}

export function isWebRTCAvailable() {
  if (webrtcLibCache !== undefined) {
    return !!webrtcLibCache;
  }

  try {
    loadWebRTCLib();
    return true;
  } catch {
    return false;
  }
}

class WebRTCCallService {
  constructor() {
    this.pc = null;
    this.localStream = null;
    this.onIceCandidate = null;
    this.onRemoteStream = null;
  }

  assertAvailable() {
    loadWebRTCLib();
  }

  async ensureMicPermission() {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Microphone permission is required for voice calls.');
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }

  async createPeerConnection() {
    this.assertAvailable();
    const { RTCPeerConnection } = loadWebRTCLib();

    if (this.pc) {
      return this.pc;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams || [];
      if (stream && this.onRemoteStream) {
        this.onRemoteStream(stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        pc.restartIce?.();
      }
    };

    this.pc = pc;
    return pc;
  }

  async attachLocalAudio() {
    this.assertAvailable();
    const { mediaDevices } = loadWebRTCLib();

    if (this.localStream) {
      return this.localStream;
    }

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    this.localStream = stream;
    const pc = await this.createPeerConnection();
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    return stream;
  }

  async startAsCaller() {
    await this.ensureMicPermission();
    await this.attachLocalAudio();
    const pc = await this.createPeerConnection();

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await pc.setLocalDescription(offer);

    return {
      type: offer.type,
      sdp: offer.sdp,
    };
  }

  async handleRemoteOffer(offer) {
    this.assertAvailable();
    const { RTCSessionDescription } = loadWebRTCLib();

    await this.ensureMicPermission();
    await this.attachLocalAudio();
    const pc = await this.createPeerConnection();

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    return {
      type: answer.type,
      sdp: answer.sdp,
    };
  }

  async handleRemoteAnswer(answer) {
    if (!this.pc) return;
    this.assertAvailable();
    const { RTCSessionDescription } = loadWebRTCLib();
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleRemoteIceCandidate(candidate) {
    if (!this.pc || !candidate) return;
    this.assertAvailable();
    const { RTCIceCandidate } = loadWebRTCLib();
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Ignore duplicate or late ICE candidates
    }
  }

  hangup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.onIceCandidate = null;
    this.onRemoteStream = null;

    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    }).catch(() => {});
  }
}

export const webrtcCallService = new WebRTCCallService();

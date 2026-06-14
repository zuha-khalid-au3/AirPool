import { create } from 'zustand';

export const useCallStore = create((set, get) => ({
  incomingCall: null,
  outgoingCall: null,
  activeCall: null,

  setIncomingCall: (call) => set({ incomingCall: call }),

  setOutgoingCall: (call) => set({ outgoingCall: call }),

  setActiveCall: (call) =>
    set({
      activeCall: call,
      incomingCall: null,
      outgoingCall: null,
    }),

  clearCall: () =>
    set({
      incomingCall: null,
      outgoingCall: null,
      activeCall: null,
    }),

  handleCallEnded: () => get().clearCall(),
}));

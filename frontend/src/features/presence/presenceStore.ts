import { create } from "zustand";
import { socket } from "../../services/socket";

type PresenceState = {
  onlineUserIds: string[];
  setOnlineUserIds: (userIds: string[]) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  clearPresence: () => void;
};

const normalizeUserIds = (userIds: string[]) => Array.from(new Set(userIds));

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUserIds: [],

  setOnlineUserIds: (userIds) => {
    set({
      onlineUserIds: normalizeUserIds(userIds),
    });
  },

  setUserOnline: (userId) => {
    set((state) => ({
      onlineUserIds: state.onlineUserIds.includes(userId)
        ? state.onlineUserIds
        : [...state.onlineUserIds, userId],
    }));
  },

  setUserOffline: (userId) => {
    set((state) => ({
      onlineUserIds: state.onlineUserIds.filter((id) => id !== userId),
    }));
  },

  clearPresence: () => {
    set({
      onlineUserIds: [],
    });
  },
}));

let listenersAttached = false;

const attachPresenceListeners = () => {
  if (listenersAttached) {
    return;
  }

  socket.on("presence:state", ({ onlineUserIds }: { onlineUserIds: string[] }) => {
    usePresenceStore.getState().setOnlineUserIds(onlineUserIds);
  });

  socket.on("presence:online", ({ userId }: { userId: string }) => {
    usePresenceStore.getState().setUserOnline(userId);
  });

  socket.on("presence:offline", ({ userId }: { userId: string }) => {
    usePresenceStore.getState().setUserOffline(userId);
  });

  // Legacy compatibility while the rest of the app is being updated.
  socket.on("onlineUsers", ({ userIds }: { userIds: string[] }) => {
    usePresenceStore.getState().setOnlineUserIds(userIds);
  });

  socket.on("userOnline", ({ userId }: { userId: string }) => {
    usePresenceStore.getState().setUserOnline(userId);
  });

  socket.on("userOffline", ({ userId }: { userId: string }) => {
    usePresenceStore.getState().setUserOffline(userId);
  });

  listenersAttached = true;
};

attachPresenceListeners();

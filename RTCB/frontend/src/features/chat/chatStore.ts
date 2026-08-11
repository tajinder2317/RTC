import { create } from "zustand";
import { socket } from "../../services/socket";

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
};

type ChatState = {
  currentConversationId: string | null;
  messages: Message[];
  typingUser: {
    userId: string;
    username: string;
  } | null;

  onlineUsers: string[];

  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  setConversation: (conversationId: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setTypingUser: (user: { userId: string; username: string } | null) => void;
  clearMessages: () => void;
};

export const useChatStore = create<ChatState>((set) => ({
  currentConversationId: null,
  messages: [],
  typingUser: null,
  onlineUsers: [],

  setConversation: (conversationId) => {
    socket.emit("joinConversation", conversationId);

    set({
      currentConversationId: conversationId,
      messages: [],
    });
  },

  setMessages: (messages) => {
    set({ messages });
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  setTypingUser: (user) => {
    set({
      typingUser: user,
    });
  },

  clearMessages: () => {
    set({
      currentConversationId: null,
      messages: [],
      typingUser: null,
    });
  },

  setUserOnline: (userId) => {
    set((state) => ({
      onlineUsers: state.onlineUsers.includes(userId)
        ? state.onlineUsers
        : [...state.onlineUsers, userId],
    }));
  },

  setUserOffline: (userId) => {
    set((state) => ({
      onlineUsers: state.onlineUsers.filter((id) => id !== userId),
    }));
  },
}));

socket.on("newMessage", (message: Message) => {
  const currentConversationId = useChatStore.getState().currentConversationId;

  if (message.conversationId !== currentConversationId) {
    return;
  }

  useChatStore.getState().addMessage(message);
});

socket.on("userTyping", (user: { userId: string; username: string }) => {
  useChatStore.getState().setTypingUser(user);
});

socket.on("userStoppedTyping", () => {
  useChatStore.getState().setTypingUser(null);
});

socket.on("userOnline", ({ userId }: { userId: string }) => {
  useChatStore.getState().setUserOnline(userId);
});

socket.on("userOffline", ({ userId }: { userId: string }) => {
  useChatStore.getState().setUserOffline(userId);
});
socket.on("onlineUsers", ({ userIds }: { userIds: string[] }) => {
  useChatStore.setState({
    onlineUsers: userIds,
  });
});

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

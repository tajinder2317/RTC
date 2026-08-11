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

  setConversation: (conversationId: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
};

export const useChatStore = create<ChatState>((set) => ({
  currentConversationId: null,
  messages: [],

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

  clearMessages: () => {
    set({
      currentConversationId: null,
      messages: [],
    });
  },
}));

socket.on("newMessage", (message: Message) => {
  useChatStore.getState().addMessage(message);
});

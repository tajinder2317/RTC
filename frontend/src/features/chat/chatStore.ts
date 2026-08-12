import { create } from "zustand";
import { socket } from "../../services/socket";
import { useAuthStore } from "../auth/authStore";

export type ChatUser = {
  id: string;
  username: string;
  email: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
};

export type Conversation = {
  id: string;
  createdAt: string;
  unreadCount?: number;
  members: {
    user: ChatUser;
  }[];
  messages: Message[];
};

type ChatState = {
  currentConversationId: string | null;
  currentConversation: Conversation | null;
  messages: Message[];
  setConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  currentConversationId: null,
  currentConversation: null,
  messages: [],

  setConversation: (conversation) => {
    if (!conversation) {
      const currentConversationId = get().currentConversationId;

      if (currentConversationId) {
        socket.emit("leaveConversation", currentConversationId);
      }

      set({
        currentConversationId: null,
        currentConversation: null,
        messages: [],
      });

      return;
    }

    const currentConversationId = get().currentConversationId;

    if (currentConversationId && currentConversationId !== conversation.id) {
      socket.emit("leaveConversation", currentConversationId);
    }

    socket.emit("joinConversation", conversation.id);

    set({
      currentConversationId: conversation.id,
      currentConversation: {
        ...conversation,
        messages: conversation.messages ?? [],
      },
      messages: conversation.messages ?? [],
    });
  },

  setMessages: (messages) => {
    set((state) => ({
      messages,
      currentConversation: state.currentConversation
        ? {
            ...state.currentConversation,
            messages,
          }
        : state.currentConversation,
    }));
  },

  addMessage: (message) => {
    set((state) => ({
      messages: state.messages.some((item) => item.id === message.id)
        ? state.messages
        : [...state.messages, message],
      currentConversation: state.currentConversation
        ? {
            ...state.currentConversation,
            messages: state.currentConversation.messages.some(
              (item) => item.id === message.id,
            )
              ? state.currentConversation.messages
              : [...state.currentConversation.messages, message],
          }
        : state.currentConversation,
    }));
  },

  clearMessages: () => {
    const currentConversationId = get().currentConversationId;

    if (currentConversationId) {
      socket.emit("leaveConversation", currentConversationId);
    }

    set({
      currentConversationId: null,
      currentConversation: null,
      messages: [],
    });
  },
}));

socket.on("newMessage", (message: Message) => {
  const currentConversationId = useChatStore.getState().currentConversationId;

  if (message.conversationId === currentConversationId) {
    useChatStore.getState().addMessage(message);
  }

  // If this message is from someone else,
  // tell the server it has been delivered.
  const currentUserId = useAuthStore.getState().user?.id;

  if (currentUserId && message.senderId !== currentUserId) {
    socket.emit("messageDelivered", {
      messageId: message.id,
    });
  }
});

socket.on(
  "message:read",
  ({
    conversationId,
    messageIds,
    readAt,
  }: {
    conversationId: string;
    messageIds: string[];
    readAt: string;
  }) => {
    const currentConversationId = useChatStore.getState().currentConversationId;

    if (conversationId !== currentConversationId || messageIds.length === 0) {
      return;
    }

    useChatStore.setState((state) => ({
      messages: state.messages.map((message) =>
        messageIds.includes(message.id)
          ? {
              ...message,
              readAt,
            }
          : message,
      ),
      currentConversation: state.currentConversation
        ? {
            ...state.currentConversation,
            messages: state.currentConversation.messages.map((message) =>
              messageIds.includes(message.id)
                ? {
                    ...message,
                    readAt,
                  }
                : message,
            ),
          }
        : state.currentConversation,
    }));
  },
);
socket.on(
  "messageDelivered",
  ({ messageId, deliveredAt }: { messageId: string; deliveredAt: string }) => {
    useChatStore.setState((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              deliveredAt,
            }
          : message,
      ),
      currentConversation: state.currentConversation
        ? {
            ...state.currentConversation,
            messages: state.currentConversation.messages.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    deliveredAt,
                  }
                : message,
            ),
          }
        : state.currentConversation,
    }));
  },
);

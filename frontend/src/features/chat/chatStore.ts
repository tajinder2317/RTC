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
  typingUser: {
    userId: string;
    username: string;
  } | null;

  onlineUsers: string[];

  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  setConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setTypingUser: (user: { userId: string; username: string } | null) => void;
  clearMessages: () => void;
};

export const useChatStore = create<ChatState>((set) => ({
  currentConversationId: null,
  currentConversation: null,
  messages: [],
  typingUser: null,
  onlineUsers: [],

  setConversation: (conversation) => {
    if (!conversation) {
      set({
        currentConversationId: null,
        currentConversation: null,
        messages: [],
        typingUser: null,
      });

      return;
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

  setTypingUser: (user) => {
    set({
      typingUser: user,
    });
  },

  clearMessages: () => {
    set({
      currentConversationId: null,
      currentConversation: null,
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

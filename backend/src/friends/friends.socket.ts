import type { Server } from "socket.io";

type SocketPayload = Record<string, unknown>;

let friendsIo: Server | null = null;

export function registerFriendsSocket(io: Server) {
  friendsIo = io;
}

function emitToUser(userId: string, event: string, payload: SocketPayload) {
  friendsIo?.to(`user:${userId}`).emit(event, payload);
}

export function emitFriendRequestNew(userId: string, payload: SocketPayload) {
  emitToUser(userId, "friendRequest:new", payload);
}

export function emitFriendRequestAccepted(
  userId: string,
  payload: SocketPayload,
) {
  emitToUser(userId, "friendRequest:accepted", payload);
}

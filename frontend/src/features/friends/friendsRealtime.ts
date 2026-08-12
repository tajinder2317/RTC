import { socket } from "../../services/socket";

type FriendEventHandlers = {
  onNewRequest?: () => void;
  onAccepted?: () => void;
};

const subscribers = new Set<FriendEventHandlers>();
let listenersAttached = false;

const emitNewRequest = () => {
  subscribers.forEach((subscriber) => {
    subscriber.onNewRequest?.();
  });
};

const emitAccepted = () => {
  subscribers.forEach((subscriber) => {
    subscriber.onAccepted?.();
  });
};

const attachListeners = () => {
  if (listenersAttached) {
    return;
  }

  socket.on("friendRequest:new", emitNewRequest);
  socket.on("friendRequest:accepted", emitAccepted);
  listenersAttached = true;
};

const detachListeners = () => {
  if (!listenersAttached || subscribers.size > 0) {
    return;
  }

  socket.off("friendRequest:new", emitNewRequest);
  socket.off("friendRequest:accepted", emitAccepted);
  listenersAttached = false;
};

export function subscribeToFriendEvents(handlers: FriendEventHandlers) {
  subscribers.add(handlers);
  attachListeners();

  return () => {
    subscribers.delete(handlers);
    detachListeners();
  };
}

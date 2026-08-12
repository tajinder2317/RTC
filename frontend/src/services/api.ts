const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default API_URL;

export async function getUsers(token: string) {
  const response = await fetch(`${API_URL}/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch users");
  }

  return data.users;
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  return data;
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      email,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Registration failed");
  }

  return data;
}
export async function createConversation(token: string, userId: string) {
  const response = await fetch(`${API_URL}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create conversation");
  }

  return data.conversation;
}

export type RelationshipStatus =
  | "SELF"
  | "FRIENDS"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "NOT_FRIENDS";

export type SocialUser = {
  id: string;
  username: string;
  email: string;
  relationship: RelationshipStatus;
  friendRequestId?: string;
  friendshipId?: string;
};

export type Friend = {
  id: string;
  username: string;
  email: string;
};

export type FriendRequest = {
  id: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  sender: Friend;
  receiver: Friend;
};

export async function searchUsers(token: string, query: string) {
  const url = new URL(`${API_URL}/users/search`);
  if (query.trim()) {
    url.searchParams.set("q", query.trim());
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to search users");
  }

  return data.users as SocialUser[];
}

export async function getFriends(token: string) {
  const response = await fetch(`${API_URL}/friends`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch friends");
  }

  return data.friends as Friend[];
}

export async function getFriendRequests(token: string) {
  const response = await fetch(`${API_URL}/friends/requests`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch friend requests");
  }

  return data.requests as FriendRequest[];
}

export async function sendFriendRequest(token: string, receiverId: string) {
  const response = await fetch(`${API_URL}/friends/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receiverId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to send friend request");
  }

  return data;
}

export async function acceptFriendRequest(token: string, requestId: string) {
  const response = await fetch(
    `${API_URL}/friends/requests/${requestId}/accept`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to accept friend request");
  }

  return data;
}

export async function rejectFriendRequest(token: string, requestId: string) {
  const response = await fetch(
    `${API_URL}/friends/requests/${requestId}/reject`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to reject friend request");
  }

  return data;
}

export async function removeFriend(token: string, friendId: string) {
  const response = await fetch(`${API_URL}/friends/${friendId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to remove friend");
  }

  return data;
}

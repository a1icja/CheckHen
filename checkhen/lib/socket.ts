import { io, Socket } from "socket.io-client";

const isBrowser = typeof window !== "undefined";

// export const socket = isBrowser ? io() : null;

export const getSocket = (classId: string, email: string): Socket | null => {
  if (!isBrowser) {
    return null;
  }

  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:6060';

  const socket = io(SOCKET_URL, {
    query: {
      classId,
      email,
    }
  });

  return socket;
};
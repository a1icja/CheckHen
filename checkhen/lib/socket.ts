import { io, Socket } from "socket.io-client";

const isBrowser = typeof window !== "undefined";

// export const socket = isBrowser ? io() : null;

export const getSocket = (classId: string, email: string): Socket | null => {
  if (!isBrowser) {
    return null;
  }

  const socket = io(':6060', {
    query: {
      classId,
      email,
    }
  });

  return socket;
};
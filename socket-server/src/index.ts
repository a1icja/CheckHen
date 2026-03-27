import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient(); // Initialize Prisma client for database operations

const io = new Server(6060, {
  cors: {
    origin: "*", // Allow all origins for CORS
  },
});

// Function to handle a new socket connection
const handleSocketConnection = async (socket: Socket) => {
  console.log("a user connected");

  console.log(socket.handshake.query); // Log query parameters from the connection

  // Validate required query parameters
  if (
    !socket.handshake.query.classId ||
    !socket.handshake.query.email
  ) {
    socket.disconnect();
    return;
  }

  // Extract query parameters, handling cases where they might be arrays
  const classId = Array.isArray(socket.handshake.query.classId)
    ? socket.handshake.query.classId[0]
    : socket.handshake.query.classId;

  const email = Array.isArray(socket.handshake.query.email)
    ? socket.handshake.query.email[0]
    : socket.handshake.query.email;

  console.log(classId, email); // Log extracted parameters

  // Upsert user in the database (create if not exists, otherwise update)
  await prisma.user.upsert({
    where: {
      email: email,
    },
    update: {}, // No updates for existing users
    create: {
      email: email,
    },
  });

  // Check-in user
  let dbCheckIn = await prisma.checkIn.findFirst({
    where: {
      user: {
        email: email,
      },
      class: {
        id: classId,
      },
    },
  });

  if (!dbCheckIn) {
    dbCheckIn = await prisma.checkIn.create({
      data: {
        user: {
          connect: {
            email: email,
          },
        },
        class: {
          connect: {
            id: classId,
          },
        },
        socketId: socket.id,
      },
    });
  }

  if (!dbCheckIn) {
    socket.disconnect();
    return;
  }

  socket.join(classId);
};

// Listen for new socket connections
io.on("connection", async (socket) => {
  await handleSocketConnection(socket);

  // socket.on("user-hand-update", (data) => {
  //   io.sockets.emit("user-hand-update", data);
  // });

  // socket.on("user-hand-acked", async (data) => {
  //   await handleUserHandAck(socket, data);
  // });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  socket.onAny((event, ...args) => {
    const roomId = args[0]?.classId as string | undefined;
    if (!roomId) return;

    if (event === "user-hand-update") {
      io.to(roomId).emit("user-hand-update", args[0]);
    }

    if (event === "user-hand-acked") {
      io.to(roomId).emit("check-raised-hands", args[0]);
    }

    if (event === "chat-message-sent") {
      io.to(roomId).emit("fetch-messages", args[0]);
    }

    if (event === "pace-signal-sent") {
      io.to(roomId).emit("pace-signal-update", args[0]);
    }

    if (event === "pace-signals-reset") {
      io.to(roomId).emit("pace-signals-reset", args[0]);
    }
  });
});

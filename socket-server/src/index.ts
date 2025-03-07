import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const io = new Server(6060, {
  cors: {
    origin: "*",
  },
});

const handleSocketConnection = async (socket: Socket) => {
  console.log("a user connected");

  console.log(socket.handshake.query);

  if (
    !socket.handshake.query.clerkId ||
    !socket.handshake.query.classId ||
    !socket.handshake.query.email
  ) {
    socket.disconnect();
    return;
  }

  // If the query params are arrays, take the first element
  const clerkId = Array.isArray(socket.handshake.query.clerkId)
    ? socket.handshake.query.clerkId[0]
    : socket.handshake.query.clerkId;

  const classId = Array.isArray(socket.handshake.query.classId)
    ? socket.handshake.query.classId[0]
    : socket.handshake.query.classId;

  const email = Array.isArray(socket.handshake.query.email)
    ? socket.handshake.query.email[0]
    : socket.handshake.query.email;

  console.log(clerkId, classId, email);

  // Create user if not exists
  await prisma.user.upsert({
    where: {
      email: email,
    },
    update: {},
    create: {
      clerk_id: clerkId,
      email: email,
    },
  });

  // Check-in user
  let dbCheckIn = await prisma.checkIn.findFirst({
    where: {
      user: {
        clerk_id: clerkId,
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
            clerk_id: clerkId,
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

const handleUserHandAck = async (socket: Socket, data: any) => {
  const email = data.email;
  const classId = data.classId;

  // Fetch check-in for socketId
  const dbCheckIn = await prisma.checkIn.findFirst({
    where: {
      user: {
        email: email,
      },
      class: {
        id: classId,
      },
    },
  });

  console.log(dbCheckIn);

  if (!dbCheckIn) {
    return;
  }

  const dbHandRaise = await prisma.handRaise.findFirst({
    where: {
      user: {
        email: email,
      },
      class: {
        id: classId,
      },
      isAcknowledged: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const updatedHandRaise = await prisma.handRaise.update({
    where: {
      id: dbHandRaise.id,
    },
    data: {
      isAcknowledged: true,
    },
  });

  console.log(updatedHandRaise);

  if (!updatedHandRaise) {
    return;
  }

  console.log("User hand acked");

  io.sockets.emit("check-raised-hands", {});

  console.log("User hand acked emitted");
};

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
    switch (event) {
      case "user-hand-update":
        io.sockets.emit("user-hand-update", args[0]);
        break;
      case "user-hand-acked":
        handleUserHandAck(socket, args[0]);
        break;
    }
  });
});

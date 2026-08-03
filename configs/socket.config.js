import { Server } from "socket.io";
import { handleConnection } from "#sockets/handlers/connection.handler.js";
import { initSocketEmitter } from "#sockets/services/socketEmitter.service.js";
import { SOCKET_EVENTS } from "#constants/socket.constants.js";
import { authenticateSocket } from "#middlewares/authenticateSocket.middleware.js";
import { socketCorsOrigin } from "./cors.config.js";

const initSocket = (httpServer) => {
  if (!process.env.CLIENT_ORIGIN) {
    // credentials:true + origin:"*" is rejected by browsers outright, and
    // authenticateSocket relies on the httpOnly cookie riding along with
    // the handshake — so this isn't optional the way it might be for a
    // token-in-header setup. Fail loudly instead of silently breaking auth.
    throw new Error(
      "CLIENT_ORIGIN env var is required (comma-separated list of allowed origins) — Socket.IO CORS cannot use '*' together with credentials.",
    );
  }

  const io = new Server(httpServer, {
    cors: {
      origin: socketCorsOrigin,
      credentials: true,
    },
    pingInterval: 15_000, // server -> client heartbeat every 15s
    pingTimeout: 30_000, // consider the client gone if no pong within 30s
  });

  // TODO (when scaling past a single instance): attach the Redis adapter
  // so rooms/broadcasts work across multiple Node processes —
  //   import { createAdapter } from "@socket.io/redis-adapter";
  //   import { createClient } from "redis";
  //   const pubClient = createClient({ url: process.env.REDIS_URL });
  //   const subClient = pubClient.duplicate();
  //   await Promise.all([pubClient.connect(), subClient.connect()]);
  //   io.adapter(createAdapter(pubClient, subClient));
  // Without this, presence/connectionTracker state also needs to move to
  // Redis, since each instance only sees its own slice of connections.

  io.use(authenticateSocket);

  // Makes io available to REST controllers/services via the emitter
  // module, without them importing this file directly.
  initSocketEmitter(io);

  io.on(SOCKET_EVENTS.CONNECT, (socket) => handleConnection(io, socket));

  return io;
};

export { initSocket };

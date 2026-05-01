import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import cors from "cors";

import env, { validateEnv } from "./configs/env.config.js";
import { connectDB } from "./configs/db.config.js";
import { corsOptions } from "./configs/cors.config.js";
import router from "./routes/index.routes.js";
import { globalErrorMiddleware } from "./middlewares/error.middleware.js";
import { ErrorHandler } from "./utils/errorHandler.util.js";
import { EXCEPTION_CODES } from "#constants/exceptionCodes.constants.js";
import { startEmailWorker } from "./workers/email.worker.js";

validateEnv();

const app = express();
const server = createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: env.CORS_ORIGINS.split(","),
//     credentials: true,
//   },
// });

// Middlewares
app.use(cors(corsOptions));
// app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/v1", router);

// 404 handler
app.use((req, res) => {
  throw new ErrorHandler("Route not found", EXCEPTION_CODES.ROUTE_NOT_FOUND);
});

// Error handler
app.use(globalErrorMiddleware);

// Start server
const startServer = async () => {
  try {
    await connectDB(env.MONGO_URI);
    startEmailWorker();

    server.listen(env.PORT, () => {
      console.log(
        `Server running on port ${env.PORT} in ${env.ENVIRONMENT} mode`,
      );
    });
  } catch (err) {
    console.error("Startup failed:", err.message);
    process.exit(1);
  }
};

startServer();

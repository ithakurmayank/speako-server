import express from "express";
import { createServer } from "http";
import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "./utils/features.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import cookieParser from "cookie-parser";
import cors from "cors";

import { Server } from "socket.io";
import { NEW_MESSAGE } from "./constants/events.js";
import router from "./routes/routes.js";

const mongoURI = process.env.MONGO_URI;
const port = process.env.PORT || 3000;
const env = process.env.NODE_ENV?.trim() || "production";

const app = express();
const server = createServer(app);
const io = new Server(server, {});

app.use(cors({ origin: "http://localhost:5173", credentials: true }));

// Middlewares
app.use(express.json());
app.use(cookieParser());

connectDB(mongoURI);

app.use("/api/v1", router);

// io.on("connection", (socket) => {
//   socket.on(NEW_MESSAGE, (data) => {
//     console.log("New message received:", data);
//   });

//   socket.on("disconnect", () => {
//     console.log("User disconnected");
//   });
// });

// Global error middleware
app.use(errorMiddleware);

server.listen(port, () => {
  console.log(`Server running on port ${port} in ${env} mode`);
});

export { env };

import mongoose from "mongoose";
import env from "./env.config.js";

const connectDB = async (uri) => {
  try {
    const data = await mongoose.connect(uri, {
      dbName: env.DB_NAME,
    });

    console.log(`MongoDB connected`);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1); // stop app if DB fails
  }
};

export { connectDB };

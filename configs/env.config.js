import dotenv from "dotenv";
dotenv.config();

const env = {
  PORT: process.env.PORT || 3000,
  TOKEN_KEY: process.env.TOKEN_KEY,
  ENVIRONMENT: process.env.NODE_ENV?.trim() || "production",
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  DB_NAME: process.env.DB_NAME,
};

const requiredEnvVars = ["MONGO_URI", "JWT_SECRET_KEY"];

export const validateEnv = () => {
  const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

  if (missingVars.length > 0) {
    console.error(
      `Missing required environment variables: ${missingVars.join(", ")}`,
    );
    process.exit(1);
  }
};

export default env;

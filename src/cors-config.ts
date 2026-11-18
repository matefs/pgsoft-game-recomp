import "dotenv/config";
import type { CorsOptions } from "cors";

/** Origens permitidas (Express + Socket.IO). */
export const allowedCorsOrigins = [
  ...(process.env.AMBIENTE === "DEV" ? ["http://localhost:3000", "http://localhost:3006", "http://127.0.0.1:3006"] : []),
  ...(process.env.DOMINIO_API ? [new URL(/^https?:\/\//i.test(process.env.DOMINIO_API) ? process.env.DOMINIO_API : `https://${process.env.DOMINIO_API}`).origin] : []),
  "https://aavip55.vercel.app",
  "https://api-pgsoft-node-production.up.railway.app",
];

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS bloqueado para origem: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

export const socketIoCors = {
  origin: allowedCorsOrigins,
  methods: ["GET", "POST"],
};

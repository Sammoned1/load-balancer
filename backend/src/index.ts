import express from "express";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { register } from "./metrics/metrics";
import winston from "winston";
import "reflect-metadata";
import { AppDataSource } from "./db/connection";
import cors from 'cors';
import router from "./routes/router";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({
  origin: 'http://localhost:5173', // точный URL вашего фронтенда
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Логирование
const logger = winston.createLogger({
  level: "info",
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
});

// Лимитирование запросов
const limiter = rateLimit({
  windowMs: 10 * 1000, // 10 секунд
  max: 50, // не более 50 запросов за 10 секунд
});

app.use(limiter);
app.use(express.json());

// // Метрики Prometheus
// app.get("/metrics", async (_req, res) => {
//   res.set("Content-Type", register.contentType);
//   res.end(await register.metrics());
// });

// Роут для вычислений
app.use("/api", router);

// AppDataSource.initialize()
//   .then(() => {
//     console.log("✅ Database connected");
//     app.listen(port, () => {
//       logger.info(`🚀 Backend running on port ${port}`);
//     });
//   })
//   .catch((err) => {
//     console.error("❌ Database connection error:", err);
//   });

app.listen(port, () => {
  logger.info(`🚀 Backend running on port ${port}`);
});

import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { SampleData } from "./entities/SampleData";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: true, // для тестового окружения
  logging: false,
  entities: [SampleData],
});

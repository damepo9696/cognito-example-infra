import { configure as serverless } from "@vendia/serverless-express";
import express from "express";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/test", (_, res) => {
  res.status(200).send({ message: "成功！" });
});

exports.handler = serverless({ app });

import htmlString from "./index.html?raw";

// Inject it into your page container
document.getElementById("app").innerHTML = htmlString;

import express from "express";
import { createServer } from "node:http";

const app = express();
const server = createServer(app);

app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});

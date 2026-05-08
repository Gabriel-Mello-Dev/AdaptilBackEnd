import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.get("/", (req, res) => {
  res.send("Servidor rodando");
});

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.on("mensagem", (msg) => {
    io.emit("mensagem", msg);
  });

  socket.on("disconnect", () => {
    console.log("Desconectado");
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log("Servidor iniciado");
});
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Set();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.post("/create-room", (req, res) => {
  const roomId = generateRoomCode();

  rooms.add(roomId);

  res.json({
    roomId,
  });
});

app.get("/room/:roomId", (req, res) => {
  const exists = rooms.has(req.params.roomId);

  res.json({
    exists,
  });
});

io.on("connection", (socket) => {
  console.log("Conectado:", socket.id);

  socket.on("join-room", (roomId) => {
    if (!rooms.has(roomId)) return;

    socket.join(roomId);

    console.log(`${socket.id} entrou em ${roomId}`);
  });

  socket.on("message", ({ roomId, message }) => {
    io.to(roomId).emit("message", message);
  });

  socket.on("disconnect", () => {
    console.log("Desconectado");
  });
});

server.listen(4000, () => {
  console.log("Servidor iniciado");
});

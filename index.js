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

/*
 * SALAS
 */
const rooms = new Set();

/*
 * ESTADO DAS SALAS
 *
 * roomVotes:
 * {
 *   ABC123: [0, 1, 1, 2]
 * }
 *
 * roomQuestions:
 * {
 *   ABC123: {
 *     title: "...",
 *     text: "...",
 *     respostas: [...],
 *     correta: 1,
 *     modeloIA: "..."
 *   }
 * }
 */
const roomVotes = {};
const roomQuestions = {};

/*
 * GERAR CÓDIGO DA SALA
 */
function generateRoomCode() {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

/*
 * CRIAR SALA
 */
app.post("/create-room", (req, res) => {
  let roomId = generateRoomCode();

  while (rooms.has(roomId)) {
    roomId = generateRoomCode();
  }

  rooms.add(roomId);

  roomVotes[roomId] = [];
  delete roomQuestions[roomId];

  res.json({
    roomId,
  });
});

/*
 * VERIFICAR SE A SALA EXISTE
 */
app.get("/room/:roomId", (req, res) => {
  const roomId = req.params.roomId.toUpperCase();

  const exists = rooms.has(roomId);

  res.json({
    exists,
  });
});

/*
 * SOCKET.IO
 */
io.on("connection", (socket) => {
  console.log("Conectado:", socket.id);

  /*
   * ENTRAR NA SALA
   */
  socket.on("join-room", (roomId) => {
    roomId = roomId.toUpperCase();

    if (!rooms.has(roomId)) {
      return;
    }

    socket.join(roomId);

    console.log(`${socket.id} entrou em ${roomId}`);
  });

  /*
   * CHAT
   */
  socket.on("message", ({ roomId, message }) => {
    roomId = roomId.toUpperCase();

    if (!rooms.has(roomId)) {
      return;
    }

    io.to(roomId).emit("message", message);
  });

  /*
   * IA COMEÇOU A GERAR A QUESTÃO
   */
  socket.on("question-generating", ({ roomId }) => {
    roomId = roomId.toUpperCase();

    if (!rooms.has(roomId)) {
      return;
    }

    /*
     * Limpa a questão e os votos anteriores
     */
    roomVotes[roomId] = [];
    delete roomQuestions[roomId];

    /*
     * Avisa todos os usuários da sala
     */
    io.to(roomId).emit("question-generating");
  });

  /*
   * QUESTÃO GERADA
   */
  socket.on("question", ({ roomId, question }) => {
    roomId = roomId.toUpperCase();

    if (!rooms.has(roomId)) {
      return;
    }

    /*
     * Salva a questão atual
     */
    roomQuestions[roomId] = question;

    /*
     * Começa uma nova votação
     */
    roomVotes[roomId] = [];

    /*
     * Envia para todos da sala
     */
    io.to(roomId).emit("question", question);
  });

  /*
   * ERRO AO GERAR QUESTÃO
   */
  socket.on("question-error", ({ roomId }) => {
    roomId = roomId.toUpperCase();

    if (!rooms.has(roomId)) {
      return;
    }

    /*
     * Avisa todos os usuários
     */
    io.to(roomId).emit("question-error");
  });

  /*
   * VOTO
   */
  socket.on("vote", ({ roomId, answer }) => {
    roomId = roomId.toUpperCase();

    if (!rooms.has(roomId)) {
      return;
    }

    /*
     * Não existe questão ativa
     */
    if (!roomQuestions[roomId]) {
      return;
    }

    /*
     * Garante que existe um array de votos
     */
    if (!roomVotes[roomId]) {
      roomVotes[roomId] = [];
    }

    /*
     * Registra o voto
     */
    roomVotes[roomId].push(answer);

    /*
     * Conta os votos
     */
    const contagem = {};

    roomVotes[roomId].forEach((voto) => {
      contagem[voto] = (contagem[voto] || 0) + 1;
    });

    /*
     * Atualiza todos os usuários
     */
    io.to(roomId).emit("vote-update", contagem);
  });

  /*
   * FINALIZAR VOTAÇÃO
   */
  socket.on("finalizar-votacao", ({ roomId }) => {
    roomId = roomId.toUpperCase();

    if (!rooms.has(roomId)) {
      return;
    }

    const question = roomQuestions[roomId];

    /*
     * Não existe questão
     */
    if (!question) {
      return;
    }

    const votos = roomVotes[roomId] || [];

    /*
     * Índice da resposta correta
     */
    const correta = Number(question.correta);

    let acertos = 0;
    let erros = 0;

    /*
     * Calcula acertos e erros
     */
    votos.forEach((voto) => {
      if (voto === correta) {
        acertos++;
      } else {
        erros++;
      }
    });

    /*
     * Verifica se a maioria acertou
     */
    const maioriaAcertou = acertos > erros;

    /*
     * Envia resultado para todos
     */
    io.to(roomId).emit("resultado-votacao", {
      correta,
      acertos,
      erros,
      maioriaAcertou,
    });
  });

  /*
   * DESCONECTAR
   */
  socket.on("disconnect", () => {
    console.log("Desconectado:", socket.id);
  });
});

/*
 * INICIAR SERVIDOR
 */
server.listen(4000, () => {
  console.log("Servidor iniciado na porta 4000");
});
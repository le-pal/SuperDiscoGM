import { createServer } from "node:http";
import next from "next";
import { createSocketServer } from "./src/server/socket";
import { subscribeToNotifications } from "./src/server/notifications";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = createSocketServer(httpServer);
  subscribeToNotifications(io);

  httpServer.listen(port, () => {
    console.log(
      `> SuperDiscoGM prêt sur http://localhost:${port} (${dev ? "development" : process.env.NODE_ENV})`
    );
  });
});

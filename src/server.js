require("dotenv").config({ path: "../.env" });
const http = require("http");

http
  .createServer((req, res) => {
    const method = req.method;
    const url = req.url;

    const parsedUrl = new URL(url, `http://${req.headers.host}`);

    const pathname = parsedUrl.pathname;

    if (method === "GET" && pathname === "/") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(`This is a ${method} ${pathname} Request!`);
    } else if (method === "GET" && pathname === "/health") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(`This is a ${method} ${pathname} Request!`);
    } else if (method === "POST" && pathname === "/users") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString(); //The incoming HTTP body arrives as chunks of data by default
      });

      req.on("end", () => {
        try {
          const data = JSON.parse(body); //parses a JSON-formatted string into a JavaScript object.
          res.writeHead(201, { "Content-type": "application/json" });
          res.end(
            JSON.stringify({
              message: "User created",
              user: data,
            }),
          );
        } catch (err) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              message: "Invalid JSON",
            }),
          );
        }
      });
    } else if (method === "GET" && pathname.startsWith("/users/")) {
      const id = parseInt(pathname.split("/")[2]);
      const page = parseInt(parsedUrl.searchParams.get("page"));
      const limit = parseInt(parsedUrl.searchParams.get("limit"));
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(
        `This is a ${method} ${pathname} (Id: ${id}) (Page: ${page}) (Limit: ${limit}) Request!`,
      );
    } else if (method === "DELETE" && pathname.startsWith("/users/")) {
      const id = parseInt(pathname.split("/")[2]);
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(`This is a ${method} ${pathname} (${id}) Request!`);
    } else {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Route not found");
    }
  })

  .listen(process.env.PORT_NO);

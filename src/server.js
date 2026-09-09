require("dotenv").config({ path: "../.env" });
const fs = require("fs");
const http = require("http");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { buffer } = require("stream/consumers");

const server = http.createServer((req, res) => {
  const method = req.method;
  const url = req.url;

  const parsedUrl = new URL(url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // GET /

  if (method === "GET" && pathname === "/") {
    res.writeHead(200, {
      "Content-Type": "text/plain",
    });

    return res.end(`This is a ${method} ${pathname} Request!`);
  }

  // POST /register
  else if (method === "POST" && pathname === "/register") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body);

        if (!data.name || !data.email || !data.password) {
          res.writeHead(400, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "Name, email and password are required",
            }),
          );
        }

        // Check whether email already exists
        db.query("SELECT id FROM users WHERE email = ?", [data.email])
          .then(([rows]) => {
            if (rows.length > 0) {
              res.writeHead(409, {
                "Content-Type": "application/json",
              });

              return res.end(
                JSON.stringify({
                  message: "Email already registered",
                }),
              );
            }

            // Hash password
            bcrypt.hash(data.password, 10, (err, hashedPassword) => {
              if (err) {
                console.error(err);

                res.writeHead(500, {
                  "Content-Type": "application/json",
                });

                return res.end(
                  JSON.stringify({
                    message: "Unable to hash password",
                  }),
                );
              }

              // Insert user
              db.query(
                "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                [data.name, data.email, hashedPassword],
              )
                .then(([result]) => {
                  res.writeHead(201, {
                    "Content-Type": "application/json",
                  });

                  return res.end(
                    JSON.stringify({
                      message: "User registered successfully",
                      user: {
                        id: result.insertId,
                        name: data.name,
                        email: data.email,
                      },
                    }),
                  );
                })
                .catch((err) => {
                  console.error(err);

                  res.writeHead(500, {
                    "Content-Type": "application/json",
                  });

                  return res.end(
                    JSON.stringify({
                      message: "Unable to save user",
                    }),
                  );
                });
            });
          })
          .catch((err) => {
            console.error(err);

            res.writeHead(500, {
              "Content-Type": "application/json",
            });

            return res.end(
              JSON.stringify({
                message: "Database error",
              }),
            );
          });
      } catch (err) {
        res.writeHead(400, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Invalid JSON",
          }),
        );
      }
    });
  }

  // POST /login
  else if (method === "POST" && pathname === "/login") {
    let loginData = "";

    req.on("data", (chunk) => {
      loginData += chunk.toString();
    });

    req.on("end", () => {
      try {
        const loginCred = JSON.parse(loginData);

        if (!loginCred.email || !loginCred.password) {
          res.writeHead(400, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "Invalid Email or Password",
            }),
          );
        }

        // Find user in MySQL
        db.query(
          "SELECT id, name, email, password FROM users WHERE email = ?",
          [loginCred.email],
        )
          .then(([rows]) => {
            if (rows.length === 0) {
              res.writeHead(401, {
                "Content-Type": "application/json",
              });

              return res.end(
                JSON.stringify({
                  message: "Invalid email or password",
                }),
              );
            }

            const existingUser = rows[0];

            bcrypt.compare(
              loginCred.password,
              existingUser.password,
              (err, isMatch) => {
                if (err) {
                  console.error(err);

                  res.writeHead(500, {
                    "Content-Type": "application/json",
                  });

                  return res.end(
                    JSON.stringify({
                      message: "Unable to verify password",
                    }),
                  );
                }
                if (!isMatch) {
                  res.writeHead(401, {
                    "Content-Type": "application/json",
                  });

                  return res.end(
                    JSON.stringify({
                      message: "Invalid email or password",
                    }),
                  );
                }

                const token = jwt.sign(
                  {
                    id: existingUser.id,
                    email: existingUser.email,
                  },
                  process.env.JWT_SECRET,
                  {
                    expiresIn: "1h",
                  },
                );

                res.writeHead(200, {
                  "Content-Type": "application/json",
                });

                return res.end(
                  JSON.stringify({
                    message: "Login successful",
                    token: token,
                  }),
                );
              },
            );
          })
          .catch((err) => {
            console.error(err);

            res.writeHead(500, {
              "Content-Type": "application/json",
            });

            return res.end(
              JSON.stringify({
                message: "Database error",
              }),
            );
          });
      } catch (err) {
        res.writeHead(400, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Invalid JSON",
          }),
        );
      }
    });
  }

  // GET /profile
  else if (method === "GET" && pathname === "/profile") {
    const token = authenticate(req);
    if (!token) {
      res.writeHead(401, {
        "content-type": "application/json",
      });
      return res.end(
        JSON.stringify({
          message: "Invalid or Expired token",
        }),
      );
    }
    try {
      db.query("SELECT id, name, email, created_at FROM users WHERE id = ?", [
        token.id,
      ])
        .then(([rows]) => {
          if (rows.length === 0) {
            res.writeHead(404, {
              "Content-Type": "application/json",
            });

            return res.end(
              JSON.stringify({
                message: "User not found",
              }),
            );
          }

          res.writeHead(200, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "Profile",
              user: rows[0],
            }),
          );
        })
        .catch((err) => {
          console.error(err);

          res.writeHead(500, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "Database error",
            }),
          );
        });
    } catch (err) {
      res.writeHead(401, {
        "Content-Type": "application/json",
      });

      return res.end(
        JSON.stringify({
          message: "Invalid or expired token",
        }),
      );
    }
  }

  // GET /users
  else if (method === "GET" && pathname === "/users") {
    db.query("SELECT id, name, email, created_at FROM users")
      .then(([users]) => {
        res.writeHead(200, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "All users data",
            users: users,
          }),
        );
      })
      .catch((err) => {
        console.error(err);

        res.writeHead(500, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Unable to fetch users",
          }),
        );
      });
  }

  // POST /users
  else if (method === "POST" && pathname === "/users") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const data = JSON.parse(body);

        if (!data.name || !data.email) {
          res.writeHead(400, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "Name and email are required",
            }),
          );
        }

        // Check duplicate email
        const [existingUsers] = await db.query(
          "SELECT id FROM users WHERE email = ?",
          [data.email],
        );

        if (existingUsers.length > 0) {
          res.writeHead(409, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "Email already exists",
            }),
          );
        }

        const [result] = await db.query(
          "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
          [data.name, data.email, data.password || ""],
        );

        res.writeHead(201, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "User created",
            user: {
              id: result.insertId,
              name: data.name,
              email: data.email,
            },
          }),
        );
      } catch (err) {
        console.error(err);

        res.writeHead(400, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Unable to create user",
          }),
        );
      }
    });
  }

  // GET /users/:id
  else if (method === "GET" && pathname.startsWith("/users/")) {
    const id = parseInt(pathname.split("/")[2]);

    if (isNaN(id)) {
      res.writeHead(400, {
        "Content-Type": "application/json",
      });

      return res.end(
        JSON.stringify({
          message: "Invalid user ID",
        }),
      );
    }

    db.query("SELECT id, name, email, created_at FROM users WHERE id = ?", [id])
      .then(([rows]) => {
        if (rows.length === 0) {
          res.writeHead(404, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "User not found",
            }),
          );
        }

        res.writeHead(200, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "User found",
            user: rows[0],
          }),
        );
      })
      .catch((err) => {
        console.error(err);

        res.writeHead(500, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Database error",
          }),
        );
      });
  }

  // PUT /users/:id
  else if (method === "PUT" && pathname.startsWith("/users/")) {
    const id = parseInt(pathname.split("/")[2]);

    if (isNaN(id)) {
      res.writeHead(400, {
        "Content-Type": "application/json",
      });

      return res.end(
        JSON.stringify({
          message: "Invalid user ID",
        }),
      );
    }

    let updateData = "";

    req.on("data", (chunk) => {
      updateData += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const data = JSON.parse(updateData);

        if (!data.name && !data.email) {
          res.writeHead(400, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "Enter valid Name or Email",
            }),
          );
        }

        const [existingUsers] = await db.query(
          "SELECT id, name, email FROM users WHERE id = ?",
          [id],
        );

        if (existingUsers.length === 0) {
          res.writeHead(404, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "Unable to find the user",
            }),
          );
        }

        // Build dynamic UPDATE query
        const fields = [];
        const values = [];

        if (data.name) {
          fields.push("name = ?");
          values.push(data.name);
        }

        if (data.email) {
          fields.push("email = ?");
          values.push(data.email);
        }

        values.push(id);

        const query = `
          UPDATE users
          SET ${fields.join(", ")}
          WHERE id = ?
        `;

        await db.query(query, values);

        const [updatedUsers] = await db.query(
          "SELECT id, name, email, created_at FROM users WHERE id = ?",
          [id],
        );

        res.writeHead(200, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "User data updated",
            user: updatedUsers[0],
          }),
        );
      } catch (err) {
        console.error(err);

        res.writeHead(500, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Unable to update user",
          }),
        );
      }
    });
  }

  // DELETE /users/:id
  else if (method === "DELETE" && pathname.startsWith("/users/")) {
    const id = parseInt(pathname.split("/")[2]);

    if (isNaN(id)) {
      res.writeHead(400, {
        "Content-Type": "application/json",
      });

      return res.end(
        JSON.stringify({
          message: "Invalid user ID",
        }),
      );
    }

    db.query("DELETE FROM users WHERE id = ?", [id])
      .then(([result]) => {
        if (result.affectedRows === 0) {
          res.writeHead(404, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "User not found",
            }),
          );
        }

        res.writeHead(200, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Successfully deleted the user",
          }),
        );
      })
      .catch((err) => {
        console.error(err);

        res.writeHead(500, {
          "Content-Type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Unable to delete user",
          }),
        );
      });
  }
  //POST - /upload (uploading all the files)
  else if (method === "POST" && pathname === "/upload") {
    const token = authenticate(req);
    if (!token) {
      res.writeHead(401, {
        "content-type": "application/json",
      });
      return res.end(
        JSON.stringify({
          message: "Invalid or Expired token",
        }),
      );
    }
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", async () => {
      try {
        const fileBuffer = Buffer.concat(chunks);
        const fileName = `file-${Date.now()}.txt`;
        const filePath = `../uploads/${fileName}`;
        fs.writeFile(filePath, fileBuffer, (err) => {
          if (err) {
            console.log(err);
            res.writeHead(500, {
              "content-type": "application/json",
            });
            return res.end(
              JSON.stringify({
                message: "unable to save file",
              }),
            );
          }
          db.query(
            "INSERT INTO files (user_id,file_name,file_path) VALUES (?,?,?)",
            [token.id, fileName, filePath],
          )
            .then(([result]) => {
              res.writeHead(201, {
                "Content-Type": "application/json",
              });
              return res.end(
                JSON.stringify({
                  message: "File uploaded successfully",
                  fileName: fileName,
                }),
              );
            })
            .catch((err) => {
              res.writeHead(500, {
                "Content-Type": "application/json",
              });
              return res.end(
                JSON.stringify({
                  message: "Unable to save file information",
                  fileName: fileName,
                }),
              );
            });
        });
      } catch (err) {
        res.writeHead(500, {
          "content-type": "application/json",
        });
        return res.end(
          JSON.stringify({
            message: "File upload failed",
          }),
        );
      }
    });
  }
  // GET - /files (list of files)
  else if (method === "GET" && pathname === "/files") {
    const token = authenticate(req);
    if (!token) {
      res.writeHead(401, {
        "content-type": "application/json",
      });
      return res.end(
        JSON.stringify({
          message: "Invalid or Expired token",
        }),
      );
    }
    db.query("SELECT file_name,file_path FROM files WHERE user_id = ?", [
      token.id,
    ])
      .then(([result]) => {
        if (result.length === 0) {
          res.writeHead(200, {
            "content-type": "application/json",
          });
          return res.end(
            JSON.stringify({
              message: "No files uploaded",
            }),
          );
        } else {
          res.writeHead(200, {
            "content-type": "application/json",
          });
          return res.end(
            JSON.stringify({
              message: "Got the list",
              list: result,
            }),
          );
        }
      })
      .catch((err) => {
        console.log(err);
        res.writeHead(500, {
          "content-type": "application/json",
        });
        return res.end(
          JSON.stringify({
            message: "Unable to load the list of files",
          }),
        );
      });
  }
  //GET - /files/:fileName (read the particular file with filename)
  else if (method === "GET" && pathname.startsWith("/files/")) {
    const token = authenticate(req);
    if (!token) {
      res.writeHead(401, {
        "content-type": "application/json",
      });
      return res.end(
        JSON.stringify({
          message: "Invalid or Expired token",
        }),
      );
    }
    const fileName = `${pathname.split("/")[2]}.txt`;
    console.log(fileName);

    const filePath = `../uploads/${fileName}`;

    fs.readdir("../uploads", (err, files) => {
      if (err) {
        res.writeHead(500, {
          "content-type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Unable to read the folder",
          }),
        );
      }

      const f = files.find((f) => f === fileName);

      if (!f) {
        res.writeHead(404, {
          "content-type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "File Not found",
          }),
        );
      }

      const readStream = fs.createReadStream(filePath);

      readStream.on("error", (err) => {
        console.error(err);

        res.writeHead(404, {
          "Content-Type": "application/json",
        });

        res.end(
          JSON.stringify({
            message: "File not found",
          }),
        );
      });

      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      });

      readStream.pipe(res);
    });
  }
  //DELETE - /files/:fileName (to delete particular file)
  else if (method === "DELETE" && pathname.startsWith("/files/")) {
    const token = authenticate(req);
    if (!token) {
      res.writeHead(401, {
        "content-type": "application/json",
      });
      return res.end(
        JSON.stringify({
          message: "Invalid or Expired token",
        }),
      );
    }
    const fileName = `${pathname.split("/")[2]}.txt`;
    const filePath = `../uploads/${fileName}`;
    fs.readdir("../uploads", (err, files) => {
      if (err) {
        res.writeHead(500, {
          "content-type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Unable to read the folder",
          }),
        );
      }
      const f = files.find((f) => f === fileName);

      if (!f) {
        res.writeHead(404, {
          "content-type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "File Not found",
          }),
        );
      }

      fs.unlink(filePath, (err) => {
        if (err) {
          console.log(err);
          res.writeHead(500, {
            "content-type": "application/json",
          });
          return res.end(
            JSON.stringify({
              message: "unable to delete file",
            }),
          );
        }
        res.writeHead(200, {
          "content-type": "application/json",
        });
        return res.end(
          JSON.stringify({
            message: "successfully deleted the file",
          }),
        );
      });
    });
  } else {
    res.writeHead(404, {
      "Content-Type": "text/plain",
    });

    return res.end("Route not found");
  }
});

function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    return verified;
  } catch (err) {
    return null;
  }
}

server.listen(process.env.PORT_NO, () => {
  console.log(`Server running on port ${process.env.PORT_NO}`);
});

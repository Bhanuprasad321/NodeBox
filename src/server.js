require("dotenv").config({ path: "../.env" });

const fs = require("fs");
const http = require("http");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

http
  .createServer((req, res) => {
    const method = req.method;
    const url = req.url;

    const parsedUrl = new URL(url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    if (method === "GET" && pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(`This is a ${method} ${pathname} Request!`);
    } else if (method === "POST" && pathname === "/register") {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          // 1. Convert JSON string into JavaScript object
          const data = JSON.parse(body);

          // 2. Validate input
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

          // 3. Read existing users
          fs.readFile("../data/users.json", "utf8", (err, fileData) => {
            if (err) {
              console.error(err);

              res.writeHead(500, {
                "Content-Type": "application/json",
              });

              return res.end(
                JSON.stringify({
                  message: "Unable to read users file",
                }),
              );
            }

            try {
              // 4. Convert file content into JavaScript array
              const users = JSON.parse(fileData);

              // 5. Check duplicate email
              const existingUser = users.find(
                (user) => user.email === data.email,
              );

              if (existingUser) {
                res.writeHead(409, {
                  "Content-Type": "application/json",
                });

                return res.end(
                  JSON.stringify({
                    message: "Email already registered",
                  }),
                );
              }

              // 6. Generate ID
              const newId =
                users.length > 0 ? users[users.length - 1].id + 1 : 1;

              // 7. Hash password
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

                // 8. Create new user
                const newUser = {
                  id: newId,
                  name: data.name,
                  email: data.email,
                  password: hashedPassword,
                };

                // 9. Add user to array
                users.push(newUser);

                // 10. Save users
                fs.writeFile(
                  "../data/users.json",
                  JSON.stringify(users, null, 2),
                  (err) => {
                    if (err) {
                      console.error(err);

                      res.writeHead(500, {
                        "Content-Type": "application/json",
                      });

                      return res.end(
                        JSON.stringify({
                          message: "Unable to save user",
                        }),
                      );
                    }

                    // 11. Send response
                    res.writeHead(201, {
                      "Content-Type": "application/json",
                    });

                    res.end(
                      JSON.stringify({
                        message: "User registered successfully",
                        user: {
                          id: newUser.id,
                          name: newUser.name,
                          email: newUser.email,
                        },
                      }),
                    );
                  },
                );
              });
            } catch (err) {
              res.writeHead(500, {
                "Content-Type": "application/json",
              });

              return res.end(
                JSON.stringify({
                  message: "Invalid users file",
                }),
              );
            }
          });
        } catch (err) {
          // Invalid JSON received from client
          res.writeHead(400, {
            "Content-Type": "application/json",
          });

          res.end(
            JSON.stringify({
              message: "Invalid JSON",
            }),
          );
        }
      });
    } else if (method === "POST" && pathname === "/login") {
      let loginData = "";
      req.on("data", (chunk) => {
        loginData += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const loginCred = JSON.parse(loginData);

          if (!loginCred.email || !loginCred.password) {
            res.writeHead(400, {
              "content-type": "application/json",
            });
            return res.end(
              JSON.stringify({ message: "Invalid Email or Password" }),
            );
          }

          fs.readFile("../data/users.json", "utf8", (err, data) => {
            if (err) {
              res.writeHead(500, {
                "content-type": "application/json",
              });
              return res.end(
                JSON.stringify({ message: "Unable to read the users data" }),
              );
            }
            try {
              const users = JSON.parse(data);
              const existingUser = users.find(
                (u) => u.email === loginCred.email,
              );
              if (!existingUser) {
                res.writeHead(401, {
                  "content-type": "application/json",
                });
                return res.end(
                  JSON.stringify({ message: "User with email not found" }),
                );
              }

              bcrypt.compare(
                loginCred.password,
                existingUser.password,
                (err, isMatch) => {
                  if (isMatch) {
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
                      "content-type": "application/json",
                    });

                    return res.end(
                      JSON.stringify({
                        message: "Login successful",
                        token: token,
                      }),
                    );
                  } else {
                    res.writeHead(400, {
                      "content-type": "application/json",
                    });
                    return res.end(
                      JSON.stringify({ message: "Wrong Password" }),
                    );
                  }
                },
              );
            } catch (err) {
              res.writeHead(500, {
                "content-type": "application/json",
              });
              return res.end(
                JSON.stringify({ message: "unable to get the users data" }),
              );
            }
          });
        } catch (err) {
          console.log(err);
          res.writeHead(400, {
            "content-type": "application/json",
          });
          return res.end(
            JSON.stringify({ message: "unable to get the login credentials" }),
          );
        }
      });
    } else if (method === "GET" && pathname === "/profile") {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.writeHead(401, {
          "content-type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Authorization header missing",
          }),
        );
      }

      const token = authHeader.split(" ")[1];

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        fs.readFile("../data/users.json", "utf8", (err, data) => {
          if (err) {
            res.writeHead(500, {
              "content-type": "application/json",
            });

            return res.end(
              JSON.stringify({
                message: "Unable to read users data",
              }),
            );
          }

          const users = JSON.parse(data);

          const user = users.find((u) => u.id === decoded.id);

          if (!user) {
            res.writeHead(404, {
              "content-type": "application/json",
            });

            return res.end(
              JSON.stringify({
                message: "User not found",
              }),
            );
          }

          res.writeHead(200, {
            "content-type": "application/json",
          });

          return res.end(
            JSON.stringify({
              id: user.id,
              name: user.name,
              email: user.email,
            }),
          );
        });
      } catch (err) {
        res.writeHead(401, {
          "content-type": "application/json",
        });

        return res.end(
          JSON.stringify({
            message: "Invalid or expired token",
          }),
        );
      }
    } else if (method === "PUT" && pathname.startsWith("/users/")) {
      const id = parseInt(pathname.split("/")[2]);
      //for updating we will send some data
      //we need to use req.on
      let updateData = "";
      req.on("data", (chunk) => {
        updateData += chunk.toString();
      });
      req.on("end", async () => {
        //get the user data
        fs.readFile("../data/users.json", (err, data) => {
          if (err) {
            console.log(err);
            res.writeHead(500, {
              "content-type": "application/json",
            });
            return res.end(
              JSON.stringify({
                message: "Unable to read users file",
              }),
            );
          }
          try {
            const users = JSON.parse(data);
            const updateD = JSON.parse(updateData);

            const user = users.find((u) => u.id === id);
            if (!user) {
              res.writeHead(404, {
                "content-type": "application/json",
              });
              return res.end(
                JSON.stringify({
                  message: "Unable to find the user",
                }),
              );
            }
            if (updateD.name || updateD.email) {
              if (updateD.name) {
                user.name = updateD.name;
              }

              if (updateD.email) {
                user.email = updateD.email;
              }
            } else {
              res.writeHead(400, {
                "content-type": "application/json",
              });
              return res.end(
                JSON.stringify({
                  message: "Enter Valid Name and Email",
                }),
              );
            }
            fs.writeFile(
              "../data/users.json",
              JSON.stringify(users, null, 2),
              (err) => {
                if (err) {
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

                // 8. Send response
                res.writeHead(200, {
                  "Content-Type": "application/json",
                });

                res.end(
                  JSON.stringify({
                    message: "User data updated",
                    user: user,
                  }),
                );
              },
            );
          } catch (err) {
            res.writeHead(500, {
              "content-type": "application/json",
            });
            return res.end(
              JSON.stringify({
                message: err,
              }),
            );
          }
        });
      });
    } else if (method === "GET" && pathname === "/users") {
      fs.readFile("../data/users.json", "utf8", (err, data) => {
        if (err) {
          console.log(err);

          res.writeHead(500, {
            "content-type": "application/json",
          });
          return res.end(
            JSON.stringify({
              message: "Unable to read users file",
            }),
          );
        }

        try {
          const users = JSON.parse(data);

          res.writeHead(200, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "All users data",
              users: users,
            }),
          );
        } catch (err) {
          console.error(err);

          res.writeHead(500, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "Invalid users file",
            }),
          );
        }
      });
    } else if (method === "POST" && pathname === "/users") {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          // 1. Convert JSON string into JavaScript object
          const data = JSON.parse(body);

          // 2. Validate user
          const user = await createUser(data);

          // 3. Read users.json
          fs.readFile("../data/users.json", "utf8", (err, txt) => {
            if (err) {
              console.error(err);

              res.writeHead(500, {
                "Content-Type": "application/json",
              });

              return res.end(
                JSON.stringify({
                  message: "Unable to read users file",
                }),
              );
            }

            try {
              // 4. Convert file content into JavaScript array
              const users = JSON.parse(txt);

              // 5. Generate ID
              const newId = users[users.length - 1].id;
              const newUser = {
                id: newId + 1,
                ...user,
              };

              // 6. Add user to array
              users.push(newUser);

              // 7. Write updated array back to file
              fs.writeFile(
                "../data/users.json",
                JSON.stringify(users, null, 2),
                (err) => {
                  if (err) {
                    console.error(err);

                    res.writeHead(500, {
                      "Content-Type": "application/json",
                    });

                    return res.end(
                      JSON.stringify({
                        message: "Unable to save user",
                      }),
                    );
                  }

                  // 8. Send response
                  res.writeHead(201, {
                    "Content-Type": "application/json",
                  });

                  res.end(
                    JSON.stringify({
                      message: "User created",
                      user: newUser,
                    }),
                  );
                },
              );
            } catch (err) {
              res.writeHead(500, {
                "Content-Type": "application/json",
              });

              res.end(
                JSON.stringify({
                  message: "Invalid users file",
                }),
              );
            }
          });
        } catch (err) {
          res.writeHead(400, {
            "Content-Type": "application/json",
          });

          res.end(
            JSON.stringify({
              message: err.message,
            }),
          );
        }
      });
    } else if (method === "GET" && pathname.startsWith("/users/")) {
      const id = parseInt(pathname.split("/")[2]);

      fs.readFile("../data/users.json", "utf8", (err, txt) => {
        if (err) {
          console.error(err);

          res.writeHead(500, {
            "Content-Type": "application/json",
          });

          return res.end(
            JSON.stringify({
              message: "Unable to read users file",
            }),
          );
        }

        try {
          const users = JSON.parse(txt);

          const user = users.find((user) => user.id === id);

          if (!user) {
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

          res.end(
            JSON.stringify({
              message: "User found",
              user: user,
            }),
          );
        } catch (err) {
          console.error(err);

          res.writeHead(500, {
            "Content-Type": "application/json",
          });

          res.end(
            JSON.stringify({
              message: "Invalid users file",
            }),
          );
        }
      });
    } else if (method === "DELETE" && pathname.startsWith("/users/")) {
      const id = parseInt(pathname.split("/")[2]);
      fs.readFile("../data/users.json", "utf8", (err, data) => {
        if (err) {
          console.log(err);
          res.writeHead(500, {
            "content-type": "application/json",
          });
          return res.end(
            JSON.stringify({
              message: "Unable to read the JSON file.",
            }),
          );
        }

        try {
          const users = JSON.parse(data);
          const updateUsers = users.filter((user) => user.id !== id);
          fs.writeFile(
            "../data/users.json",
            JSON.stringify(updateUsers, null, 2),
            (err) => {
              if (err) {
                console.error(err);

                res.writeHead(500, {
                  "Content-Type": "application/json",
                });

                return res.end(
                  JSON.stringify({
                    message: "Unable to save user",
                  }),
                );
              }
              res.writeHead(200, {
                "content-type": "application/json",
              });
              return res.end(
                JSON.stringify({
                  message: "Successfully deleted the user",
                }),
              );
            },
          );
        } catch (err) {
          res.writeHead(500, {
            "content-type": "text/plain",
          });
          return res.end(`ERROR: ${err}`);
        }
      });
    } else {
      res.writeHead(404, {
        "Content-Type": "text/plain",
      });

      res.end("Route not found");
    }
  })
  .listen(process.env.PORT_NO);

// User validation
function createUser(user) {
  return new Promise((resolve, reject) => {
    if (user.name && user.email) {
      resolve(user);
    } else {
      reject(new Error("Name and email are required"));
    }
  });
}

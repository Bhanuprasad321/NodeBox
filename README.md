# NodeBox

NodeBox is a small backend project I built to learn and practice Node.js by building something close to a real application.

It works like a simple file storage system where users can register, log in, upload files, view their files, download them, and delete them.

The project currently stores files locally on the server and uses MySQL to store user and file information.

## What I Used

- Node.js
- HTTP module
- MySQL
- mysql2
- bcrypt
- JSON Web Tokens (JWT)
- File System (`fs`)
- Buffers
- Streams

## What I Learned From This Project

This project helped me understand how Node.js works without depending on Express.

Some of the main things I practiced:

- Creating an HTTP server using Node's `http` module
- Handling different HTTP methods and routes
- Reading request bodies
- Working with JSON data
- Connecting Node.js with MySQL
- Writing SQL queries from Node.js
- Password hashing using bcrypt
- User login and password verification
- Creating and verifying JWT tokens
- Protecting routes using authentication
- Reading request data in chunks
- Working with Buffers
- Uploading files using `fs.writeFile`
- Reading files using Streams
- Downloading files using `createReadStream()`
- Deleting files using `fs.unlink`
- Connecting file ownership with users in MySQL

## Features

### User Authentication

- User registration
- Password hashing
- User login
- JWT authentication
- Protected profile route

### File Management

- Upload a file
- List files uploaded by the logged-in user
- Download a file
- Delete a file
- Check file ownership before downloading or deleting

### Database

MySQL is used to store:

- User information
- File information
- File ownership

The actual uploaded files are stored locally in the `uploads` folder.

## API Routes

### Authentication

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/register` | Register a new user |
| POST | `/login` | Login and receive a JWT token |
| GET | `/profile` | Get the logged-in user's profile |

### Users

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/users` | Get all users |
| GET | `/users/:id` | Get a user by ID |
| PUT | `/users/:id` | Update user details |
| DELETE | `/users/:id` | Delete a user |

### Files

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/upload` | Upload a file |
| GET | `/files` | Get files belonging to the logged-in user |
| GET | `/files/:id` | Download a file |
| DELETE | `/files/:id` | Delete a file |

File routes require a valid JWT token.

## How File Upload Works

The upload flow is kept simple:

1. User logs in and gets a JWT token.
2. The token is sent with the upload request.
3. Node.js receives the file data in chunks.
4. The chunks are combined into a Buffer.
5. The Buffer is written to the `uploads` folder.
6. File details and ownership are stored in MySQL.

For downloads, the file is read using a Node.js Read Stream and sent to the client.

## Project Structure

```text
NodeBox/
│
├── config/
│   └── db.js
│
├── uploads/
│
├── src/
│   └── server.js
│
├── .env
├── .gitignore
├── package.json
└── README.md
```
Sure — here is the **exact section in one plain text box**, so you can copy-paste it directly into your `README.md` without the formatting getting messed up.


The exact folder structure may vary depending on the current project setup.

## Setup

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd NodeBox
````

### 2. Install dependencies

```bash
npm install
```

### 3. Create the MySQL database

Create a database named `nodebox` and create the required tables.

Example:

```sql
CREATE DATABASE nodebox;

USE nodebox;

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE files (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    file_name VARCHAR(256) NOT NULL,
    file_path VARCHAR(256) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 4. Configure environment variables

Create a `.env` file with your database details and JWT secret.

```env
PORT_NO=3000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=nodebox

JWT_SECRET=your_secret_key
```

Do not upload your `.env` file to GitHub.

### 5. Start the server

```bash
node src/server.js
```

The server should start on the port configured in `.env`.

## Testing

I tested the main flow using Postman:

```text
Register
   ↓
Login
   ↓
Get Profile
   ↓
Upload File
   ↓
List Files
   ↓
Download File
   ↓
Delete File
```

Protected routes are tested using the JWT token received from the login API.

## Current Limitations

This is a learning project, so it is not a real cloud storage service yet.

Currently:

* Files are stored on the local server.
* Uploaded files are stored as `.txt` files.
* There is no frontend.
* There is no actual cloud storage such as Amazon S3.
* File upload does not use `multipart/form-data`.

These are possible areas for future improvement.

## Why I Built This

I built NodeBox mainly to revise Node.js by implementing the concepts instead of just studying them theoretically.

While building it, I practiced things like HTTP servers, routing, MySQL, authentication, JWT, Buffers, Streams, and file handling in a single project.

The goal was to use NodeBox as a practical revision project and get a better understanding of how these Node.js concepts work together.

## Author

**Bhanu Prasad**

B.Tech - Electronics and Communication Engineering


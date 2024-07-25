const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const { error } = require("console");

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "362514Kmo.",
  database: "farmer",
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err.stack);
    return;
  }
  console.log("Connected to database");
});

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/"); // Uploads will be stored in the 'uploads' directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Rename file with current timestamp + original extension
  },
});

// Multer upload configuration
const upload = multer({ storage: storage });

// Route for inserting a new user with image upload
app.post("/api/users", upload.single("img"), (req, res) => {
  const { username, email, role, password, dob, address, gender } = req.body;

  // Handle image upload
  const img = req.file ? req.file.path : null;

  // Format dob from string to Date object
  const formattedDob = new Date(dob);

  // Ensure formattedDob is a valid Date
  if (isNaN(formattedDob.getTime())) {
    res.status(400).json({ error: "Invalid date format for Date of Birth" });
    return;
  }

  // Format the user object to match your database schema
  const newUser = {
    username,
    email,
    Role: role,
    password,
    Dob: formattedDob.toISOString().slice(0, 19).replace("T", " "),
    address,
    gender,
    img,
  };

  // Insert into the 'user' table
  db.query("INSERT INTO user SET ?", newUser, (err, results) => {
    if (err) {
      console.error("Error inserting user:", err);
      res.status(500).send(err);
    } else {
      console.log("User added successfully:", results);
      res
        .status(201)
        .json({ message: "User added successfully", user: newUser });
    }
  });
});

app.post("/api/admin", async (req, res) => {
  const { username, email, password, gender } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10); // Hash password
    const newAdmin = { username, email, password: hashedPassword, gender };

    // Insert into database
    db.query("INSERT INTO admin SET ?", newAdmin, (err, results) => {
      if (err) {
        console.error("Error inserting admin:", err);
        res.status(500).json({ error: "Failed to add admin" });
        return;
      }
      console.log("Admin added successfully:", results);
      res
        .status(201)
        .json({ message: "Admin added successfully", admin: newAdmin });
    });
  } catch (error) {
    console.error("Error hashing password:", error);
    res.status(500).json({ error: "Failed to hash password" });
  }
});

// admin login

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const sql = "SELECT * FROM admin WHERE username = ?";
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    const user = results[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error("Error comparing passwords:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      res.json({ message: "Login successful", user });
    });
  });
});

// Login user
app.post("/api/users/login", (req, res) => {
  const { username, password } = req.body;
  const sql = "SELECT * FROM user WHERE username = ?";

  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = results[0];
    const storedPassword = user.password;
    if (storedPassword !== password) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    res.json({ message: "Login successful", user });
  });
});

//add youtube video
app.post("/api/videos", (req, res) => {
  const { title, url } = req.body;
  const sql = "INSERT INTO videos (title, url) VALUES (?, ?)";
  db.query(sql, [title, url], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json({ message: "Video added successfully" });
  });
});

// get videos
app.get("/api/videos/get", (req, res) => {
  const sql = "SELECT * FROM videos";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json(results);
  });
});

//get users
app.get("/api/users/get", (req, res) => {
  const sql = "SELECT * FROM user";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json(results);
  });
});
// delete users
app.delete("/api/users/delete/:id", (req, res) => {
  const id = req.params.id;
  const sql = "DELETE FROM user WHERE id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  });
});

// edit user
app.put("/api/users/edit/:id", (req, res) => {
  const id = req.params.id;
  const { name, email, password } = req.body;
  const sql = "UPDATE user SET name = ?, email = ?, password = ? WHERE id = ?";

  db.query(sql, [name, email, password, id], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "User updated successfully" });
  });
});
// artical

app.post("/api/articles", upload.single("img"), (req, res) => {
  const { title, description, date, category, writer } = req.body;
  const image = req.file ? req.file.filename : null;
  const query =
    "INSERT INTO articles (title, description, image, date, category, writer) VALUES (?, ?, ?, ?, ?, ?)";

  db.query(
    query,
    [title, description, image, date, category, writer],
    (err, result) => {
      if (err) {
        res
          .status(500)
          .json({ message: "Error creating article", error: err.message });
        return;
      }
      res
        .status(201)
        .json({
          message: "Article created successfully",
          articleId: result.insertId,
        });
    }
  );
});

// Define the path to the uploads directory
const uploadsDir = path.join(__dirname, "uploads");

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route to get articles
app.get("/api/articles/get", (req, res) => {
  const sql = "SELECT * FROM articles";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "No articles found" });
    }

    // Append the image URL to each article object
    results.forEach((article) => {
      article.imageUrl = `http://localhost:3000/uploads?filename=${article.image}`;
    });

    res.json(results);
  });
});

// Route for serving image files
app.get("/uploads", (req, res) => {
  const filename = req.query.filename;
  const filePath = path.join(uploadsDir, filename);

  // Check if the file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(`File not found: ${filePath}`);
      return res.status(404).send("File not found");
    }

    // Send the file
    res.sendFile(filePath);
  });
});

//delete article
app.delete("/api/articles/delete/:id", (req, res) => {
  const id = req.params.id;
  const sql = "DELETE FROM articles WHERE id=?";
  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "No article found" });
    }
    res.json({ message: "Article deleted" });
  });
});

//edit article
app.put("/api/articles/edit/:id", (req, res) => {
  const id = req.params.id;
  const { title, description, image } = req.body;
  const sql = "UPDATE articles SET title=?, description=?, image=? WHERE id=?";
  db.query(sql, [title, content, image, id], (err, results) =>
    {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Internal server error" });
        }
        if (results.affectedRows === 0) {
          return res.status(404).json({ error: "No article found" });
          }
          res.json({ message: "Article updated" });
          }
          );
          });
//delete videos
app.delete("/api/videos/delete/:id", (req, res) => {
  const id = req.params.id;
  const sql = "DELETE FROM videos WHERE id=?";
  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "No video found" });
        }
        res.json({ message: "Video deleted" });
        });
        });
        //edit videos
        app.put("/api/videos/edit/:id", (req, res) => {
          const id = req.params.id;
          const { title, description, image } = req.body;
        
          // Validate input data
          if (!title || !description || !image) {
            return res.status(400).json({ error: "Missing required fields" });
          }
        
          // SQL query to update the video
          const sql = "UPDATE videos SET title=?, description=?, image=? WHERE id=?";
          db.query(sql, [title, description, image, id], (err, results) => {
            if (err) {
              console.error("Database error:", err);
              return res.status(500).json({ error: "Internal server error" });
            }
        
            if (results.affectedRows === 0) {
              return res.status(404).json({ error: "No video found with the given ID" });
            }
        
            res.json({ message: "Video updated successfully" });
          });
        });
        



// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

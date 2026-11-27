const express = require("express"); 
const path = require("path"); 
const sqlite3 = require("sqlite3").verbose(); 
const bcrypt = require("bcrypt"); 
 
const app = express(); 
const PORT = 3000; 
 
// ================================ 
// MIDDLEWARE 
// ================================ 
 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
 
app.use(express.static(path.join(__dirname, "public"))); 
 
 
// ================================ 
// DATABASE 
// ================================ 
 
const db = new sqlite3.Database("./StudentHub.db", (err) => { 
    if (err) { 
        console.error("Database error:", err.message); 
    } else { 
        console.log("Connected to StudentHub database."); 
    } 
}); 
 
 
db.serialize(() => { 
 
    // USERS 
    db.run(` 
        CREATE TABLE IF NOT EXISTS users ( 
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            name TEXT NOT NULL, 
            email TEXT UNIQUE NOT NULL , 
            password TEXT NOT NULL, 
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP 
        ) 
    `); 
 
 
    // ASSIGNMENTS 
    db.run(` 
        CREATE TABLE IF NOT EXISTS assignments ( 
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            user_id INTEGER NOT NULL, 
            title TEXT NOT NULL, 
            subject TEXT, 
            description TEXT,
            due_date TEXT, 
            completed INTEGER DEFAULT 0, 
            FOREIGN KEY (user_id) REFERENCES users(id) 
        ) 
    `); 
 
 
    // TIMETABLE 
    db.run(` 
        CREATE TABLE IF NOT EXISTS timetable ( 
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            user_id INTEGER NOT NULL, 
            subject TEXT NOT NULL, 
            day TEXT NOT NULL, 
            start_time TEXT, 
            end_time TEXT, 
            FOREIGN KEY (user_id) REFERENCES users(id) 
        ) 
    `); 
 
 
    // QUIZ SCORES 
    db.run(` 
        CREATE TABLE IF NOT EXISTS quiz_scores ( 
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            user_id INTEGER NOT NULL, 
            quiz_name TEXT NOT NULL, 
            score INTEGER NOT NULL, 
            total INTEGER NOT NULL, 
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
            FOREIGN KEY (user_id) REFERENCES users(id) 
        ) 
    `); 
 
 
    console.log("StudentHub database tables are ready."); 
 
}); 
 
 
// ================================ 
// SIMPLE LOGIN SESSIONS 
// ================================ 
 
const sessions = new Map(); 
 
 
function createToken() { 
 
    return ( 
        Math.random().toString(36).substring(2) + 
        Date.now().toString(36) 
    ); 
 
} 
 
 
function authenticate(req, res, next) { 
 
    const authHeader = 
        req.headers.authorization || ""; 
 
    const token = 
        authHeader.replace("Bearer ", ""); 
 
 
    if (!token || !sessions.has(token)) { 
 
        return res.status(401).json({ 
 
            success: false, 
 
            message: "Please log in first." 
 
        }); 
 
    } 
 
 
    req.user = sessions.get(token); 
 
    next(); 
 
} 
 
 
// ================================ 
// HOME PAGE 
// ================================ 
 
app.get("/", (req, res) => { 
 
    res.sendFile( 
        path.join(__dirname, "public", "index.html") 
    ); 
 
}); 
 
 
// ================================ 
// REGISTER 
// ================================ 
 
app.post("/api/register", async (req, res) => { 
 
    const { 
        name, 
        email, 
        password 
    } = req.body; 
 
 
    if (!name || !email || !password) { 
 
        return res.status(400).json({ 
 
            success: false, 
 
            message: "Please fill in all fields." 
 
        }); 
 
    } 
 
 
    if (password.length < 6) { 
 
        return res.status(400).json({ 
 
            success: false, 
 
            message: "Password must be at least 6 characters." 
 
        }); 
 
    } 
 
 
    try { 
 
        const hashedPassword = 
            await bcrypt.hash(password, 10); 
 
 
        const sql = ` 
            INSERT INTO users 
            (name, email, password) 
            VALUES (?, ?, ?) 
        `; 
 
 
        db.run( 
            sql, 
            [ 
                name, 
                email.toLowerCase(), 
                hashedPassword 
            ], 
            function(err) { 
 
                if (err) { 
 
                    if (err.message.includes("UNIQUE")) { 
 
                        return res.status(400).json({ 
 
                            success: false, 
 
                            message: 
                                "An account with that email already exists." 
 
                        }); 
 
                    } 
 
 
                    console.error(err); 
 
 
                    return res.status(500).json({ 
 
                        success: false, 
 
                        message: "Could not create account." 
 
                    }); 
 
                } 
 
 
                res.json({ 
 
                    success: true, 
 
                    message: 
                        "Account created successfully!", 
 
                    userId: this.lastID 
 
                }); 
 
            } 
        ); 
 
    } 
 
    catch (error) { 
 
        console.error(error); 
 
 
        res.status(500).json({ 
 
            success: false, 
 
            message: "Registration failed." 
 
        }); 
 
    } 
 
}); 
 
 
// ================================ 
// LOGIN 
// ================================ 
 
app.post("/api/login", (req, res) => { 
 
    const { 
        email, 
        password 
    } = req.body; 
 
 
    if (!email || !password) { 
 
        return res.status(400).json({ 
 
            success: false, 
 
            message: 
                "Email and password are required." 
 
        }); 
 
    } 
 
 
    db.get( 
 
        `SELECT * FROM users WHERE email = ?`, 
 
        [email.toLowerCase()], 
 
        async (err, user) => { 
 
            if (err) { 
 
                console.error(err); 
 
 
                return res.status(500).json({ 
 
                    success: false, 
 
                    message: "Database error." 
 
                }); 
 
            } 
 
 
            if (!user) { 
 
                return res.status(401).json({ 
 
                    success: false, 
 
                    message:  
                        "Invalid email or password." 
 
                }); 
 
            } 
 
 
            try { 
 
                const passwordCorrect = 
                    await bcrypt.compare( 
                        password, 
                        user.password 
                    ); 
 
 
                if (!passwordCorrect) { 
 
                    return res.status(401).json({ 
 
                        success: false, 
 
                        message: 
                            "Invalid email or password." 
 
                    }); 
 
                } 
 
 
                const token = createToken(); 
 
 
                sessions.set(token, { 
 
                    id: user.id, 
 
                    name: user.name, 
 
                    email: user.email 
 
                }); 
 
 
                res.json({ 
 
                    success: true, 
 
                    message: "Login successful!", 
 
                    token: token, 
 
                    user: { 
 
                        id: user.id, 
 
                        name: user.name, 
 
                        email: user.email 
 
                    } 
 
                }); 
 
            } 
 
            catch (error) { 
 
                console.error(error); 
 
 
                res.status(500).json({ 
 
                    success: false, 
 
                    message: "Login failed." 
 
                }); 
 
            } 
 
        } 
 
    ); 
 
}); 
 
 
// ================================ 
// LOGOUT 
// ================================ 
 
app.post( 
    "/api/logout", 
    authenticate, 
    (req, res) => { 
 
        const token = 
            req.headers.authorization 
                ?.replace("Bearer ", ""); 
 
 
        sessions.delete(token); 
 
 
        res.json({ 
 
            success: true, 
 
            message: "Logged out successfully." 
 
        }); 
 
    } 
); 
 
 
// ================================ 
// CURRENT USER 
// ================================ 
 
app.get( 
    "/api/me", 
    authenticate, 
    (req, res) => { 
 
        res.json({ 
 
            success: true, 
 
            user: req.user 
 
        }); 
 
    } 
); 
 
 
// ================================ 
// DASHBOARD 
// ================================ 
 
app.get( 
    "/api/dashboard", 
    authenticate, 
    (req, res) => { 
 
        const userId = req.user.id; 
 
 
        db.get( 
 
            ` 
            SELECT 
 
            ( 
                SELECT COUNT(*) 
                FROM assignments 
                WHERE user_id = ? 
                AND completed = 0 
            ) AS pendingAssignments, 
 
            ( 
                SELECT COUNT(*) 
                FROM assignments 
                WHERE user_id = ? 
                AND completed = 1 
            ) AS completedAssignments, 
 
            ( 
                SELECT COUNT(*) 
                FROM timetable 
                WHERE user_id = ? 
            ) AS timetableCount, 
 
            ( 
                SELECT COUNT(*) 
                FROM quiz_scores 
                WHERE user_id = ? 
            ) AS quizCount 
            `, 
 
            [ 
                userId, 
                userId, 
                userId, 
                userId 
            ], 
 
            (err, stats) => { 
 
                if (err) { 
 
                    console.error(err); 
 
 
                    return res.status(500).json({ 
 
                        success: false, 
 
                        message: 
                            "Could not load dashboard." 
 
                    }); 
 
                } 
 
 
                res.json({ 
 
                    success: true, 
 
                    student: req.user, 
 
                    statistics: stats 
 
                }); 
 
            } 
 
        ); 
 
    } 
); 
 
 
// ================================ 
// ASSIGNMENTS 
// ================================ 
 
// GET ASSIGNMENTS 
 
app.get( 
    "/api/assignments", 
    authenticate, 
    (req, res) => { 
 
        db.all( 
 
            ` 
            SELECT * 
            FROM assignments 
            WHERE user_id = ? 
            ORDER BY due_date ASC 
            `, 
 
            [req.user.id], 
 
            (err, assignments) => { 
 
                if (err) { 
 
                    console.error(err); 
 
 
                    return res.status(500).json({ 
 
                        success: false, 
 
                        message: 
                            "Could not load assignments." 
 
                    }); 
 
                } 
 
 
                res.json({ 
 
                    success: true, 
 
                    assignments: assignments 
 
                }); 
 
            } 
 
        ); 
 
    } 
); 
 
 
// ADD ASSIGNMENT 
 
app.post( 
    "/api/assignments", 
    authenticate, 
    (req, res) => { 
 
        const { 
            title, 
            subject, 
            due_date 
        } = req.body; 
 
 
        if (!title) { 
 
            return res.status(400).json({ 
 
                success: false, 
 
                message: 
                    "Assignment title is required." 
 
            }); 
 
        } 
 
 
        db.run( 
 
            ` 
            INSERT INTO assignments 
            (user_id, title, subject, due_date) 
            VALUES (?, ?, ?, ?) 
            `, 
 
            [ 
                req.user.id, 
                title, 
                subject || "", 
                due_date || "" 
            ], 
 
            function(err) { 
 
                if (err) { 
 
                    console.error(err); 
 
 
                    return res.status(500).json({ 
 
                        success: false, 
 
                        message: 
                            "Could not add assignment." 
 
                    }); 
 
                } 
 
 
                res.json({ 
 
                    success: true, 
 
                    message: 
                        "Assignment added!", 
 
                    assignmentId: 
                        this.lastID 
 
                }); 
 
            } 
 
        ); 
 
    } 
); 
 
 
// COMPLETE ASSIGNMENT 
 
app.put( 
    "/api/assignments/:id/complete", 
    authenticate, 
    (req, res) => { 
 
        db.run( 
 
            ` 
            UPDATE assignments 
            SET completed = 1 
            WHERE id = ? 
            AND user_id = ? 
            `, 
 
            [ 
                req.params.id, 
                req.user.id 
            ], 
 
            function(err) { 
 
                if (err) { 
 
                    console.error(err); 
 
 
                    return res.status(500).json({ 
 
                        success: false, 
 
                        message: 
                            "Could not update assignment." 
 
                    }); 
 
                } 
 
 
                res.json({ 
 
                    success: true, 
 
                    message: 
                        "Assignment completed!" 
 
                }); 
 
            } 
 
        ); 
 
    } 
); 
 
 
// DELETE ASSIGNMENT 
 
app.delete( 
    "/api/assignments/:id", 
    authenticate, 
    (req, res) => { 
 
        db.run( 
 
            ` 
            DELETE FROM assignments 
            WHERE id = ? 
            AND user_id = ? 
            `, 
 
            [ 
                req.params.id, 
                req.user.id 
            ], 
 
            function(err) { 
 
                if (err) { 
 
                    console.error(err); 
 
 
                    return res.status(500).json({ 
 
                        success: false, 
 
                        message: 
                            "Could not delete assignment." 
 
                    }); 
 
                } 
 
 
                res.json({ 
 
                    success: true, 
 
                    message: 
                        "Assignment deleted." 
 
                }); 
 
            } 
 
        ); 
 
    } 
); 
 
 
// ================================ 
// TIMETABLE 
// ================================ 
 
// GET TIMETABLE 
 
app.get( 
    "/api/timetable", 
    authenticate, 
    (req, res) => { 
 
        db.all( 
 
            ` 
            SELECT * 
            FROM timetable 
            WHERE user_id = ? 
            ORDER BY day, start_time 
            `, 
 
            [req.user.id], 
 
            (err, timetable) => { 
 
                if (err) { 
 
                    console.error(err); 
 
 
                    return res.status(500).json({ 
 
                        success: false, 
 
                        message: 
                            "Could not load timetable." 
 
                    }); 
 
                } 
 
 
                res.json({ 
 
                    success: true, 
 
                    timetable: timetable 
 
                }); 
 
            } 
 
        ); 
 
    } 
); 
 
 
// ADD TIMETABLE 
 
app.post( 
    "/api/timetable", 
    authenticate, 
    (req, res) => { 
 
        const { 
            subject, 
            day, 
            start_time, 
            end_time 
        } = req.body; 
 
 
        if (!subject || !day) { 
 
            return res.status(400).json({ 
 
                success: false, 
 
                message: 
                    "Subject and day are required." 
 
            }); 
 
        } 
 
 
        db.run( 
 
            ` 
            INSERT INTO timetable 
            (user_id, subject, day, start_time, end_time) 
            VALUES (?, ?, ?, ?, ?) 
            `, 
 
            [ 
                req.user.id, 
                subject, 
                day, 
                start_time || "", 
                end_time || "" 
            ], 
 
            function(err) { 
 
                if (err) { 
 
                    console.error(err); 
 
 
                    return res.status(500).json({ 
 
                        success: false, 
 
                        message: 
                            "Could not add timetable entry." 
 
                    }); 
 
                } 
 
 
                res.json({ 
 
                    success: true, 
 
                    message: 
                        "Timetable updated!", 
 
                    timetableId: 
                        this.lastID 
 
                }); 
 
            } 
 
        ); 
 
    } 
); 
 
 
// ================================ 
// QUIZ SCORES 
// ================================ 
 
// SAVE QUIZ SCORE 
 
app.post( 
    "/api/quiz-scores", 
    authenticate, 
    (req, res) => { 
 
        const { 
            quiz_name, 
            score, 
            total 
        } = req.body; 
 
 
        if ( 
            !quiz_name || 
            score === undefined || 
            !total 
        ) { 
 
            return res.status(400).json({ 
 
                success: false, 
 
                message: 
                    "Quiz information is incomplete." 
 
            }); 
 
        } 
 
 
        db.run( 
 
            ` 
            INSERT INTO quiz_scores 
            (user_id, quiz_name, score, total) 
            VALUES (?, ?, ?, ?) 
            `, 
 
            [ 
                req.user.id, 
                quiz_name, 
                score, 
                total 
            ], 
 
            function(err) { 
 
                if (err) { 
 
                    console.error(err); 
 
 
                    return res.status(500).json({ 
 
                        success: false, 
 
                        message: 
                            "Could not save quiz score." 
 
                    }); 
 
                } 
 
 
                res.json({ 
 
                    success: true, 
 
                    message: 
                        "Quiz score saved!", 
 
                    scoreId: 
                        this.lastID 
 
                }); 
 
            } 
 
        ); 
 
    } 
); 
 
 
// GET QUIZ SCORES 
 
app.get( 
    "/api/quiz-scores", 
    authenticate, 
    (req, res) => { 
 
        db.all( 
 
            ` 
            SELECT * 
            FROM quiz_scores 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            `, 
 
            [req.user.id], 
 
            (err, scores) => { 
 
                if (err) { 
 
                    console.error(err); 
 
 
                    return res.status(500).json({ 
 
                        success: false, 
 
                        message: 
                            "Could not load quiz scores." 
 
                    }); 
 
                } 
 
 
                res.json({ 
 
                    success: true, 
 
                    scores: scores 
 
                }); 
 
            } 
 
        ); 
 
    } 
); 
 
 
// ================================ 
// START SERVER 
// ================================ 
 
app.listen(PORT, () => { 
console.log(""); 
console.log("================================"); 
console.log("STUDENTHUB SERVER"); 
console.log("================================"); 
console.log(`Server: http://localhost:${PORT}`); 
console.log("Database: StudentHub.db"); 
console.log("Status: ONLINE"); 
console.log("================================"); 
console.log(""); 
}); 
app.use(express.static("public"));

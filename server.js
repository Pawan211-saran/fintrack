import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false } });

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",").map(v => v.trim()) || true }));
app.use(express.json());

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is missing. Add it to server/.env before using the API.");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(160) NOT NULL,
      category VARCHAR(60) NOT NULL,
      type VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(60) NOT NULL,
      limit_amount NUMERIC(12,2) NOT NULL CHECK (limit_amount > 0),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, name)
    );
  `);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please login again." });
  }
}

const cleanEmail = email => String(email || "").trim().toLowerCase();

app.get("/api/health", (req, res) => res.json({ ok: true, service: "FinTrack API" }));

app.post("/api/auth/signup", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");
    if (name.length < 2) return res.status(400).json({ message: "Please enter your name." });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: "Enter a valid email." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (exists.rowCount) return res.status(409).json({ message: "An account with this email already exists." });
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email",
      [name,email,hash]
    );
    const user = result.rows[0];
    res.status(201).json({ user, token: signToken(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Could not create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");
    const result = await pool.query("SELECT id,name,email,password_hash FROM users WHERE email=$1", [email]);
    if (!result.rowCount) return res.status(401).json({ message: "Invalid email or password." });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Invalid email or password." });
    const safeUser = { id:user.id, name:user.name, email:user.email };
    res.json({ user:safeUser, token:signToken(safeUser) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Could not login." });
  }
});

app.get("/api/auth/me", auth, async (req,res) => {
  const result = await pool.query("SELECT id,name,email FROM users WHERE id=$1", [req.user.sub]);
  if (!result.rowCount) return res.status(401).json({ message:"User no longer exists." });
  res.json({ user: result.rows[0] });
});

app.get("/api/transactions", auth, async (req,res) => {
  const result = await pool.query(
    `SELECT id,title,category,type,amount::float AS amount,
            TO_CHAR(transaction_date,'Mon DD, YYYY') AS date,
            transaction_date
     FROM transactions WHERE user_id=$1 ORDER BY transaction_date DESC, id DESC`,
    [req.user.sub]
  );
  res.json({ transactions: result.rows });
});

app.post("/api/transactions", auth, async (req,res) => {
  const title=String(req.body.title||"").trim();
  const category=String(req.body.category||"").trim();
  const type=req.body.type==="income"?"income":"expense";
  const amount=Number(req.body.amount);
  const date=req.body.date ? new Date(req.body.date) : new Date();
  if(!title || !category || !Number.isFinite(amount) || amount<=0 || Number.isNaN(date.getTime()))
    return res.status(400).json({message:"Please provide valid transaction details."});
  const result=await pool.query(
    `INSERT INTO transactions(user_id,title,category,type,amount,transaction_date)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING id,title,category,type,amount::float AS amount,
     TO_CHAR(transaction_date,'Mon DD, YYYY') AS date, transaction_date`,
    [req.user.sub,title,category,type,amount,date.toISOString().slice(0,10)]
  );
  res.status(201).json({transaction:result.rows[0]});
});

app.delete("/api/transactions/:id", auth, async (req,res) => {
  const result=await pool.query("DELETE FROM transactions WHERE id=$1 AND user_id=$2 RETURNING id",[req.params.id,req.user.sub]);
  if(!result.rowCount) return res.status(404).json({message:"Transaction not found."});
  res.json({ok:true});
});

app.get("/api/budgets", auth, async (req,res) => {
  const result=await pool.query(
    `SELECT b.id,b.name,b.limit_amount::float AS "limit",
      COALESCE(SUM(CASE WHEN t.type='expense' AND t.category=b.name THEN t.amount ELSE 0 END),0)::float AS spent
     FROM budgets b LEFT JOIN transactions t ON t.user_id=b.user_id
     WHERE b.user_id=$1 GROUP BY b.id ORDER BY b.id`,
    [req.user.sub]
  );
  res.json({budgets:result.rows});
});

app.post("/api/budgets", auth, async (req,res) => {
  const name=String(req.body.name||"").trim();
  const limit=Number(req.body.limit);
  if(!name || !Number.isFinite(limit) || limit<=0) return res.status(400).json({message:"Enter a valid budget."});
  try {
    const result=await pool.query(
      `INSERT INTO budgets(user_id,name,limit_amount) VALUES($1,$2,$3)
       ON CONFLICT(user_id,name) DO UPDATE SET limit_amount=EXCLUDED.limit_amount
       RETURNING id,name,limit_amount::float AS "limit"`,
      [req.user.sub,name,limit]
    );
    res.status(201).json({budget:result.rows[0]});
  } catch(e){ console.error(e); res.status(500).json({message:"Could not save budget."}); }
});

app.delete("/api/budgets/:id", auth, async (req,res) => {
  const result=await pool.query("DELETE FROM budgets WHERE id=$1 AND user_id=$2 RETURNING id",[req.params.id,req.user.sub]);
  if(!result.rowCount) return res.status(404).json({message:"Budget not found."});
  res.json({ok:true});
});

app.get("/api/reports", auth, async (req,res) => {
  const summary=await pool.query(
    `SELECT COALESCE(SUM(amount) FILTER(WHERE type='income'),0)::float AS income,
            COALESCE(SUM(amount) FILTER(WHERE type='expense'),0)::float AS expense
     FROM transactions WHERE user_id=$1`,[req.user.sub]);
  const categories=await pool.query(
    `SELECT category,COALESCE(SUM(amount),0)::float AS amount
     FROM transactions WHERE user_id=$1 AND type='expense'
     GROUP BY category ORDER BY amount DESC`,[req.user.sub]);
  res.json({summary:summary.rows[0],categories:categories.rows});
});

app.use((err,req,res,next)=>{ console.error(err); res.status(500).json({message:"Unexpected server error."}); });

initDb().then(()=>app.listen(PORT,()=>console.log(`FinTrack API running on port ${PORT}`)))
  .catch(err=>{console.error("Database initialization failed:",err);process.exit(1);});

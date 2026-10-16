require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');


const createDatabase = async () => {
  // Connect to db 
  const adminPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });

  try {
    const result = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [process.env.DB_NAME]
    );

    if (result.rowCount === 0) {
      
      await adminPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`Database "${process.env.DB_NAME}" created`);
    } else {
      console.log(`Database "${process.env.DB_NAME}" already exists`);
    }
  } finally {
    await adminPool.end();
  }
};

// create table
const createTables = async () => {
  const pool = require('./db'); // now connects to leave_management

  try {
    // Remove old tables if already exist
    await pool.query(
      `DROP TABLE IF EXISTS comments, attachments, leaves, leave_balances, leave_types, users CASCADE`
    );

    // 1. users
    await pool.query(`
      CREATE TABLE users (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(150) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        role        VARCHAR(10) NOT NULL DEFAULT 'EMPLOYEE'
                    CHECK (role IN ('ADMIN', 'EMPLOYEE')),
        department  VARCHAR(100),
                phone       VARCHAR(20),
        photo_path  VARCHAR(255),
        token_version INT NOT NULL DEFAULT 0,
        is_active   BOOLEAN DEFAULT TRUE,
        is_active   BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. leave_types
    await pool.query(`
      CREATE TABLE leave_types (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(50) UNIQUE NOT NULL,
        total_days  INT NOT NULL CHECK (total_days >= 0),
        is_active   BOOLEAN DEFAULT TRUE
      )
    `);

    // 3. leave_balances
    await pool.query(`
      CREATE TABLE leave_balances (
        id             SERIAL PRIMARY KEY,
        user_id        INT NOT NULL REFERENCES users(id),
        leave_type_id  INT NOT NULL REFERENCES leave_types(id),
        total_days     INT NOT NULL,
        used_days      INT NOT NULL DEFAULT 0,
        UNIQUE (user_id, leave_type_id)
      )
    `);

    // 4. leaves
    await pool.query(`
      CREATE TABLE leaves (
        id               SERIAL PRIMARY KEY,
        user_id          INT NOT NULL REFERENCES users(id),
        leave_type_id    INT NOT NULL REFERENCES leave_types(id),
        start_date       DATE NOT NULL,
        end_date         DATE NOT NULL,
        total_days       INT NOT NULL,
        reason           TEXT NOT NULL,
        status           VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
        rejection_reason TEXT,
        created_at       TIMESTAMP DEFAULT NOW(),
        CHECK (end_date >= start_date)
      )
    `);

    // 5. attachments
       await pool.query(`
      CREATE TABLE attachments (
        id             SERIAL PRIMARY KEY,
        leave_id       INT REFERENCES leaves(id) ON DELETE CASCADE,
        user_id        INT REFERENCES users(id),
        original_name  VARCHAR(255) NOT NULL,
        stored_name    VARCHAR(255) NOT NULL,
        file_path      VARCHAR(255),
        file_type      VARCHAR(100),
        file_size      INT,
        uploaded_at    TIMESTAMP DEFAULT NOW()
      )
    `);

    // 6. comments
    await pool.query(`
      CREATE TABLE comments (
        id          SERIAL PRIMARY KEY,
        leave_id    INT NOT NULL REFERENCES leaves(id) ON DELETE CASCADE,
        user_id     INT NOT NULL REFERENCES users(id),
        comment     TEXT NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Tables created');

    // leave types
    const leaveTypes = [
      ['Casual Leave', 12],
      ['Sick Leave', 10],
      ['Earned Leave', 15],
      ['Work From Home', 24],
    ];
    for (const [name, days] of leaveTypes) {
      await pool.query(
        'INSERT INTO leave_types (name, total_days) VALUES ($1, $2)',
        [name, days]
      );
    }
    console.log('Leave types added');

    // Admin user (password is hashed)
    const hashed = await bcrypt.hash('Admin@123', 10);
    await pool.query(
      `INSERT INTO users (name, email, password, role, department)
       VALUES ($1, $2, $3, 'ADMIN', 'Management')`,
      ['Admin', 'admin@company.com', hashed]
    );
    console.log('Admin created: admin@company.com / Admin@123');
  } finally {
    await pool.end();
  }
};

const initDb = async () => {
  try {
    await createDatabase();
    await createTables();
  } catch (err) {
    console.error('Database setup failed:', err.message);
  }
};

initDb();
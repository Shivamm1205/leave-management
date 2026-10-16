require('dotenv').config();
const pool = require('./db');

// Adds the new columns without touching existing data 
const migrate = async () => {
  try {
    // attachments: file path, owner, and an optional leave 
    await pool.query('ALTER TABLE attachments ADD COLUMN IF NOT EXISTS file_path VARCHAR(255)');
    await pool.query('ALTER TABLE attachments ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id)');
    await pool.query('ALTER TABLE attachments ALTER COLUMN leave_id DROP NOT NULL');

    // Old rows: the owner comes from the leave, the path is the old file name
    await pool.query(
      `UPDATE attachments a SET user_id = l.user_id
       FROM leaves l WHERE a.leave_id = l.id AND a.user_id IS NULL`
    );
    await pool.query('UPDATE attachments SET file_path = stored_name WHERE file_path IS NULL');

    // users: profile photo path and the login token version
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0');

    // Show what the users table has now
    const cols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
    );
    console.log('users columns:', cols.rows.map((r) => r.column_name).join(', '));
    console.log('Migration done');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
};

migrate();
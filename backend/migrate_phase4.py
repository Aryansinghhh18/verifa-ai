import sqlite3

def migrate():
    conn = sqlite3.connect("verifa.db")
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys=OFF;")
    cursor.execute("BEGIN TRANSACTION;")

    # 1. Migrate batch_jobs
    cursor.execute("DROP TABLE IF EXISTS batch_jobs_old;")
    cursor.execute("ALTER TABLE batch_jobs RENAME TO batch_jobs_old;")
    cursor.execute("""
        CREATE TABLE batch_jobs (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            chatbot_id VARCHAR(36),
            status VARCHAR(20) NOT NULL,
            total_cases INTEGER NOT NULL,
            completed_cases INTEGER NOT NULL,
            failed_cases INTEGER NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            created_at DATETIME NOT NULL,
            completed_at DATETIME,
            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY(chatbot_id) REFERENCES chatbots (id) ON DELETE SET NULL
        );
    """)
    cursor.execute("""
        INSERT INTO batch_jobs (id, user_id, chatbot_id, status, total_cases, completed_cases, failed_cases, file_name, created_at, completed_at)
        SELECT id, user_id, chatbot_id, status, total_cases, completed_cases, failed_cases, file_name, created_at, completed_at
        FROM batch_jobs_old;
    """)
    cursor.execute("DROP TABLE batch_jobs_old;")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_batch_jobs_user_id ON batch_jobs (user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_batch_jobs_chatbot_id ON batch_jobs (chatbot_id);")

    # 2. Migrate evaluations (make chatbot_id nullable)
    cursor.execute("DROP TABLE IF EXISTS evaluations_old;")
    cursor.execute("ALTER TABLE evaluations RENAME TO evaluations_old;")
    cursor.execute("""
        CREATE TABLE evaluations (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            chatbot_id VARCHAR(36),
            batch_job_id VARCHAR(36),
            prompt TEXT NOT NULL,
            reference_evidence TEXT,
            chatbot_response TEXT NOT NULL,
            status_code INTEGER NOT NULL,
            response_latency_ms FLOAT NOT NULL,
            status VARCHAR(20) NOT NULL,
            error_message TEXT,
            created_at DATETIME NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY(chatbot_id) REFERENCES chatbots (id) ON DELETE CASCADE,
            FOREIGN KEY(batch_job_id) REFERENCES batch_jobs (id) ON DELETE SET NULL
        );
    """)
    cursor.execute("""
        INSERT INTO evaluations (id, user_id, chatbot_id, batch_job_id, prompt, reference_evidence, chatbot_response, status_code, response_latency_ms, status, error_message, created_at)
        SELECT id, user_id, chatbot_id, batch_job_id, prompt, reference_evidence, chatbot_response, status_code, response_latency_ms, status, error_message, created_at
        FROM evaluations_old;
    """)
    cursor.execute("DROP TABLE evaluations_old;")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_evaluations_user_id ON evaluations (user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_evaluations_chatbot_id ON evaluations (chatbot_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_evaluations_batch_job_id ON evaluations (batch_job_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_evaluations_created_at ON evaluations (created_at);")

    cursor.execute("COMMIT;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    conn.close()
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()

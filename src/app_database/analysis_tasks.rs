use rusqlite::{params, OptionalExtension};
use serde_json::Value as JsonValue;

use super::{bool_to_sqlite, AppDatabase, StoredAnalysisTask};

fn analysis_task_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<StoredAnalysisTask> {
    let result_json: Option<String> = row.get(7)?;
    Ok(StoredAnalysisTask {
        task_id: row.get::<_, i64>(0)? as u64,
        task_type: row.get(1)?,
        source_path: row.get(2)?,
        status: row.get(3)?,
        store_result: row.get::<_, i64>(4)? != 0,
        created_at_epoch_secs: row.get::<_, i64>(5)? as u64,
        updated_at_epoch_secs: row.get::<_, i64>(6)? as u64,
        result: result_json
            .as_deref()
            .and_then(|value| serde_json::from_str(value).ok()),
        error: row.get(8)?,
    })
}

impl AppDatabase {
    pub fn upsert_analysis_task(
        &self,
        task_id: u64,
        task_type: &str,
        source_path: &str,
        status: &str,
        store_result: bool,
        created_at_epoch_secs: u64,
        updated_at_epoch_secs: u64,
        result: Option<&JsonValue>,
        error: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let result_json = result.map(|value| value.to_string());
        conn.execute(
            r#"
            INSERT INTO analysis_tasks
                (task_id, task_type, source_path, status, store_result, created_at, updated_at, result_json, error_text)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(task_id) DO UPDATE SET
                task_type = excluded.task_type,
                source_path = excluded.source_path,
                status = excluded.status,
                store_result = excluded.store_result,
                updated_at = excluded.updated_at,
                result_json = excluded.result_json,
                error_text = excluded.error_text
            "#,
            params![
                task_id as i64,
                task_type,
                source_path,
                status,
                bool_to_sqlite(store_result),
                created_at_epoch_secs as i64,
                updated_at_epoch_secs as i64,
                result_json,
                error,
            ],
        )
        .map_err(|e| format!("Failed to persist analysis task: {}", e))?;
        Ok(())
    }

    pub fn get_analysis_task(&self, task_id: u64) -> Result<Option<StoredAnalysisTask>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            r#"
            SELECT task_id, task_type, source_path, status, store_result, created_at, updated_at, result_json, error_text
            FROM analysis_tasks
            WHERE task_id = ?1
            "#,
            params![task_id as i64],
            analysis_task_from_row,
        )
        .optional()
        .map_err(|e| format!("Failed to read analysis task: {}", e))
    }

    pub fn recent_analysis_tasks(&self, limit: usize) -> Result<Vec<StoredAnalysisTask>, String> {
        self.recent_analysis_tasks_by_type(None, limit)
    }

    pub fn recent_analysis_tasks_by_type(
        &self,
        task_type: Option<&str>,
        limit: usize,
    ) -> Result<Vec<StoredAnalysisTask>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let query_all = r#"
                SELECT task_id, task_type, source_path, status, store_result, created_at, updated_at, result_json, error_text
                FROM analysis_tasks
                ORDER BY updated_at DESC, task_id DESC
                LIMIT ?1
                "#;
        let query_filtered = r#"
                SELECT task_id, task_type, source_path, status, store_result, created_at, updated_at, result_json, error_text
                FROM analysis_tasks
                WHERE task_type = ?1
                ORDER BY updated_at DESC, task_id DESC
                LIMIT ?2
                "#;

        let rows = if let Some(task_type) = task_type {
            let mut stmt = conn
                .prepare(query_filtered)
                .map_err(|e| format!("Failed to prepare filtered analysis tasks query: {}", e))?;
            let rows = stmt
                .query_map(params![task_type, limit as i64], analysis_task_from_row)
                .map_err(|e| format!("Failed to query filtered analysis tasks: {}", e))?
                .collect::<Result<Vec<_>, _>>();
            rows
        } else {
            let mut stmt = conn
                .prepare(query_all)
                .map_err(|e| format!("Failed to prepare analysis tasks query: {}", e))?;
            let rows = stmt
                .query_map(params![limit as i64], analysis_task_from_row)
                .map_err(|e| format!("Failed to query analysis tasks: {}", e))?
                .collect::<Result<Vec<_>, _>>();
            rows
        };

        rows.map_err(|e| format!("Failed to decode analysis tasks: {}", e))
    }
}

use rand::seq::SliceRandom;
use rusqlite::{params, OptionalExtension, ToSql};

use super::{media_id_for_path, now_epoch_secs_i64, AppDatabase, QueueEntryRecord};

fn queue_entry_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<QueueEntryRecord> {
    Ok(QueueEntryRecord {
        queue_id: row.get(0)?,
        entry_id: row.get(1)?,
        position_index: row.get(2)?,
        shuffle_index: row.get(3)?,
        source_path: row.get(4)?,
        media_id: row.get(5)?,
        status: row.get(6)?,
        added_at_epoch_secs: row.get::<_, i64>(7)? as u64,
        updated_at_epoch_secs: row.get::<_, i64>(8)? as u64,
        title: row.get(9)?,
        artist: row.get(10)?,
        album: row.get(11)?,
        duration_secs: row.get(12)?,
        has_cover_art: row.get::<_, i64>(13)? != 0,
        external_artwork_url: row.get(14)?,
    })
}

const QUEUE_ENTRY_SELECT_WITH_METADATA: &str = r#"
    SELECT q.queue_id, q.entry_id, q.position_index, q.shuffle_index, q.source_path, q.media_id,
           q.status, q.added_at, q.updated_at,
           m.title, m.artist, m.album, m.duration_secs,
           EXISTS (
               SELECT 1
               FROM cover_art_cache
               WHERE cover_art_cache.media_id = q.media_id
               LIMIT 1
           ) AS has_cover_art,
           m.external_artwork_url
    FROM playback_queue_entries q
    LEFT JOIN media_items m ON m.media_id = q.media_id
"#;

impl AppDatabase {
    pub fn queue_entry_at_position(
        &self,
        queue_id: &str,
        position_index: i64,
    ) -> Result<Option<QueueEntryRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let sql = format!(
            r#"
            {}
            WHERE q.queue_id = ?1 AND q.position_index = ?2
            LIMIT 1
            "#,
            QUEUE_ENTRY_SELECT_WITH_METADATA
        );
        conn.query_row(
            &sql,
            params![queue_id, position_index],
            queue_entry_from_row,
        )
        .optional()
        .map_err(|e| {
            format!(
                "Failed to read queue entry at position {}: {}",
                position_index, e
            )
        })
    }

    pub fn replace_queue_entries(&self, queue_id: &str, entries: &[String]) -> Result<(), String> {
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start queue transaction: {}", e))?;
        tx.execute(
            "DELETE FROM playback_queue_entries WHERE queue_id = ?1",
            params![queue_id],
        )
        .map_err(|e| format!("Failed to clear queue entries: {}", e))?;

        let now = now_epoch_secs_i64();
        for (index, source_path) in entries.iter().enumerate() {
            tx.execute(
                r#"
                INSERT INTO playback_queue_entries
                    (queue_id, position_index, source_path, media_id, status, added_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?5)
                "#,
                params![
                    queue_id,
                    index as i64,
                    source_path,
                    media_id_for_path(source_path),
                    now,
                ],
            )
            .map_err(|e| format!("Failed to insert queue entry: {}", e))?;
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit queue transaction: {}", e))?;
        Ok(())
    }

    pub fn append_queue_entry(&self, queue_id: &str, source_path: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_secs_i64();
        let next_position: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(position_index) + 1, 0) FROM playback_queue_entries WHERE queue_id = ?1",
                params![queue_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to compute next queue position: {}", e))?;
        conn.execute(
            r#"
            INSERT INTO playback_queue_entries
                (queue_id, position_index, source_path, media_id, status, added_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?5)
            "#,
            params![
                queue_id,
                next_position,
                source_path,
                media_id_for_path(source_path),
                now
            ],
        )
        .map_err(|e| format!("Failed to append queue entry: {}", e))?;
        Ok(())
    }

    pub fn append_queue_entries(&self, queue_id: &str, entries: &[String]) -> Result<(), String> {
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start queue append transaction: {}", e))?;
        let now = now_epoch_secs_i64();
        let next_position: i64 = tx
            .query_row(
                "SELECT COALESCE(MAX(position_index) + 1, 0) FROM playback_queue_entries WHERE queue_id = ?1",
                params![queue_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to compute next queue position: {}", e))?;

        for (offset, source_path) in entries.iter().enumerate() {
            tx.execute(
                r#"
                INSERT INTO playback_queue_entries
                    (queue_id, position_index, source_path, media_id, status, added_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?5)
                "#,
                params![
                    queue_id,
                    next_position + offset as i64,
                    source_path,
                    media_id_for_path(source_path),
                    now,
                ],
            )
            .map_err(|e| format!("Failed to append queue entry: {}", e))?;
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit queue append transaction: {}", e))?;
        Ok(())
    }

    pub fn remove_queue_entry(&self, queue_id: &str, entry_id: i64) -> Result<(), String> {
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start queue removal transaction: {}", e))?;
        tx.execute(
            "DELETE FROM playback_queue_entries WHERE queue_id = ?1 AND entry_id = ?2",
            params![queue_id, entry_id],
        )
        .map_err(|e| format!("Failed to remove queue entry: {}", e))?;
        tx.execute(
            r#"
            UPDATE playback_queue_entries
            SET position_index = (
                SELECT COUNT(*) FROM playback_queue_entries q2
                WHERE q2.queue_id = ?1
                  AND q2.position_index < playback_queue_entries.position_index
            ),
                updated_at = ?2
            WHERE queue_id = ?1
            "#,
            params![queue_id, now_epoch_secs_i64()],
        )
        .map_err(|e| format!("Failed to reindex queue entries: {}", e))?;
        tx.commit()
            .map_err(|e| format!("Failed to commit queue removal transaction: {}", e))?;
        Ok(())
    }

    pub fn clear_queue(&self, queue_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM playback_queue_entries WHERE queue_id = ?1",
            params![queue_id],
        )
        .map_err(|e| format!("Failed to clear queue: {}", e))?;
        Ok(())
    }

    pub fn list_queue_entries(&self, queue_id: &str) -> Result<Vec<QueueEntryRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let sql = format!(
            r#"
            {}
            WHERE q.queue_id = ?1
            ORDER BY COALESCE(q.shuffle_index, q.position_index) ASC, q.entry_id ASC
            "#,
            QUEUE_ENTRY_SELECT_WITH_METADATA
        );
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Failed to prepare queue entries query: {}", e))?;

        let rows = stmt
            .query_map(params![queue_id], queue_entry_from_row)
            .map_err(|e| format!("Failed to query queue entries: {}", e))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to decode queue entries: {}", e))
    }

    pub fn peek_next_queue_entry(
        &self,
        queue_id: &str,
        after_source_path: Option<&str>,
    ) -> Result<Option<QueueEntryRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let after_media_id = after_source_path.map(media_id_for_path);

        let query_with_cursor = format!(
            r#"
            {}
            WHERE q.queue_id = ?1
              AND q.status IN ('queued', 'preloading')
              AND COALESCE(q.shuffle_index, q.position_index) > COALESCE(
                  (
                      SELECT COALESCE(q2.shuffle_index, q2.position_index)
                      FROM playback_queue_entries q2
                      WHERE q2.queue_id = ?1 AND q2.media_id = ?2
                      ORDER BY COALESCE(q2.shuffle_index, q2.position_index) ASC, q2.entry_id ASC
                      LIMIT 1
                  ),
                  -1
              )
            ORDER BY COALESCE(q.shuffle_index, q.position_index) ASC, q.entry_id ASC
            LIMIT 1
            "#,
            QUEUE_ENTRY_SELECT_WITH_METADATA
        );

        let query_without_cursor = format!(
            r#"
            {}
            WHERE q.queue_id = ?1
              AND q.status IN ('queued', 'preloading')
            ORDER BY COALESCE(q.shuffle_index, q.position_index) ASC, q.entry_id ASC
            LIMIT 1
            "#,
            QUEUE_ENTRY_SELECT_WITH_METADATA
        );

        let result = if let Some(media_id) = after_media_id.as_deref() {
            conn.query_row(
                &query_with_cursor,
                params![queue_id, media_id],
                queue_entry_from_row,
            )
        } else {
            conn.query_row(
                &query_without_cursor,
                params![queue_id],
                queue_entry_from_row,
            )
        };

        result
            .optional()
            .map_err(|e| format!("Failed to peek next queue entry: {}", e))
    }

    pub fn peek_previous_queue_entry(
        &self,
        queue_id: &str,
        before_source_path: Option<&str>,
    ) -> Result<Option<QueueEntryRecord>, String> {
        let Some(media_id) = before_source_path.map(media_id_for_path) else {
            return Ok(None);
        };

        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            r#"
            SELECT q.queue_id, q.entry_id, q.position_index, q.shuffle_index, q.source_path, q.media_id,
                   q.status, q.added_at, q.updated_at,
                   m.title, m.artist, m.album, m.duration_secs,
                   EXISTS (
                       SELECT 1
                       FROM cover_art_cache
                       WHERE cover_art_cache.media_id = q.media_id
                       LIMIT 1
                   ) AS has_cover_art,
                   m.external_artwork_url
            FROM playback_queue_entries q
            LEFT JOIN media_items m ON m.media_id = q.media_id
            WHERE q.queue_id = ?1
              AND COALESCE(q.shuffle_index, q.position_index) < (
                  SELECT COALESCE(q2.shuffle_index, q2.position_index)
                  FROM playback_queue_entries q2
                  WHERE q2.queue_id = ?1 AND q2.media_id = ?2
                  ORDER BY COALESCE(q2.shuffle_index, q2.position_index) ASC, q2.entry_id ASC
                  LIMIT 1
              )
            ORDER BY COALESCE(q.shuffle_index, q.position_index) DESC, q.entry_id DESC
            LIMIT 1
            "#,
            params![queue_id, media_id],
            queue_entry_from_row,
        )
        .optional()
        .map_err(|e| format!("Failed to peek previous queue entry: {}", e))
    }

    pub fn shuffle_entries(&self, queue_id: &str) -> Result<(), String> {
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start shuffle transaction: {}", e))?;

        let mut entries = {
            let mut stmt = tx
                .prepare(
                    r#"
                    SELECT entry_id
                    FROM playback_queue_entries
                    WHERE queue_id = ?1
                    ORDER BY position_index ASC, entry_id ASC
                    "#,
                )
                .map_err(|e| format!("Failed to prepare shuffle query: {}", e))?;
            let rows = stmt
                .query_map(params![queue_id], |row| row.get::<_, i64>(0))
                .map_err(|e| format!("Failed to query shuffle entries: {}", e))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("Failed to decode shuffle entries: {}", e))?;
            rows
        };

        let original = entries.clone();
        entries.shuffle(&mut rand::thread_rng());
        if entries.len() > 1 && entries == original {
            entries.swap(0, 1);
        }

        let now = now_epoch_secs_i64();
        for (index, entry_id) in entries.iter().enumerate() {
            tx.execute(
                r#"
                UPDATE playback_queue_entries
                SET shuffle_index = ?3,
                    updated_at = ?4
                WHERE queue_id = ?1 AND entry_id = ?2
                "#,
                params![queue_id, entry_id, index as i64, now],
            )
            .map_err(|e| format!("Failed to update shuffle index: {}", e))?;
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit shuffle transaction: {}", e))?;
        Ok(())
    }

    pub fn unshuffle_entries(&self, queue_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            r#"
            UPDATE playback_queue_entries
            SET shuffle_index = NULL,
                updated_at = ?2
            WHERE queue_id = ?1
            "#,
            params![queue_id, now_epoch_secs_i64()],
        )
        .map_err(|e| format!("Failed to clear shuffle indexes: {}", e))?;
        Ok(())
    }

    pub fn reset_queue_cycle_for_repeat_all(
        &self,
        queue_id: &str,
    ) -> Result<Option<QueueEntryRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            r#"
            UPDATE playback_queue_entries
            SET status = 'queued',
                updated_at = ?2
            WHERE queue_id = ?1
              AND status IN ('played', 'playing', 'preloading')
            "#,
            params![queue_id, now_epoch_secs_i64()],
        )
        .map_err(|e| format!("Failed to reset queue cycle: {}", e))?;
        drop(conn);

        self.peek_next_queue_entry(queue_id, None)
    }

    pub fn mark_queue_entry_status(
        &self,
        queue_id: &str,
        entry_id: i64,
        status: &str,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            r#"
            UPDATE playback_queue_entries
            SET status = ?3,
                updated_at = ?4
            WHERE queue_id = ?1 AND entry_id = ?2
            "#,
            params![queue_id, entry_id, status, now_epoch_secs_i64()],
        )
        .map_err(|e| format!("Failed to update queue entry status: {}", e))?;
        Ok(())
    }

    pub fn mark_queue_entry_playing(&self, queue_id: &str, entry_id: i64) -> Result<(), String> {
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start queue status transaction: {}", e))?;
        let now = now_epoch_secs_i64();

        tx.execute(
            r#"
            UPDATE playback_queue_entries
            SET status = 'queued',
                updated_at = ?3
            WHERE queue_id = ?1
              AND entry_id <> ?2
              AND status IN ('playing', 'preloading')
            "#,
            params![queue_id, entry_id, now],
        )
        .map_err(|e| format!("Failed to clear active queue entries: {}", e))?;

        tx.execute(
            r#"
            UPDATE playback_queue_entries
            SET status = 'playing',
                updated_at = ?3
            WHERE queue_id = ?1 AND entry_id = ?2
            "#,
            params![queue_id, entry_id, now],
        )
        .map_err(|e| format!("Failed to mark queue entry as playing: {}", e))?;

        tx.commit()
            .map_err(|e| format!("Failed to commit queue status transaction: {}", e))?;
        Ok(())
    }

    pub fn mark_queue_entry_played_by_path(
        &self,
        queue_id: &str,
        source_path: &str,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let media_id = media_id_for_path(source_path);
        conn.execute(
            r#"
            UPDATE playback_queue_entries
            SET status = 'played',
                updated_at = ?3
            WHERE entry_id = (
                SELECT entry_id
                FROM playback_queue_entries
                WHERE queue_id = ?1 AND media_id = ?2
                ORDER BY position_index ASC, entry_id ASC
                LIMIT 1
            )
            "#,
            params![queue_id, media_id, now_epoch_secs_i64()],
        )
        .map_err(|e| format!("Failed to mark queue entry as played: {}", e))?;
        Ok(())
    }

    pub fn mark_queue_entry_status_by_path(
        &self,
        queue_id: &str,
        source_path: &str,
        current_statuses: &[&str],
        next_status: &str,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let updated_at = now_epoch_secs_i64();
        let media_id = media_id_for_path(source_path);

        let changed = if current_statuses.is_empty() {
            conn.execute(
                r#"
                UPDATE playback_queue_entries
                SET status = ?3,
                    updated_at = ?4
                WHERE entry_id = (
                    SELECT entry_id
                    FROM playback_queue_entries
                    WHERE queue_id = ?1 AND media_id = ?2
                    ORDER BY position_index ASC, entry_id ASC
                    LIMIT 1
                )
                "#,
                params![queue_id, media_id, next_status, updated_at],
            )
        } else {
            let placeholders = std::iter::repeat("?")
                .take(current_statuses.len())
                .collect::<Vec<_>>()
                .join(", ");
            let sql = format!(
                r#"
                UPDATE playback_queue_entries
                SET status = ?,
                    updated_at = ?
                WHERE entry_id = (
                    SELECT entry_id
                    FROM playback_queue_entries
                    WHERE queue_id = ?
                      AND media_id = ?
                      AND status IN ({})
                    ORDER BY position_index ASC, entry_id ASC
                    LIMIT 1
                )
                "#,
                placeholders
            );
            let mut query_params: Vec<&dyn ToSql> =
                vec![&next_status, &updated_at, &queue_id, &media_id];
            for status in current_statuses {
                query_params.push(status);
            }
            conn.execute(&sql, rusqlite::params_from_iter(query_params))
        }
        .map_err(|e| format!("Failed to update queue entry status by path: {}", e))?;

        if changed == 0 {
            return Ok(());
        }

        Ok(())
    }
}

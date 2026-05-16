use rusqlite::{params, OptionalExtension};

use super::{media_id_for_path, now_epoch_secs_i64, AppDatabase, NcmTrackSourceRecord};

pub(super) fn ncm_track_source_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<NcmTrackSourceRecord> {
    Ok(NcmTrackSourceRecord {
        media_id: row.get(0)?,
        source_path: row.get(1)?,
        song_id: row.get(2)?,
        source_page_url: row.get(3)?,
        resolved_at_epoch_secs: row.get::<_, i64>(4)? as u64,
        scrobbled_at_epoch_secs: row.get::<_, Option<i64>>(5)?.map(|v| v as u64),
        scrobble_secs: row.get::<_, Option<i64>>(6)?.map(|v| v as u64),
    })
}

fn read_ncm_track_source_from_conn(
    conn: &rusqlite::Connection,
    media_id: &str,
) -> Result<NcmTrackSourceRecord, String> {
    conn.query_row(
        r#"
        SELECT media_id, source_path, song_id, source_page_url,
               resolved_at, scrobbled_at, scrobble_secs
        FROM ncm_track_sources
        WHERE media_id = ?1
        "#,
        params![media_id],
        ncm_track_source_from_row,
    )
    .map_err(|e| format!("Failed to read NCM track source '{}': {}", media_id, e))
}

impl AppDatabase {
    pub fn record_ncm_track_source(
        &self,
        source_path: &str,
        song_id: i64,
        source_page_url: Option<&str>,
    ) -> Result<NcmTrackSourceRecord, String> {
        if song_id <= 0 {
            return Err("NCM song id must be positive".to_string());
        }
        let media_id = self.record_media_stub(source_path)?;
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_secs_i64();
        conn.execute(
            r#"
            INSERT INTO ncm_track_sources (
                media_id, source_path, song_id, source_page_url, resolved_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(media_id) DO UPDATE SET
                source_path = excluded.source_path,
                song_id = excluded.song_id,
                source_page_url = excluded.source_page_url,
                resolved_at = excluded.resolved_at
            "#,
            params![media_id, source_path, song_id, source_page_url, now],
        )
        .map_err(|e| format!("Failed to record NCM track source: {}", e))?;
        read_ncm_track_source_from_conn(&conn, &media_id)
    }

    pub fn ncm_track_source_for_path(
        &self,
        source_path: &str,
    ) -> Result<Option<NcmTrackSourceRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let media_id = media_id_for_path(source_path);
        conn.query_row(
            r#"
            SELECT media_id, source_path, song_id, source_page_url,
                   resolved_at, scrobbled_at, scrobble_secs
            FROM ncm_track_sources
            WHERE media_id = ?1
            "#,
            params![media_id],
            ncm_track_source_from_row,
        )
        .optional()
        .map_err(|e| format!("Failed to read NCM track source: {}", e))
    }

    pub fn mark_ncm_track_scrobbled(
        &self,
        source_path: &str,
        scrobble_secs: u64,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let media_id = media_id_for_path(source_path);
        conn.execute(
            r#"
            UPDATE ncm_track_sources
            SET scrobbled_at = ?2,
                scrobble_secs = ?3
            WHERE media_id = ?1
            "#,
            params![media_id, now_epoch_secs_i64(), scrobble_secs as i64],
        )
        .map_err(|e| format!("Failed to mark NCM track scrobbled: {}", e))?;
        Ok(())
    }
}

use rusqlite::{params, OptionalExtension};
use serde_json::Value as JsonValue;

use super::{
    bool_to_sqlite, media_id_for_path, now_epoch_secs_i64, AppDatabase, PlaybackHistoryEntry,
    PlaybackRuntimeSnapshot, PlaybackSessionRecord,
};

fn playback_session_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PlaybackSessionRecord> {
    Ok(PlaybackSessionRecord {
        session_id: row.get(0)?,
        media_id: row.get(1)?,
        source_path: row.get(2)?,
        status: row.get(3)?,
        started_at_epoch_secs: row.get::<_, i64>(4)? as u64,
        updated_at_epoch_secs: row.get::<_, i64>(5)? as u64,
        ended_at_epoch_secs: row.get::<_, Option<i64>>(6)?.map(|v| v as u64),
        position_secs: row.get(7)?,
        duration_secs: row.get(8)?,
        volume: row.get(9)?,
        device_id: row.get::<_, Option<i64>>(10)?.map(|v| v as usize),
        exclusive_mode: row.get::<_, i64>(11)? != 0,
    })
}

impl AppDatabase {
    pub fn start_playback_session(
        &self,
        source_path: &str,
        status: &str,
        snapshot: &PlaybackRuntimeSnapshot,
    ) -> Result<i64, String> {
        let media_id = self.record_media_stub(source_path)?;
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_secs_i64();
        conn.execute(
            r#"
            INSERT INTO playback_sessions
                (media_id, source_path, status, started_at, updated_at, position_secs, duration_secs, volume, device_id, exclusive_mode)
            VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            params![
                media_id,
                source_path,
                status,
                now,
                snapshot.position_secs,
                snapshot.duration_secs,
                snapshot.volume.map(|v| v as f64),
                snapshot.device_id.map(|v| v as i64),
                bool_to_sqlite(snapshot.exclusive_mode),
            ],
        )
        .map_err(|e| format!("Failed to start playback session: {}", e))?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_playback_session(
        &self,
        session_id: i64,
        status: &str,
        snapshot: &PlaybackRuntimeSnapshot,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_secs_i64();
        conn.execute(
            r#"
            UPDATE playback_sessions
            SET status = ?2,
                updated_at = ?3,
                position_secs = ?4,
                duration_secs = ?5,
                volume = ?6,
                device_id = ?7,
                exclusive_mode = ?8
            WHERE session_id = ?1
            "#,
            params![
                session_id,
                status,
                now,
                snapshot.position_secs,
                snapshot.duration_secs,
                snapshot.volume.map(|v| v as f64),
                snapshot.device_id.map(|v| v as i64),
                bool_to_sqlite(snapshot.exclusive_mode),
            ],
        )
        .map_err(|e| format!("Failed to update playback session: {}", e))?;
        Ok(())
    }

    pub fn finish_playback_session(
        &self,
        session_id: i64,
        status: &str,
        snapshot: &PlaybackRuntimeSnapshot,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_secs_i64();
        conn.execute(
            r#"
            UPDATE playback_sessions
            SET status = ?2,
                updated_at = ?3,
                ended_at = ?3,
                position_secs = ?4,
                duration_secs = ?5,
                volume = ?6,
                device_id = ?7,
                exclusive_mode = ?8
            WHERE session_id = ?1
            "#,
            params![
                session_id,
                status,
                now,
                snapshot.position_secs,
                snapshot.duration_secs,
                snapshot.volume.map(|v| v as f64),
                snapshot.device_id.map(|v| v as i64),
                bool_to_sqlite(snapshot.exclusive_mode),
            ],
        )
        .map_err(|e| format!("Failed to finish playback session: {}", e))?;
        Ok(())
    }

    pub fn append_playback_history(
        &self,
        session_id: Option<i64>,
        source_path: &str,
        event_type: &str,
        position_secs: Option<f64>,
        payload: Option<&JsonValue>,
    ) -> Result<(), String> {
        let media_id = media_id_for_path(source_path);
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_secs_i64();
        let payload_json = payload.map(|value| value.to_string());
        conn.execute(
            r#"
            INSERT INTO playback_history
                (session_id, media_id, source_path, event_type, event_at, position_secs, payload_json)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
            params![
                session_id,
                media_id,
                source_path,
                event_type,
                now,
                position_secs,
                payload_json,
            ],
        )
        .map_err(|e| format!("Failed to append playback history: {}", e))?;
        Ok(())
    }

    pub fn recent_playback_history(
        &self,
        limit: usize,
    ) -> Result<Vec<PlaybackHistoryEntry>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                r#"
                SELECT h.id, h.session_id, h.media_id, n.song_id, n.source_page_url,
                       h.source_path, h.event_type, h.event_at,
                       h.position_secs, h.payload_json, m.title, m.artist, m.album, m.duration_secs,
                       EXISTS (
                           SELECT 1
                           FROM cover_art_cache
                           WHERE cover_art_cache.media_id = h.media_id
                           LIMIT 1
                       ) AS has_cover_art,
                       m.external_artwork_url
                FROM playback_history h
                LEFT JOIN media_items m ON m.media_id = h.media_id
                LEFT JOIN ncm_track_sources n ON n.media_id = h.media_id
                ORDER BY h.event_at DESC, h.id DESC
                LIMIT ?1
                "#,
            )
            .map_err(|e| format!("Failed to prepare playback history query: {}", e))?;

        let rows = stmt
            .query_map(params![limit as i64], |row| {
                let payload_json: Option<String> = row.get(9)?;
                Ok(PlaybackHistoryEntry {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    media_id: row.get(2)?,
                    ncm_song_id: row.get(3)?,
                    ncm_source_page_url: row.get(4)?,
                    source_path: row.get(5)?,
                    event_type: row.get(6)?,
                    event_at_epoch_secs: row.get::<_, i64>(7)? as u64,
                    position_secs: row.get(8)?,
                    payload: payload_json
                        .as_deref()
                        .and_then(|value| serde_json::from_str(value).ok()),
                    title: row.get(10)?,
                    artist: row.get(11)?,
                    album: row.get(12)?,
                    duration_secs: row.get(13)?,
                    has_cover_art: row.get::<_, i64>(14)? != 0,
                    external_artwork_url: row.get(15)?,
                })
            })
            .map_err(|e| format!("Failed to query playback history: {}", e))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to decode playback history: {}", e))
    }

    pub fn recent_playback_sessions(
        &self,
        limit: usize,
    ) -> Result<Vec<PlaybackSessionRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                r#"
                SELECT session_id, media_id, source_path, status, started_at, updated_at, ended_at,
                       position_secs, duration_secs, volume, device_id, exclusive_mode
                FROM playback_sessions
                ORDER BY updated_at DESC, session_id DESC
                LIMIT ?1
                "#,
            )
            .map_err(|e| format!("Failed to prepare playback sessions query: {}", e))?;

        let rows = stmt
            .query_map(params![limit as i64], playback_session_from_row)
            .map_err(|e| format!("Failed to query playback sessions: {}", e))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to decode playback sessions: {}", e))
    }

    pub fn latest_open_playback_session(&self) -> Result<Option<PlaybackSessionRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            r#"
            SELECT session_id, media_id, source_path, status, started_at, updated_at, ended_at,
                   position_secs, duration_secs, volume, device_id, exclusive_mode
            FROM playback_sessions
            WHERE ended_at IS NULL
            ORDER BY updated_at DESC, session_id DESC
            LIMIT 1
            "#,
            [],
            playback_session_from_row,
        )
        .optional()
        .map_err(|e| format!("Failed to load latest open playback session: {}", e))
    }
}

use rusqlite::{params, Connection, OptionalExtension};

use super::{now_epoch_millis_i64, AppDatabase, NcmAccountRecord, NcmAccountUpsert};

fn ncm_account_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NcmAccountRecord> {
    let cookie: String = row.get(3)?;
    Ok(NcmAccountRecord {
        user_id: row.get(0)?,
        nickname: row.get(1)?,
        avatar_url: row.get(2)?,
        has_cookie: !cookie.trim().is_empty(),
        cookie,
        vip_type: row.get(4)?,
        level: row.get(5)?,
        signin_at_ms: row.get(6)?,
        added_at_ms: row.get(7)?,
        refreshed_at_ms: row.get(8)?,
    })
}

fn non_empty_string(value: String) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value)
    }
}

fn read_ncm_account_from_conn(conn: &Connection, user_id: i64) -> Result<NcmAccountRecord, String> {
    conn.query_row(
        r#"
        SELECT user_id, nickname, avatar_url, cookie, vip_type, level,
               signin_at_ms, added_at_ms, refreshed_at_ms
        FROM ncm_accounts
        WHERE user_id = ?1
        "#,
        params![user_id],
        ncm_account_from_row,
    )
    .map_err(|e| format!("Failed to read NCM account {}: {}", user_id, e))
}

fn active_ncm_user_id_from_conn(conn: &Connection) -> Result<Option<i64>, String> {
    conn.query_row(
        "SELECT active_user_id FROM ncm_account_state WHERE state_key = 'active'",
        [],
        |row| row.get::<_, Option<i64>>(0),
    )
    .optional()
    .map(|value| value.flatten())
    .map_err(|e| format!("Failed to read active NCM account id: {}", e))
}

fn set_active_ncm_user_id_in_conn(conn: &Connection, user_id: Option<i64>) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO ncm_account_state (state_key, active_user_id, updated_at_ms)
        VALUES ('active', ?1, ?2)
        ON CONFLICT(state_key) DO UPDATE SET
            active_user_id = excluded.active_user_id,
            updated_at_ms = excluded.updated_at_ms
        "#,
        params![user_id, now_epoch_millis_i64()],
    )
    .map_err(|e| format!("Failed to set active NCM account id: {}", e))?;
    Ok(())
}

impl AppDatabase {
    pub fn list_ncm_accounts(&self) -> Result<(Vec<NcmAccountRecord>, Option<i64>), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                r#"
                SELECT user_id, nickname, avatar_url, cookie, vip_type, level,
                       signin_at_ms, added_at_ms, refreshed_at_ms
                FROM ncm_accounts
                ORDER BY added_at_ms ASC, user_id ASC
                "#,
            )
            .map_err(|e| format!("Failed to prepare NCM account list query: {}", e))?;
        let accounts = stmt
            .query_map([], ncm_account_from_row)
            .map_err(|e| format!("Failed to query NCM accounts: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to decode NCM accounts: {}", e))?;
        let active_user_id = active_ncm_user_id_from_conn(&conn)?;
        Ok((accounts, active_user_id))
    }

    pub fn active_ncm_account(&self) -> Result<Option<NcmAccountRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let Some(user_id) = active_ncm_user_id_from_conn(&conn)? else {
            return Ok(None);
        };
        conn.query_row(
            r#"
            SELECT user_id, nickname, avatar_url, cookie, vip_type, level,
                   signin_at_ms, added_at_ms, refreshed_at_ms
            FROM ncm_accounts
            WHERE user_id = ?1
            "#,
            params![user_id],
            ncm_account_from_row,
        )
        .optional()
        .map_err(|e| format!("Failed to read active NCM account: {}", e))
    }

    pub fn active_ncm_cookie(&self) -> Result<Option<String>, String> {
        Ok(self
            .active_ncm_account()?
            .and_then(|account| non_empty_string(account.cookie)))
    }

    pub fn upsert_ncm_account(&self, input: &NcmAccountUpsert) -> Result<NcmAccountRecord, String> {
        if input.user_id <= 0 {
            return Err("NCM user id must be positive".to_string());
        }
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_millis_i64();
        conn.execute(
            r#"
            INSERT INTO ncm_accounts (
                user_id, nickname, avatar_url, cookie, vip_type, level,
                signin_at_ms, added_at_ms, refreshed_at_ms
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
            ON CONFLICT(user_id) DO UPDATE SET
                nickname = COALESCE(excluded.nickname, nickname),
                avatar_url = COALESCE(excluded.avatar_url, avatar_url),
                cookie = excluded.cookie,
                vip_type = COALESCE(excluded.vip_type, vip_type),
                level = COALESCE(excluded.level, level),
                signin_at_ms = COALESCE(excluded.signin_at_ms, signin_at_ms),
                refreshed_at_ms = excluded.refreshed_at_ms
            "#,
            params![
                input.user_id,
                input.nickname,
                input.avatar_url,
                input.cookie,
                input.vip_type,
                input.level,
                input.signin_at_ms,
                now,
            ],
        )
        .map_err(|e| format!("Failed to upsert NCM account: {}", e))?;
        set_active_ncm_user_id_in_conn(&conn, Some(input.user_id))?;
        read_ncm_account_from_conn(&conn, input.user_id)
    }

    pub fn update_ncm_account_profile(
        &self,
        user_id: i64,
        nickname: Option<&str>,
        avatar_url: Option<&str>,
        vip_type: Option<i64>,
        level: Option<i64>,
    ) -> Result<Option<NcmAccountRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_millis_i64();
        let changed = conn
            .execute(
                r#"
                UPDATE ncm_accounts
                SET nickname = COALESCE(?2, nickname),
                    avatar_url = COALESCE(?3, avatar_url),
                    vip_type = COALESCE(?4, vip_type),
                    level = COALESCE(?5, level),
                    refreshed_at_ms = ?6
                WHERE user_id = ?1
                "#,
                params![user_id, nickname, avatar_url, vip_type, level, now],
            )
            .map_err(|e| format!("Failed to update NCM account profile: {}", e))?;
        if changed == 0 {
            return Ok(None);
        }
        read_ncm_account_from_conn(&conn, user_id).map(Some)
    }

    pub fn mark_ncm_account_signed_in(
        &self,
        user_id: i64,
    ) -> Result<Option<NcmAccountRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_millis_i64();
        let changed = conn
            .execute(
                r#"
                UPDATE ncm_accounts
                SET signin_at_ms = ?2,
                    refreshed_at_ms = ?2
                WHERE user_id = ?1
                "#,
                params![user_id, now],
            )
            .map_err(|e| format!("Failed to update NCM account signin time: {}", e))?;
        if changed == 0 {
            return Ok(None);
        }
        read_ncm_account_from_conn(&conn, user_id).map(Some)
    }

    pub fn set_active_ncm_account(&self, user_id: i64) -> Result<NcmAccountRecord, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let account = read_ncm_account_from_conn(&conn, user_id)?;
        set_active_ncm_user_id_in_conn(&conn, Some(user_id))?;
        Ok(account)
    }

    pub fn clear_active_ncm_account(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        set_active_ncm_user_id_in_conn(&conn, None)
    }

    pub fn delete_ncm_account(&self, user_id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM ncm_accounts WHERE user_id = ?1",
            params![user_id],
        )
        .map_err(|e| format!("Failed to delete NCM account: {}", e))?;
        if active_ncm_user_id_from_conn(&conn)? == Some(user_id) {
            set_active_ncm_user_id_in_conn(&conn, None)?;
        }
        Ok(())
    }
}

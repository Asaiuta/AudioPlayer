use super::super::types::{NcmPlaylistSummary, NcmTrackSummary};
use super::read_non_empty_string;
use super::tracks::read_track_summary;
use serde_json::Value;

pub(in crate::server::netease) fn read_user_playlists(payload: &Value) -> Vec<NcmPlaylistSummary> {
    payload
        .get("playlist")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(read_playlist_summary)
        .collect()
}

pub(in crate::server::netease) fn filter_playlist_summaries(
    playlists: Vec<NcmPlaylistSummary>,
    mode: Option<&str>,
) -> Vec<NcmPlaylistSummary> {
    match mode {
        Some("created-playlists") => playlists
            .into_iter()
            .filter(|playlist| !playlist.subscribed)
            .collect(),
        Some("collected-playlists") => playlists
            .into_iter()
            .filter(|playlist| playlist.subscribed)
            .collect(),
        _ => playlists,
    }
}

pub(in crate::server::netease) fn read_search_playlists(
    payload: &Value,
) -> Vec<NcmPlaylistSummary> {
    payload
        .get("result")
        .and_then(|result| result.get("playlists"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(read_playlist_summary)
        .collect()
}

pub(in crate::server::netease) fn read_playlist_tracks(payload: &Value) -> Vec<NcmTrackSummary> {
    let root_songs = payload.get("songs").and_then(Value::as_array);
    let playlist_tracks = payload
        .get("playlist")
        .and_then(|playlist| playlist.get("tracks"))
        .and_then(Value::as_array);
    root_songs
        .or(playlist_tracks)
        .into_iter()
        .flatten()
        .filter_map(read_track_summary)
        .collect()
}

pub(in crate::server::netease) fn read_playlist_summary(
    value: &Value,
) -> Option<NcmPlaylistSummary> {
    let item = value.as_object()?;
    let id = item.get("id").and_then(Value::as_i64)?;
    let name = item.get("name").and_then(read_non_empty_string)?;
    Some(NcmPlaylistSummary {
        id,
        name,
        creator: item
            .get("creator")
            .and_then(|creator| creator.get("nickname"))
            .and_then(read_non_empty_string),
        cover_url: item.get("coverImgUrl").and_then(read_non_empty_string),
        track_count: item.get("trackCount").and_then(Value::as_i64),
        subscribed: item
            .get("subscribed")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    })
}

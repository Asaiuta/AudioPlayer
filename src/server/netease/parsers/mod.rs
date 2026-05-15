mod discover;
mod home_feed;
mod playlists;
mod tracks;

use super::types::NcmArtistSummary;
use serde_json::Value;

pub(in crate::server::netease) use discover::*;
pub(in crate::server::netease) use home_feed::*;
pub(in crate::server::netease) use playlists::*;
pub(in crate::server::netease) use tracks::*;

pub(in crate::server::netease) fn read_non_empty_string(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn read_artists(value: Option<&Value>) -> Option<String> {
    let names = value?
        .as_array()?
        .iter()
        .filter_map(|item| item.get("name").and_then(read_non_empty_string))
        .collect::<Vec<_>>();
    if names.is_empty() {
        None
    } else {
        Some(names.join(", "))
    }
}

fn read_artist_summaries(value: Option<&Value>) -> Vec<NcmArtistSummary> {
    value
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let id = item.get("id").and_then(Value::as_i64)?;
            let name = item.get("name").and_then(read_non_empty_string)?;
            Some(NcmArtistSummary { id, name })
        })
        .collect()
}

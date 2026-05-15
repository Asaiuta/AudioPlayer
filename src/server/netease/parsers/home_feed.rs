use super::super::types::{
    NcmHomeFeedCard, NcmHomePersonalFmPreview, NcmHomeTrackCover, NcmTrackSummary,
};
use super::{read_artists, read_non_empty_string};
use serde_json::Value;

pub(in crate::server::netease) fn read_personalized_playlist_cards(
    payload: &Value,
) -> Vec<NcmHomeFeedCard> {
    payload
        .get("result")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(read_personalized_playlist_card)
        .collect()
}

pub(in crate::server::netease) fn read_recommend_resource_cards(
    payload: &Value,
) -> Vec<NcmHomeFeedCard> {
    payload
        .get("recommend")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(read_recommend_resource_card)
        .collect()
}

pub(in crate::server::netease) fn read_newest_album_cards(payload: &Value) -> Vec<NcmHomeFeedCard> {
    payload
        .get("albums")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(read_newest_album_card)
        .collect()
}

pub(in crate::server::netease) fn read_top_artist_cards(payload: &Value) -> Vec<NcmHomeFeedCard> {
    payload
        .get("artists")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(read_top_artist_card)
        .collect()
}

pub(in crate::server::netease) fn read_personalized_mv_cards(
    payload: &Value,
) -> Vec<NcmHomeFeedCard> {
    payload
        .get("result")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(read_personalized_mv_card)
        .collect()
}

pub(in crate::server::netease) fn read_personalized_dj_cards(
    payload: &Value,
) -> Vec<NcmHomeFeedCard> {
    payload
        .get("result")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(read_personalized_dj_card)
        .collect()
}

pub(in crate::server::netease) fn read_radar_playlist_card(
    payload: &Value,
) -> Option<NcmHomeFeedCard> {
    let playlist = payload.get("playlist")?.as_object()?;
    let id = playlist.get("id").and_then(Value::as_i64)?;
    let title = playlist.get("name").and_then(read_non_empty_string)?;
    Some(NcmHomeFeedCard {
        id,
        title,
        subtitle: playlist
            .get("creator")
            .and_then(|creator| creator.get("nickname"))
            .and_then(read_non_empty_string),
        cover_url: playlist.get("coverImgUrl").and_then(read_non_empty_string),
        play_count: playlist.get("playCount").and_then(Value::as_f64),
        description: playlist.get("description").and_then(read_non_empty_string),
    })
}

pub(in crate::server::netease) fn track_covers(
    tracks: &[NcmTrackSummary],
) -> Vec<NcmHomeTrackCover> {
    tracks
        .iter()
        .map(|track| NcmHomeTrackCover {
            id: track.song_id,
            url: track.artwork_url.clone(),
        })
        .collect()
}

pub(in crate::server::netease) fn personal_fm_preview(
    tracks: &[NcmTrackSummary],
) -> Option<NcmHomePersonalFmPreview> {
    let track = tracks.first()?;
    let title = track.title.clone()?;
    Some(NcmHomePersonalFmPreview {
        title,
        artist: track.artist.clone(),
        album: track.album.clone(),
        cover_url: track.artwork_url.clone(),
    })
}

fn read_personalized_playlist_card(value: &Value) -> Option<NcmHomeFeedCard> {
    let item = value.as_object()?;
    let id = item.get("id").and_then(Value::as_i64)?;
    let title = item.get("name").and_then(read_non_empty_string)?;
    Some(NcmHomeFeedCard {
        id,
        title,
        subtitle: item
            .get("creator")
            .and_then(|creator| creator.get("nickname"))
            .and_then(read_non_empty_string)
            .or_else(|| item.get("copywriter").and_then(read_non_empty_string)),
        cover_url: item.get("picUrl").and_then(read_non_empty_string),
        play_count: item.get("playCount").and_then(Value::as_f64),
        description: item
            .get("copywriter")
            .and_then(read_non_empty_string)
            .or_else(|| item.get("description").and_then(read_non_empty_string)),
    })
}

fn read_recommend_resource_card(value: &Value) -> Option<NcmHomeFeedCard> {
    let item = value.as_object()?;
    let id = item.get("id").and_then(Value::as_i64)?;
    let title = item.get("name").and_then(read_non_empty_string)?;
    Some(NcmHomeFeedCard {
        id,
        title,
        subtitle: item
            .get("creator")
            .and_then(|creator| creator.get("nickname"))
            .and_then(read_non_empty_string),
        cover_url: item.get("picUrl").and_then(read_non_empty_string),
        play_count: item
            .get("playcount")
            .and_then(Value::as_f64)
            .or_else(|| item.get("playCount").and_then(Value::as_f64)),
        description: item
            .get("copywriter")
            .and_then(read_non_empty_string)
            .or_else(|| item.get("description").and_then(read_non_empty_string)),
    })
}

fn read_newest_album_card(value: &Value) -> Option<NcmHomeFeedCard> {
    let item = value.as_object()?;
    let id = item.get("id").and_then(Value::as_i64)?;
    let title = item.get("name").and_then(read_non_empty_string)?;
    Some(NcmHomeFeedCard {
        id,
        title,
        subtitle: item
            .get("artist")
            .and_then(|artist| artist.get("name"))
            .and_then(read_non_empty_string)
            .or_else(|| read_artists(item.get("artists"))),
        cover_url: item.get("picUrl").and_then(read_non_empty_string),
        play_count: None,
        description: item.get("description").and_then(read_non_empty_string),
    })
}

fn read_top_artist_card(value: &Value) -> Option<NcmHomeFeedCard> {
    let item = value.as_object()?;
    let id = item.get("id").and_then(Value::as_i64)?;
    let title = item.get("name").and_then(read_non_empty_string)?;
    Some(NcmHomeFeedCard {
        id,
        title,
        subtitle: None,
        cover_url: item
            .get("picUrl")
            .and_then(read_non_empty_string)
            .or_else(|| item.get("img1v1Url").and_then(read_non_empty_string)),
        play_count: None,
        description: None,
    })
}

fn read_personalized_mv_card(value: &Value) -> Option<NcmHomeFeedCard> {
    let item = value.as_object()?;
    let id = item.get("id").and_then(Value::as_i64)?;
    let title = item.get("name").and_then(read_non_empty_string)?;
    Some(NcmHomeFeedCard {
        id,
        title,
        subtitle: item
            .get("artistName")
            .and_then(read_non_empty_string)
            .or_else(|| read_artists(item.get("artists"))),
        cover_url: item
            .get("picUrl")
            .and_then(read_non_empty_string)
            .or_else(|| item.get("cover").and_then(read_non_empty_string)),
        play_count: item.get("playCount").and_then(Value::as_f64),
        description: item
            .get("copywriter")
            .and_then(read_non_empty_string)
            .or_else(|| item.get("description").and_then(read_non_empty_string)),
    })
}

fn read_personalized_dj_card(value: &Value) -> Option<NcmHomeFeedCard> {
    let item = value.as_object()?;
    let id = item.get("id").and_then(Value::as_i64)?;
    let title = item.get("name").and_then(read_non_empty_string)?;
    Some(NcmHomeFeedCard {
        id,
        title,
        subtitle: item
            .get("copywriter")
            .and_then(read_non_empty_string)
            .or_else(|| item.get("description").and_then(read_non_empty_string)),
        cover_url: item.get("picUrl").and_then(read_non_empty_string),
        play_count: item.get("playCount").and_then(Value::as_f64),
        description: item
            .get("copywriter")
            .and_then(read_non_empty_string)
            .or_else(|| item.get("description").and_then(read_non_empty_string)),
    })
}

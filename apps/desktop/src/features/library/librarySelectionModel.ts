interface MediaIdCarrier {
  media_id: string | null;
}

export const uniqueMediaIds = (items: ReadonlyArray<MediaIdCarrier | null>): string[] =>
  [
    ...new Set(
      items.flatMap((item) => (item?.media_id ? [item.media_id] : []))
    )
  ];

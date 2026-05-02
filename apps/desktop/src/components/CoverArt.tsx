import { useEffect, useState } from "react";

interface CoverArtProps {
  coverUrl: string | null;
  alt?: string;
}

export function CoverArt({ coverUrl, alt = "Album cover" }: CoverArtProps) {
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setHasFailed(false);
  }, [coverUrl]);

  const showImage = coverUrl !== null && !hasFailed;

  return (
    <div className="cover-art">
      {showImage ? (
        <img
          className="cover-art-image"
          src={coverUrl}
          alt={alt}
          onError={() => setHasFailed(true)}
        />
      ) : (
        <div className="cover-placeholder" aria-hidden="true">
          <span>♪</span>
        </div>
      )}
    </div>
  );
}

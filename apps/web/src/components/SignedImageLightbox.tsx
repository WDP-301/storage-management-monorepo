import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import { UploadsApi } from '../lib/api';
import { type FileRef, SignedFileLink, SignedImageThumb, safeHttpUrl } from './SignedFile';

/** Files without a type are evidence photos, which are always images. */
export const isImageFile = (file: FileRef) => !file.mimeType || file.mimeType.startsWith('image/');

/**
 * Lightbox state for a list of files: `open(file)` shows that image and lets the viewer step
 * through every image of the same list. Render `lightbox` once next to the thumbnails.
 */
export function useImageLightbox(files: FileRef[]) {
  const images = useMemo(() => files.filter(isImageFile), [files]);
  const [index, setIndex] = useState<number | null>(null);
  const open = (file: FileRef) => {
    const at = images.findIndex((img) => img === file);
    setIndex(at >= 0 ? at : null);
  };
  const lightbox = (
    <SignedImageLightbox images={images} index={index} onClose={() => setIndex(null)} />
  );
  return { open, lightbox };
}

/** Thumbnails for images (opening the shared viewer) and links for other files, in one row. */
export const SignedFileGallery: React.FC<{ files: FileRef[] }> = ({ files }) => {
  const { open, lightbox } = useImageLightbox(files);
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((file) =>
        isImageFile(file) ? (
          <SignedImageThumb key={file.fileKey ?? file.url} file={file} onOpen={() => open(file)} />
        ) : (
          <SignedFileLink key={file.fileKey ?? file.url} file={file} />
        ),
      )}
      {lightbox}
    </div>
  );
};

interface Props {
  /** Every image the viewer can step through, in display order. */
  images: FileRef[];
  /** Image to open on; null keeps the viewer closed. */
  index: number | null;
  onClose: () => void;
}

/**
 * Full-screen viewer for private-bucket images. Presigned links expire, so each opening asks for
 * fresh URLs instead of reusing the thumbnails' ones.
 */
export const SignedImageLightbox: React.FC<Props> = ({ images, index, onClose }) => {
  const [urls, setUrls] = useState<(string | null)[] | null>(null);
  const open = index !== null;

  useEffect(() => {
    if (!open) {
      setUrls(null);
      return;
    }
    let cancelled = false;
    // A link that fails to sign shows as an empty slide rather than closing the whole viewer.
    Promise.all(
      images.map((file) =>
        file.fileKey
          ? UploadsApi.downloadUrl(file.fileKey).catch(() => null)
          : Promise.resolve(safeHttpUrl(file.url)),
      ),
    ).then((resolved) => !cancelled && setUrls(resolved));
    return () => {
      cancelled = true;
    };
  }, [open, images]);

  return (
    <Lightbox
      open={open && urls !== null}
      close={onClose}
      index={index ?? 0}
      slides={images.map((file, i) => ({ src: urls?.[i] ?? '', alt: file.name }))}
      plugins={[Zoom, Counter]}
      // One image needs no arrows or wrap-around.
      carousel={{ finite: images.length <= 1 }}
      render={images.length <= 1 ? { buttonPrev: () => null, buttonNext: () => null } : undefined}
    />
  );
};

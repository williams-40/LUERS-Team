import { Modal } from './Modal';

/**
 * Evidence photos/videos previously opened in a new browser tab. Reporters
 * and responders reviewing evidence stay in the app instead — same pattern
 * as every other overlay in the app (FeedbackModal, ConfirmDialog).
 */
export function MediaViewerModal({
  url,
  fileType,
  label,
  onClose,
}: {
  url: string;
  fileType: 'image' | 'video';
  label: string;
  onClose: () => void;
}) {
  return (
    <Modal title={label} onClose={onClose} size="lg">
      {fileType === 'video' ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={url}
          controls
          autoPlay
          className="max-h-[75vh] w-full rounded-lg bg-black"
        />
      ) : (
        <img src={url} alt={label} className="max-h-[75vh] w-full rounded-lg object-contain" />
      )}
    </Modal>
  );
}

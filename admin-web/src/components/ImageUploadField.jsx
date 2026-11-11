import { useRef, useState } from 'react';
import { Button } from 'antd';
import { newIdempotencyKey } from '../api/idempotency.js';
import { ConfirmActionModal } from './ConfirmActionModal.jsx';
import { completeUpload, createUploadUrl, putToStorage } from './imageUploadApi.js';

const ACCEPTED_TYPES = ['image/png', 'image/webp', 'image/jpeg']; // M84 `mimeType`
const MAX_BYTES = 2 * 1024 * 1024; // M84 `sizeBytes` (≤2MB)
const WRONG_TYPE_TEXT = 'PNG, WebP, JPEG 이미지만 올릴 수 있어요.';
const TOO_BIG_TEXT = '2MB 이하의 이미지만 올릴 수 있어요.';

/**
 * Image field of ADM-25 (badge) and ADM-26 (pet stage). Picking a file opens a
 * `ConfirmActionModal` (reason + Idempotency-Key); confirming runs
 * M84 (upload URL) -> PUT to the storage -> M85 (complete) and then calls `onChange(assetId)`.
 * Trying again in the same modal repeats the steps with the same keys.
 *
 * @param {object} props
 * @param {'badge'|'pet_stage'} props.assetKind
 * @param {string} [props.ownerId] achievement ID or pet species ID; the button is disabled
 *   until it exists
 * @param {string|null} [props.value] current `assetId`
 * @param {(assetId: string) => void} props.onChange
 */
export function ImageUploadField({ assetKind, ownerId, value, onChange }) {
  const inputRef = useRef(null);
  const completeKeyRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);

  const handleFileChosen = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // so that the same file can be chosen again
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError(WRONG_TYPE_TEXT);
    } else if (file.size > MAX_BYTES) {
      setFileError(TOO_BIG_TEXT);
    } else {
      setFileError(null);
      completeKeyRef.current = newIdempotencyKey(); // key of M85 for this choice
      setPendingFile(file);
    }
  };

  const handleSubmit = async ({ reason, idempotencyKey }) => {
    const ticket = await createUploadUrl(
      {
        assetKind,
        ownerId,
        mimeType: pendingFile.type,
        sizeBytes: pendingFile.size,
        reason,
      },
      idempotencyKey,
    );
    await putToStorage(ticket, pendingFile);
    const done = await completeUpload(ticket.assetId, { reason }, completeKeyRef.current);
    setImageUrl(done.imageUrl);
    setPendingFile(null);
    onChange(done.assetId);
  };

  return (
    <div>
      {imageUrl && (
        <img src={imageUrl} alt="" style={{ display: 'block', maxWidth: 160, marginBottom: 8 }} />
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        hidden
        data-testid="image-upload-input"
        onChange={handleFileChosen}
      />
      <Button disabled={!ownerId} onClick={() => inputRef.current?.click()}>
        {value ? '이미지 교체' : '이미지 선택'}
      </Button>
      {fileError && (
        <div role="alert" style={{ color: '#ff4d4f', marginTop: 4 }}>
          {fileError}
        </div>
      )}
      <ConfirmActionModal
        open={pendingFile !== null}
        title="이미지 업로드"
        summary={pendingFile?.name}
        onSubmit={handleSubmit}
        onCancel={() => setPendingFile(null)}
      />
    </div>
  );
}

import { EvtcError } from './errors.js';
import { EVTC_PARSE_LIMITS } from './parser.js';

export const EVTC_FILE_LIMITS = Object.freeze({
  maximumCompressedBytes: 64 * 1024 * 1024,
  maximumExpandedBytes: EVTC_PARSE_LIMITS.maximumExpandedBytes,
  maximumExpansionRatio: 200
});

const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_CENTRAL_HEADER = 0x02014b50;
const ZIP_END = 0x06054b50;
const MAX_END_SEARCH = 65_557;

function signature(view: DataView, offset: number): number {
  return offset + 4 <= view.byteLength ? view.getUint32(offset, true) : -1;
}

function findEndOfCentralDirectory(view: DataView): number {
  const first = Math.max(0, view.byteLength - MAX_END_SEARCH);
  for (let offset = view.byteLength - 22; offset >= first; offset -= 1) {
    if (signature(view, offset) === ZIP_END) return offset;
  }

  return -1;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(compressed: Uint8Array, maximumBytes: number): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new EvtcError(
      'UNSUPPORTED_COMPRESSION',
      'This browser cannot expand deflate-compressed EVTC files. Use an uncompressed .evtc file or a current browser.'
    );
  }

  let stream: DecompressionStream;
  try {
    stream = new DecompressionStream('deflate-raw');
  } catch {
    throw new EvtcError(
      'UNSUPPORTED_COMPRESSION',
      'This browser does not support raw-deflate ZIP entries. Use an uncompressed .evtc file or a current browser.'
    );
  }

  const compressedCopy = new Uint8Array(compressed.byteLength);
  compressedCopy.set(compressed);
  const reader = new Blob([compressedCopy.buffer]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();

    if (done) break;
    total += value.byteLength;

    if (total > maximumBytes) {
      await reader.cancel();
      throw new EvtcError('EXPANDED_SIZE_EXCEEDED', 'The expanded EVTC file exceeds the 512 MiB safety limit.');
    }

    chunks.push(value);
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

async function expandZip(bytes: Uint8Array): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfCentralDirectory(view);

  if (end < 0) {
    throw new EvtcError('INVALID_ZIP', 'The ZIP central directory is missing.');
  }

  const disk = view.getUint16(end + 4, true);
  const centralDisk = view.getUint16(end + 6, true);
  const entriesOnDisk = view.getUint16(end + 8, true);
  const entryCount = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);

  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new EvtcError('INVALID_ZIP', 'Multi-disk ZIP files are not supported.');
  }

  if (entryCount !== 1) {
    throw new EvtcError('INVALID_ZIP', 'An EVTC ZIP must contain exactly one file entry.', { entryCount });
  }

  if (centralOffset + centralSize > end || signature(view, centralOffset) !== ZIP_CENTRAL_HEADER) {
    throw new EvtcError('INVALID_ZIP', 'The ZIP central directory is invalid.');
  }

  const flags = view.getUint16(centralOffset + 8, true);
  const compressionMethod = view.getUint16(centralOffset + 10, true);
  const expectedCrc = view.getUint32(centralOffset + 16, true);
  const compressedSize = view.getUint32(centralOffset + 20, true);
  const expandedSize = view.getUint32(centralOffset + 24, true);
  const localOffset = view.getUint32(centralOffset + 42, true);

  if ([compressedSize, expandedSize, localOffset].includes(0xffffffff)) {
    throw new EvtcError('INVALID_ZIP', 'ZIP64 EVTC archives are not supported.');
  }

  if ((flags & 1) !== 0) {
    throw new EvtcError('INVALID_ZIP', 'Encrypted EVTC ZIP entries are not supported.');
  }

  if (expandedSize > EVTC_FILE_LIMITS.maximumExpandedBytes) {
    throw new EvtcError(
      'EXPANDED_SIZE_EXCEEDED',
      'The ZIP declares an expanded EVTC larger than the 512 MiB safety limit.'
    );
  }

  if (compressedSize > 0 && expandedSize / compressedSize > EVTC_FILE_LIMITS.maximumExpansionRatio) {
    throw new EvtcError('ZIP_BOMB', 'The ZIP expansion ratio exceeds the EVTC safety limit.');
  }

  if (signature(view, localOffset) !== ZIP_LOCAL_HEADER) {
    throw new EvtcError('INVALID_ZIP', 'The ZIP local entry header is invalid.');
  }

  const localMethod = view.getUint16(localOffset + 8, true);
  const nameLength = view.getUint16(localOffset + 26, true);
  const extraLength = view.getUint16(localOffset + 28, true);
  const payloadOffset = localOffset + 30 + nameLength + extraLength;

  if (localMethod !== compressionMethod || payloadOffset + compressedSize > bytes.byteLength) {
    throw new EvtcError('INVALID_ZIP', 'The ZIP entry metadata is inconsistent.');
  }

  const compressed = bytes.subarray(payloadOffset, payloadOffset + compressedSize);
  let expanded: Uint8Array;

  if (compressionMethod === 0) {
    expanded = compressed.slice();
  } else if (compressionMethod === 8) {
    expanded = await inflateRaw(compressed, EVTC_FILE_LIMITS.maximumExpandedBytes);
  } else {
    throw new EvtcError('UNSUPPORTED_COMPRESSION', `ZIP compression method ${compressionMethod} is not supported.`, {
      compressionMethod
    });
  }

  if (expanded.byteLength !== expandedSize) {
    throw new EvtcError(
      'INVALID_ZIP',
      `The ZIP entry expanded to ${expanded.byteLength} bytes; expected ${expandedSize}.`
    );
  }

  if (crc32(expanded) !== expectedCrc) {
    throw new EvtcError('INVALID_ZIP', 'The EVTC ZIP entry failed its CRC check.');
  }

  return expanded;
}

export async function decompressEvtcInput(input: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isZip = signature(view, 0) === ZIP_LOCAL_HEADER;

  if (isZip && bytes.byteLength > EVTC_FILE_LIMITS.maximumCompressedBytes) {
    throw new EvtcError('FILE_TOO_LARGE', 'The selected file exceeds the 64 MiB compressed-file safety limit.');
  }

  if (!isZip && bytes.byteLength > EVTC_FILE_LIMITS.maximumExpandedBytes) {
    throw new EvtcError('EXPANDED_SIZE_EXCEEDED', 'The EVTC file exceeds the 512 MiB expanded-file safety limit.');
  }

  if (isZip) return expandZip(bytes);
  return bytes;
}

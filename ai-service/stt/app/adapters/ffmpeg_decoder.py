"""
FFmpeg Streaming Decoder — infrastructure layer.

Uses a subprocess to decode compressed audio bytes (WebM, MP3, etc.)
into raw PCM 16-kHz mono samples in real-time.
"""
from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)


class StreamingDecoder:
    """
    Spawns an FFmpeg process and provides a pipe-based interface for
    incremental decoding.
    """

    def __init__(self, sample_rate: int = 16_000) -> None:
        self._sample_rate = sample_rate
        self._process: asyncio.subprocess.Process | None = None

    async def start(self) -> None:
        """Launch the FFmpeg process."""
        try:
            self._process = await asyncio.create_subprocess_exec(
                "ffmpeg",
                "-loglevel", "quiet",
                "-i", "pipe:0",
                "-f", "s16le",
                "-acodec", "pcm_s16le",
                "-ar", str(self._sample_rate),
                "-ac", "1",
                "pipe:1",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            logger.info("FFmpeg streaming decoder started.")
        except Exception as exc:
            logger.error("Failed to start FFmpeg: %s", exc)
            raise

    async def push(self, data: bytes) -> None:
        """Write compressed bytes to FFmpeg's stdin."""
        if not self._process or not self._process.stdin:
            return

        if data:
            self._process.stdin.write(data)
            # We don't necessarily need to drain every time if chunks are small,
            # but it's safer for flow control.
            try:
                await self._process.stdin.drain()
            except ConnectionResetError:
                logger.warning("FFmpeg stdin closed unexpectedly.")

    async def read(self, limit: int = 4096) -> bytes:
        """
        Read decoded PCM bytes from FFmpeg's stdout.
        This is a non-blocking (async) read. It might return an empty
        byte string if no data is available yet.
        """
        if not self._process or not self._process.stdout:
            return b""

        # Use read(limit) or readexactly if we know the size.
        # read(limit) returns up to 'limit' bytes.
        try:
            # Note: We use read(limit) which will wait until AT LEAST one byte
            # is available or EOF is reached. In a streaming context,
            # we might want to read whatever is in the pipe buffer without waiting.
            # However, asyncio doesn't have a direct "read_available".
            # But for gRPC chunks, we usually have enough data to trigger some output.
            
            # Use a small timeout or just trust that FFmpeg is fast enough.
            # Actually, if we don't want to block the loop, we should be careful.
            # But this is a dedicated task per stream, so it's okay to await.
            return await self._process.stdout.read(limit)
        except Exception as exc:
            logger.error("Error reading from FFmpeg: %s", exc)
            return b""

    async def stop(self) -> None:
        """Close pipes and wait for the process to exit."""
        if not self._process:
            return

        logger.info("Stopping FFmpeg decoder...")
        if self._process.stdin:
            try:
                self._process.stdin.close()
                await self._process.stdin.wait_closed()
            except Exception:
                pass

        try:
            # Give it a moment to finish
            await asyncio.wait_for(self._process.wait(), timeout=2.0)
        except asyncio.TimeoutError:
            logger.warning("FFmpeg did not exit gracefully, killing.")
            self._process.kill()
        
        self._process = None

import uuid
import random
from typing import Dict, List

# In-memory session store.
# For real production you'd move this to Redis / DB.
_sessions: Dict[str, Dict[str, List]] = {}

CHUNK_SIZE = 9500  # ~9.5k characters per chunk


def create_session(full_text: str) -> str:
    """
    Split full_text into CHUNK_SIZE chunks and create a new session.
    Returns session_id.
    """
    if not full_text or not full_text.strip():
        raise ValueError("Empty text for session.")

    chunks = [full_text[i:i + CHUNK_SIZE] for i in range(0, len(full_text), CHUNK_SIZE)]

    # Remove totally empty chunks just in case
    chunks = [c for c in chunks if c.strip()]
    if not chunks:
        raise ValueError("No non-empty chunks after splitting text.")

    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "chunks": chunks,
        "unused_indices": list(range(len(chunks))),
    }
    return session_id


def get_random_chunk(session_id: str) -> str:
    """
    Return a random unused chunk from the session.
    If all chunks have been used, reset the unused list and continue.
    """
    session = _sessions.get(session_id)
    if not session:
        raise KeyError("Session not found.")

    chunks: List[str] = session.get("chunks", [])
    unused: List[int] = session.get("unused_indices", [])

    if not chunks:
        raise KeyError("No chunks stored for this session.")

    # All chunks used at least once: reset and start again
    if not unused:
        unused = list(range(len(chunks)))
        session["unused_indices"] = unused

    idx = random.choice(unused)
    unused.remove(idx)
    session["unused_indices"] = unused

    return chunks[idx]

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.generate_quiz import generate_quiz
from backend.chunk_manager import create_session, get_random_chunk

from io import BytesIO
from pypdf import PdfReader
from docx import Document


app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SessionRequest(BaseModel):
    session_id: str


# ---------------------------
# TEXT EXTRACTION
# ---------------------------

def extract_text_from_upload(filename: str, file_bytes: bytes) -> str:
    filename_lower = filename.lower()

    # TXT
    if filename_lower.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="ignore")

    # PDF
    if filename_lower.endswith(".pdf"):
        reader = PdfReader(BytesIO(file_bytes))
        pages_text = []
        for i, page in enumerate(reader.pages):
            txt = page.extract_text() or ""
            pages_text.append(f"\n\n=== PUSLAPIS {i+1} ===\n\n{txt}")
        return "\n".join(pages_text)

    # DOCX
    if filename_lower.endswith(".docx"):
        doc = Document(BytesIO(file_bytes))
        parts = []
        for para in doc.paragraphs:
            t = para.text.strip()
            if not t:
                continue
            style = para.style.name if para.style else ""
            if "Heading" in style:
                parts.append(f"\n\n### {t}\n")
            else:
                parts.append(t)
        return "\n\n".join(parts)

    # Fallback
    return file_bytes.decode("utf-8", errors="ignore")


# ---------------------------
# FIRST GENERATION
# ---------------------------

@app.post("/generate")
async def generate_first_quiz(
    file: UploadFile = File(...),
    question_count: int = Form(...),
    difficulty: str = Form("medium")
):
    """
    Handles first-time generation:
    - Extracts text
    - Creates session
    - Selects a chunk
    - Generates MCQs using dynamic count and difficulty
    """
    file_bytes = await file.read()
    content = extract_text_from_upload(file.filename, file_bytes)

    if not content.strip():
        return {
            "quiz": "Nepavyko išgauti teksto iš failo.",
            "session_id": None,
        }

    try:
        session_id = create_session(content)
        chunk = get_random_chunk(session_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Generate quiz with requested count and difficulty
    result = generate_quiz(chunk, question_count, difficulty)

    return {"quiz": result, "session_id": session_id}


# ---------------------------
# RE-GENERATION FROM SAME SESSION
# ---------------------------

@app.post("/generate_again")
async def generate_again(
    session_id: str = Form(...),
    question_count: int = Form(...),
    difficulty: str = Form("medium")
):
    """
    Regenerates MCQs but keeps session and difficulty.
    """
    try:
        chunk = get_random_chunk(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = generate_quiz(chunk, question_count, difficulty)

    return {"quiz": result, "session_id": session_id}

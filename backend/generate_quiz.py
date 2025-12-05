import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# ---------------------------
# CLEANER
# ---------------------------

def clean_output(text: str) -> str:
    text = text.strip()

    if text.startswith('"""') and text.endswith('"""'):
        text = text[3:-3].strip()

    replacements = [
        ("### SECOND BLOCK", "### ANTRAS BLOKAS"),
        ("### SECOND  BLOCK", "### ANTRAS BLOKAS"),
        ("### ANTRASIS BLOKAS", "### ANTRAS BLOKAS"),
        ("### ANTRAS BLOKAS (SLĖPTAS ATSAKYMŲ RAKTAS)", "### ANTRAS BLOKAS"),
    ]
    for old, new in replacements:
        text = text.replace(old, new)

    if "### FIRST BLOCK" in text:
        text = text.replace("### FIRST BLOCK", "### PIRMAS BLOKAS")

    return text


# ---------------------------
# GENERATION PIPELINE (UPDATED)
# ---------------------------

def generate_quiz(content: str, count: int, difficulty: str) -> str:
    """
    Full MCQ generation pipeline with dynamic question count and difficulty.
    difficulty ∈ {"easy", "medium", "hard"}
    """

    # normalize difficulty to known model-friendly descriptions
    difficulty_instruction = {
        "easy": "Write simple recall questions with very clear correct answers.",
        "medium": "Write moderately challenging comprehension questions.",
        "hard": "Write difficult inference-based, analytical questions requiring deeper understanding.",
    }.get(difficulty, "Write moderately challenging comprehension questions.")

    # ==========================
    # STEP 1 — Extract facts
    # ==========================

    fact_prompt = f"""
Extract ONLY literal factual statements from the text below.

Rules:
- No paraphrasing.
- No extra knowledge.
- 30–80 atomic facts.
- Each fact = one simple sentence.

TEXT:
\"\"\"{content}\"\"\""""

    resp_facts = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "Extract literal factual statements only."},
            {"role": "user", "content": fact_prompt},
        ],
    )
    facts = resp_facts.choices[0].message.content.strip()

    # ==========================
    # STEP 2 — Generate MCQs
    # ==========================

    mcq_prompt = f"""
Using ONLY the factual statements below, generate {count} multiple-choice questions (MCQs) in ENGLISH.

Difficulty rule:
{difficulty_instruction}

STRICT FORMAT:

### FIRST BLOCK (FOR USER)
1) [question]
A) [answer]
B) [answer]
C) [answer]
D) [answer]

...
{count}) [question]
A) ...
B) ...
C) ...
D) ...

### SECOND BLOCK (HIDDEN ANSWER KEY)
List {count} answers in order:

1) A
2) C
...
{count}) D

Rules:
- Exactly {count} MCQs.
- No external information.
- Only ONE correct option.
- Keep formatting EXACT.
- Use only the given facts.
- Difficulty must follow: {difficulty} level.

FACTS:
\"\"\"{facts}\"\"\""""

    resp_mcq = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "Generate MCQs strictly from the facts."},
            {"role": "user", "content": mcq_prompt},
        ],
    )
    english_mcqs = resp_mcq.choices[0].message.content.strip()

    # ==========================
    # STEP 3 — Translate to LT
    # ==========================

    translation_prompt = f"""
Translate EVERYTHING below into fluent Lithuanian.

STRICT RULES:
- Keep numbering EXACT.
- Keep A/B/C/D EXACT.
- Do NOT change formatting.

TEXT:
\"\"\"{english_mcqs}\"\"\""""

    resp_lt = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "Translate perfectly to Lithuanian."},
            {"role": "user", "content": translation_prompt},
        ],
    )
    lt_output = resp_lt.choices[0].message.content.strip()

    # Cleanup
    return clean_output(lt_output)

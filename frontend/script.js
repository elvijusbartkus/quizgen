/* =====================================
   GLOBAL STATE
===================================== */

let quizData = null;
let currentMode = "edit";

/* =====================================
   SHUFFLE FUNCTION
===================================== */

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

/* =====================================
   SHUFFLE ANSWERS (optional)
===================================== */

function shuffleAnswersForAll() {
    quizData.forEach(q => {
        const correctText = q.options[q.correctIndex];

        shuffleArray(q.options);

        q.correctIndex = q.options.indexOf(correctText);
    });
}

/* =====================================
   DOM REFERENCES
===================================== */

const fileInput = document.getElementById("fileInput");
const fileNameSpan = document.getElementById("fileName");
const generateBtn = document.getElementById("generateBtn");

const slider = document.getElementById("questionSlider");
const sliderValue = document.getElementById("sliderValue");

// difficulty selector
const difficultySelector = () =>
    document.querySelector('input[name="difficulty"]:checked').value;

const editBanner = document.getElementById("edit-banner");
const modeToggle = document.getElementById("mode-toggle");
const editModeBtn = document.getElementById("editModeBtn");
const quizModeBtn = document.getElementById("quizModeBtn");

const loadingOverlay = document.getElementById("loading-overlay");
const quizContainer = document.getElementById("quiz-container");
const extraButtons = document.getElementById("extra-buttons");
const resultBox = document.getElementById("result");
const successCheck = document.getElementById("success-check");

const againBtn = document.getElementById("againBtn");
const pdfBtn = document.getElementById("pdfBtn");
const shuffleBtn = document.getElementById("shuffleBtn"); // NEW

/* =====================================
   FILE NAME DISPLAY
===================================== */

fileInput.addEventListener("change", function () {
    const file = this.files.length ? this.files[0] : null;
    fileNameSpan.textContent = file ? file.name : "Failas nepasirinktas";
});

/* =====================================
   SLIDER UI
===================================== */

function updateSliderUI() {
    const min = Number(slider.min);
    const max = Number(slider.max);
    const val = Number(slider.value);

    const percent = ((val - min) / (max - min)) * 100;

    sliderValue.textContent = val;
    sliderValue.style.left = `calc(${percent}% )`;
}

slider.addEventListener("input", updateSliderUI);
updateSliderUI();

/* =====================================
   PARSE QUIZ TEXT
===================================== */

function parseQuizText(rawText) {
    const lines = rawText.split("\n").map(l => l.trim()).filter(l => l);
    const quiz = [];
    let current = null;

    lines.forEach(line => {
        const qMatch = line.match(/^(\d+)\)\s+(.*)/);
        if (qMatch && !["A", "B", "C", "D"].includes(qMatch[2][0])) {
            if (current) quiz.push(current);
            current = { question: qMatch[2], options: [], correctIndex: null };
            return;
        }

        const optMatch = line.match(/^([A-D])\)\s+(.*)/);
        if (optMatch && current) {
            current.options.push(optMatch[2]);
            return;
        }

        const keyMatch = line.match(/^(\d+)\)\s+([A-D])$/);
        if (keyMatch) {
            const qIndex = parseInt(keyMatch[1]) - 1;
            const idx = "ABCD".indexOf(keyMatch[2]);
            if (quiz[qIndex]) quiz[qIndex].correctIndex = idx;
        }
    });

    if (current) quiz.push(current);

    return quiz;
}

/* =====================================
   GENERATE QUIZ (UPDATED WITH DIFFICULTY)
===================================== */

generateBtn.addEventListener("click", generateQuiz);

async function generateQuiz() {
    if (!fileInput.files.length) {
        alert("Įkelkite failą");
        return;
    }

    loadingOverlay.style.display = "flex";
    quizContainer.innerHTML = "";
    extraButtons.style.display = "none";
    editBanner.style.display = "none";
    modeToggle.style.display = "none";

    const selectedCount = slider.value;
    const difficulty = difficultySelector(); // NEW

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("question_count", selectedCount);
    formData.append("difficulty", difficulty); // NEW

    try {
        const response = await fetch("http://127.0.0.1:8000/generate", {
            method: "POST",
            body: formData
        });

        loadingOverlay.style.display = "none";

        const data = await response.json();

        if (!data.quiz) {
            alert("Nepavyko sugeneruoti testo");
            return;
        }

        quizData = parseQuizText(data.quiz);

        shuffleArray(quizData);
        shuffleAnswersForAll();

        currentMode = "quiz";

        modeToggle.style.display = "flex";
        extraButtons.style.display = "flex";
        editBanner.style.display = "none";

        updateModeButtonsUI();
        renderQuizMode();

    } catch (err) {
        loadingOverlay.style.display = "none";
        console.error(err);
        alert("Klaida jungiantis prie serverio");
    }
}

/* =====================================
   MODE TOGGLE
===================================== */

editModeBtn.addEventListener("click", () => {
    currentMode = "edit";
    updateModeButtonsUI();
    renderEditMode();
    resultBox.innerHTML = "";
    hideSuccessCheck();
});

quizModeBtn.addEventListener("click", () => {
    currentMode = "quiz";
    updateModeButtonsUI();
    renderQuizMode();
    resultBox.innerHTML = "";
    hideSuccessCheck();
});

function updateModeButtonsUI() {
    editModeBtn.classList.toggle("active", currentMode === "edit");
    quizModeBtn.classList.toggle("active", currentMode === "quiz");
}

/* =====================================
   EDIT MODE
===================================== */

function renderEditMode() {
    quizContainer.innerHTML = "";

    quizData.forEach((q, i) => {
        const block = document.createElement("div");
        block.className = "question-block";

        const title = document.createElement("div");
        title.className = "question-title";
        title.textContent = `Klausimas ${i + 1}`;
        block.appendChild(title);

        const text = document.createElement("div");
        text.className = "editable";
        text.contentEditable = true;
        text.innerText = q.question;
        text.oninput = () => (quizData[i].question = text.innerText);
        block.appendChild(text);

        q.options.forEach((opt, j) => {
            const optDiv = document.createElement("div");
            optDiv.className = "editable";
            optDiv.contentEditable = true;
            optDiv.innerText = opt;
            optDiv.oninput = () =>
                (quizData[i].options[j] = optDiv.innerText);
            block.appendChild(optDiv);
        });

        quizContainer.appendChild(block);
    });
}

/* =====================================
   QUIZ MODE
===================================== */

function renderQuizMode() {
    quizContainer.innerHTML = "";

    quizData.forEach((q, i) => {
        const qDiv = document.createElement("div");
        qDiv.className = "quiz-question";

        const qText = document.createElement("p");
        qText.textContent = `${i + 1}. ${q.question}`;
        qDiv.appendChild(qText);

        q.options.forEach((opt, j) => {
            const label = document.createElement("label");
            label.dataset.questionIndex = i;
            label.dataset.optionIndex = j;

            const input = document.createElement("input");
            input.type = "radio";
            input.name = `question-${i}`;
            input.value = j;

            label.appendChild(input);
            label.appendChild(document.createTextNode(" " + opt));

            qDiv.appendChild(label);
        });

        quizContainer.appendChild(qDiv);
    });

    const btn = document.createElement("button");
    btn.textContent = "Patikrinti atsakymus";
    btn.addEventListener("click", checkAnswers);
    quizContainer.appendChild(btn);
}

/* =====================================
   SHUFFLE BUTTON
===================================== */

shuffleBtn.addEventListener("click", () => {
    shuffleArray(quizData);
    shuffleAnswersForAll();
    renderQuizMode();
    resultBox.innerHTML = "";
    hideSuccessCheck();
});

/* =====================================
   ANSWER CHECKING
===================================== */

function checkAnswers() {
    let correctCount = 0;

    quizData.forEach((q, i) => {
        const selected = document.querySelector(
            `input[name="question-${i}"]:checked`
        );

        const correctIndex = q.correctIndex;

        const labels = quizContainer.querySelectorAll(
            `label[data-question-index="${i}"]`
        );

        labels.forEach(label => {
            const idx = Number(label.dataset.optionIndex);
            if (idx === correctIndex) label.classList.add("correct-answer");
        });

        if (selected) {
            if (Number(selected.value) === correctIndex) correctCount++;
            else {
                const wrong = quizContainer.querySelector(
                    `label[data-question-index="${i}"][data-option-index="${selected.value}"]`
                );
                if (wrong) wrong.classList.add("wrong-answer");
            }
        }
    });

    resultBox.innerHTML = `<strong>Rezultats:</strong> ${correctCount} iš ${quizData.length}.`;

    if (correctCount === quizData.length) showSuccessCheck();
    else hideSuccessCheck();
}

/* =====================================
   SUCCESS CHECK
===================================== */

function showSuccessCheck() {
    successCheck.classList.add("show");
}

function hideSuccessCheck() {
    successCheck.classList.remove("show");
}

/* =====================================
   AGAIN & PDF
===================================== */

againBtn.addEventListener("click", () => {
    window.location.reload();
});

pdfBtn.addEventListener("click", async () => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    const canvas = await html2canvas(quizContainer);
    const img = canvas.toDataURL("image/png");

    pdf.addImage(img, "PNG", 10, 10, 180, 0);
    pdf.save("testas.pdf");
});

document.addEventListener("DOMContentLoaded", () => {
  const SCORE_KEY = "zeroday_score";

  const state = {
    mode: null,
    allQuestions: [],
    filteredQuestions: [],
    currentIndex: 0,
    score: Number(localStorage.getItem(SCORE_KEY)) || 0,
    streak: 0,
    answered: false,
    pyqQuestions: [],
    curatedBooklets: {},
    mockTests: {},
  };

  const elements = {
    modeTagline: document.getElementById("mode-tagline"),
    scoreDisplay: document.getElementById("score-display"),
    streakDisplay: document.getElementById("streak-display"),
    modeScreen: document.getElementById("mode-screen"),
    curatedScreen: document.getElementById("curated-screen"),
    mockConfigScreen: document.getElementById("mock-config-screen"),
    solverScreen: document.getElementById("solver-screen"),
    modeMockBtn: document.getElementById("mode-mock"),
    modePyqBtn: document.getElementById("mode-pyq"),
    modeCuratedBtn: document.getElementById("mode-curated"),
    curatedBackBtn: document.getElementById("curated-back"),
    mockBackBtn: document.getElementById("mock-back"),
    mockStartBtn: document.getElementById("mock-start"),
    mockYear: document.getElementById("mock-year"),
    mockShift: document.getElementById("mock-shift"),
    bookletList: document.getElementById("booklet-list"),
    filtersWrap: document.getElementById("filters-wrap"),
    subjectWrap: document.getElementById("subject-wrap"),
    topicLabel: document.getElementById("topic-label"),
    difficultyLabel: document.getElementById("difficulty-label"),
    subjectFilter: document.getElementById("subject-filter"),
    topicFilter: document.getElementById("topic-filter"),
    difficultyFilter: document.getElementById("difficulty-filter"),
    progressText: document.getElementById("progress-text"),
    topicText: document.getElementById("topic-text"),
    questionText: document.getElementById("question-text"),
    questionImage: document.getElementById("question-image"),
    optionsContainer: document.getElementById("options-container"),
    integerAnswerWrap: document.getElementById("integer-answer-wrap"),
    integerAnswer: document.getElementById("integer-answer"),
    checkIntegerBtn: document.getElementById("check-integer-btn"),
    integerFeedback: document.getElementById("integer-feedback"),
    nextBtn: document.getElementById("next-btn"),
    skipBtn: document.getElementById("skip-btn"),
    questionCard: document.getElementById("question-card"),
    emptyState: document.getElementById("empty-state"),
  };

  async function init() {
    updateScore(0, false);
    const [pyqRes, curatedRes, mockRes, chemistryRes] = await Promise.all([
      fetch("questions.json"),
      fetch("curated_booklets.json"),
      fetch("mock_tests.json"),
      fetch("chemistry_special_booklet.json"),
    ]);

    state.pyqQuestions = (await pyqRes.json()).map((q) => normalizeQuestion(q, "PYQ"));

    const curatedData = await curatedRes.json();
    state.curatedBooklets = Object.fromEntries(
      Object.entries(curatedData).map(([name, list]) => [
        name,
        list.map((q) => normalizeQuestion(q, name)),
      ]),
    );

    const chemistrySpecial = await chemistryRes.json();
    const chemistryCombined = Object.values(chemistrySpecial).flat();
    state.curatedBooklets["Chemistry KaTeX Special Booklet"] = chemistryCombined.map((q) =>
      normalizeQuestion(q, "Chemistry Special"),
    );

    const rawMock = await mockRes.json();
    state.mockTests = {};
    Object.entries(rawMock).forEach(([year, shiftObj]) => {
      state.mockTests[year] = {};
      Object.entries(shiftObj).forEach(([shift, list]) => {
        state.mockTests[year][shift] = list.map((q) => normalizeQuestion(q, `Mock ${year}`));
      });
    });

    bindEvents();
    buildMockSelectors();
  }

  function normalizeQuestion(raw, defaultTopic) {
    const type = raw.type === "numerical" ? "integer" : raw.type || "mcq";
    const subject = raw.subject || "chemistry";
    const topic = raw.topic || defaultTopic || "general";
    const difficulty = raw.difficulty || "medium";

    const text = buildQuestionText(raw.question ?? raw.text, raw.statements, raw.type);

    if (type === "integer") {
      return {
        subject,
        topic,
        difficulty,
        type: "integer",
        text,
        image: raw.image || "",
        answer:
          raw.answer !== undefined && raw.answer !== null && raw.answer !== ""
            ? Number(raw.answer)
            : null,
      };
    }

    const options = normalizeOptions(raw.options ?? []);
    const correct = mapCorrectAnswer(raw.answer, options, raw.correct);

    return {
      subject,
      topic,
      difficulty,
      type: "mcq",
      text,
      image: raw.image || "",
      options,
      correct,
    };
  }

  function buildQuestionText(question, statements, qtype) {
    let parts = [];

    if (typeof question === "string") {
      parts.push(`<p>${question}</p>`);
    } else if (question && typeof question === "object") {
      if (question.assertion || question.reason) {
        parts.push(`<p><strong>Assertion:</strong> ${question.assertion || ""}</p>`);
        parts.push(`<p><strong>Reason:</strong> ${question.reason || ""}</p>`);
      } else {
        Object.entries(question).forEach(([key, value]) => {
          const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          parts.push(`<p><strong>${label}:</strong> ${value}</p>`);
        });
      }
    }

    if (statements && typeof statements === "object") {
      const statementLines = Object.entries(statements)
        .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
        .join("");
      parts.push(`<ul>${statementLines}</ul>`);
    }

    if (!parts.length) {
      parts.push(`<p>${qtype || "Question"}</p>`);
    }

    return parts.join("");
  }

  function normalizeOptions(optionsInput) {
    if (Array.isArray(optionsInput)) {
      return optionsInput.map((op) =>
        typeof op === "string" ? { key: "", text: op, image: "" } : { key: "", ...op },
      );
    }

    return Object.entries(optionsInput || {}).map(([key, value]) => ({
      key,
      text: value,
      image: "",
    }));
  }

  function mapCorrectAnswer(answer, options, fallbackCorrect) {
    if (typeof fallbackCorrect === "number") return fallbackCorrect;
    if (answer === undefined || answer === null) return null;

    if (typeof answer === "number") return answer;
    const answerText = String(answer).trim();

    const optionIndexByKey = options.findIndex((op) => op.key === answerText);
    if (optionIndexByKey >= 0) return optionIndexByKey;

    const optionIndexByText = options.findIndex((op) => op.text === answerText);
    if (optionIndexByText >= 0) return optionIndexByText;

    return null;
  }

  function bindEvents() {
    elements.modePyqBtn.addEventListener("click", startPyqMode);
    elements.modeCuratedBtn.addEventListener("click", showCuratedScreen);
    elements.modeMockBtn.addEventListener("click", showMockConfigScreen);
    elements.curatedBackBtn.addEventListener("click", showModeScreen);
    elements.mockBackBtn.addEventListener("click", showModeScreen);
    elements.mockStartBtn.addEventListener("click", startMockMode);
    elements.mockYear.addEventListener("change", buildMockShiftSelector);

    elements.subjectFilter.addEventListener("change", () => {
      buildTopicFilter();
      applyFilters();
    });
    elements.topicFilter.addEventListener("change", applyFilters);
    elements.difficultyFilter.addEventListener("change", applyFilters);
    elements.nextBtn.addEventListener("click", nextQuestion);
    elements.skipBtn.addEventListener("click", nextQuestion);
    elements.checkIntegerBtn.addEventListener("click", handleIntegerAnswer);
  }

  function showModeScreen() {
    elements.modeTagline.textContent = "Choose your solving mode";
    elements.modeScreen.classList.remove("hidden");
    elements.curatedScreen.classList.add("hidden");
    elements.mockConfigScreen.classList.add("hidden");
    elements.solverScreen.classList.add("hidden");
  }

  function showCuratedScreen() {
    elements.modeTagline.textContent = "Pick a curated booklet";
    elements.modeScreen.classList.add("hidden");
    elements.curatedScreen.classList.remove("hidden");
    elements.mockConfigScreen.classList.add("hidden");
    elements.solverScreen.classList.add("hidden");

    elements.bookletList.innerHTML = "";
    Object.keys(state.curatedBooklets).forEach((bookletName) => {
      const button = document.createElement("button");
      button.className = "chooser-card";
      button.textContent = bookletName;
      button.addEventListener("click", () => startCuratedMode(bookletName));
      elements.bookletList.appendChild(button);
    });
  }

  function showMockConfigScreen() {
    elements.modeTagline.textContent = "Configure your NTA-style mock";
    elements.modeScreen.classList.add("hidden");
    elements.curatedScreen.classList.add("hidden");
    elements.mockConfigScreen.classList.remove("hidden");
    elements.solverScreen.classList.add("hidden");
  }

  function buildMockSelectors() {
    const years = Object.keys(state.mockTests);
    elements.mockYear.innerHTML = years
      .map((year) => `<option value="${year}">${year}</option>`)
      .join("");
    buildMockShiftSelector();
  }

  function buildMockShiftSelector() {
    const selectedYear = elements.mockYear.value;
    const shifts = Object.keys(state.mockTests[selectedYear]);
    elements.mockShift.innerHTML = shifts
      .map((shift) => `<option value="${shift}">${titleCase(shift.replace(/-/g, " "))}</option>`)
      .join("");
  }

  function startPyqMode() {
    state.mode = "pyq";
    state.allQuestions = state.pyqQuestions;
    enterSolver("JEE MAIN PYQs", { subject: true, filters: true, curatedDifficulty: false });
  }

  function startCuratedMode(bookletName) {
    state.mode = "curated";
    state.allQuestions = state.curatedBooklets[bookletName];
    enterSolver(bookletName, { subject: false, filters: true, curatedDifficulty: true });
  }

  function startMockMode() {
    const year = elements.mockYear.value;
    const shift = elements.mockShift.value;
    state.mode = "mock";
    state.allQuestions = state.mockTests[year][shift];
    enterSolver(`NTA Mock ${year} • ${titleCase(shift.replace(/-/g, " "))}`, {
      subject: false,
      filters: false,
      curatedDifficulty: false,
    });
  }

  function enterSolver(tagline, config) {
    elements.modeTagline.textContent = tagline;
    elements.modeScreen.classList.add("hidden");
    elements.curatedScreen.classList.add("hidden");
    elements.mockConfigScreen.classList.add("hidden");
    elements.solverScreen.classList.remove("hidden");

    elements.filtersWrap.classList.toggle("hidden", !config.filters);
    elements.subjectWrap.classList.toggle("hidden", !config.subject);
    elements.topicLabel.textContent = config.subject ? "Topic" : "Chapter";
    elements.difficultyLabel.textContent = config.curatedDifficulty ? "Difficulty order" : "Difficulty";

    buildFilters(config);
    applyFilters();
  }

  function buildFilters(config = {}) {
    if (config.filters === false) return;

    if (!config.subject) {
      elements.subjectFilter.innerHTML = '<option value="all">All</option>';
    } else {
      const subjects = ["all", ...new Set(state.allQuestions.map((q) => q.subject))];
      elements.subjectFilter.innerHTML = subjects
        .map((subject) => `<option value="${subject}">${titleCase(subject)}</option>`)
        .join("");
    }

    if (config.curatedDifficulty) {
      elements.difficultyFilter.innerHTML = [
        '<option value="all">All</option>',
        '<option value="easy_first">Easy → Hard</option>',
        '<option value="hard_first">Hard → Easy</option>',
      ].join("");
    } else {
      elements.difficultyFilter.innerHTML = [
        '<option value="all">All</option>',
        '<option value="easy">Easy</option>',
        '<option value="medium">Medium</option>',
        '<option value="hard">Hard</option>',
      ].join("");
    }

    buildTopicFilter();
  }

  function buildTopicFilter() {
    const selectedSubject = elements.subjectFilter.value;
    const source =
      state.mode === "pyq" && selectedSubject !== "all"
        ? state.allQuestions.filter((q) => q.subject === selectedSubject)
        : state.allQuestions;

    const topics = ["all", ...new Set(source.map((q) => q.topic))];
    elements.topicFilter.innerHTML = topics
      .map((topic) => `<option value="${topic}">${titleCase(topic)}</option>`)
      .join("");
  }

  function applyFilters() {
    if (state.mode === "mock") {
      state.filteredQuestions = [...state.allQuestions];
    } else {
      const subject = elements.subjectFilter.value;
      const topic = elements.topicFilter.value;
      const difficulty = elements.difficultyFilter.value;

      state.filteredQuestions = state.allQuestions.filter((q) => {
        const matchSubject = state.mode !== "pyq" || subject === "all" || q.subject === subject;
        const matchTopic = topic === "all" || q.topic === topic;
        const matchDifficulty =
          state.mode === "curated" || difficulty === "all" ? true : q.difficulty === difficulty;
        return matchSubject && matchTopic && matchDifficulty;
      });

      if (state.mode === "curated") {
        if (difficulty === "easy_first") {
          sortByDifficulty(["easy", "medium", "hard"]);
        } else if (difficulty === "hard_first") {
          sortByDifficulty(["hard", "medium", "easy"]);
        }
      }
    }

    state.currentIndex = 0;
    loadQuestion();
  }

  function sortByDifficulty(order) {
    const rank = Object.fromEntries(order.map((level, idx) => [level, idx]));
    state.filteredQuestions.sort((a, b) => (rank[a.difficulty] ?? 99) - (rank[b.difficulty] ?? 99));
  }

  function loadQuestion() {
    state.answered = false;
    elements.nextBtn.disabled = true;
    elements.integerAnswer.value = "";
    elements.integerFeedback.textContent = "";
    elements.integerAnswer.classList.remove("correct", "wrong");

    if (!state.filteredQuestions.length) {
      elements.questionCard.classList.add("hidden");
      elements.emptyState.classList.remove("hidden");
      return;
    }

    elements.questionCard.classList.remove("hidden");
    elements.emptyState.classList.add("hidden");

    const question = state.filteredQuestions[state.currentIndex];
    elements.progressText.textContent = `Question ${state.currentIndex + 1} / ${state.filteredQuestions.length}`;
    elements.topicText.textContent = `Topic: ${titleCase(question.topic)} • ${titleCase(question.difficulty)}`;
    elements.questionText.innerHTML = question.text;

    if (question.image) {
      elements.questionImage.src = question.image;
      elements.questionImage.style.display = "block";
    } else {
      elements.questionImage.style.display = "none";
      elements.questionImage.removeAttribute("src");
    }

    if (question.type === "integer") {
      elements.optionsContainer.classList.add("hidden");
      elements.integerAnswerWrap.classList.remove("hidden");
    } else {
      elements.integerAnswerWrap.classList.add("hidden");
      elements.optionsContainer.classList.remove("hidden");
      renderOptions(question);
    }

    renderMathInElement(elements.questionCard, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
    });
  }

  function renderOptions(question) {
    elements.optionsContainer.innerHTML = "";
    question.options.forEach((option, index) => {
      const optionButton = document.createElement("button");
      optionButton.className = "option";
      optionButton.type = "button";

      const label = option.key ? `<strong>${option.key}.</strong> ` : "";
      const imageHTML = option.image
        ? `<img class="option-image" src="${option.image}" alt="Option diagram" />`
        : "";

      optionButton.innerHTML = `<div>${label}${option.text}</div>${imageHTML}`;
      optionButton.addEventListener("click", () => handleAnswer(index));
      elements.optionsContainer.appendChild(optionButton);
    });
  }

  function handleAnswer(selectedIndex) {
    if (state.answered) return;
    const question = state.filteredQuestions[state.currentIndex];
    const optionButtons = [...elements.optionsContainer.querySelectorAll(".option")];
    const correctIndex = question.correct;

    state.answered = true;
    optionButtons.forEach((button, index) => {
      button.classList.add("disabled");
      if (index === selectedIndex) button.classList.add("selected");
      if (correctIndex !== null && correctIndex !== undefined && index === correctIndex) {
        button.classList.add("correct");
      }
      if (
        correctIndex !== null &&
        correctIndex !== undefined &&
        index === selectedIndex &&
        selectedIndex !== correctIndex
      ) {
        button.classList.add("wrong");
      }
    });

    if (correctIndex === null || correctIndex === undefined) {
      elements.integerFeedback.textContent = "Answer key unavailable for this question.";
      elements.nextBtn.disabled = false;
      return;
    }

    finalizeAnswer(selectedIndex === correctIndex);
  }

  function handleIntegerAnswer() {
    if (state.answered) return;
    const question = state.filteredQuestions[state.currentIndex];
    const value = elements.integerAnswer.value.trim();
    if (!value) return;

    state.answered = true;

    if (question.answer === null || question.answer === undefined || Number.isNaN(question.answer)) {
      elements.integerFeedback.textContent = "Answer key unavailable for this question.";
      elements.nextBtn.disabled = false;
      return;
    }

    const isCorrect = Number(value) === Number(question.answer);
    elements.integerAnswer.classList.add(isCorrect ? "correct" : "wrong");
    elements.integerFeedback.textContent = isCorrect
      ? "Correct answer!"
      : `Wrong answer. Correct value: ${question.answer}`;

    finalizeAnswer(isCorrect);
  }

  function finalizeAnswer(isCorrect) {
    updateScore(isCorrect ? 20 : -5, isCorrect);

    if (isCorrect) {
      elements.questionCard.classList.add("correct-pop");
      setTimeout(() => elements.questionCard.classList.remove("correct-pop"), 350);
    }

    elements.nextBtn.disabled = false;
  }

  function updateScore(delta, isCorrect) {
    state.score += delta;
    if (isCorrect) state.streak += 1;
    else if (delta < 0) state.streak = 0;

    localStorage.setItem(SCORE_KEY, String(state.score));
    elements.scoreDisplay.textContent = `⚡ Score: ${state.score}`;
    elements.streakDisplay.textContent = `🔥 Streak: ${state.streak}`;
  }

  function nextQuestion() {
    if (!state.filteredQuestions.length) return;
    state.currentIndex = (state.currentIndex + 1) % state.filteredQuestions.length;
    loadQuestion();
  }

  function titleCase(value) {
    return value
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  init().catch((error) => {
    console.error("Unable to initialize ZEROday app", error);
    elements.modeTagline.textContent = "Unable to load data files.";
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const SCORE_KEY = "zeroday_score";

  const state = {
    allQuestions: [],
    filteredQuestions: [],
    currentIndex: 0,
    score: Number(localStorage.getItem(SCORE_KEY)) || 0,
    streak: 0,
    answered: false,
  };

  const elements = {
    subjectFilter: document.getElementById("subject-filter"),
    topicFilter: document.getElementById("topic-filter"),
    difficultyFilter: document.getElementById("difficulty-filter"),
    scoreDisplay: document.getElementById("score-display"),
    streakDisplay: document.getElementById("streak-display"),
    progressText: document.getElementById("progress-text"),
    topicText: document.getElementById("topic-text"),
    questionText: document.getElementById("question-text"),
    questionImage: document.getElementById("question-image"),
    optionsContainer: document.getElementById("options-container"),
    nextBtn: document.getElementById("next-btn"),
    skipBtn: document.getElementById("skip-btn"),
    questionCard: document.getElementById("question-card"),
    emptyState: document.getElementById("empty-state"),
  };

  async function init() {
    updateScore(0, false);
    const response = await fetch("questions.json");
    state.allQuestions = await response.json();
    bindEvents();
    buildFilters();
    applyFilters();
  }

  function bindEvents() {
    elements.subjectFilter.addEventListener("change", () => {
      buildTopicFilter();
      applyFilters();
    });
    elements.topicFilter.addEventListener("change", applyFilters);
    elements.difficultyFilter.addEventListener("change", applyFilters);
    elements.nextBtn.addEventListener("click", nextQuestion);
    elements.skipBtn.addEventListener("click", nextQuestion);
  }

  function buildFilters() {
    const subjects = ["all", ...new Set(state.allQuestions.map((q) => q.subject))];
    elements.subjectFilter.innerHTML = subjects
      .map((subject) => `<option value="${subject}">${titleCase(subject)}</option>`)
      .join("");
    buildTopicFilter();
  }

  function buildTopicFilter() {
    const selectedSubject = elements.subjectFilter.value;
    const source =
      selectedSubject === "all"
        ? state.allQuestions
        : state.allQuestions.filter((q) => q.subject === selectedSubject);

    const topics = ["all", ...new Set(source.map((q) => q.topic))];
    elements.topicFilter.innerHTML = topics
      .map((topic) => `<option value="${topic}">${titleCase(topic)}</option>`)
      .join("");
  }

  function applyFilters() {
    const subject = elements.subjectFilter.value;
    const topic = elements.topicFilter.value;
    const difficulty = elements.difficultyFilter.value;

    state.filteredQuestions = state.allQuestions.filter((q) => {
      const matchSubject = subject === "all" || q.subject === subject;
      const matchTopic = topic === "all" || q.topic === topic;
      const matchDifficulty = difficulty === "all" || q.difficulty === difficulty;
      return matchSubject && matchTopic && matchDifficulty;
    });

    state.currentIndex = 0;
    loadQuestion();
  }

  function loadQuestion() {
    state.answered = false;
    elements.nextBtn.disabled = true;

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

    renderOptions(question);

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

      const imageHTML = option.image
        ? `<img class="option-image" src="${option.image}" alt="Option diagram" />`
        : "";

      optionButton.innerHTML = `<div>${option.text}</div>${imageHTML}`;
      optionButton.addEventListener("click", () => handleAnswer(index));
      elements.optionsContainer.appendChild(optionButton);
    });
  }

  function handleAnswer(selectedIndex) {
    if (state.answered) return;

    const question = state.filteredQuestions[state.currentIndex];
    const optionButtons = [...elements.optionsContainer.querySelectorAll(".option")];

    state.answered = true;
    optionButtons.forEach((button, index) => {
      button.classList.add("disabled");
      if (index === selectedIndex) button.classList.add("selected");
      if (index === question.correct) button.classList.add("correct");
      if (index === selectedIndex && selectedIndex !== question.correct) {
        button.classList.add("wrong");
      }
    });

    const isCorrect = selectedIndex === question.correct;
    updateScore(isCorrect ? 20 : -5, isCorrect);

    if (isCorrect) {
      elements.questionCard.classList.add("correct-pop");
      setTimeout(() => elements.questionCard.classList.remove("correct-pop"), 350);
    }

    elements.nextBtn.disabled = false;
  }

  function updateScore(delta, isCorrect) {
    state.score += delta;
    if (isCorrect) {
      state.streak += 1;
    } else if (delta < 0) {
      state.streak = 0;
    }

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
    elements.questionText.innerHTML = "Unable to load questions. Please refresh.";
  });
});

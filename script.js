document.addEventListener("DOMContentLoaded", () => {
  const Quiz = {
    elements: {
      instructionsPage: document.getElementById("instructions-page"),
      quizPage: document.getElementById("quiz-page"),
      resultPage: document.getElementById("result-page"),
      startBtn: document.getElementById("start-quiz-btn"),
      timerEl: document.getElementById("timer"),
      questionInfoEl: document.getElementById("question-info"),
      questionTextEl: document.getElementById("question-text"),
      optionsContainer: document.getElementById("options-container"),
      paletteContainer: document.getElementById("question-palette"),
      saveNextBtn: document.getElementById("save-next-btn"),
      saveMarkReviewBtn: document.getElementById("save-mark-review-btn"),
      clearResponseBtn: document.getElementById("clear-response-btn"),
      markReviewBtn: document.getElementById("mark-review-btn"),
      submitTestBtn: document.getElementById("submit-test-btn"),
      togglePaletteBtn: document.getElementById("toggle-palette-btn"),
      paletteSection: document.getElementById("palette-section"),
      paletteOverlay: document.getElementById("palette-overlay"),
      totalQuestionsEl: document.getElementById("total-questions"),
      attemptedQuestionsEl: document.getElementById("attempted-questions"),
      correctAnswersEl: document.getElementById("correct-answers"),
      incorrectAnswersEl: document.getElementById("incorrect-answers"),
      finalScoreEl: document.getElementById("final-score"),
    },
    state: {
      questions: [],
      sectionInfo: {},
      userAnswers: [],
      currentQuestionIndex: 0,
      timer: null,
      timeLeft: 10 * 60,
    },
    async init() {
      this.setupEventListeners();
      try {
        const response = await fetch("questions.json");
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        this.processQuestionData(await response.json());
      } catch (error) {
        console.error("Failed to load quiz questions:", error);
        document.body.innerHTML = `<div style="padding: 40px; text-align: center;"><h1>Error</h1><p>Could not load questions.</p></div>`;
      }
    },
    processQuestionData(data) {
      let currentIndex = 0;
      for (const sectionName in data) {
        const sectionQuestions = data[sectionName];
        this.state.sectionInfo[sectionName] = {
          start: currentIndex,
          count: sectionQuestions.length,
        };
        sectionQuestions.forEach((q) =>
          this.state.questions.push({ ...q, section: sectionName }),
        );
        currentIndex += sectionQuestions.length;
      }
      this.state.userAnswers = Array.from(
        { length: this.state.questions.length },
        () => ({ answer: null, status: "not-visited" }),
      );
    },
    setupEventListeners() {
      const { elements } = this;
      elements.startBtn.addEventListener("click", () => this.startQuiz());
      elements.saveNextBtn.addEventListener("click", () =>
        this.handleSaveAndNext(),
      );
      elements.saveMarkReviewBtn.addEventListener("click", () =>
        this.handleSaveAndMarkForReview(),
      );
      elements.clearResponseBtn.addEventListener("click", () =>
        this.handleClearResponse(),
      );
      elements.markReviewBtn.addEventListener("click", () =>
        this.handleMarkForReview(),
      );
      elements.submitTestBtn.addEventListener("click", () =>
        this.confirmAndSubmit(),
      );
      elements.togglePaletteBtn.addEventListener("click", () =>
        this.togglePalette(),
      );
      elements.paletteOverlay.addEventListener("click", () =>
        this.togglePalette(),
      );
    },
    startQuiz() {
      this.elements.instructionsPage.style.display = "none";
      this.elements.quizPage.style.display = "flex";
      this.createPalette();
      this.loadQuestion(0);
      this.startTimer();
    },
    createPalette() {
      const { paletteContainer } = this.elements;
      const { sectionInfo, questions } = this.state;
      paletteContainer.innerHTML = "";
      for (const sectionName in sectionInfo) {
        const info = sectionInfo[sectionName];
        const sectionDiv = document.createElement("div");
        const header = document.createElement("h3");
        header.textContent = sectionName;
        header.style.cssText =
          "text-align: left; margin: 10px 0; font-size: 1rem; color: var(--gray-700)";
        sectionDiv.appendChild(header);
        const grid = document.createElement("div");
        grid.className = "palette-grid";
        for (let i = 0; i < info.count; i++) {
          const globalIndex = info.start + i;
          const btn = document.createElement("button");
          btn.className = "palette-btn not-visited";
          btn.textContent = i + 1;
          btn.addEventListener("click", () => {
            this.loadQuestion(globalIndex);
            if (window.innerWidth <= 1024) this.togglePalette();
          });
          grid.appendChild(btn);
        }
        sectionDiv.appendChild(grid);
        paletteContainer.appendChild(sectionDiv);
      }
      this.updatePalette();
    },
    createOptionElement(text, index) {
      const optionDiv = document.createElement("div");
      optionDiv.className = "option";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "option";
      radio.value = index;
      const label = document.createElement("label");
      label.innerHTML = text;
      const checkIcon = document.createElement("div");
      checkIcon.className = "check-icon";
      checkIcon.innerHTML = "&#10003;";
      optionDiv.append(radio, label, checkIcon);
      optionDiv.addEventListener("click", () => {
        if (radio.checked) return;
        radio.checked = true;
        document
          .querySelectorAll(".option")
          .forEach((o) => o.classList.remove("selected"));
        optionDiv.classList.add("selected");
        this.updateNavButtonsState();
      });
      if (
        this.state.userAnswers[this.state.currentQuestionIndex].answer === index
      ) {
        radio.checked = true;
        optionDiv.classList.add("selected");
      }
      return optionDiv;
    },
    loadQuestion(index) {
      this.state.currentQuestionIndex = index;
      const question = this.state.questions[index];
      const { elements, state } = this;

      if (state.userAnswers[index].status === "not-visited") {
        state.userAnswers[index].status = "not-answered";
      }

      const sectionDetails = state.sectionInfo[question.section];

      elements.questionInfoEl.textContent = `${question.section} - Question No. ${index - sectionDetails.start + 1}`;

      // ✅ IMPORTANT: use innerHTML
      elements.questionTextEl.innerHTML = question.text;

      elements.optionsContainer.innerHTML = "";

      question.options.forEach((optionText, optionIndex) => {
        const optionEl = this.createOptionElement(optionText, optionIndex);

        // 👇 FIX: render option as HTML (not text)
        optionEl.querySelector("label").innerHTML = optionText;

        elements.optionsContainer.appendChild(optionEl);
      });

      // 🔥 THIS IS THE MISSING PART
      renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
      });

      this.updatePalette();
      this.updateNavButtonsState();
    },
    updatePalette() {
      const { userAnswers, currentQuestionIndex } = this.state;
      this.elements.paletteContainer
        .querySelectorAll(".palette-btn")
        .forEach((btn, globalIndex) => {
          btn.className = "palette-btn";
          btn.classList.add(userAnswers[globalIndex].status);
          if (globalIndex === currentQuestionIndex) btn.classList.add("active");
        });
    },
    updateNavButtonsState() {
      const isAnswerSelected = this.getSelectedOption() !== null;
      this.elements.saveNextBtn.disabled = !isAnswerSelected;
      this.elements.saveMarkReviewBtn.disabled = !isAnswerSelected;
    },
    getSelectedOption() {
      const selectedRadio = this.elements.optionsContainer.querySelector(
        'input[name="option"]:checked',
      );
      return selectedRadio ? parseInt(selectedRadio.value) : null;
    },
    handleSaveAndNext() {
      const selectedAnswer = this.getSelectedOption();
      if (selectedAnswer !== null) {
        this.state.userAnswers[this.state.currentQuestionIndex] = {
          answer: selectedAnswer,
          status: "answered",
        };
      }
      this.goToNextQuestion();
    },
    handleSaveAndMarkForReview() {
      const selectedAnswer = this.getSelectedOption();
      if (selectedAnswer !== null) {
        this.state.userAnswers[this.state.currentQuestionIndex] = {
          answer: selectedAnswer,
          status: "answered-marked",
        };
      }
      this.goToNextQuestion();
    },
    handleMarkForReview() {
      const { currentQuestionIndex, userAnswers } = this.state;
      userAnswers[currentQuestionIndex].answer = null;
      userAnswers[currentQuestionIndex].status = "marked";
      this.goToNextQuestion();
    },
    handleClearResponse() {
      const { currentQuestionIndex, userAnswers } = this.state;
      userAnswers[currentQuestionIndex] = {
        answer: null,
        status: "not-answered",
      };
      this.loadQuestion(currentQuestionIndex);
    },
    goToNextQuestion() {
      this.loadQuestion(
        (this.state.currentQuestionIndex + 1) % this.state.questions.length,
      );
    },
    startTimer() {
      this.state.timer = setInterval(() => {
        this.state.timeLeft--;
        const minutes = Math.floor(this.state.timeLeft / 60);
        const seconds = this.state.timeLeft % 60;
        this.elements.timerEl.textContent = `Time Left: ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        if (this.state.timeLeft <= 60)
          this.elements.timerEl.style.color = "var(--timer-urgent)";
        if (this.state.timeLeft <= 0) this.submitTest();
      }, 1000);
    },
    confirmAndSubmit() {
      const attempted = this.state.userAnswers.filter(
        (a) => a.status === "answered" || a.status === "answered-marked",
      ).length;
      if (
        confirm(
          `Are you sure you want to submit?\nYou have attempted ${attempted} out of ${this.state.questions.length} questions.`,
        )
      ) {
        this.submitTest();
      }
    },
    submitTest() {
      clearInterval(this.state.timer);
      this.calculateResults();
      this.elements.quizPage.style.display = "none";
      this.elements.resultPage.style.display = "flex";
    },
    calculateResults() {
      let score = 0,
        correct = 0,
        incorrect = 0,
        attempted = 0;
      this.state.userAnswers.forEach((userAns, index) => {
        if (
          userAns.status === "answered" ||
          userAns.status === "answered-marked"
        ) {
          attempted++;
          if (userAns.answer === this.state.questions[index].correct) {
            correct++;
            score += 4;
          } else {
            incorrect++;
            score -= 1;
          }
        }
      });
      const {
        totalQuestionsEl,
        attemptedQuestionsEl,
        correctAnswersEl,
        incorrectAnswersEl,
        finalScoreEl,
      } = this.elements;
      totalQuestionsEl.textContent = this.state.questions.length;
      attemptedQuestionsEl.textContent = attempted;
      correctAnswersEl.textContent = correct;
      incorrectAnswersEl.textContent = incorrect;
      finalScoreEl.textContent = `${score}`;
    },
    togglePalette() {
      this.elements.paletteSection.classList.toggle("visible");
      this.elements.paletteOverlay.classList.toggle("visible");
    },
  };
  Quiz.init();
});

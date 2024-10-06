let board;
let score;
let bestScore = 0;
let currentLanguage;
let previousBoard;
let previousScore;
let historyStack = []; // История ходов

const GRID_SIZE = 4;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const MULTIPLIER_CHANCE = 0.1;
const BOMB_CHANCE = 0.05;

const translations = {
  en: {
    newGame: "New Game",
    score: "SCORE",
    best: "BEST",
    gameOver: "Game Over! Your score: ",
    gameExplanation:
      "Use arrow keys or swipe to move tiles! ________________________________________________",
    gameName: "2048: Multiply and Explode",
  },
  ru: {
    newGame: "Новая игра",
    score: "СЧЕТ",
    best: "РЕКОРД",
    gameOver: "Игра окончена! Ваш счет: ",
    gameExplanation:
      "Используйте стрелки или свайпы, чтобы двигать плитки! ________________________________________________",
    gameName: "2048: Умножай и Взрывай",
  },
  tr: {
    newGame: "Yeni Oyun",
    score: "SKOR",
    best: "EN İYİ",
    gameOver: "Oyun bitti! Skorunuz: ",
    gameExplanation:
      "Taşları hareket ettirmek için okları veya kaydırmaları kullanın! ________________________________________________",
    gameName: "2048: Çarp ve Patlat",
  },
  de: {
    newGame: "Neues Spiel",
    score: "PUNKTZAHL",
    best: "BESTE",
    gameOver: "Spiel beendet! Ihr Punktestand: ",
    gameExplanation:
      "Verwenden Sie die Pfeiltasten oder wischen Sie, um die Fliesen zu bewegen! ________________________________________________",
    gameName: "2048: Multiplizieren und Explodieren",
  },
  es: {
    newGame: "Nuevo Juego",
    score: "PUNTUACIÓN",
    best: "MEJOR",
    gameOver: "¡Juego Terminado! Tu puntuación: ",
    gameExplanation:
      "¡Usa las teclas de flecha o desliza para mover las fichas! ________________________________________________",
    gameName: "2048: Multiplica y Explota",
  },
};

// Initialize audio context
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = "sine") {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.01,
    audioContext.currentTime + duration
  );

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playMergeSound() {
  playSound(440, 0.1); // A4 note
}

function playMoveSound() {
  playSound(330, 0.05); // E4 note, shorter duration
}

function playGameOverSound() {
  playSound(220, 0.3, "sawtooth"); // A3 note, longer duration, sawtooth wave
}

function savePreviousState() {
  previousBoard = JSON.parse(JSON.stringify(board)); // Сохраняем копию доски
  previousScore = score; // Сохраняем текущий счет
}

function loadGameState() {
  if (window.ysdk) {
    window.ysdk
      .getPlayer({ scopes: false })
      .then((player) => {
        return player.getData(["gameState", "bestScore"]);
      })
      .then((data) => {
        if (data.gameState) {
          const gameState = JSON.parse(data.gameState);
          board = gameState.board;
          score = parseInt(gameState.score) || 0;
        } else {
          startNewGame();
        }

        bestScore = parseInt(data.bestScore) || 0;
        updateBestScore();
        updateScore(0);
        updateBoard();
      })
      .catch((error) => {
        console.error("Error loading game state:", error);
        startNewGame();
      });
  } else {
    const savedState = localStorage.getItem("gameState");
    if (savedState) {
      const gameState = JSON.parse(savedState);
      board = gameState.board;
      score = parseInt(gameState.score) || 0;
      bestScore = parseInt(gameState.bestScore) || 0;
    } else {
      startNewGame();
    }
    updateBestScore();
    updateScore(0);
    updateBoard();
  }
}

function saveGameState() {
  const gameState = {
    board: board,
    score: score,
    bestScore: bestScore,
  };

  if (window.ysdk) {
    window.ysdk
      .getPlayer({ scopes: false })
      .then((player) => {
        return player.setData({
          gameState: JSON.stringify(gameState),
          bestScore: bestScore.toString(),
        });
      })
      .catch((error) => {
        console.error("Error saving game state:", error);
      });
  } else {
    localStorage.setItem("gameState", JSON.stringify(gameState));
  }
}

function addNewTile() {
  let emptyCells = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      if (board[i][j] === 0) {
        emptyCells.push({ i, j });
      }
    }
  }
  if (emptyCells.length > 0) {
    let { i, j } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    let tileType = getNewTileType();
    board[i][j] = tileType;
  }
}

function getNewTileType() {
  let random = Math.random();
  if (random < MULTIPLIER_CHANCE) {
    return "M"; // Плитка-множитель
  } else if (random < MULTIPLIER_CHANCE + BOMB_CHANCE) {
    return "B"; // Плитка-бомба
  } else {
    return Math.random() < 0.9 ? 2 : 4;
  }
}

function initGame(ysdk) {
  if (ysdk) {
    // Manually set the language based on Yandex SDK's detected language
    let detectedLang = ysdk.environment.i18n.lang;
    currentLanguage = translations.hasOwnProperty(detectedLang)
      ? detectedLang
      : "ru";
  } else {
    currentLanguage = "ru";
  }

  console.log("Current language:", currentLanguage);

  updateLanguage();

  document
    .getElementById("new-game-btn")
    .addEventListener("click", restartGame);
  setupSwipeListeners();

  document.body.addEventListener(
    "touchmove",
    function (e) {
      e.preventDefault();
    },
    { passive: false }
  );

  loadGameState();

  // Показ полноэкранной рекламы в начале игры
  if (window.ysdk && window.ysdk.adv) {
    window.ysdk.adv.showFullscreenAdv({
      callbacks: {
        onOpen: function () {
          console.log("Полноэкранная реклама успешно показана.");
        },
        onClose: function (wasShown) {
          if (wasShown) {
            console.log("Реклама закрыта, она была показана.");
          } else {
            console.log("Реклама закрыта, но не была показана.");
          }
        },
        onError: function (error) {
          console.error("Ошибка при показе рекламы:", error);
        },
        onOffline: function () {
          console.warn("Пользователь оффлайн, реклама не может быть показана.");
        },
      },
    });
  } else {
    console.error("Yandex SDK или реклама недоступны.");
  }
}

// Функция для сохранения текущего состояния в историю
function saveHistory() {
  const state = {
    board: JSON.parse(JSON.stringify(board)),
    score: score,
  };
  historyStack.push(state);
}

function updateBoard() {
  const grid = document.querySelector(".grid");
  grid.innerHTML = "";
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      const tile = document.createElement("div");
      tile.className = `tile tile-${board[i][j]}`;
      const inner = document.createElement("div");
      inner.className = "tile-inner";
      if (board[i][j] !== 0) {
        if (board[i][j] === "M") {
          inner.textContent = "×2";
          tile.classList.add("tile-multiplier");
        } else if (board[i][j] === "B") {
          inner.textContent = "💣";
          tile.classList.add("tile-bomb");
        } else {
          inner.textContent = board[i][j];
        }
      }
      tile.appendChild(inner);
      grid.appendChild(tile);
    }
  }
}

// Функция для отмены хода, используя историю
function undoMove() {
  if (historyStack.length > 0) {
    const previousState = historyStack.pop(); // Извлекаем последнее состояние из стека
    board = previousState.board;
    score = previousState.score;
    updateBoard();
    updateScore(0); // Обновляем счет на экране
    saveGameState(); // Сохраняем текущее состояние
  } else {
    console.log("Нет ходов для отмены.");
  }
}

// Функция для показа видеорекламы с вознаграждением
function showRewardedVideo() {
  if (window.ysdk && window.ysdk.adv) {
    window.ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen: () => {
          console.log("Видеореклама открыта.");
        },
        onRewarded: () => {
          console.log("Просмотр засчитан! Отмена хода.");
          undoMove(); // Отменить ход после успешного просмотра рекламы
        },
        onClose: () => {
          console.log("Видеореклама закрыта.");
        },
        onError: (e) => {
          console.log("Ошибка при показе видеорекламы:", e);
        },
      },
    });
  } else {
    console.error("Yandex SDK недоступен.");
  }
}

// обработчик на кнопку отмены хода
document.getElementById("undo-btn").addEventListener("click", function () {
  if (historyStack.length > 0) {
    // Показываем видеорекламу, перед отменой хода
    showRewardedVideo();
  } else {
    console.log("Нет ходов для отмены.");
  }
});

function move(direction) {
  let moved = false;
  const transpose = (array) =>
    array[0].map((_, colIndex) => array.map((row) => row[colIndex]));
  const reverse = (array) => array.map((row) => [...row].reverse());

  let newBoard = JSON.parse(JSON.stringify(board));

  if (direction === "ArrowUp" || direction === "ArrowDown") {
    newBoard = transpose(newBoard);
  }
  if (direction === "ArrowRight" || direction === "ArrowDown") {
    newBoard = reverse(newBoard);
  }

  let mergeOccurred = false;

  for (let i = 0; i < GRID_SIZE; i++) {
    let row = newBoard[i].filter((cell) => cell !== 0);
    let mergedIndices = new Set();
    for (let j = 0; j < row.length - 1; j++) {
      if (!mergedIndices.has(j)) {
        // Если обе плитки множители "M", не соединять их
        if (row[j] === "M" && row[j + 1] === "M") {
          continue; // Пропустить объединение
        }

        if (row[j] === row[j + 1] || row[j] === "M" || row[j + 1] === "M") {
          if (row[j] === "M" || row[j + 1] === "M") {
            row[j] = (row[j] === "M" ? row[j + 1] : row[j]) * 2;
          } else {
            row[j] *= 2;
          }

          updateScore(row[j]);
          mergeOccurred = true;
          row.splice(j + 1, 1);
          mergedIndices.add(j);
          moved = true;
          j--; // Check this position again
        }
      }
    }

    while (row.length < GRID_SIZE) {
      row.push(0);
    }

    if (JSON.stringify(newBoard[i]) !== JSON.stringify(row)) {
      moved = true;
    }
    newBoard[i] = row;
  }

  if (direction === "ArrowRight" || direction === "ArrowDown") {
    newBoard = reverse(newBoard);
  }
  if (direction === "ArrowUp" || direction === "ArrowDown") {
    newBoard = transpose(newBoard);
  }

  if (moved) {
    saveHistory(); // Сохранить текущее состояние перед ходом
    board = newBoard;
    addNewTile();
    updateBoard();
    saveGameState();

    // Play sound effects after the move is completed
    if (mergeOccurred) {
      playMergeSound();
    } else {
      playMoveSound();
    }

    if (isGameOver()) {
      playGameOverSound();
      if (window.ysdk) {
        window.ysdk
          .getLeaderboards()
          .then((lb) => lb.setLeaderboardScore("2048_leaderboard", score));
      }
    }
  }

  return moved;
}

function updateScore(increase) {
  if (typeof increase === "number" && !isNaN(increase)) {
    score += increase;
    score = Math.max(0, score); // Ensure score is never negative
    document.getElementById("score").textContent = score;
    if (score > bestScore) {
      bestScore = score;
      updateBestScore();
      saveGameState();
    }
  }
}

function updateBestScore() {
  document.getElementById("best-score").textContent = bestScore;
}

function startNewGame() {
  board = Array(GRID_SIZE)
    .fill()
    .map(() => Array(GRID_SIZE).fill(0));
  score = 0;
  addNewTile();
  addNewTile();
  updateScore(0);
}

function restartGame() {
  startNewGame();
  updateScore(0);
  updateBoard();
  saveGameState();
}

function isGameOver() {
  if (board.flat().includes(0)) return false;
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      if (
        (i < GRID_SIZE - 1 &&
          (board[i][j] === board[i + 1][j] ||
            board[i][j] === "M" ||
            board[i + 1][j] === "M" ||
            board[i][j] === "B" ||
            board[i + 1][j] === "B")) ||
        (j < GRID_SIZE - 1 &&
          (board[i][j] === board[i][j + 1] ||
            board[i][j] === "M" ||
            board[i][j + 1] === "M" ||
            board[i][j] === "B" ||
            board[i][j + 1] === "B"))
      ) {
        return false;
      }
    }
  }
  return true;
}

function setupSwipeListeners() {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  const gameBoard = document.getElementById("game-board");

  gameBoard.addEventListener(
    "touchstart",
    function (event) {
      touchStartX = event.changedTouches[0].screenX;
      touchStartY = event.changedTouches[0].screenY;
    },
    false
  );

  gameBoard.addEventListener(
    "touchend",
    function (event) {
      touchEndX = event.changedTouches[0].screenX;
      touchEndY = event.changedTouches[0].screenY;
      handleSwipe();
    },
    false
  );

  function handleSwipe() {
    let dx = touchEndX - touchStartX;
    let dy = touchEndY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        move("ArrowRight");
      } else {
        move("ArrowLeft");
      }
    } else {
      if (dy > 0) {
        move("ArrowDown");
      } else {
        move("ArrowUp");
      }
    }
  }
}

function updateLanguage() {
  document.getElementById("new-game-btn").textContent =
    translations[currentLanguage].newGame;
  document.querySelector(".score-title").textContent =
    translations[currentLanguage].score;
  document.querySelector(".best-score-title").textContent =
    translations[currentLanguage].best;
  document.querySelector(".game-explanation").textContent =
    translations[currentLanguage].gameExplanation;
  document.title = translations[currentLanguage].gameName;
  document.querySelector("h1").textContent =
    translations[currentLanguage].gameName;
}

document.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    move(e.key);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  if (typeof YaGames !== "undefined") {
    YaGames.init()
      .then((ysdk) => {
        window.ysdk = ysdk;
        console.log("Yandex Games SDK initialized");
        initGame(ysdk);
        ysdk.features.LoadingAPI.ready();
      })
      .catch((error) => {
        console.error("Failed to initialize Yandex Games SDK:", error);
        initGame(null);
      });
  } else {
    console.log("Yandex Games SDK not available");
    initGame(null);
  }
});

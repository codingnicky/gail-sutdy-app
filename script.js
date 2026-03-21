// ==================== グローバル変数 ====================
let flashcards = [];
let currentIndex = 0;
let isFlipped = false;
let masteredCards = new Set();
let shuffleOrder = [];
let originalOrder = [];
let isShuffled = false;
let currentFilter = 'all';
let showUnmasteredOnly = false;
let categories = new Set();
let streak = 0;
let lastStudyDate = null;

// テストモード用
let testQuestions = [];
let currentTestIndex = 0;
let testScore = 0;
let testAnswers = [];

// スワイプ検出用
let touchStartX = 0;
let touchEndX = 0;

// ==================== 初期化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    // スプラッシュ画面を表示
    showSplashScreen();

    // Service Worker を登録
    registerServiceWorker();

    await loadFlashcards();
    loadUserData();
    initializeUI();
    setupEventListeners();
    updateDisplay();
});

// スプラッシュ画面制御
function showSplashScreen() {
    const splash = document.getElementById('splashScreen');
    setTimeout(() => {
        splash.classList.add('hidden');
    }, 2000); // 2秒後に非表示
}

// ==================== Service Worker 登録 ====================
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('✅ Service Worker registered successfully:', registration.scope);

                // 更新チェック
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('🔄 New Service Worker found, installing...');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // 新しいバージョンが利用可能
                            console.log('🎉 New version available! Please refresh.');
                            showUpdateNotification();
                        }
                    });
                });

                // 定期的に更新をチェック
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000); // 1時間ごと
            })
            .catch(error => {
                console.error('❌ Service Worker registration failed:', error);
            });

        // コントローラー変更時（新しいSWがアクティブになった時）
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 Service Worker controller changed');
        });
    } else {
        console.log('ℹ️ Service Worker is not supported in this browser');
    }
}

// アップデート通知を表示
function showUpdateNotification() {
    // 簡易的な通知（後で改善可能）
    if (confirm('新しいバージョンが利用可能です！\nページを再読み込みしますか？')) {
        window.location.reload();
    }
}

// オフライン/オンライン状態の監視
window.addEventListener('online', () => {
    console.log('🌐 オンラインになりました');
    // 必要に応じてUIを更新
});

window.addEventListener('offline', () => {
    console.log('📵 オフラインになりました');
    // 必要に応じてUIを更新（「オフラインモード」など表示）
});

// ==================== データ読み込み ====================
async function loadFlashcards() {
    try {
        const response = await fetch('フラッシュカードデータ.json');
        flashcards = await response.json();

        // カテゴリーを抽出
        flashcards.forEach(card => categories.add(card.category));

        // 元の順序を保存
        originalOrder = flashcards.map((_, i) => i);
        // 初期シャッフル順を作成（デフォルトは元の順番）
        shuffleOrder = [...originalOrder];

        console.log(`${flashcards.length}枚のフラッシュカードを読み込みました`);
    } catch (error) {
        console.error('フラッシュカードの読み込みに失敗しました:', error);
        alert('データの読み込みに失敗しました。ページを再読み込みしてください。');
    }
}

// ==================== ローカルストレージ ====================
function loadUserData() {
    // 覚えたカードを読み込み
    const saved = localStorage.getItem('masteredCards');
    if (saved) {
        masteredCards = new Set(JSON.parse(saved));
    }

    // シャッフル順を読み込み
    const savedOrder = localStorage.getItem('shuffleOrder');
    if (savedOrder) {
        shuffleOrder = JSON.parse(savedOrder);
    }

    // シャッフル状態を読み込み
    const savedShuffled = localStorage.getItem('isShuffled');
    if (savedShuffled !== null) {
        isShuffled = savedShuffled === 'true';
        updateShuffleButton();
    }

    // 現在のインデックスを読み込み
    const savedIndex = localStorage.getItem('currentIndex');
    if (savedIndex !== null) {
        currentIndex = parseInt(savedIndex, 10);
    }

    // ダークモードを読み込み
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'true') {
        document.body.classList.add('dark-mode');
        updateDarkModeIcon();
    }

    // ストリークデータを読み込み
    loadStreakData();
}

function saveUserData() {
    localStorage.setItem('masteredCards', JSON.stringify([...masteredCards]));
    localStorage.setItem('shuffleOrder', JSON.stringify(shuffleOrder));
    localStorage.setItem('isShuffled', isShuffled.toString());
    localStorage.setItem('currentIndex', currentIndex.toString());
}

function loadStreakData() {
    const savedStreak = localStorage.getItem('streak');
    const savedDate = localStorage.getItem('lastStudyDate');

    if (savedStreak) {
        streak = parseInt(savedStreak, 10);
    }

    if (savedDate) {
        lastStudyDate = savedDate;
    }

    updateStreak();
}

function saveStreakData() {
    localStorage.setItem('streak', streak.toString());
    localStorage.setItem('lastStudyDate', lastStudyDate);
}

function updateStreak() {
    const today = new Date().toDateString();

    if (lastStudyDate === today) {
        // 今日既に学習済み
        updateStreakDisplay();
        return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (lastStudyDate === yesterdayStr) {
        // 昨日学習していた → ストリーク継続
        streak++;
    } else if (lastStudyDate !== null && lastStudyDate !== today) {
        // 1日以上空いた → ストリークリセット
        streak = 1;
    } else if (lastStudyDate === null) {
        // 初回
        streak = 1;
    }

    lastStudyDate = today;
    saveStreakData();
    updateStreakDisplay();
}

function updateStreakDisplay() {
    document.getElementById('streakNumber').textContent = streak;

    const messages = [
        '素晴らしい継続力！',
        '調子いいね！',
        'その調子で頑張ろう！',
        '毎日コツコツ最高！',
        'もう習慣だね！🎉'
    ];

    let message = '今日も学習しよう！';
    if (streak >= 7) {
        message = messages[4];
    } else if (streak >= 5) {
        message = messages[3];
    } else if (streak >= 3) {
        message = messages[2];
    } else if (streak >= 2) {
        message = messages[1];
    } else if (streak >= 1) {
        message = messages[0];
    }

    document.getElementById('streakMessage').textContent = message;
}

// ==================== UI初期化 ====================
function initializeUI() {
    // カテゴリーフィルターを設定
    const filterSelect = document.getElementById('categoryFilter');
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        filterSelect.appendChild(option);
    });

    // カテゴリー別進捗を表示
    updateCategoryProgress();

    // 全体進捗を更新
    updateOverallProgress();
}

// ==================== イベントリスナー ====================
function setupEventListeners() {
    // フラッシュカードのクリック（フリップ）
    const flashcard = document.getElementById('flashcard');
    flashcard.addEventListener('click', flipCard);

    // スワイプ操作
    flashcard.addEventListener('touchstart', handleTouchStart, { passive: true });
    flashcard.addEventListener('touchend', handleTouchEnd, { passive: true });

    // ナビゲーションボタン
    document.getElementById('prevBtn').addEventListener('click', showPrevCard);
    document.getElementById('nextBtn').addEventListener('click', showNextCard);

    // アクションボタン
    document.getElementById('masteredBtn').addEventListener('click', markAsMastered);
    document.getElementById('notMasteredBtn').addEventListener('click', markAsNotMastered);

    // コントロールボタン
    document.getElementById('shuffleBtn').addEventListener('click', shuffleCards);
    document.getElementById('resetBtn').addEventListener('click', resetProgress);

    // フィルター
    document.getElementById('categoryFilter').addEventListener('change', handleFilterChange);
    document.getElementById('showUnmasteredOnly').addEventListener('click', toggleUnmasteredFilter);

    // カード番号ジャンプ
    document.getElementById('jumpToCard').addEventListener('click', openJumpModal);
    document.getElementById('cancelJump').addEventListener('click', closeJumpModal);
    document.getElementById('confirmJump').addEventListener('click', jumpToCard);
    document.getElementById('jumpInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') jumpToCard();
    });

    // ダッシュボード折りたたみ
    document.getElementById('toggleDashboard').addEventListener('click', toggleDashboard);

    // ダークモード切替
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

    // ボトムナビゲーション
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchPage(item.dataset.page));
    });

    // テストモードボタン
    document.getElementById('retryTest').addEventListener('click', startTest);
    document.getElementById('backToDashboard').addEventListener('click', () => switchPage('dashboard'));

    // キーボード操作
    document.addEventListener('keydown', handleKeyPress);
}

// ==================== フラッシュカード表示 ====================
function updateDisplay() {
    const filteredCards = getFilteredCards();

    if (filteredCards.length === 0) {
        showNoCardsMessage();
        return;
    }

    // インデックスを範囲内に収める
    if (currentIndex >= filteredCards.length) {
        currentIndex = 0;
    } else if (currentIndex < 0) {
        currentIndex = filteredCards.length - 1;
    }

    const actualIndex = shuffleOrder[currentIndex];
    const card = flashcards[actualIndex];

    // カード情報を表示
    document.getElementById('cardCategory').textContent = card.category;
    document.getElementById('cardCategoryBack').textContent = card.category;
    document.getElementById('cardQuestion').textContent = card.question;
    document.getElementById('cardAnswer').textContent = card.answer;

    // 進捗表示
    document.getElementById('currentCard').textContent = currentIndex + 1;
    document.getElementById('totalCards').textContent = filteredCards.length;

    // ボタンの有効/無効
    document.getElementById('prevBtn').disabled = currentIndex === 0;
    document.getElementById('nextBtn').disabled = currentIndex === filteredCards.length - 1;

    // カードをリセット（裏返っていたら表に戻す）
    if (isFlipped) {
        isFlipped = false;
        document.getElementById('flashcard').classList.remove('flipped');
    }

    // 保存
    saveUserData();
}

function showNoCardsMessage() {
    document.getElementById('cardCategory').textContent = 'メッセージ';
    document.getElementById('cardQuestion').textContent = '表示するカードがありません';
    document.getElementById('currentCard').textContent = '0';
    document.getElementById('totalCards').textContent = '0';
    document.getElementById('prevBtn').disabled = true;
    document.getElementById('nextBtn').disabled = true;
}

// ==================== フィルタリング ====================
function getFilteredCards() {
    let filtered = shuffleOrder.map(i => flashcards[i]);

    // カテゴリーフィルター
    if (currentFilter !== 'all') {
        filtered = filtered.filter((_, idx) => {
            const actualIndex = shuffleOrder[idx];
            return flashcards[actualIndex].category === currentFilter;
        });
    }

    // 未習得のみフィルター
    if (showUnmasteredOnly) {
        filtered = filtered.filter((_, idx) => {
            const actualIndex = shuffleOrder[idx];
            return !masteredCards.has(flashcards[actualIndex].id);
        });
    }

    // 新しいシャッフル順を作成
    const newShuffleOrder = [];
    for (let i = 0; i < shuffleOrder.length; i++) {
        const actualIndex = shuffleOrder[i];
        const card = flashcards[actualIndex];

        let passCategory = currentFilter === 'all' || card.category === currentFilter;
        let passMastered = !showUnmasteredOnly || !masteredCards.has(card.id);

        if (passCategory && passMastered) {
            newShuffleOrder.push(actualIndex);
        }
    }

    shuffleOrder = newShuffleOrder;

    return filtered;
}

function handleFilterChange(e) {
    currentFilter = e.target.value;
    currentIndex = 0;
    updateDisplay();
}

function toggleUnmasteredFilter() {
    showUnmasteredOnly = !showUnmasteredOnly;
    const button = document.getElementById('showUnmasteredOnly');
    button.classList.toggle('active', showUnmasteredOnly);
    currentIndex = 0;
    updateDisplay();
}

// ==================== カードフリップ ====================
function flipCard() {
    isFlipped = !isFlipped;
    document.getElementById('flashcard').classList.toggle('flipped', isFlipped);
}

// ==================== ナビゲーション ====================
function showPrevCard() {
    if (currentIndex > 0) {
        vibrateLight();
        currentIndex--;
        updateDisplay();
    }
}

function showNextCard() {
    const filteredCards = getFilteredCards();
    if (currentIndex < filteredCards.length - 1) {
        vibrateLight();
        currentIndex++;
        updateDisplay();
    }
}

// ==================== スワイプ操作 ====================
function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // 左スワイプ = 次へ
            showNextCard();
        } else {
            // 右スワイプ = 前へ
            showPrevCard();
        }
    }
}

// ==================== 学習管理 ====================
function markAsMastered() {
    const actualIndex = shuffleOrder[currentIndex];
    const cardId = flashcards[actualIndex].id;

    masteredCards.add(cardId);

    // 紙吹雪演出を表示
    triggerConfetti();

    // ハプティックフィードバック（成功）
    vibrateSuccess();

    // ストリークを更新
    updateStreak();

    // アニメーション付きで次のカードへ
    animateCardTransition(() => {
        showNextCard();
        updateOverallProgress();
        updateCategoryProgress();
    });
}

function markAsNotMastered() {
    const actualIndex = shuffleOrder[currentIndex];
    const cardId = flashcards[actualIndex].id;

    masteredCards.delete(cardId);

    showNextCard();
    updateOverallProgress();
    updateCategoryProgress();
}

function animateCardTransition(callback) {
    const flashcard = document.getElementById('flashcard');

    // カードを右上にフェードアウト
    flashcard.classList.add('card-exit');

    setTimeout(() => {
        flashcard.classList.remove('card-exit');
        callback();

        // 次のカードを下から表示
        flashcard.classList.add('card-enter');

        setTimeout(() => {
            flashcard.classList.remove('card-enter');
        }, 400);
    }, 400);
}

// ==================== 進捗表示 ====================
function updateOverallProgress() {
    const totalCards = flashcards.length;
    const masteredCount = masteredCards.size;
    const remainingCount = totalCards - masteredCount;
    const percentage = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

    // テキスト更新
    document.getElementById('overallPercentage').textContent = `${percentage}%`;
    document.getElementById('masteredCount').textContent = masteredCount;
    document.getElementById('remainingCount').textContent = remainingCount;

    // ドーナツチャート更新
    const circle = document.getElementById('progressCircle');
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    circle.style.strokeDashoffset = offset;
}

function updateCategoryProgress() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = '';

    const categoryStats = {};

    // カテゴリーごとの統計を計算
    categories.forEach(category => {
        const cardsInCategory = flashcards.filter(card => card.category === category);
        const masteredInCategory = cardsInCategory.filter(card => masteredCards.has(card.id));

        categoryStats[category] = {
            total: cardsInCategory.length,
            mastered: masteredInCategory.length,
            percentage: cardsInCategory.length > 0
                ? Math.round((masteredInCategory.length / cardsInCategory.length) * 100)
                : 0
        };
    });

    // カテゴリーごとの進捗バーを作成
    Array.from(categories).sort().forEach(category => {
        const stats = categoryStats[category];

        const item = document.createElement('div');
        item.className = 'category-item';
        item.dataset.category = category;

        item.innerHTML = `
            <span class="category-name">${category}</span>
            <div class="category-bar-container">
                <div class="category-bar" style="width: ${stats.percentage}%"></div>
            </div>
            <span class="category-percentage">${stats.percentage}%</span>
        `;

        // クリックで未習得のみフィルター
        item.addEventListener('click', () => {
            currentFilter = category;
            showUnmasteredOnly = true;
            currentIndex = 0;

            document.getElementById('categoryFilter').value = category;
            document.getElementById('showUnmasteredOnly').classList.add('active');

            // 学習ページに切り替え
            switchPage('study');

            updateDisplay();
        });

        categoryList.appendChild(item);
    });
}

// ==================== ページ切替 ====================
function switchPage(pageName) {
    vibrateLight();

    // 全てのページを非表示
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // 全てのナビアイテムを非アクティブに
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // 指定されたページを表示
    if (pageName === 'dashboard') {
        document.getElementById('dashboardPage').classList.add('active');
        document.querySelector('[data-page="dashboard"]').classList.add('active');
    } else if (pageName === 'study') {
        document.getElementById('studyPage').classList.add('active');
        document.querySelector('[data-page="study"]').classList.add('active');
    } else if (pageName === 'test') {
        document.getElementById('testPage').classList.add('active');
        document.querySelector('[data-page="test"]').classList.add('active');
        startTest();
    }
}

// ==================== シャッフル ====================
function shuffleCards() {
    if (isShuffled) {
        // シャッフル解除：元の順序に戻す
        shuffleOrder = [...originalOrder];
        isShuffled = false;
    } else {
        // シャッフル実行：Fisher-Yatesアルゴリズム
        shuffleOrder = [...originalOrder];
        for (let i = shuffleOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
        }
        isShuffled = true;
    }

    updateShuffleButton();
    currentIndex = 0;
    updateDisplay();
    saveUserData();
}

function updateShuffleButton() {
    const btn = document.getElementById('shuffleBtn');
    const icon = btn.querySelector('.material-icons');

    if (isShuffled) {
        icon.textContent = 'restart_alt';
        btn.innerHTML = '<span class="material-icons">restart_alt</span>元に戻す';
    } else {
        icon.textContent = 'shuffle';
        btn.innerHTML = '<span class="material-icons">shuffle</span>シャッフル';
    }
}

// ==================== リセット ====================
function resetProgress() {
    if (confirm('学習進捗をリセットしますか？この操作は取り消せません。')) {
        masteredCards.clear();
        shuffleOrder = [...originalOrder];
        isShuffled = false;
        currentIndex = 0;
        currentFilter = 'all';
        showUnmasteredOnly = false;

        document.getElementById('categoryFilter').value = 'all';
        document.getElementById('showUnmasteredOnly').classList.remove('active');
        updateShuffleButton();

        updateDisplay();
        updateOverallProgress();
        updateCategoryProgress();
        saveUserData();

        alert('学習進捗をリセットしました！');
    }
}

// ==================== カード番号ジャンプ ====================
function openJumpModal() {
    const modal = document.getElementById('jumpModal');
    const input = document.getElementById('jumpInput');
    const filteredCards = getFilteredCards();

    input.max = filteredCards.length;
    input.value = currentIndex + 1;

    modal.classList.add('active');
    input.focus();
    input.select();
}

function closeJumpModal() {
    const modal = document.getElementById('jumpModal');
    modal.classList.remove('active');
}

function jumpToCard() {
    const input = document.getElementById('jumpInput');
    const cardNumber = parseInt(input.value, 10);
    const filteredCards = getFilteredCards();

    if (cardNumber >= 1 && cardNumber <= filteredCards.length) {
        currentIndex = cardNumber - 1;
        updateDisplay();
        closeJumpModal();
    } else {
        alert(`1から${filteredCards.length}の間の数字を入力してください`);
    }
}

// ==================== ダッシュボード折りたたみ ====================
function toggleDashboard() {
    const dashboard = document.getElementById('dashboard');
    dashboard.classList.toggle('collapsed');
}

// ==================== ダークモード ====================
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark.toString());
    updateDarkModeIcon();
}

function updateDarkModeIcon() {
    const icon = document.querySelector('#darkModeToggle .material-icons');
    const isDark = document.body.classList.contains('dark-mode');
    icon.textContent = isDark ? 'light_mode' : 'dark_mode';
}

// ==================== キーボード操作 ====================
function handleKeyPress(e) {
    // モーダルが開いている時は無視
    if (document.getElementById('jumpModal').classList.contains('active')) {
        return;
    }

    switch(e.key) {
        case 'ArrowLeft':
            showPrevCard();
            break;
        case 'ArrowRight':
            showNextCard();
            break;
        case ' ':
        case 'Enter':
            e.preventDefault();
            flipCard();
            break;
        case 'g':
        case 'G':
            markAsMastered();
            break;
        case 'n':
        case 'N':
            markAsNotMastered();
            break;
    }
}

// ==================== ユーティリティ ====================
// ページを離れる前に保存
window.addEventListener('beforeunload', saveUserData);

// ==================== 紙吹雪演出 ====================
function triggerConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#1A73E8', '#0F9D58', '#DB4437', '#F4B400', '#AB47BC'];
    const shapes = ['square', 'circle', 'triangle'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = `confetti ${shapes[Math.floor(Math.random() * shapes.length)]}`;

        // ランダムな位置
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = -10 + 'px';

        // ランダムな色
        const color = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.backgroundColor = color;
        confetti.style.borderBottomColor = color;

        // ランダムな遅延
        confetti.style.animationDelay = Math.random() * 0.3 + 's';

        // ランダムな持続時間
        confetti.style.animationDuration = (Math.random() * 1 + 2) + 's';

        container.appendChild(confetti);

        // アニメーション終了後に削除
        setTimeout(() => {
            confetti.remove();
        }, 3500);
    }
}

// ==================== ハプティックフィードバック ====================
function vibrateSuccess() {
    if ('vibrate' in navigator) {
        // 成功パターン: 短い-短い-長い
        navigator.vibrate([50, 50, 100]);
    }
}

function vibrateLight() {
    if ('vibrate' in navigator) {
        // 軽いタップ
        navigator.vibrate(10);
    }
}

function vibrateMedium() {
    if ('vibrate' in navigator) {
        // 中程度のタップ
        navigator.vibrate(30);
    }
}

// ==================== テストモード ====================
function startTest() {
    // テストをリセット
    currentTestIndex = 0;
    testScore = 0;
    testAnswers = [];

    // ランダムに10問選択
    const allCards = [...flashcards];
    testQuestions = [];

    for (let i = 0; i < 10 && i < allCards.length; i++) {
        const randomIndex = Math.floor(Math.random() * allCards.length);
        testQuestions.push(allCards.splice(randomIndex, 1)[0]);
    }

    // UI初期化
    document.getElementById('testContent').classList.remove('hidden');
    document.getElementById('testResult').classList.add('hidden');
    document.getElementById('testScore').textContent = '0';
    document.getElementById('testTotal').textContent = testQuestions.length;
    document.getElementById('testProgressFill').style.width = '0%';

    // 最初の問題を表示
    showTestQuestion();
}

function showTestQuestion() {
    if (currentTestIndex >= testQuestions.length) {
        showTestResult();
        return;
    }

    const question = testQuestions[currentTestIndex];

    // 問題を表示
    document.getElementById('testCategory').textContent = question.category;
    document.getElementById('testQuestion').textContent = question.question;

    // 4択を生成
    const options = generateTestOptions(question);
    const optionsContainer = document.getElementById('testOptions');
    optionsContainer.innerHTML = '';

    options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'test-option';
        button.textContent = option.text;
        button.addEventListener('click', () => selectTestOption(option.isCorrect, button));
        optionsContainer.appendChild(button);
    });

    // 進捗を更新
    const progress = ((currentTestIndex) / testQuestions.length) * 100;
    document.getElementById('testProgressFill').style.width = progress + '%';
}

function generateTestOptions(correctQuestion) {
    const options = [];

    // 正解
    options.push({
        text: correctQuestion.answer,
        isCorrect: true
    });

    // 不正解を3つ追加
    const otherCards = flashcards.filter(card => card.id !== correctQuestion.id);
    const shuffled = otherCards.sort(() => Math.random() - 0.5);

    for (let i = 0; i < 3 && i < shuffled.length; i++) {
        options.push({
            text: shuffled[i].answer,
            isCorrect: false
        });
    }

    // シャッフル
    return options.sort(() => Math.random() - 0.5);
}

function selectTestOption(isCorrect, button) {
    vibrateLight();

    // 全てのボタンを無効化
    document.querySelectorAll('.test-option').forEach(btn => {
        btn.classList.add('disabled');
        btn.style.pointerEvents = 'none';
    });

    // 選択されたボタンをハイライト
    if (isCorrect) {
        button.classList.add('correct');
        testScore++;
        testAnswers.push(true);
        document.getElementById('testScore').textContent = testScore;
        vibrateSuccess();
    } else {
        button.classList.add('incorrect');
        testAnswers.push(false);

        // 正解を表示
        document.querySelectorAll('.test-option').forEach(btn => {
            if (btn.textContent === testQuestions[currentTestIndex].answer) {
                btn.classList.add('correct');
            }
        });
    }

    // 1.5秒後に次の問題へ
    setTimeout(() => {
        currentTestIndex++;
        showTestQuestion();
    }, 1500);
}

function showTestResult() {
    // コンテンツを非表示、結果を表示
    document.getElementById('testContent').classList.add('hidden');
    document.getElementById('testResult').classList.remove('hidden');

    const percentage = Math.round((testScore / testQuestions.length) * 100);

    document.getElementById('finalScore').textContent = testScore;
    document.getElementById('finalTotal').textContent = testQuestions.length;
    document.getElementById('resultPercentage').textContent = percentage + '%';

    // アイコンとメッセージを変更
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');

    if (percentage === 100) {
        resultIcon.textContent = '🎉';
        resultTitle.textContent = 'パーフェクト！';
        triggerConfetti();
    } else if (percentage >= 80) {
        resultIcon.textContent = '🌟';
        resultTitle.textContent = '素晴らしい！';
    } else if (percentage >= 60) {
        resultIcon.textContent = '👍';
        resultTitle.textContent = 'よくできました！';
    } else {
        resultIcon.textContent = '💪';
        resultTitle.textContent = 'もう少し頑張ろう！';
    }

    // 進捗を100%に
    document.getElementById('testProgressFill').style.width = '100%';

    vibrateSuccess();
}

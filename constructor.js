// ===== КОНСТРУКТОР ВИКТОРИН =====

// Глобальная переменная для хранения вопросов
let quizQuestions = [];

// Функция для отображения конструктора
function showConstructor() {
    const form = document.getElementById('quizForm');
    form.innerHTML = `
        <h3 style="color: #ffd700; margin-bottom: 20px;">🛠️ Конструктор викторины</h3>
        
        <div class="form-group">
            <label>Название викторины</label>
            <input type="text" id="quizTitle" placeholder="Например: Английский 5 класс">
        </div>
        
        <div class="form-group">
            <label>Класс</label>
            <select id="quizClass">
                <option value="5">5 класс</option>
                <option value="6">6 класс</option>
                <option value="7">7 класс</option>
                <option value="8">8 класс</option>
                <option value="9">9 класс</option>
                <option value="10">10 класс</option>
                <option value="11">11 класс</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>Предмет</label>
            <select id="quizSubject">
                ${allSubjects.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
        </div>
        
        <div class="form-group">
            <label>Количество вопросов</label>
            <div class="question-count">
                <input type="number" id="questionCount" min="1" max="20" value="5">
                <button class="add-quiz-btn" onclick="generateQuestions()">Создать вопросы</button>
            </div>
        </div>
        
        <div id="questionsContainer"></div>
        
        <button class="add-question-btn" onclick="addQuestion()" id="addQuestionBtn" style="display: none;">
            ➕ Добавить вопрос
        </button>
        
        <button class="submit-quiz" onclick="saveQuizWithQuestions()" id="saveQuizBtn" style="display: none;">
            💾 Сохранить викторину
        </button>
    `;
    
    form.classList.add('visible');
}

// Генерация заданного количества вопросов
function generateQuestions() {
    const count = parseInt(document.getElementById('questionCount').value) || 5;
    quizQuestions = [];
    
    for (let i = 0; i < count; i++) {
        quizQuestions.push({
            id: Date.now() + i,
            question: '',
            answers: ['', '', '', ''],
            correct: 0
        });
    }
    
    renderQuestions();
    document.getElementById('addQuestionBtn').style.display = 'block';
    document.getElementById('saveQuizBtn').style.display = 'block';
}

// Добавление нового вопроса
function addQuestion() {
    quizQuestions.push({
        id: Date.now(),
        question: '',
        answers: ['', '', '', ''],
        correct: 0
    });
    renderQuestions();
}

// Удаление вопроса
function removeQuestion(index) {
    quizQuestions.splice(index, 1);
    renderQuestions();
    
    if (quizQuestions.length === 0) {
        document.getElementById('addQuestionBtn').style.display = 'none';
        document.getElementById('saveQuizBtn').style.display = 'none';
    }
}

// Обновление вопроса
function updateQuestion(index, field, value) {
    if (field === 'question') {
        quizQuestions[index].question = value;
    } else if (field.startsWith('answer')) {
        const answerIndex = parseInt(field.replace('answer', ''));
        quizQuestions[index].answers[answerIndex] = value;
    } else if (field === 'correct') {
        quizQuestions[index].correct = parseInt(value);
    }
}

// Отрисовка вопросов
function renderQuestions() {
    const container = document.getElementById('questionsContainer');
    let html = '';
    
    quizQuestions.forEach((q, index) => {
        html += `
            <div class="question-card" id="question-${q.id}">
                <div class="question-header">
                    <span>Вопрос ${index + 1}</span>
                    <button class="remove-question" onclick="removeQuestion(${index})">×</button>
                </div>
                
                <div class="form-group">
                    <label>Текст вопроса</label>
                    <input type="text" value="${q.question}" 
                           onchange="updateQuestion(${index}, 'question', this.value)"
                           placeholder="Введите вопрос">
                </div>
                
                ${[0, 1, 2, 3].map(i => `
                    <div class="answer-option">
                        <input type="radio" name="correct-${q.id}" value="${i}" 
                               ${q.correct === i ? 'checked' : ''}
                               onchange="updateQuestion(${index}, 'correct', this.value)">
                        <input type="text" value="${q.answers[i]}" 
                               placeholder="Вариант ответа ${i + 1}"
                               onchange="updateQuestion(${index}, 'answer${i}', this.value)">
                        ${q.correct === i ? '<span class="correct-badge">✓ Правильный</span>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Сохранение викторины с вопросами
async function saveQuizWithQuestions() {
    const title = document.getElementById('quizTitle').value;
    const quizClass = document.getElementById('quizClass').value;
    const subject = document.getElementById('quizSubject').value;
    
    if (!title) {
        alert('Введите название викторины');
        return;
    }
    
    // Проверяем заполненность
    let isValid = true;
    quizQuestions.forEach((q, index) => {
        if (!q.question) {
            alert(`Заполните вопрос ${index + 1}`);
            isValid = false;
            return;
        }
        
        let hasAnswer = false;
        q.answers.forEach(a => {
            if (a) hasAnswer = true;
        });
        
        if (!hasAnswer) {
            alert(`Добавьте варианты ответов к вопросу ${index + 1}`);
            isValid = false;
            return;
        }
    });
    
    if (!isValid) return;
    
    try {
        // Создаем уникальный ID для викторины
        const quizId = `quiz_${Date.now()}`;
        
        // Сохраняем метаданные викторины
        const quizData = {
            type: 'constructed',
            class: quizClass,
            subject: subject,
            title: title,
            questionCount: quizQuestions.length,
            maxScore: quizQuestions.length,
            createdBy: currentUser.uid,
            createdAt: Date.now()
        };
        
        const quizRef = await db.ref('quizzes').push(quizData);
        const quizKey = quizRef.key;
        
        // Сохраняем вопросы отдельно
        for (let i = 0; i < quizQuestions.length; i++) {
            const q = quizQuestions[i];
            await db.ref(`questions/${quizKey}/${i}`).set({
                question: q.question,
                answers: q.answers,
                correct: q.correct
            });
        }
        
        alert('✅ Викторина успешно создана!');
        document.getElementById('quizForm').classList.remove('visible');
        quizQuestions = [];
        
    } catch (error) {
        console.error('Ошибка при сохранении:', error);
        alert('Ошибка при сохранении викторины');
    }
}

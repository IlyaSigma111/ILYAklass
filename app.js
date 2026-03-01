// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
const baseSubjects = [
    'Русский язык', 'Алгебра', 'Геометрия', 'Математика', 
    'Химия', 'Физика', 'Литература', 'Английский язык', 
    'История', 'Физкультура'
];

// Telegram Bot настройки
const TELEGRAM_BOT_TOKEN = '8632118104:AAFn7dJ-Zd4c7Xki_8cZKjDIc0JjU8Ubt5E';
const TELEGRAM_CHAT_ID = '1474901393';
let lastUpdateId = 0;
let pollingActive = true;
let botStarted = false; // Флаг для защиты от спама
let processedUpdates = new Set(); // Множество обработанных update_id

// Email разработчика (твой)
const DEVELOPER_EMAIL = 'ilyagulkov25@gmail.com';

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ИМЕНАМИ =====
function cleanDisplayName(name) {
    if (!name) return name;
    // Убираем скобки с числом для отображения
    return name.replace(/\s*\(\d+\)$/, '');
}

function getBaseName(name) {
    if (!name) return name;
    // Получаем имя без скобок для проверки уникальности
    return name.replace(/\s*\(\d+\)$/, '').trim();
}

function checkIfModerator(name) {
    if (!name) return false;
    // Проверяем, есть ли скобки с числом в конце
    return /\s*\(\d+\)$/.test(name);
}

async function isNameTaken(baseName, excludeUid = null) {
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    
    for (const uid in users) {
        if (excludeUid && uid === excludeUid) continue;
        
        const user = users[uid];
        const userBaseName = getBaseName(user.fullName || user.googleName);
        
        if (userBaseName.toLowerCase() === baseName.toLowerCase()) {
            return true;
        }
    }
    return false;
}

async function getUniqueName(baseName) {
    let uniqueName = baseName;
    let counter = 1;
    
    while (await isNameTaken(getBaseName(uniqueName))) {
        uniqueName = `${baseName}(${counter})`;
        counter++;
    }
    
    return uniqueName;
}

// ===== TELEGRAM ФУНКЦИИ =====
async function sendTelegramMessage(text, chatId = TELEGRAM_CHAT_ID) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });
        const data = await response.json();
        console.log('Telegram response:', data);
        return data;
    } catch (error) {
        console.error('Ошибка отправки в Telegram:', error);
    }
}

async function getTelegramUpdates() {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.ok && data.result.length > 0) {
            for (const update of data.result) {
                // Проверяем, не обрабатывали ли мы уже это обновление
                if (processedUpdates.has(update.update_id)) {
                    continue;
                }
                
                lastUpdateId = update.update_id;
                processedUpdates.add(update.update_id);
                
                // Ограничиваем размер множества (чтобы не раздувалось)
                if (processedUpdates.size > 100) {
                    const iterator = processedUpdates.values();
                    processedUpdates.delete(iterator.next().value);
                }
                
                if (update.message && update.message.text) {
                    const chatId = update.message.chat.id;
                    const text = update.message.text.trim();
                    
                    await handleTelegramCommand(text, chatId);
                }
            }
        }
    } catch (error) {
        console.error('Ошибка получения обновлений:', error);
    }
    
    if (pollingActive) {
        setTimeout(getTelegramUpdates, 2000);
    }
}

async function handleTelegramCommand(command, chatId) {
    let response = '';
    
    switch(command) {
        case '/start':
            response = `
🚀 <b>Добро пожаловать в бота ИЛЬЯКЛАСС!</b>

📊 <b>Доступные команды:</b>

/stats - Полная статистика
/teachers - Список учителей
/students - Список учеников
/moderators - Список модераторов
/quizzes - Все викторины
/results - Все результаты
/top - Топ учеников
/active - Активные викторины
/help - Помощь
            `;
            break;
            
        case '/help':
            response = `
📚 <b>Помощь по командам:</b>

/stats - общая статистика по платформе
/teachers - список всех учителей
/students - список всех учеников
/moderators - список модераторов
/quizzes - количество и список викторин
/results - статистика по результатам
/top - топ учеников по баллам
/active - список активных викторин
            `;
            break;
            
        case '/stats':
            response = await getFullStats();
            break;
            
        case '/teachers':
            response = await getTeachersList();
            break;
            
        case '/students':
            response = await getStudentsList();
            break;
            
        case '/moderators':
            response = await getModeratorsList();
            break;
            
        case '/quizzes':
            response = await getQuizzesList();
            break;
            
        case '/results':
            response = await getResultsStats();
            break;
            
        case '/top':
            response = await getTopStudents();
            break;
            
        case '/active':
            response = await getActiveQuizzes();
            break;
            
        default:
            if (command.startsWith('/')) {
                response = '❌ Неизвестная команда. Напишите /help';
            } else {
                return;
            }
    }
    
    if (response) {
        await sendTelegramMessage(response, chatId);
    }
}

async function getFullStats() {
    try {
        const [usersSnap, resultsSnap, sessionsSnap, quizzesSnap] = await Promise.all([
            db.ref('users').once('value'),
            db.ref('results').once('value'),
            db.ref('sessions').once('value'),
            db.ref('quizzes').once('value')
        ]);
        
        const users = usersSnap.val() || {};
        const results = resultsSnap.val() || {};
        const sessions = sessionsSnap.val() || {};
        const quizzes = quizzesSnap.val() || {};
        
        let developers = 0, moderators = 0, teachers = 0, students = 0;
        const developersList = [];
        const moderatorsList = [];
        const teachersList = [];
        const studentsList = [];
        
        Object.entries(users).forEach(([id, u]) => {
            const displayName = cleanDisplayName(u.fullName || u.googleName);
            
            if (u.role === 'developer') {
                developers++;
                developersList.push(`👑 ${displayName}`);
            } else if (u.isModerator) {
                moderators++;
                moderatorsList.push(`🛡️ ${displayName}`);
            } else if (u.role === 'teacher') {
                teachers++;
                teachersList.push(`👨‍🏫 ${displayName}`);
            } else if (u.role === 'student') {
                students++;
                studentsList.push(`👨‍🎓 ${displayName}`);
            }
        });
        
        const totalSessions = Object.keys(sessions).length;
        const activeSessions = Object.values(sessions).filter(s => s.status === 'active').length;
        const totalResults = Object.keys(results).length;
        const totalQuizzes = Object.keys(quizzes).length;
        
        let totalScore = 0;
        Object.values(results).forEach(r => totalScore += r.score || 0);
        const avgScore = totalResults > 0 ? (totalScore / totalResults).toFixed(1) : 0;
        
        return `
📊 <b>ПОЛНАЯ СТАТИСТИКА ИЛЬЯКЛАСС</b>

👥 <b>Пользователи:</b>
• Разработчиков: ${developers}
• Модераторов: ${moderators}
• Учителей: ${teachers}
• Учеников: ${students}
• Всего: ${developers + moderators + teachers + students}

📚 <b>Викторины:</b>
• Всего создано: ${totalQuizzes}
• Проведено игр: ${totalSessions}
• Активных сейчас: ${activeSessions}

📝 <b>Результаты:</b>
• Всего результатов: ${totalResults}
• Средний балл: ${avgScore}
• Сумма баллов: ${totalScore}

👑 <b>Разработчики (${developers}):</b>
${developersList.join('\n') || '• Нет'}

🛡️ <b>Модераторы (${moderators}):</b>
${moderatorsList.join('\n') || '• Нет'}

👨‍🏫 <b>Учителя (${teachers}):</b>
${teachersList.slice(0, 5).join('\n')}${teachersList.length > 5 ? `\n... и еще ${teachersList.length - 5}` : ''}

👨‍🎓 <b>Ученики (${students}):</b>
${studentsList.slice(0, 5).join('\n')}${studentsList.length > 5 ? `\n... и еще ${studentsList.length - 5}` : ''}

🕐 ${new Date().toLocaleString('ru-RU')}
        `;
    } catch (error) {
        console.error('Ошибка stats:', error);
        return '❌ Ошибка получения статистики';
    }
}

async function getModeratorsList() {
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    
    let moderators = [];
    Object.values(users).forEach(u => {
        if (u.isModerator) {
            moderators.push(`🛡️ ${cleanDisplayName(u.fullName || u.googleName)}`);
        }
    });
    
    return moderators.length > 0 
        ? `🛡️ <b>Список модераторов (${moderators.length}):</b>\n\n${moderators.join('\n')}`
        : '🛡️ Модераторов пока нет';
}

async function getTeachersList() {
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    
    let teachers = [];
    Object.values(users).forEach(u => {
        if (u.role === 'teacher' && !u.isModerator) {
            teachers.push(`• ${cleanDisplayName(u.fullName || u.googleName)}`);
        }
    });
    
    return teachers.length > 0 
        ? `👨‍🏫 <b>Список учителей (${teachers.length}):</b>\n\n${teachers.join('\n')}`
        : '👨‍🏫 Учителей пока нет';
}

async function getStudentsList() {
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    
    let students = [];
    Object.values(users).forEach(u => {
        if (u.role === 'student' && !u.isModerator) {
            students.push(`• ${cleanDisplayName(u.fullName || u.googleName)}`);
        }
    });
    
    return students.length > 0 
        ? `👨‍🎓 <b>Список учеников (${students.length}):</b>\n\n${students.join('\n')}`
        : '👨‍🎓 Учеников пока нет';
}

async function getQuizzesList() {
    const quizzesSnap = await db.ref('quizzes').once('value');
    const quizzes = quizzesSnap.val() || {};
    
    let bySubject = {};
    Object.values(quizzes).forEach(q => {
        bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
    });
    
    let subjects = Object.entries(bySubject)
        .map(([s, c]) => `• ${s}: ${c} викторин`)
        .join('\n');
    
    return `
📚 <b>Статистика викторин:</b>
• Всего: ${Object.keys(quizzes).length}

<b>По предметам:</b>
${subjects}
    `;
}

async function getResultsStats() {
    const resultsSnap = await db.ref('results').once('value');
    const results = resultsSnap.val() || {};
    
    let bySubject = {};
    let totalScore = 0;
    
    Object.values(results).forEach(r => {
        bySubject[r.quizSubject] = (bySubject[r.quizSubject] || 0) + 1;
        totalScore += r.score || 0;
    });
    
    let subjects = Object.entries(bySubject)
        .map(([s, c]) => `• ${s}: ${c} результатов`)
        .join('\n');
    
    return `
📝 <b>Статистика результатов:</b>
• Всего: ${Object.keys(results).length}
• Сумма баллов: ${totalScore}
• Средний балл: ${(totalScore / Object.keys(results).length).toFixed(1)}

<b>По предметам:</b>
${subjects}
    `;
}

async function getTopStudents() {
    const resultsSnap = await db.ref('results').once('value');
    const results = resultsSnap.val() || {};
    
    let studentScores = {};
    Object.values(results).forEach(r => {
        if (!studentScores[r.studentName]) {
            studentScores[r.studentName] = { total: 0, count: 0 };
        }
        studentScores[r.studentName].total += r.score || 0;
        studentScores[r.studentName].count++;
    });
    
    let top = Object.entries(studentScores)
        .map(([name, data]) => ({ name: cleanDisplayName(name), avg: data.total / data.count, total: data.total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((s, i) => `${i+1}. ${s.name} — ${s.total} баллов (ср. ${s.avg.toFixed(1)})`)
        .join('\n');
    
    return `🏆 <b>Топ учеников:</b>\n\n${top || 'Пока нет данных'}`;
}

async function getActiveQuizzes() {
    const sessionsSnap = await db.ref('sessions').once('value');
    const sessions = sessionsSnap.val() || {};
    
    let active = [];
    Object.entries(sessions).forEach(([id, s]) => {
        if (s.status === 'active') {
            active.push(`• ${s.quizSubject} - ${s.quizTitle}\n  👥 ${Object.keys(s.students || {}).length} учеников`);
        }
    });
    
    return active.length > 0
        ? `🟢 <b>Активные викторины (${active.length}):</b>\n\n${active.join('\n\n')}`
        : '🟢 Активных викторин нет';
}

// ===== АВТОРИЗАЦИЯ =====
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadAllSubjects();
        
        const userRef = db.ref('users/' + user.uid);
        const snapshot = await userRef.once('value');
        let userData = snapshot.val();
        
        if (userData && userData.role) {
            userRole = userData.role;
            userFullName = userData.fullName || user.displayName;
            
            // Проверяем, разработчик ли это
            const isDeveloper = user.email === DEVELOPER_EMAIL;
            
            if (isDeveloper) {
                userRole = 'developer';
                userIsModerator = false;
                await db.ref('users/' + currentUser.uid).update({
                    role: 'developer',
                    isModerator: false
                });
            } else {
                // Проверяем, модератор ли это (по наличию скобок в имени)
                userIsModerator = userData.isModerator || checkIfModerator(user.displayName);
                
                if (userIsModerator && !userData.isModerator) {
                    await db.ref('users/' + currentUser.uid).update({
                        isModerator: true
                    });
                }
            }
            
            if (userRole === 'teacher' && userData.subjects) {
                teacherSubjects = userData.subjects;
            } else if (userRole === 'teacher') {
                teacherSubjects = [...allSubjects];
            }
            
            document.getElementById('roleModal').style.display = 'none';
            updateUI();
            
            const savedSubject = localStorage.getItem('selectedSubject_' + currentUser.uid);
            if (savedSubject && (savedSubject === 'all' || allSubjects.includes(savedSubject))) {
                selectedSubject = savedSubject;
            } else {
                selectedSubject = 'all';
            }
            
            loadContent();
        } else {
            document.getElementById('roleModal').style.display = 'flex';
            updateUI();
        }
    } else {
        currentUser = null;
        userRole = null;
        userFullName = null;
        userIsModerator = false;
        teacherSubjects = [];
        updateUI();
        loadContent();
    }
});

async function loadAllSubjects() {
    const subjectsSnap = await db.ref('subjects').once('value');
    const subjects = subjectsSnap.val();
    if (subjects) {
        allSubjects = Object.values(subjects);
    } else {
        allSubjects = [...baseSubjects];
    }
}

function signIn() {
    auth.signInWithPopup(provider);
}

function signOut() {
    auth.signOut();
}

async function selectRole(role) {
    if (!currentUser) return;
    
    // Проверяем уникальность имени
    const baseName = getBaseName(currentUser.displayName);
    const isTaken = await isNameTaken(baseName);
    
    let finalName = currentUser.displayName;
    if (isTaken) {
        finalName = await getUniqueName(baseName);
    }
    
    const isDeveloper = currentUser.email === DEVELOPER_EMAIL;
    const isModerator = !isDeveloper && checkIfModerator(finalName);
    
    const userData = {
        email: currentUser.email,
        googleName: currentUser.displayName,
        avatar: currentUser.photoURL,
        role: isDeveloper ? 'developer' : role,
        fullName: finalName,
        isModerator: isModerator,
        registeredAt: Date.now()
    };
    
    await db.ref('users/' + currentUser.uid).set(userData);
    
    document.getElementById('roleModal').style.display = 'none';
    userFullName = finalName;
    userRole = isDeveloper ? 'developer' : role;
    userIsModerator = isModerator;
    
    if (role === 'teacher' && !isDeveloper) {
        document.getElementById('subjectModal').style.display = 'flex';
        renderSubjectCheckboxes();
    } else {
        window.location.reload();
    }
}

async function saveTeacherSubjects() {
    const checkboxes = document.querySelectorAll('#subjectsCheckboxList input[type="checkbox"]:checked');
    teacherSubjects = Array.from(checkboxes).map(cb => cb.value);
    
    await db.ref('users/' + currentUser.uid).update({
        subjects: teacherSubjects
    });
    
    document.getElementById('subjectModal').style.display = 'none';
    window.location.reload();
}

function skipSubjectSelection() {
    document.getElementById('subjectModal').style.display = 'none';
    teacherSubjects = [...allSubjects];
    window.location.reload();
}

function updateUI() {
    const userSection = document.getElementById('userSection');
    if (!userSection) return;
    
    if (currentUser) {
        const displayName = cleanDisplayName(userFullName || currentUser.displayName);
        let roleText = '';
        let roleClass = '';
        
        if (userRole === 'developer') {
            roleText = '👑 Разработчик';
            roleClass = 'developer';
        } else if (userIsModerator) {
            roleText = '🛡️ Модератор';
            roleClass = 'moderator';
        } else {
            roleText = userRole === 'teacher' ? '👨‍🏫 Учитель' : '👨‍🎓 Ученик';
        }
        
        userSection.innerHTML = `
            <div class="user-card">
                <img src="${currentUser.photoURL}" class="avatar">
                <div class="user-info">
                    <span class="user-name">${displayName}</span>
                    <span class="user-role ${roleClass}">${roleText}</span>
                </div>
                <button onclick="signOut()" class="logout-btn">Выйти</button>
            </div>
        `;
    } else {
        userSection.innerHTML = '';
    }
}

// ===== ЗАГРУЗКА КОНТЕНТА =====
function loadContent() {
    const content = document.getElementById('content');
    
    if (!currentUser) {
        content.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-title">
                        <span class="logo-il">ИЛЬ</span>
                        <span class="logo-yaclass">ЯКЛАСС</span>
                    </div>
                    <div class="login-subtitle">Войдите, чтобы продолжить</div>
                    <button class="login-big-btn" onclick="signIn()">
                        🔑 Войти через Google
                    </button>
                </div>
            </div>
        `;
        return;
    }

    let subjectsToShow = [];
    
    if (userRole === 'teacher') {
        subjectsToShow = teacherSubjects.filter(s => allSubjects.includes(s));
    } else {
        subjectsToShow = [...allSubjects];
    }

    content.innerHTML = `
        <div class="subjects-grid" id="subjectsGrid">
            ${userRole === 'student' ? `
                <div class="subject-card ${selectedSubject === 'all' ? 'selected' : ''}" onclick="selectSubject('all')">
                    <div class="subject-icon">📚</div>
                    <div class="subject-name">Все предметы</div>
                    <div class="subject-count" id="count-all">0 викторин</div>
                </div>
            ` : ''}
            ${subjectsToShow.map(s => `
                <div class="subject-card ${selectedSubject === s ? 'selected' : ''}" onclick="selectSubject('${s}')" id="subject-${s.replace(/\s/g, '')}">
                    <div class="subject-icon">📖</div>
                    <div class="subject-name">${s}</div>
                    <div class="subject-count" id="count-${s.replace(/\s/g, '')}">0 викторин</div>
                </div>
            `).join('')}
        </div>

        <div class="quizzes-section" id="quizzesSection">
            <div class="section-header">
                <h2 class="section-title" id="selectedSubjectTitle">${selectedSubject === 'all' ? 'Все предметы' : selectedSubject}</h2>
                ${userRole === 'teacher' || userRole === 'developer' || userIsModerator ? `
                    <button class="add-quiz-btn" onclick="toggleForm()">➕ Добавить викторину</button>
                ` : ''}
            </div>

            <div id="quizForm" class="quiz-form">
                <h3 style="color: #ffd700; margin-bottom: 20px; font-size: 24px;">Новая викторина</h3>
                
                <div class="form-group">
                    <label>Тип викторины</label>
                    <div class="radio-group" id="quizTypeGroup">
                        <div class="radio-option selected" onclick="selectQuizType('kahoot')" id="type-kahoot">
                            <input type="radio" name="quizType" value="kahoot" checked> 🎮 Kahoot
                        </div>
                        <div class="radio-option" onclick="selectQuizType('simple')" id="type-simple">
                            <input type="radio" name="quizType" value="simple"> 📝 Простая
                        </div>
                    </div>
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
                        ${allSubjects.map(s => `<option value="${s}" ${selectedSubject !== 'all' && selectedSubject === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Название</label>
                    <input type="text" id="quizTitle" placeholder="Conditionals">
                </div>

                <div class="form-group">
                    <label>Описание</label>
                    <textarea id="quizDescription" rows="3" placeholder="Краткое описание..."></textarea>
                </div>

                <div class="form-group">
                    <label>Ссылка</label>
                    <input type="url" id="quizLink" placeholder="https://...">
                </div>

                <div class="form-group" id="maxScoreGroup">
                    <label>Макс. балл</label>
                    <input type="number" id="quizMaxScore" value="15" min="1" max="100">
                </div>

                <button class="submit-quiz" onclick="saveQuiz()">💾 Сохранить</button>
            </div>

            <div id="quizzesList" class="quiz-grid"></div>
        </div>

        ${userRole === 'teacher' || userRole === 'developer' || userIsModerator ? `
            <div class="my-quizzes-section">
                <h2 class="section-title">📋 Мои проведенные викторины</h2>
                <div id="myQuizzesList" class="sessions-grid"></div>
            </div>
        ` : `
            <div class="my-quizzes-section">
                <h2 class="section-title">📊 Мои результаты</h2>
                <div id="myResults" class="results-grid"></div>
            </div>
        `}
    `;

    loadAllQuizzes();
    if (userRole === 'teacher' || userRole === 'developer' || userIsModerator) {
        loadTeacherSessions();
    } else {
        loadStudentResults();
    }
    
    if (window.location.hash === '#addQuiz') {
        setTimeout(() => {
            document.getElementById('quizForm').classList.add('visible');
        }, 500);
    }
}

function selectSubject(subject) {
    selectedSubject = subject;
    localStorage.setItem('selectedSubject_' + currentUser.uid, subject);
    
    document.querySelectorAll('.subject-card').forEach(el => el.classList.remove('selected'));
    
    if (subject === 'all') {
        const allSubjectEl = document.querySelector('.subject-card');
        if (allSubjectEl) allSubjectEl.classList.add('selected');
    } else {
        const el = document.getElementById(`subject-${subject.replace(/\s/g, '')}`);
        if (el) el.classList.add('selected');
    }
    
    document.getElementById('selectedSubjectTitle').innerHTML = subject === 'all' ? 'Все предметы' : subject;
    loadQuizzesBySubject(subject);
}

function loadAllQuizzes() {
    db.ref('quizzes').on('value', (snapshot) => {
        const quizzes = snapshot.val();
        if (!quizzes) return;
        
        const counts = {};
        allSubjects.forEach(s => counts[s] = 0);
        
        Object.values(quizzes).forEach(q => {
            if (counts.hasOwnProperty(q.subject)) {
                counts[q.subject]++;
            }
        });
        
        allSubjects.forEach(s => {
            const countEl = document.getElementById(`count-${s.replace(/\s/g, '')}`);
            if (countEl) {
                countEl.textContent = `${counts[s] || 0} викторин`;
            }
        });
        
        if (userRole === 'student') {
            const countAllEl = document.getElementById('count-all');
            if (countAllEl) {
                const total = Object.values(quizzes).length;
                countAllEl.textContent = `${total} викторин`;
            }
        }
        
        loadQuizzesBySubject(selectedSubject);
    });
}

function loadQuizzesBySubject(subject) {
    let query = db.ref('quizzes');
    
    if (subject !== 'all') {
        query = query.orderByChild('subject').equalTo(subject);
    }
    
    query.on('value', (snapshot) => {
        const quizzes = snapshot.val();
        const container = document.getElementById('quizzesList');
        if (!container) return;
        
        if (!quizzes) {
            container.innerHTML = '<div class="empty-message">В этом разделе пока нет викторин</div>';
            return;
        }

        let html = '';
        const quizzesArray = Object.entries(quizzes);
        
        let filteredQuizzes = quizzesArray;
        if (userRole === 'teacher' && teacherSubjects.length > 0 && subject === 'all') {
            filteredQuizzes = quizzesArray.filter(([_, q]) => teacherSubjects.includes(q.subject));
        }
        
        const processQuizzes = async () => {
            for (const [key, q] of filteredQuizzes) {
                if (userRole === 'student' && q.type === 'kahoot') {
                    const sessionsSnap = await db.ref('sessions').orderByChild('quizId').equalTo(key).once('value');
                    const sessions = sessionsSnap.val();
                    let isActive = false;
                    if (sessions) {
                        Object.values(sessions).forEach(s => {
                            if (s.status === 'active') isActive = true;
                        });
                    }
                    if (!isActive) continue;
                }
                
                let teacherLink = q.link;
                let studentLink = q.link;
                
                if (q.type === 'kahoot' && q.link.includes('ilyasigma111.github.io')) {
                    if (!teacherLink.endsWith('/teacher.html') && !teacherLink.endsWith('/student.html')) {
                        teacherLink = teacherLink.replace(/\/?$/, '') + '/teacher.html';
                        studentLink = studentLink.replace(/\/?$/, '') + '/student.html';
                    } else if (teacherLink.endsWith('/teacher.html')) {
                        studentLink = teacherLink.replace('/teacher.html', '/student.html');
                    } else if (teacherLink.endsWith('/student.html')) {
                        teacherLink = studentLink.replace('/student.html', '/teacher.html');
                    }
                }
                
                html += `
                    <div class="quiz-card">
                        <div class="quiz-header">
                            <span class="quiz-badge ${q.type === 'kahoot' ? 'badge-kahoot' : 'badge-simple'}">
                                ${q.type === 'kahoot' ? '🎮 Kahoot' : '📝 Простая'}
                            </span>
                            ${userRole === 'teacher' || userRole === 'developer' || userIsModerator ? `
                                <button class="delete-btn" onclick="deleteQuiz('${key}')" title="Удалить">🗑️</button>
                            ` : ''}
                        </div>
                        <div class="quiz-class">${q.class} класс</div>
                        <div class="quiz-title">${q.title}</div>
                        <div class="quiz-subject">${q.subject}</div>
                        ${q.description ? `<p class="quiz-description">${q.description}</p>` : ''}
                        <div class="quiz-link">🔗 ${q.link}</div>
                        ${q.type === 'kahoot' ? `<div class="quiz-maxscore">Макс: ${q.maxScore}</div>` : ''}
                        
                        <div class="quiz-actions">
                            ${userRole === 'teacher' || userRole === 'developer' || userIsModerator ? `
                                ${q.type === 'kahoot' ? 
                                    `<button class="btn btn-teacher" onclick="startQuiz('${key}', '${teacherLink}', '${q.subject}', '${q.title}', ${q.maxScore})">▶️ Запустить</button>` :
                                    `<a href="${q.link}" target="_blank" class="btn btn-external">🌐 Перейти</a>`
                                }
                            ` : `
                                ${q.type === 'kahoot' ? 
                                    `<button class="btn btn-student" onclick="joinQuiz('${key}', '${studentLink}', '${q.subject}', '${q.title}', ${q.maxScore})">🎮 Играть</button>` :
                                    `<a href="${q.link}" target="_blank" class="btn btn-external">🌐 Перейти</a>`
                                }
                            `}
                        </div>
                    </div>
                `;
            }
            
            container.innerHTML = html || '<div class="empty-message">В этом разделе пока нет викторин</div>';
        };
        
        processQuizzes();
    });
}

async function deleteQuiz(quizId) {
    if (!confirm('Удалить викторину?')) return;
    try {
        await db.ref('quizzes/' + quizId).remove();
        alert('Викторина удалена');
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

function selectQuizType(type) {
    quizType = type;
    document.getElementById('type-kahoot').classList.toggle('selected', type === 'kahoot');
    document.getElementById('type-simple').classList.toggle('selected', type === 'simple');
    document.getElementById('maxScoreGroup').style.display = type === 'kahoot' ? 'block' : 'none';
}

function toggleForm() {
    document.getElementById('quizForm').classList.toggle('visible');
}

async function saveQuiz() {
    try {
        const type = quizType;
        const quizClass = document.getElementById('quizClass').value;
        const subject = document.getElementById('quizSubject').value;
        const title = document.getElementById('quizTitle').value;
        const description = document.getElementById('quizDescription').value;
        let link = document.getElementById('quizLink').value;
        const maxScore = type === 'kahoot' ? parseInt(document.getElementById('quizMaxScore').value) : 0;

        if (!title || !link) {
            alert('Заполните название и ссылку');
            return;
        }

        if (type === 'kahoot' && link.includes('ilyasigma111.github.io')) {
            link = link.replace(/\/$/, '');
        }

        const quizData = {
            type, class: quizClass, subject, title, description, link,
            createdBy: currentUser.uid,
            createdAt: Date.now()
        };

        if (type === 'kahoot') quizData.maxScore = maxScore;

        await db.ref('quizzes').push(quizData);
        
        document.getElementById('quizTitle').value = '';
        document.getElementById('quizDescription').value = '';
        document.getElementById('quizLink').value = '';
        document.getElementById('quizMaxScore').value = '15';
        document.getElementById('quizForm').classList.remove('visible');
        
        alert('✅ Викторина добавлена');
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function startQuiz(quizId, link, subject, title, maxScore) {
    try {
        const teacherName = userFullName || currentUser.displayName || 'Учитель';
        
        let folder = '';
        if (link.includes('ilyasigma111.github.io')) {
            const match = link.match(/github\.io\/([^\/]+)/);
            if (match) folder = match[1];
        }
        
        const sessionRef = db.ref('sessions').push();
        const sessionId = sessionRef.key;
        
        const sessionData = {
            quizId, quizFolder: folder, quizSubject: subject, quizTitle: title,
            maxScore: maxScore || 0, teacherId: currentUser.uid, teacherName,
            status: 'active', startedAt: Date.now(), students: {}
        };
        
        await sessionRef.set(sessionData);
        await db.ref(`teacherSessions/${currentUser.uid}/${sessionId}`).set({
            quizSubject: subject, quizTitle: title, maxScore: maxScore || 0,
            status: 'active', startedAt: Date.now(), students: {}
        });
        
        window.open(link, '_blank');
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function joinQuiz(quizId, link, subject, title, maxScore) {
    try {
        const studentName = userFullName || currentUser.displayName || 'Ученик';
        if (!studentName) return;
        
        const sessionsSnapshot = await db.ref('sessions').orderByChild('quizId').equalTo(quizId).once('value');
        const sessions = sessionsSnapshot.val();
        
        let activeSession = null;
        let activeSessionId = null;
        
        if (sessions) {
            for (const [key, value] of Object.entries(sessions)) {
                if (value.status === 'active') {
                    activeSession = value;
                    activeSessionId = key;
                    break;
                }
            }
        }
        
        if (!activeSession) {
            alert('Нет активной викторины');
            return;
        }
        
        await db.ref(`sessions/${activeSessionId}/students/${currentUser.uid}`).set({
            name: studentName, email: currentUser.email, joinedAt: Date.now()
        });
        
        await db.ref(`teacherSessions/${activeSession.teacherId}/${activeSessionId}/students/${currentUser.uid}`).set({
            name: studentName, email: currentUser.email
        });
        
        let url;
        try {
            url = new URL(link);
            url.searchParams.append('session', activeSessionId);
            url.searchParams.append('student', currentUser.uid);
            url.searchParams.append('name', studentName);
            window.open(url.toString(), '_blank');
        } catch (e) {
            const separator = link.includes('?') ? '&' : '?';
            window.open(link + separator + `session=${activeSessionId}&student=${currentUser.uid}&name=${encodeURIComponent(studentName)}`, '_blank');
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

function loadTeacherSessions() {
    db.ref(`teacherSessions/${currentUser.uid}`).on('value', (snapshot) => {
        const sessions = snapshot.val();
        const container = document.getElementById('myQuizzesList');
        if (!container) return;
        
        if (!sessions) {
            container.innerHTML = '<div class="empty-state">📭 Нет проведенных викторин</div>';
            return;
        }

        let html = '';
        const sortedIds = Object.keys(sessions).sort((a, b) => {
            return (sessions[b].startedAt || 0) - (sessions[a].startedAt || 0);
        });
        
        sortedIds.forEach(id => {
            const s = sessions[id];
            const date = s.startedAt ? new Date(s.startedAt).toLocaleString() : 'Дата неизвестна';
            const sessionId = `session-${id}`;
            const studentsCount = s.students ? Object.keys(s.students).length : 0;
            
            html += `
                <div class="session-card">
                    <div class="session-preview" onclick="toggleSessionDetails('${sessionId}')">
                        <div class="session-info">
                            <div class="session-title">${s.quizSubject} - ${s.quizTitle}</div>
                            <div class="session-meta">
                                <span class="session-date">📅 ${date}</span>
                                <span class="session-students">👥 ${studentsCount}</span>
                            </div>
                        </div>
                        <div class="session-right">
                            <span class="session-status ${s.status === 'active' ? 'status-active' : 'status-finished'}">
                                ${s.status === 'active' ? '🟢 Активна' : '🔵 Завершена'}
                            </span>
                            <span class="toggle-icon">▼</span>
                        </div>
                    </div>
                    
                    <div id="${sessionId}" class="session-details" style="display: none;">
                        <div class="students-list">
                            ${renderStudents(s.students, s.maxScore, id, s.status)}
                        </div>
                        
                        ${s.status === 'active' ? `
                            <button class="finish-quiz-btn" onclick="finishQuiz('${id}')">
                                🏁 Завершить викторину
                            </button>
                        ` : ''}
                        
                        ${s.status === 'finished' ? `
                            <button class="save-scores-btn" onclick="saveScores('${id}')">
                                💾 Сохранить баллы
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        // Опасная зона только для разработчика
        if (userRole === 'developer') {
            html += `
                <div class="danger-zone">
                    <h3>⚠️ Опасная зона</h3>
                    <button class="clear-stats-btn" onclick="clearAllStats()">
                        🗑️ ОЧИСТИТЬ ВСЁ
                    </button>
                </div>
            `;
        }
        
        container.innerHTML = html;
    });
}

function toggleSessionDetails(sessionId) {
    const details = document.getElementById(sessionId);
    if (!details) return;
    
    const card = details.closest('.session-card');
    const icon = card.querySelector('.toggle-icon');
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        icon.textContent = '▲';
        card.classList.add('expanded');
    } else {
        details.style.display = 'none';
        icon.textContent = '▼';
        card.classList.remove('expanded');
    }
}

function renderStudents(students, maxScore, sessionId, status) {
    if (!students || Object.keys(students).length === 0) {
        return '<div class="empty-students">👥 Пока нет учеников</div>';
    }
    
    let html = '<div class="students-grid">';
    Object.keys(students).forEach(id => {
        const student = students[id];
        html += `
            <div class="student-card">
                <div class="student-name">${student.name || 'Без имени'}</div>
                ${status === 'finished' ? 
                    `<input type="number" class="score-input" id="score-${sessionId}-${id}" 
                            max="${maxScore || 100}" min="0" 
                            placeholder="0-${maxScore || 100}" value="${student.score || 0}">` :
                    '<div class="student-status">✓ Присоединился</div>'
                }
            </div>
        `;
    });
    html += '</div>';
    return html;
}

async function finishQuiz(sessionId) {
    try {
        await db.ref(`sessions/${sessionId}`).update({ status: 'finished' });
        await db.ref(`teacherSessions/${currentUser.uid}/${sessionId}`).update({ status: 'finished' });
        
        const session = (await db.ref(`teacherSessions/${currentUser.uid}/${sessionId}`).once('value')).val();
        sendTelegramMessage(`
🎮 <b>Викторина завершена!</b>
📖 ${session.quizSubject} - ${session.quizTitle}
👥 Участников: ${Object.keys(session.students || {}).length}
        `);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function saveScores(sessionId) {
    try {
        const sessionSnap = await db.ref(`sessions/${sessionId}`).once('value');
        const session = sessionSnap.val();
        
        if (!session || !session.students) {
            alert('Нет учеников');
            return;
        }
        
        let count = 0;
        for (const studentId of Object.keys(session.students)) {
            const input = document.getElementById(`score-${sessionId}-${studentId}`);
            if (!input) continue;
            
            const score = parseInt(input.value);
            if (isNaN(score)) continue;
            
            const resultId = `${sessionId}_${studentId}`;
            await db.ref('results/' + resultId).set({
                studentId, studentName: session.students[studentId].name,
                quizSubject: session.quizSubject, quizTitle: session.quizTitle,
                score, maxScore: session.maxScore || 0,
                teacherId: currentUser.uid, sessionId, date: Date.now()
            });
            
            await db.ref(`teacherSessions/${currentUser.uid}/${sessionId}/students/${studentId}`).update({ score });
            count++;
        }
        
        alert(`✅ Сохранено ${count} результатов`);
        
        const stats = await getFullStats();
        sendTelegramMessage(stats);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function clearAllStats() {
    if (!confirm('⚠️ Удалить ВСЕ результаты?')) return;
    
    const password = prompt('Введите "УДАЛИТЬ ВСЁ"');
    if (password !== 'УДАЛИТЬ ВСЁ') {
        alert('Отмена');
        return;
    }
    
    try {
        const resultsSnap = await db.ref('results').once('value');
        const results = resultsSnap.val();
        
        if (!results) {
            alert('Нет результатов');
            return;
        }
        
        const total = Object.keys(results).length;
        let count = 0;
        
        for (const key of Object.keys(results)) {
            await db.ref('results/' + key).remove();
            count++;
        }
        
        alert(`✅ Удалено ${count} результатов`);
        sendTelegramMessage(`🧹 <b>Очистка статистики</b>\nУдалено ${count} результатов`);
        
        window.location.reload();
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

function loadStudentResults() {
    db.ref('results').orderByChild('studentId').equalTo(currentUser.uid).on('value', (snapshot) => {
        const results = snapshot.val();
        const container = document.getElementById('myResults');
        if (!container) return;
        
        if (!results) {
            container.innerHTML = '<div class="empty-state">📭 У вас пока нет результатов</div>';
            return;
        }

        let html = '<div class="results-grid">';
        const sortedIds = Object.keys(results).sort((a, b) => {
            return (results[b].date || 0) - (results[a].date || 0);
        });
        
        sortedIds.forEach(key => {
            const r = results[key];
            const date = r.date ? new Date(r.date).toLocaleString() : 'Дата неизвестна';
            
            html += `
                <div class="result-card">
                    <div class="result-subject">${r.quizSubject}</div>
                    <div class="result-title">${r.quizTitle}</div>
                    <div class="result-score">${r.score || 0}/${r.maxScore || 0}</div>
                    <div class="result-date">${date}</div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    });
}

// ===== ЗАПУСК TELEGRAM БОТА (ТОЛЬКО ОДИН РАЗ) =====
let botInitialized = false;

setTimeout(() => {
    if (!botInitialized) {
        botInitialized = true;
        getTelegramUpdates();
        
        // Отправляем приветствие только один раз
        sendTelegramMessage(`
🚀 <b>ИЛЬЯКЛАСС ЗАПУЩЕН!</b>

Бот готов к работе.
Напишите /help для списка команд.
        `);
    }
}, 3000);

// Ежедневная статистика (проверяем каждый час, отправляем только в 20:00)
setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 20 && now.getMinutes() === 0) {
        const stats = await getFullStats();
        sendTelegramMessage(stats);
    }
}, 60000);

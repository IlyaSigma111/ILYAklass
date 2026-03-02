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
let botStarted = false;
let processedUpdates = new Set();

// Email разработчика (для Google входа)
const DEVELOPER_EMAIL = 'ilyagulkov25@gmail.com';

// ===== ОБНОВЛЕННАЯ АВТОРИЗАЦИЯ (поддерживает оба способа) =====
auth.onAuthStateChanged(async (googleUser) => {
    // Проверяем сначала simple-пользователя
    const simpleUser = getCurrentSimpleUser();
    
    if (simpleUser) {
        // Используем simple-пользователя
        currentUser = {
            uid: simpleUser.id,
            email: simpleUser.username + '@local',
            displayName: simpleUser.username,
            photoURL: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'
        };
        userRole = simpleUser.role;
        userFullName = simpleUser.fullName || simpleUser.username;
        userIsModerator = simpleUser.isModerator || false;
        
        await loadAllSubjects();
        document.getElementById('roleModal').style.display = 'none';
        updateUI();
        
        const savedSubject = localStorage.getItem('selectedSubject_' + currentUser.uid);
        if (savedSubject && (savedSubject === 'all' || allSubjects.includes(savedSubject))) {
            selectedSubject = savedSubject;
        } else {
            selectedSubject = 'all';
        }
        
        loadContent();
        
    } else if (googleUser) {
        // Используем Google-пользователя
        currentUser = googleUser;
        await loadAllSubjects();
        
        const userRef = db.ref('users/' + googleUser.uid);
        const snapshot = await userRef.once('value');
        let userData = snapshot.val();
        
        if (userData && userData.role) {
            userRole = userData.role;
            userFullName = userData.fullName || googleUser.displayName;
            
            const isDeveloper = googleUser.email === DEVELOPER_EMAIL;
            
            if (isDeveloper) {
                userRole = 'developer';
                userIsModerator = false;
                await db.ref('users/' + currentUser.uid).update({
                    role: 'developer',
                    isModerator: false
                });
            } else {
                userIsModerator = userData.isModerator || checkIfModerator(googleUser.displayName);
                
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
    if (getCurrentSimpleUser()) {
        simpleLogout();
    } else {
        auth.signOut();
    }
}

async function selectRole(role) {
    if (!currentUser) return;
    
    try {
        const baseName = getBaseName(currentUser.displayName);
        
        const isDeveloper = currentUser.email === DEVELOPER_EMAIL;
        const isModerator = !isDeveloper && checkIfModerator(currentUser.displayName);
        
        const userData = {
            email: currentUser.email,
            googleName: currentUser.displayName,
            avatar: currentUser.photoURL,
            role: isDeveloper ? 'developer' : role,
            fullName: currentUser.displayName,
            isModerator: isModerator,
            registeredAt: Date.now()
        };
        
        await db.ref('users/' + currentUser.uid).set(userData);
        
        document.getElementById('roleModal').style.display = 'none';
        userFullName = currentUser.displayName;
        userRole = isDeveloper ? 'developer' : role;
        userIsModerator = isModerator;
        
        if (role === 'teacher' && !isDeveloper) {
            document.getElementById('subjectModal').style.display = 'flex';
            renderSubjectCheckboxes();
        } else {
            window.location.reload();
        }
    } catch (error) {
        console.error('Ошибка при выборе роли:', error);
        alert('Ошибка при регистрации. Попробуйте еще раз.');
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
                    <button class="login-big-btn" onclick="showLoginModal()">
                        🔑 Войти
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
                    <div class="constructor-buttons">
                        <button class="add-quiz-btn" onclick="toggleForm()">➕ По ссылке</button>
                        <button class="add-quiz-btn" onclick="showConstructor()">🛠️ Конструктор</button>
                    </div>
                ` : ''}
            </div>

            <div id="quizForm" class="quiz-form"></div>

            <div id="quizzesList" class="quiz-grid"></div>
        </div>

        ${userRole === 'teacher' || userRole === 'developer' || userIsModerator ? `
            <div class="my-quizzes-section">
                <h2 class="section-title">📋 Мои проведенные</h2>
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
                countAllEl.textContent = `${Object.values(quizzes).length} викторин`;
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
            container.innerHTML = '<div class="empty-message">Нет викторин</div>';
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
                
                if (q.type === 'kahoot' && q.link && q.link.includes('ilyasigma111.github.io')) {
                    if (!teacherLink.endsWith('/teacher.html') && !teacherLink.endsWith('/student.html')) {
                        teacherLink = teacherLink.replace(/\/?$/, '') + '/teacher.html';
                        studentLink = studentLink.replace(/\/?$/, '') + '/student.html';
                    }
                }
                
                let badgeClass = 'badge-simple';
                let badgeText = '📝 Простая';
                
                if (q.type === 'kahoot') {
                    badgeClass = 'badge-kahoot';
                    badgeText = '🎮 Kahoot';
                } else if (q.type === 'constructed') {
                    badgeClass = 'badge-constructed';
                    badgeText = '🛠️ Конструктор';
                }
                
                html += `
                    <div class="quiz-card">
                        <div class="quiz-header">
                            <span class="quiz-badge ${badgeClass}">${badgeText}</span>
                            ${userRole === 'teacher' || userRole === 'developer' || userIsModerator ? `
                                <button class="delete-btn" onclick="deleteQuiz('${key}')">🗑️</button>
                            ` : ''}
                        </div>
                        <div class="quiz-class">${q.class} класс</div>
                        <div class="quiz-title">${q.title}</div>
                        <div class="quiz-subject">${q.subject}</div>
                        ${q.type === 'constructed' ? `<div class="quiz-maxscore">Вопросов: ${q.questionCount}</div>` : ''}
                        ${q.type === 'kahoot' ? `<div class="quiz-maxscore">Макс: ${q.maxScore}</div>` : ''}
                        
                        <div class="quiz-actions">
                            ${userRole === 'teacher' || userRole === 'developer' || userIsModerator ? `
                                ${q.type === 'kahoot' ? 
                                    `<button class="btn btn-teacher" onclick="startQuiz('${key}', '${teacherLink}', '${q.subject}', '${q.title}', ${q.maxScore})">▶️ Запустить</button>` :
                                    q.type === 'constructed' ?
                                    `<button class="btn btn-teacher" onclick="startConstructedQuiz('${key}')">▶️ Провести</button>` :
                                    `<a href="${q.link}" target="_blank" class="btn btn-external">🌐 Перейти</a>`
                                }
                            ` : `
                                ${q.type === 'kahoot' ? 
                                    `<button class="btn btn-student" onclick="joinQuiz('${key}', '${studentLink}', '${q.subject}', '${q.title}', ${q.maxScore})">🎮 Играть</button>` :
                                    q.type === 'constructed' ?
                                    `<button class="btn btn-student" onclick="joinConstructedQuiz('${key}')">🛠️ Играть</button>` :
                                    `<a href="${q.link}" target="_blank" class="btn btn-external">🌐 Перейти</a>`
                                }
                            `}
                        </div>
                    </div>
                `;
            }
            
            container.innerHTML = html || '<div class="empty-message">Нет викторин</div>';
        };
        
        processQuizzes();
    });
}

// Запуск конструкторской викторины
async function startConstructedQuiz(quizId) {
    try {
        const teacherName = userFullName || currentUser.displayName || 'Учитель';
        
        // Получаем вопросы
        const questionsSnap = await db.ref(`questions/${quizId}`).once('value');
        const questions = questionsSnap.val();
        
        if (!questions) {
            alert('Ошибка: вопросы не найдены');
            return;
        }
        
        const sessionRef = db.ref('sessions').push();
        const sessionId = sessionRef.key;
        
        const sessionData = {
            quizId: quizId,
            quizType: 'constructed',
            quizSubject: 'constructed',
            quizTitle: 'constructed',
            maxScore: Object.keys(questions).length,
            teacherId: currentUser.uid,
            teacherName: teacherName,
            status: 'active',
            startedAt: Date.now(),
            students: {}
        };
        
        await sessionRef.set(sessionData);
        
        // Сохраняем в teacherSessions
        await db.ref(`teacherSessions/${currentUser.uid}/${sessionId}`).set({
            quizSubject: 'constructed',
            quizTitle: 'constructed',
            maxScore: Object.keys(questions).length,
            status: 'active',
            startedAt: Date.now(),
            students: {}
        });
        
        // Открываем панель учителя для конструкторской викторины
        window.open(`teacher-constructed.html?session=${sessionId}&quiz=${quizId}`, '_blank');
        
    } catch (error) {
        console.error('Ошибка при запуске:', error);
        alert('Ошибка при запуске викторины');
    }
}

// Присоединение к конструкторской викторине
async function joinConstructedQuiz(quizId) {
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
            name: studentName,
            email: currentUser.email,
            joinedAt: Date.now()
        });
        
        await db.ref(`teacherSessions/${activeSession.teacherId}/${activeSessionId}/students/${currentUser.uid}`).set({
            name: studentName,
            email: currentUser.email
        });
        
        // Открываем страницу ученика для конструкторской викторины
        window.open(`student-constructed.html?session=${activeSessionId}&quiz=${quizId}&student=${currentUser.uid}&name=${encodeURIComponent(studentName)}`, '_blank');
        
    } catch (error) {
        console.error('Ошибка при присоединении:', error);
        alert('Ошибка при присоединении к викторине');
    }
}

async function deleteQuiz(quizId) {
    if (!confirm('Удалить викторину?')) return;
    try {
        await db.ref('quizzes/' + quizId).remove();
        // Также удаляем вопросы, если есть
        await db.ref('questions/' + quizId).remove();
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
    const form = document.getElementById('quizForm');
    form.innerHTML = `
        <h3 style="color: #ffd700; margin-bottom: 20px;">➕ Добавить по ссылке</h3>
        
        <div class="form-group">
            <label>Тип</label>
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
                ${allSubjects.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
        </div>

        <div class="form-group">
            <label>Название</label>
            <input type="text" id="quizTitle" placeholder="Conditionals">
        </div>

        <div class="form-group">
            <label>Описание</label>
            <textarea id="quizDescription" rows="3" placeholder="..."></textarea>
        </div>

        <div class="form-group">
            <label>Ссылка</label>
            <input type="url" id="quizLink" placeholder="https://...">
        </div>

        <div class="form-group" id="maxScoreGroup">
            <label>Макс. балл</label>
            <input type="number" id="quizMaxScore" value="15" min="1">
        </div>

        <button class="submit-quiz" onclick="saveQuiz()">💾 Сохранить</button>
    `;
    form.classList.toggle('visible');
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

        const quizData = {
            type: type,
            class: quizClass,
            subject: subject,
            title: title,
            description: description,
            link: link,
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
        
        const sessionRef = db.ref('sessions').push();
        const sessionId = sessionRef.key;
        
        const sessionData = {
            quizId: quizId,
            quizSubject: subject,
            quizTitle: title,
            maxScore: maxScore || 0,
            teacherId: currentUser.uid,
            teacherName: teacherName,
            status: 'active',
            startedAt: Date.now(),
            students: {}
        };
        
        await sessionRef.set(sessionData);
        await db.ref(`teacherSessions/${currentUser.uid}/${sessionId}`).set({
            quizSubject: subject,
            quizTitle: title,
            maxScore: maxScore || 0,
            status: 'active',
            startedAt: Date.now(),
            students: {}
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
            name: studentName,
            email: currentUser.email,
            joinedAt: Date.now()
        });
        
        await db.ref(`teacherSessions/${activeSession.teacherId}/${activeSessionId}/students/${currentUser.uid}`).set({
            name: studentName,
            email: currentUser.email
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
            container.innerHTML = '<div class="empty-state">Нет проведенных</div>';
            return;
        }

        let html = '<div class="sessions-grid">';
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
                        <div>
                            <div class="session-title">${s.quizSubject} - ${s.quizTitle}</div>
                            <div class="session-meta">
                                <span>📅 ${date}</span>
                                <span>👥 ${studentsCount}</span>
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
                        ${renderStudents(s.students, s.maxScore, id, s.status)}
                        
                        ${s.status === 'active' ? `
                            <button class="finish-quiz-btn" onclick="finishQuiz('${id}')">🏁 Завершить</button>
                        ` : ''}
                        
                        ${s.status === 'finished' ? `
                            <button class="save-scores-btn" onclick="saveScores('${id}')">💾 Сохранить</button>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        if (userRole === 'developer') {
            html += `
                <div class="danger-zone">
                    <h3>⚠️ Опасная зона</h3>
                    <button class="clear-stats-btn" onclick="clearAllStats()">🗑️ ОЧИСТИТЬ ВСЁ</button>
                </div>
            `;
        }
        
        html += '</div>';
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
    } else {
        details.style.display = 'none';
        icon.textContent = '▼';
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
                <div class="student-name">${student.name}</div>
                ${status === 'finished' ? 
                    `<input type="number" class="score-input" id="score-${sessionId}-${id}" 
                            max="${maxScore}" min="0" value="${student.score || 0}">` :
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
                studentId: studentId,
                studentName: session.students[studentId].name,
                quizSubject: session.quizSubject,
                quizTitle: session.quizTitle,
                score: score,
                maxScore: session.maxScore,
                teacherId: currentUser.uid,
                sessionId: sessionId,
                date: Date.now()
            });
            
            await db.ref(`teacherSessions/${currentUser.uid}/${sessionId}/students/${studentId}`).update({ score: score });
            count++;
        }
        
        alert(`✅ Сохранено ${count} результатов`);
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
        
        let count = 0;
        for (const key of Object.keys(results)) {
            await db.ref('results/' + key).remove();
            count++;
        }
        
        alert(`✅ Удалено ${count} результатов`);
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
            container.innerHTML = '<div class="empty-state">Нет результатов</div>';
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
                    <div class="result-score">${r.score}/${r.maxScore}</div>
                    <div class="result-date">${date}</div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    });
}

// ===== TELEGRAM ФУНКЦИИ =====
async function sendTelegramMessage(text, chatId = TELEGRAM_CHAT_ID) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });
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
                if (processedUpdates.has(update.update_id)) continue;
                
                lastUpdateId = update.update_id;
                processedUpdates.add(update.update_id);
                
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

/stats - общая статистика
/teachers - список учителей
/students - список учеников
/moderators - список модераторов
/quizzes - статистика викторин
/results - статистика результатов
/top - топ учеников
/active - активные викторины
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
            }
    }
    
    if (response) {
        await sendTelegramMessage(response, chatId);
    }
}

async function getFullStats() {
    try {
        const [usersSnap, resultsSnap, sessionsSnap, quizzesSnap, simpleUsersSnap] = await Promise.all([
            db.ref('users').once('value'),
            db.ref('results').once('value'),
            db.ref('sessions').once('value'),
            db.ref('quizzes').once('value'),
            db.ref('simple_users').once('value')
        ]);
        
        const googleUsers = usersSnap.val() || {};
        const simpleUsers = simpleUsersSnap.val() || {};
        const results = resultsSnap.val() || {};
        const sessions = sessionsSnap.val() || {};
        const quizzes = quizzesSnap.val() || {};
        
        let developers = 0, moderators = 0, teachers = 0, students = 0;
        
        // Считаем Google пользователей
        Object.values(googleUsers).forEach(u => {
            if (u.role === 'developer') developers++;
            else if (u.isModerator) moderators++;
            else if (u.role === 'teacher') teachers++;
            else if (u.role === 'student') students++;
        });
        
        // Считаем Simple пользователей
        Object.values(simpleUsers).forEach(u => {
            if (u.role === 'developer') developers++;
            else if (u.isModerator) moderators++;
            else if (u.role === 'teacher') teachers++;
            else if (u.role === 'student') students++;
        });
        
        const totalSessions = Object.keys(sessions).length;
        const activeSessions = Object.values(sessions).filter(s => s.status === 'active').length;
        const totalResults = Object.keys(results).length;
        const totalQuizzes = Object.keys(quizzes).length;
        
        let totalScore = 0;
        Object.values(results).forEach(r => totalScore += r.score || 0);
        const avgScore = totalResults > 0 ? (totalScore / totalResults).toFixed(1) : 0;
        
        return `
📊 <b>ПОЛНАЯ СТАТИСТИКА</b>

👥 <b>Пользователи:</b>
• Разработчиков: ${developers}
• Модераторов: ${moderators}
• Учителей: ${teachers}
• Учеников: ${students}
• Всего: ${developers + moderators + teachers + students}

📚 <b>Викторины:</b>
• Всего: ${totalQuizzes}
• Проведено: ${totalSessions}
• Активных: ${activeSessions}

📝 <b>Результаты:</b>
• Всего: ${totalResults}
• Средний балл: ${avgScore}
• Сумма баллов: ${totalScore}
        `;
    } catch (error) {
        return '❌ Ошибка получения статистики';
    }
}

async function getModeratorsList() {
    const [googleSnap, simpleSnap] = await Promise.all([
        db.ref('users').once('value'),
        db.ref('simple_users').once('value')
    ]);
    
    const googleUsers = googleSnap.val() || {};
    const simpleUsers = simpleSnap.val() || {};
    
    let moderators = [];
    
    Object.values(googleUsers).forEach(u => {
        if (u.isModerator) {
            moderators.push(`🛡️ ${cleanDisplayName(u.fullName || u.googleName)} (Google)`);
        }
    });
    
    Object.values(simpleUsers).forEach(u => {
        if (u.isModerator) {
            moderators.push(`🛡️ ${u.username}`);
        }
    });
    
    return moderators.length > 0 
        ? `🛡️ <b>Модераторы (${moderators.length}):</b>\n\n${moderators.join('\n')}`
        : '🛡️ Модераторов пока нет';
}

async function getTeachersList() {
    const [googleSnap, simpleSnap] = await Promise.all([
        db.ref('users').once('value'),
        db.ref('simple_users').once('value')
    ]);
    
    const googleUsers = googleSnap.val() || {};
    const simpleUsers = simpleSnap.val() || {};
    
    let teachers = [];
    
    Object.values(googleUsers).forEach(u => {
        if (u.role === 'teacher' && !u.isModerator) {
            teachers.push(`• ${cleanDisplayName(u.fullName || u.googleName)}`);
        }
    });
    
    Object.values(simpleUsers).forEach(u => {
        if (u.role === 'teacher' && !u.isModerator) {
            teachers.push(`• ${u.username}`);
        }
    });
    
    return teachers.length > 0 
        ? `👨‍🏫 <b>Учителя (${teachers.length}):</b>\n\n${teachers.join('\n')}`
        : '👨‍🏫 Учителей пока нет';
}

async function getStudentsList() {
    const [googleSnap, simpleSnap] = await Promise.all([
        db.ref('users').once('value'),
        db.ref('simple_users').once('value')
    ]);
    
    const googleUsers = googleSnap.val() || {};
    const simpleUsers = simpleSnap.val() || {};
    
    let students = [];
    
    Object.values(googleUsers).forEach(u => {
        if (u.role === 'student' && !u.isModerator) {
            students.push(`• ${cleanDisplayName(u.fullName || u.googleName)}`);
        }
    });
    
    Object.values(simpleUsers).forEach(u => {
        if (u.role === 'student' && !u.isModerator) {
            students.push(`• ${u.username}`);
        }
    });
    
    return students.length > 0 
        ? `👨‍🎓 <b>Ученики (${students.length}):</b>\n\n${students.join('\n')}`
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
        .map(([s, c]) => `• ${s}: ${c}`)
        .join('\n');
    
    return `
📚 <b>Викторины:</b>
• Всего: ${Object.keys(quizzes).length}

<b>По предметам:</b>
${subjects}
    `;
}

async function getResultsStats() {
    const resultsSnap = await db.ref('results').once('value');
    const results = resultsSnap.val() || {};
    
    let totalScore = 0;
    Object.values(results).forEach(r => totalScore += r.score || 0);
    
    return `
📝 <b>Результаты:</b>
• Всего: ${Object.keys(results).length}
• Сумма баллов: ${totalScore}
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
        .map(([name, data]) => ({ 
            name: cleanDisplayName(name), 
            total: data.total 
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((s, i) => `${i+1}. ${s.name} — ${s.total} баллов`)
        .join('\n');
    
    return `🏆 <b>Топ учеников:</b>\n\n${top || 'Нет данных'}`;
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
        ? `🟢 <b>Активные (${active.length}):</b>\n\n${active.join('\n\n')}`
        : '🟢 Активных викторин нет';
}

// ===== ЗАПУСК БОТА =====
setTimeout(() => {
    if (!botStarted) {
        botStarted = true;
        getTelegramUpdates();
    }
}, 3000);

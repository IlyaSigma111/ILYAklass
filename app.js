// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
// Убираем повторные объявления, оставляем только те, что не объявлены в firebase.js

// Базовый список предметов
const baseSubjects = [
    'Русский язык', 'Алгебра', 'Геометрия', 'Математика', 
    'Химия', 'Физика', 'Литература', 'Английский язык', 
    'История', 'Физкультура'
];

// ===== АВТОРИЗАЦИЯ =====
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        
        // Загружаем все предметы из БД
        await loadAllSubjects();
        
        const userRef = db.ref('users/' + user.uid);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (userData && userData.role) {
            userRole = userData.role;
            userFullName = userData.fullName || user.displayName;
            
            if (userRole === 'teacher' && userData.subjects) {
                teacherSubjects = userData.subjects;
            } else if (userRole === 'teacher') {
                teacherSubjects = [...allSubjects];
            }
            
            document.getElementById('roleModal').style.display = 'none';
            updateUI();
            
            // Загружаем сохраненный выбранный предмет из localStorage
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
        teacherSubjects = [];
        updateUI();
        loadContent();
    }
});

// Загрузка всех предметов из БД
async function loadAllSubjects() {
    const subjectsSnap = await db.ref('subjects').once('value');
    const subjects = subjectsSnap.val();
    if (subjects) {
        allSubjects = Object.values(subjects);
    } else {
        allSubjects = [...baseSubjects];
    }
}

// Добавление нового предмета
async function addNewSubject() {
    const newSubject = document.getElementById('newSubjectInput').value.trim();
    if (!newSubject) {
        alert('Введите название предмета');
        return;
    }
    
    // Форматируем с заглавной буквы
    const formattedSubject = newSubject.charAt(0).toUpperCase() + newSubject.slice(1);
    
    if (allSubjects.includes(formattedSubject)) {
        alert('Такой предмет уже существует');
        return;
    }
    
    await db.ref('subjects').push(formattedSubject);
    allSubjects.push(formattedSubject);
    renderSubjectCheckboxes();
    
    document.getElementById('newSubjectInput').value = '';
}

// Отрисовка чекбоксов предметов
function renderSubjectCheckboxes() {
    const container = document.getElementById('subjectsCheckboxList');
    if (!container) return;
    
    let html = '';
    allSubjects.forEach(subject => {
        html += `
            <label class="subject-checkbox">
                <input type="checkbox" value="${subject}" ${teacherSubjects.includes(subject) ? 'checked' : ''}>
                ${subject}
            </label>
        `;
    });
    container.innerHTML = html;
}

function signIn() {
    auth.signInWithPopup(provider);
}

function signOut() {
    auth.signOut();
}

async function selectRole(role) {
    if (!currentUser) return;
    
    const userData = {
        email: currentUser.email,
        googleName: currentUser.displayName,
        avatar: currentUser.photoURL,
        role: role,
        fullName: currentUser.displayName,
        registeredAt: Date.now()
    };
    
    await db.ref('users/' + currentUser.uid).set(userData);
    
    document.getElementById('roleModal').style.display = 'none';
    userFullName = currentUser.displayName;
    userRole = role;
    
    if (role === 'teacher') {
        // Показываем окно выбора предметов
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
        userSection.innerHTML = `
            <div class="user-card">
                <img src="${currentUser.photoURL}" class="avatar">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 600;">${userFullName || currentUser.displayName}</span>
                    <span style="font-size: 12px; color: #4CAF50;">${userRole === 'teacher' ? 'Учитель' : 'Ученик'}</span>
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

    // Формируем список предметов для отображения
    let subjectsToShow = [];
    
    if (userRole === 'teacher') {
        // Для учителя показываем только его предметы
        subjectsToShow = teacherSubjects.filter(s => allSubjects.includes(s));
    } else {
        // Для ученика показываем все предметы
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
                ${userRole === 'teacher' ? `
                    <button class="add-quiz-btn" onclick="toggleForm()">➕ Добавить викторину</button>
                ` : ''}
            </div>

            <div id="quizForm" class="quiz-form">
                <h3 style="color: #4CAF50; margin-bottom: 30px; font-size: 28px;">Новая викторина</h3>
                
                <div class="form-group">
                    <label>Тип викторины</label>
                    <div class="radio-group" id="quizTypeGroup">
                        <div class="radio-option selected" onclick="selectQuizType('kahoot')" id="type-kahoot">
                            <input type="radio" name="quizType" value="kahoot" checked> 🎮 Kahoot (с учениками)
                        </div>
                        <div class="radio-option" onclick="selectQuizType('simple')" id="type-simple">
                            <input type="radio" name="quizType" value="simple"> 📝 Простая ссылка (без учеников)
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
                    <label>Название викторины</label>
                    <input type="text" id="quizTitle" placeholder="Например: Conditionals, Past Simple...">
                </div>

                <div class="form-group">
                    <label>Описание (необязательно)</label>
                    <textarea id="quizDescription" rows="3" placeholder="Краткое описание викторины..."></textarea>
                </div>

                <div class="form-group">
                    <label>Ссылка</label>
                    <input type="url" id="quizLink" placeholder="https://example.com/quiz">
                    <small style="color: #666; display: block; margin-top: 5px;">Вставьте полную ссылку на викторину</small>
                </div>

                <div class="form-group" id="maxScoreGroup">
                    <label>Максимальный балл (для Kahoot)</label>
                    <input type="number" id="quizMaxScore" placeholder="15" value="15">
                </div>

                <button class="submit-quiz" onclick="saveQuiz()">💾 Сохранить викторину</button>
            </div>

            <div id="quizzesList" class="quiz-grid"></div>
        </div>

        ${userRole === 'teacher' ? `
            <div class="my-quizzes-section">
                <h2 class="section-title">📋 Мои проведенные викторины</h2>
                <div id="myQuizzesList"></div>
            </div>
        ` : `
            <div class="my-quizzes-section">
                <h2 class="section-title">📊 Мои результаты</h2>
                <div id="myResults"></div>
            </div>
        `}
    `;

    loadAllQuizzes();
    if (userRole === 'teacher') {
        loadTeacherSessions();
    } else {
        loadStudentResults();
    }
    
    // Проверяем, нужно ли открыть форму (из hash)
    if (window.location.hash === '#addQuiz') {
        setTimeout(() => {
            document.getElementById('quizForm').classList.add('visible');
        }, 500);
    }
}

function selectSubject(subject) {
    selectedSubject = subject;
    
    // Сохраняем выбранный предмет в localStorage
    localStorage.setItem('selectedSubject_' + currentUser.uid, subject);
    
    // Подсвечиваем выбранный предмет
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
        
        // Обновляем счетчики для всех предметов
        allSubjects.forEach(s => {
            const countEl = document.getElementById(`count-${s.replace(/\s/g, '')}`);
            if (countEl) {
                countEl.textContent = `${counts[s] || 0} викторин`;
            }
        });
        
        // Счетчик для "Все предметы" (только для учеников)
        if (userRole === 'student') {
            const countAllEl = document.getElementById('count-all');
            if (countAllEl) {
                const total = Object.values(quizzes).length;
                countAllEl.textContent = `${total} викторин`;
            }
        }
        
        // После обновления счетчиков, загружаем викторины для выбранного предмета
        loadQuizzesBySubject(selectedSubject);
    });
}

function loadQuizzesBySubject(subject) {
    let query = db.ref('quizzes');
    
    // Фильтруем по предмету если нужно
    if (subject !== 'all') {
        query = query.orderByChild('subject').equalTo(subject);
    }
    
    query.on('value', (snapshot) => {
        const quizzes = snapshot.val();
        const container = document.getElementById('quizzesList');
        if (!container) return;
        
        if (!quizzes) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">В этом разделе пока нет викторин</p>';
            return;
        }

        let html = '';
        const quizzesArray = Object.entries(quizzes);
        
        // Для учителя дополнительно фильтруем по его предметам
        let filteredQuizzes = quizzesArray;
        if (userRole === 'teacher' && teacherSubjects.length > 0 && subject === 'all') {
            filteredQuizzes = quizzesArray.filter(([_, q]) => teacherSubjects.includes(q.subject));
        }
        
        // Обрабатываем каждую викторину
        const processQuizzes = async () => {
            for (const [key, q] of filteredQuizzes) {
                // Для учеников проверяем активность Kahoot
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
                
                // Формируем правильные ссылки для Kahoot
                let teacherLink = q.link;
                let studentLink = q.link;
                
                if (q.type === 'kahoot' && q.link.includes('ilyasigma111.github.io')) {
                    // Добавляем /teacher.html и /student.html если их нет
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
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <span class="quiz-badge ${q.type === 'kahoot' ? 'badge-kahoot' : 'badge-simple'}">
                                ${q.type === 'kahoot' ? '🎮 Kahoot' : '📝 Простая'}
                            </span>
                            ${userRole === 'teacher' ? `
                                <button class="delete-btn" onclick="deleteQuiz('${key}')" title="Удалить викторину">🗑️</button>
                            ` : ''}
                        </div>
                        <div class="quiz-class">${q.class} класс</div>
                        <div class="quiz-title">${q.title}</div>
                        <div class="quiz-subject">${q.subject}</div>
                        ${q.description ? `<p style="color: #666; margin-bottom: 15px;">${q.description}</p>` : ''}
                        <div class="quiz-link">🔗 ${q.link}</div>
                        ${q.type === 'kahoot' ? `<div style="color: #4CAF50; margin: 10px 0;">Макс. балл: ${q.maxScore}</div>` : ''}
                        
                        <div class="quiz-actions">
                            ${userRole === 'teacher' ? `
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
            
            container.innerHTML = html || '<p style="text-align: center; color: #666; padding: 40px;">В этом разделе пока нет викторин</p>';
        };
        
        processQuizzes();
    });
}

// Удаление викторины
async function deleteQuiz(quizId) {
    if (!confirm('Вы уверены, что хотите удалить эту викторину?')) return;
    
    try {
        await db.ref('quizzes/' + quizId).remove();
        alert('Викторина удалена');
    } catch (error) {
        console.error('Ошибка при удалении:', error);
        alert('Ошибка при удалении викторины');
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
    if (form) form.classList.toggle('visible');
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

        // Для Kahoot проверяем и исправляем ссылку
        if (type === 'kahoot' && link.includes('ilyasigma111.github.io')) {
            // Убираем слеш в конце если есть
            link = link.replace(/\/$/, '');
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

        if (type === 'kahoot') {
            quizData.maxScore = maxScore;
        }

        await db.ref('quizzes').push(quizData);
        
        // Очищаем форму
        document.getElementById('quizTitle').value = '';
        document.getElementById('quizDescription').value = '';
        document.getElementById('quizLink').value = '';
        document.getElementById('quizMaxScore').value = '15';
        
        document.getElementById('quizForm').classList.remove('visible');
        
        alert('Викторина успешно добавлена!');
        
    } catch (error) {
        console.error('Ошибка при сохранении:', error);
        alert('Ошибка при сохранении викторины');
    }
}

// Учитель запускает Kahoot викторину
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
            quizId: quizId,
            quizFolder: folder,
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
        console.error('Ошибка при запуске:', error);
        alert('Ошибка при запуске викторины');
    }
}

// Ученик присоединяется к Kahoot
async function joinQuiz(quizId, link, subject, title, maxScore) {
    try {
        const studentName = userFullName || currentUser.displayName || 'Ученик';
        
        if (!studentName) {
            alert('Ошибка: не удалось определить имя');
            return;
        }
        
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
            alert('Сейчас нет активной викторины');
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
        
        // Добавляем параметры к ссылке
        let url;
        try {
            url = new URL(link);
            url.searchParams.append('session', activeSessionId);
            url.searchParams.append('student', currentUser.uid);
            url.searchParams.append('name', studentName);
            window.open(url.toString(), '_blank');
        } catch (e) {
            // Если ссылка относительная
            const separator = link.includes('?') ? '&' : '?';
            window.open(link + separator + `session=${activeSessionId}&student=${currentUser.uid}&name=${encodeURIComponent(studentName)}`, '_blank');
        }
        
    } catch (error) {
        console.error('Ошибка при присоединении:', error);
        alert('Ошибка при присоединении к викторине');
    }
}

// ===== ИСПРАВЛЕННАЯ ФУНКЦИЯ С КНОПКОЙ ОЧИСТКИ =====
function loadTeacherSessions() {
    db.ref(`teacherSessions/${currentUser.uid}`).on('value', (snapshot) => {
        const sessions = snapshot.val();
        const container = document.getElementById('myQuizzesList');
        if (!container) return;
        
        if (!sessions) {
            container.innerHTML = '<p style="color: #666; text-align: center;">Нет проведенных викторин</p>';
            return;
        }

        let html = '';
        const sortedIds = Object.keys(sessions).sort((a, b) => {
            return (sessions[b].startedAt || 0) - (sessions[a].startedAt || 0);
        });
        
        sortedIds.forEach(id => {
            const s = sessions[id];
            const date = s.startedAt ? new Date(s.startedAt).toLocaleString() : 'Дата неизвестна';
            
            html += `
                <div class="session-card">
                    <div class="session-header">
                        <div>
                            <strong style="color: #4CAF50; font-size: 20px;">${s.quizSubject} - ${s.quizTitle}</strong>
                            <div style="color: #666; margin-top: 5px;">${date}</div>
                        </div>
                        <span class="session-status ${s.status === 'active' ? 'status-active' : 'status-finished'}">
                            ${s.status === 'active' ? '🟢 Активна' : '🔵 Завершена'}
                        </span>
                    </div>
                    
                    <div class="students-list" id="students-${id}">
                        ${renderStudents(s.students, s.maxScore, id, s.status)}
                    </div>
                    
                    ${s.status === 'active' ? `
                        <button class="finish-quiz-btn" onclick="finishQuiz('${id}')">
                            🏁 Завершить викторину
                        </button>
                    ` : ''}
                    
                    ${s.status === 'finished' ? `
                        <button class="save-scores-btn" onclick="saveScores('${id}')">
                            💾 Сохранить результаты
                        </button>
                    ` : ''}
                </div>
            `;
        });
        
        // Добавляем кнопку очистки статистики
        html += `
            <div class="danger-zone">
                <h3>⚠️ Опасная зона</h3>
                <button class="clear-stats-btn" onclick="clearAllStats()">
                    🗑️ ОЧИСТИТЬ ВСЮ СТАТИСТИКУ
                </button>
                <p>Это удалит все результаты всех учеников навсегда!</p>
            </div>
        `;
        
        container.innerHTML = html;
    });
}

function renderStudents(students, maxScore, sessionId, status) {
    if (!students || Object.keys(students).length === 0) {
        return '<p style="color: #666;">Пока нет учеников</p>';
    }
    
    let html = '';
    Object.keys(students).forEach(id => {
        const student = students[id];
        html += `
            <div class="student-item">
                <span style="font-weight: 500;">${student.name || 'Без имени'}</span>
                ${status === 'finished' ? 
                    `<input type="number" class="score-input" id="score-${sessionId}-${id}" 
                            max="${maxScore || 100}" min="0" 
                            placeholder="0-${maxScore || 100}" value="0">` :
                    '<span style="color: #4CAF50;">✓ Присоединился</span>'
                }
            </div>
        `;
    });
    return html;
}

async function finishQuiz(sessionId) {
    try {
        await db.ref(`sessions/${sessionId}`).update({ status: 'finished' });
        await db.ref(`teacherSessions/${currentUser.uid}/${sessionId}`).update({ status: 'finished' });
    } catch (error) {
        console.error('Ошибка при завершении:', error);
        alert('Ошибка при завершении викторины');
    }
}

async function saveScores(sessionId) {
    try {
        const sessionSnap = await db.ref(`sessions/${sessionId}`).once('value');
        const session = sessionSnap.val();
        
        if (!session || !session.students) {
            alert('Нет учеников в этой викторине');
            return;
        }
        
        let count = 0;
        for (const studentId of Object.keys(session.students)) {
            const input = document.getElementById(`score-${sessionId}-${studentId}`);
            if (!input) continue;
            
            const score = parseInt(input.value);
            if (isNaN(score)) continue;
            
            await db.ref('results').push({
                studentId: studentId,
                studentName: session.students[studentId].name || 'Без имени',
                quizSubject: session.quizSubject || 'Без названия',
                quizTitle: session.quizTitle || 'Без темы',
                score: score,
                maxScore: session.maxScore || 0,
                teacherId: currentUser.uid,
                date: Date.now()
            });
            count++;
        }
        
        alert(`✅ Сохранено ${count} результатов!`);
        
    } catch (error) {
        console.error('Ошибка при сохранении:', error);
        alert('Ошибка при сохранении результатов');
    }
}

// ===== НОВАЯ ФУНКЦИЯ ДЛЯ ОЧИСТКИ СТАТИСТИКИ =====
async function clearAllStats() {
    if (!confirm('⚠️ ВНИМАНИЕ! Вы уверены, что хотите удалить ВСЕ результаты? Это действие нельзя отменить!')) return;
    
    const password = prompt('Для подтверждения введите "УДАЛИТЬ ВСЁ" (капсом)');
    if (password !== 'УДАЛИТЬ ВСЁ') {
        alert('Отмена');
        return;
    }
    
    try {
        // Показываем сообщение о начале очистки
        const loadingMsg = document.createElement('div');
        loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 20px; border: 3px solid #f44336; z-index: 9999; box-shadow: 0 10px 40px rgba(0,0,0,0.3); text-align: center;';
        loadingMsg.innerHTML = '<h3 style="color: #f44336; margin-bottom: 15px;">🧹 Очистка...</h3><p>Удаляем все результаты</p><div style="width: 100%; height: 4px; background: #f0f0f0; margin-top: 20px; border-radius: 2px;"><div id="progressBar" style="width: 0%; height: 100%; background: #f44336; border-radius: 2px; transition: width 0.3s;"></div></div>';
        document.body.appendChild(loadingMsg);
        
        // Получаем все результаты
        const resultsSnap = await db.ref('results').once('value');
        const results = resultsSnap.val();
        
        if (!results) {
            alert('Нет результатов для удаления');
            document.body.removeChild(loadingMsg);
            return;
        }
        
        const total = Object.keys(results).length;
        let count = 0;
        
        // Удаляем каждый результат
        for (const key of Object.keys(results)) {
            await db.ref('results/' + key).remove();
            count++;
            
            // Обновляем прогресс
            const progress = (count / total) * 100;
            const progressBar = document.getElementById('progressBar');
            if (progressBar) {
                progressBar.style.width = progress + '%';
            }
            loadingMsg.innerHTML = `<h3 style="color: #f44336; margin-bottom: 15px;">🧹 Очистка...</h3><p>Удалено ${count} из ${total} результатов</p><div style="width: 100%; height: 4px; background: #f0f0f0; margin-top: 20px; border-radius: 2px;"><div style="width: ${progress}%; height: 100%; background: #f44336; border-radius: 2px; transition: width 0.3s;"></div></div>`;
        }
        
        document.body.removeChild(loadingMsg);
        
        alert(`✅ Успешно удалено ${count} результатов!`);
        
        // Перезагружаем страницу
        window.location.reload();
        
    } catch (error) {
        console.error('Ошибка при очистке:', error);
        alert('❌ Ошибка при очистке статистики: ' + error.message);
    }
}

// Результаты ученика
function loadStudentResults() {
    db.ref('results').orderByChild('studentId').equalTo(currentUser.uid).on('value', (snapshot) => {
        const results = snapshot.val();
        const container = document.getElementById('myResults');
        if (!container) return;
        
        if (!results) {
            container.innerHTML = '<p style="color: #666; text-align: center;">У вас пока нет результатов</p>';
            return;
        }

        let html = '<div class="students-list">';
        const sortedIds = Object.keys(results).sort((a, b) => {
            return (results[b].date || 0) - (results[a].date || 0);
        });
        
        sortedIds.forEach(key => {
            const r = results[key];
            const date = r.date ? new Date(r.date).toLocaleString() : 'Дата неизвестна';
            
            html += `
                <div class="student-item">
                    <div>
                        <strong style="color: #4CAF50;">${r.quizSubject} - ${r.quizTitle}</strong>
                        <div style="color: #666; font-size: 14px;">${date}</div>
                    </div>
                    <span class="score-badge">${r.score || 0}/${r.maxScore || 0}</span>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    });
}

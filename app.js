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
            }
            
            document.getElementById('roleModal').style.display = 'none';
            updateUI();
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
    
    // Проверяем, есть ли уже такой предмет
    if (allSubjects.includes(newSubject)) {
        alert('Такой предмет уже существует');
        return;
    }
    
    // Добавляем в БД
    await db.ref('subjects').push(newSubject);
    allSubjects.push(newSubject);
    
    // Обновляем список чекбоксов
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
                <span style="font-weight: 500;">${userFullName || currentUser.displayName}</span>
                <span class="role-badge">${userRole === 'teacher' ? 'Учитель' : 'Ученик'}</span>
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

    content.innerHTML = `
        <div class="subjects-grid" id="subjectsGrid">
            <div class="subject-card ${selectedSubject === 'all' ? 'selected' : ''}" onclick="selectSubject('all')">
                <div class="subject-icon">📚</div>
                <div class="subject-name">Все предметы</div>
                <div class="subject-count" id="count-all">0 викторин</div>
            </div>
            ${allSubjects.map(s => `
                <div class="subject-card" onclick="selectSubject('${s}')" id="subject-${s.replace(/\s/g, '')}">
                    <div class="subject-icon">📖</div>
                    <div class="subject-name">${s}</div>
                    <div class="subject-count" id="count-${s.replace(/\s/g, '')}">0 викторин</div>
                </div>
            `).join('')}
        </div>

        <div class="quizzes-section" id="quizzesSection">
            <div class="section-header">
                <h2 class="section-title" id="selectedSubjectTitle">${selectedSubject === 'all' ? 'Все предметы' : selectedSubject}</h2>
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
}

function selectSubject(subject) {
    selectedSubject = subject;
    
    // Подсвечиваем выбранный предмет
    document.querySelectorAll('.subject-card').forEach(el => el.classList.remove('selected'));
    if (subject === 'all') {
        document.querySelector('.subject-card').classList.add('selected');
    } else {
        document.getElementById(`subject-${subject.replace(/\s/g, '')}`).classList.add('selected');
    }
    
    document.getElementById('selectedSubjectTitle').innerHTML = subject === 'all' ? 'Все предметы' : subject;
    
    loadQuizzesBySubject(subject);
}

function loadAllQuizzes() {
    db.ref('quizzes').on('value', (snapshot) => {
        const quizzes = snapshot.val();
        if (!quizzes) return;
        
        const counts = { all: 0 };
        allSubjects.forEach(s => counts[s] = 0);
        
        Object.values(quizzes).forEach(q => {
            counts.all++;
            if (counts.hasOwnProperty(q.subject)) {
                counts[q.subject]++;
            }
        });
        
        document.getElementById('count-all').textContent = `${counts.all} викторин`;
        allSubjects.forEach(s => {
            const countEl = document.getElementById(`count-${s.replace(/\s/g, '')}`);
            if (countEl) {
                countEl.textContent = `${counts[s]} викторин`;
            }
        });
        
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
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">В этом разделе пока нет викторин</p>';
            return;
        }

        let html = '';
        const quizzesArray = subject === 'all' ? Object.entries(quizzes) : Object.entries(quizzes);
        
        // Фильтруем для учеников - только активные Kahoot
        const promises = [];
        
        quizzesArray.forEach(([key, q]) => {
            if (userRole === 'student' && q.type === 'kahoot') {
                const promise = db.ref('sessions').orderByChild('quizId').equalTo(key).once('value')
                    .then(sessionsSnap => {
                        const sessions = sessionsSnap.val();
                        let isActive = false;
                        if (sessions) {
                            Object.values(sessions).forEach(s => {
                                if (s.status === 'active') isActive = true;
                            });
                        }
                        return isActive ? { key, q } : null;
                    });
                promises.push(promise);
            } else {
                promises.push(Promise.resolve({ key, q }));
            }
        });
        
        Promise.all(promises).then(results => {
            results.forEach(item => {
                if (!item) return;
                const { key, q } = item;
                
                html += `
                    <div class="quiz-card">
                        <span class="quiz-badge ${q.type === 'kahoot' ? 'badge-kahoot' : 'badge-simple'}">
                            ${q.type === 'kahoot' ? '🎮 Kahoot' : '📝 Простая'}
                        </span>
                        <div class="quiz-class">${q.class} класс</div>
                        <div class="quiz-title">${q.title}</div>
                        <div class="quiz-subject">${q.subject}</div>
                        ${q.description ? `<p style="color: #666; margin-bottom: 15px;">${q.description}</p>` : ''}
                        <div class="quiz-link">🔗 ${q.link}</div>
                        ${q.type === 'kahoot' ? `<div style="color: #4CAF50; margin: 10px 0;">Макс. балл: ${q.maxScore}</div>` : ''}
                        
                        <div class="quiz-actions">
                            ${userRole === 'teacher' ? `
                                ${q.type === 'kahoot' ? 
                                    `<button class="btn btn-teacher" onclick="startQuiz('${key}', '${q.link}', '${q.subject}', '${q.title}', ${q.maxScore})">▶️ Запустить</button>` :
                                    `<a href="${q.link}" target="_blank" class="btn btn-external">🌐 Перейти</a>`
                                }
                            ` : `
                                ${q.type === 'kahoot' ? 
                                    `<button class="btn btn-student" onclick="joinQuiz('${key}', '${q.link}', '${q.subject}', '${q.title}', ${q.maxScore})">🎮 Играть</button>` :
                                    `<a href="${q.link}" target="_blank" class="btn btn-external">🌐 Перейти</a>`
                                }
                            `}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html || '<p style="text-align: center; color: #666; padding: 40px;">В этом разделе пока нет викторин</p>';
        });
    });
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
        } catch (e) {
            // Если ссылка относительная
            url = link + (link.includes('?') ? '&' : '?') + 
                  `session=${activeSessionId}&student=${currentUser.uid}&name=${encodeURIComponent(studentName)}`;
        }
        
        window.open(url.toString(), '_blank');
        
    } catch (error) {
        console.error('Ошибка при присоединении:', error);
        alert('Ошибка при присоединении к викторине');
    }
}

// Загрузка сессий учителя
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
                            placeholder="0-${maxScore || 100}">` :
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

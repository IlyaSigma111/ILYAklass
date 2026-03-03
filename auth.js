// ===== СИСТЕМА ВХОДА ПО НИКУ И ПАРОЛЮ =====

// Хеширование пароля (простое, для теста)
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        hash = ((hash << 5) - hash) + password.charCodeAt(i);
        hash = hash & hash;
    }
    return hash.toString(16);
}

// Регистрация нового пользователя
async function registerUser() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regPasswordConfirm').value;
    const role = document.getElementById('regRole').value;

    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }

    if (password !== confirm) {
        alert('Пароли не совпадают');
        return;
    }

    if (password.length < 3) {
        alert('Пароль должен быть минимум 3 символа');
        return;
    }

    try {
        const usersSnap = await db.ref('simple_users').once('value');
        const users = usersSnap.val() || {};
        
        let userExists = false;
        for (const uid in users) {
            if (users[uid].username.toLowerCase() === username.toLowerCase()) {
                userExists = true;
                break;
            }
        }

        if (userExists) {
            alert('Пользователь с таким ником уже существует');
            return;
        }

        const isModerator = /\s*\(\d+\)$/.test(username);
        const isDeveloper = username.toLowerCase() === 'илья' || username.toLowerCase() === 'ilya';
        
        const newUserRef = db.ref('simple_users').push();
        const userId = newUserRef.key;
        
        const userData = {
            username: username,
            password: hashPassword(password),
            role: isDeveloper ? 'developer' : role,
            isModerator: isModerator,
            fullName: username,
            createdAt: Date.now()
        };

        await newUserRef.set(userData);

        localStorage.setItem('currentSimpleUser', JSON.stringify({
            id: userId,
            username: username,
            role: userData.role,
            isModerator: isModerator,
            fullName: username
        }));

        closeRegisterModal();
        window.location.reload();

    } catch (error) {
        console.error('Ошибка регистрации:', error);
        alert('Ошибка при регистрации');
    }
}

// Вход по нику и паролю
async function simpleLogin() {
    const username = document.getElementById('simpleUsername').value.trim();
    const password = document.getElementById('simplePassword').value;

    if (!username || !password) {
        alert('Введите ник и пароль');
        return;
    }

    try {
        const usersSnap = await db.ref('simple_users').once('value');
        const users = usersSnap.val() || {};
        
        let foundUser = null;
        let userId = null;

        for (const uid in users) {
            if (users[uid].username.toLowerCase() === username.toLowerCase()) {
                foundUser = users[uid];
                userId = uid;
                break;
            }
        }

        if (!foundUser) {
            alert('Пользователь не найден');
            return;
        }

        const hashedPassword = hashPassword(password);
        if (foundUser.password !== hashedPassword) {
            alert('Неверный пароль');
            return;
        }

        localStorage.setItem('currentSimpleUser', JSON.stringify({
            id: userId,
            username: foundUser.username,
            role: foundUser.role,
            isModerator: foundUser.isModerator || false,
            fullName: foundUser.fullName || foundUser.username
        }));

        closeLoginModal();
        window.location.reload();

    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Ошибка при входе');
    }
}

// Выход
function simpleLogout() {
    localStorage.removeItem('currentSimpleUser');
    window.location.reload();
}

// Получение текущего пользователя
function getCurrentSimpleUser() {
    const userJson = localStorage.getItem('currentSimpleUser');
    return userJson ? JSON.parse(userJson) : null;
}

// Тестовые аккаунты
async function createTestAccounts() {
    const testAccounts = [
        { username: 'teacher', password: '123', role: 'teacher' },
        { username: 'student', password: '123', role: 'student' },
        { username: 'moderator', password: '123', role: 'student', isModerator: true },
        { username: 'Илья', password: '123', role: 'developer' }
    ];

    for (const acc of testAccounts) {
        const hashedPassword = hashPassword(acc.password);
        const exists = await checkUserExists(acc.username);
        
        if (!exists) {
            await db.ref('simple_users').push({
                username: acc.username,
                password: hashedPassword,
                role: acc.role,
                isModerator: acc.isModerator || false,
                fullName: acc.username,
                createdAt: Date.now()
            });
        }
    }
    console.log('✅ Тестовые аккаунты созданы');
}

// Проверка существования пользователя
async function checkUserExists(username) {
    const usersSnap = await db.ref('simple_users').once('value');
    const users = usersSnap.val() || {};
    
    for (const uid in users) {
        if (users[uid].username.toLowerCase() === username.toLowerCase()) {
            return true;
        }
    }
    return false;
}

// Создаем тестовые аккаунты при первом запуске
setTimeout(() => {
    createTestAccounts();
}, 2000);

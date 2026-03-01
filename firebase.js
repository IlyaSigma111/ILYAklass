// firebase.js - Твой конфиг и общие функции

// Твой Firebase конфиг
const firebaseConfig = {
    apiKey: "AIzaSyA-FGoB1L-euPEfGZvTN0pyfyLGZY4zGyE",
    authDomain: "ilyaklass-b11c0.firebaseapp.com",
    projectId: "ilyaklass-b11c0",
    storageBucket: "ilyaklass-b11c0.firebasestorage.app",
    messagingSenderId: "803990572684",
    appId: "1:803990572684:web:f10f6399a2c0c035e5b5a9",
    databaseURL: "https://ilyaklass-b11c0-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const provider = new firebase.auth.GoogleAuthProvider();

// Глобальные переменные
let currentUser = null;
let userRole = null;
let userSettings = null;

// Проверка авторизации
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        
        // Получаем данные пользователя
        const userRef = db.ref('users/' + user.uid);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (userData && userData.role) {
            userRole = userData.role;
            userSettings = userData.settings || {
                classFilter: 'all',
                subjectFilter: 'all',
                emailNotifications: true,
                darkMode: true
            };
            
            // Обновляем интерфейс на всех страницах
            updateUserInterface();
            
            // Если есть функция загрузки контента на странице
            if (typeof loadPageContent === 'function') {
                loadPageContent();
            }
        } else {
            // Показываем модалку выбора роли
            showRoleModal();
        }
    } else {
        // Не авторизован
        currentUser = null;
        userRole = null;
        userSettings = null;
        updateUserInterface();
    }
});

// Функция входа
function signIn() {
    auth.signInWithPopup(provider);
}

// Функция выхода
function signOut() {
    auth.signOut();
    window.location.href = 'index.html';
}

// Выбор роли
async function selectRole(role) {
    if (!currentUser) return;
    
    await db.ref('users/' + currentUser.uid).set({
        email: currentUser.email,
        name: currentUser.displayName,
        avatar: currentUser.photoURL,
        role: role,
        settings: {
            classFilter: 'all',
            subjectFilter: 'all',
            emailNotifications: true,
            darkMode: true
        },
        registeredAt: firebase.database.ServerValue.TIMESTAMP
    });
    
    document.getElementById('roleModal').style.display = 'none';
    window.location.reload();
}

// Сохранение настроек
async function saveSettings(settings) {
    if (!currentUser) return;
    await db.ref('users/' + currentUser.uid + '/settings').update(settings);
    userSettings = settings;
}

// Обновление интерфейса пользователя (для всех страниц)
function updateUserInterface() {
    const userSection = document.getElementById('userSection');
    if (!userSection) return;
    
    if (currentUser) {
        userSection.innerHTML = `
            <div class="user-card">
                <img src="${currentUser.photoURL}" class="avatar">
                <span>${currentUser.displayName}</span>
                <span class="role-badge">${userRole === 'teacher' ? '👨‍🏫 Учитель' : '👨‍🎓 Ученик'}</span>
                <button onclick="signOut()" class="logout-btn">Выйти</button>
            </div>
        `;
    } else {
        userSection.innerHTML = `
            <button onclick="signIn()" class="login-btn">Войти через Google</button>
        `;
    }
}

// Показать модалку выбора роли
function showRoleModal() {
    const modal = document.getElementById('roleModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}
